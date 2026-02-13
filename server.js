require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { crawlWebsite } = require('./src/crawler');
const axios = require('axios'); // Webhook送信用に追加

// Supabaseクライアント初期化（サーバーサイドはSERVICE_ROLE_KEYを使用）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 既存アナライザー
const { analyzeSEO } = require('./src/analyzers/seo');
const { analyzePerformance } = require('./src/analyzers/performance');
const { analyzeContent } = require('./src/analyzers/content');
const { analyzeStructuredData } = require('./src/analyzers/structured-data');
const { analyzeLLMO } = require('./src/analyzers/llmo');

// 新規アナライザー（10カテゴリ対応）
const { analyzeEntity } = require('./src/analyzers/entity');
const { analyzeEEAT } = require('./src/analyzers/eeat');
const { analyzeStatistics } = require('./src/analyzers/statistics');
const { analyzeMultimedia } = require('./src/analyzers/multimedia');
const { analyzeSocial } = require('./src/analyzers/social');
const { analyzeLocalSEO } = require('./src/analyzers/local-seo');

const { generatePDF } = require('./src/pdf-generator');

// 複数ページクロール機能
const { getCandidateUrls } = require('./src/url-selector');
const { crawlMultiplePages } = require('./src/multi-crawler');
const { aggregateResults, calculatePageTotalScore } = require('./src/aggregator');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// APIキー認証ミドルウェア
const apiKeyAuth = (req, res, next) => {
  const serverApiKey = process.env.API_KEY;
  
  // 認証不要なエンドポイント（フロントエンド用や埋め込み用）
  if (
    req.url.includes('/industries') || 
    req.url.includes('/report/') || 
    req.url.includes('/result/')
  ) {
    return next();
  }

  // 環境変数にAPI_KEYが設定されていない場合は認証をスキップ（開発用など）
  if (!serverApiKey) {
    return next();
  }

  const clientApiKey = req.headers['x-api-key'];
  
  if (!clientApiKey || clientApiKey !== serverApiKey) {
    console.warn(`[Auth] 認証失敗: ${req.method} ${req.url} (Client Key: ${clientApiKey ? 'あり' : 'なし'})`);
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  
  next();
};

// /api/ 以下のルートに認証を適用
// 注意: 既存のフロントエンド(public)からのアクセスもAPIキーが必要になります。
// 必要に応じてフロントエンド用に除外設定をするか、フロントエンド側にもAPIキーを持たせてください。
app.use('/api/', apiKeyAuth);

// 診断ジョブの状態管理
const analysisJobs = new Map();

/**
 * ルートエンドポイント
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * 診断開始エンドポイント
 * POST /api/analyze
 * Body: { url: string, companyName?: string, industryName?: string, webhookUrl?: string, options?: object }
 */
app.post('/api/analyze', async (req, res) => {
  const { url, companyName, industryName, webhookUrl, options = {} } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URLが必要です' });
  }

  // ジョブIDを生成
  const jobId = uuidv4();

  // サーバーのベースURLを取得（レポートURL生成用）
  const protocol = req.protocol;
  const host = req.get('host');
  const serverBaseUrl = `${protocol}://${host}`;

  // ジョブを登録
  analysisJobs.set(jobId, {
    status: 'pending',
    progress: 0,
    url,
    companyName: companyName || null,
    industryName: industryName || null,
    webhookUrl: webhookUrl || null,
    serverBaseUrl, // Webhook通知用に保存
    createdAt: new Date(),
    result: null,
    error: null
  });

  // レスポンスを即座に返す
  res.json({
    jobId,
    status: 'pending',
    message: '診断を開始しました'
  });

  // バックグラウンドで診断を実行
  runAnalysis(jobId, url, options, companyName, industryName);
});

/**
 * 診断状態確認エンドポイント
 * GET /api/analyze/:jobId
 */
app.get('/api/analyze/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = analysisJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'ジョブが見つかりません' });
  }

  res.json({
    jobId,
    status: job.status,
    progress: job.progress,
    url: job.url,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    error: job.error
  });
});

/**
 * PDFレポート取得エンドポイント
 * GET /api/report/:jobId
 */
app.get('/api/report/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = analysisJobs.get(jobId);

  if (!job) {
    // メモリにない場合はDBから検索
    try {
      const { data, error } = await supabase
        .from('diagnosis_reports')
        .select('pdf_path')
        .eq('job_id', jobId)
        .single();
      
      if (!error && data && data.pdf_path && data.pdf_path.startsWith('http')) {
        return res.redirect(data.pdf_path);
      }
    } catch (e) {
      console.error('DBからのPDF取得エラー:', e);
    }
    return res.status(404).json({ error: 'ジョブが見つかりません' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ error: '診断がまだ完了していません' });
  }

  if (job.error) {
    return res.status(500).json({ error: job.error });
  }

  // Supabase URLがあればリダイレクト
  if (job.pdfUrl) {
    return res.redirect(job.pdfUrl);
  }

  // なければローカルファイルを返す
  const pdfPath = path.join(__dirname, 'reports', `${jobId}.pdf`);

  if (fs.existsSync(pdfPath)) {
    res.download(pdfPath, `LLMO診断.pdf`);
  } else {
    res.status(404).json({ error: 'PDFファイルが見つかりません' });
  }
});

/**
 * 診断結果取得エンドポイント（JSON）
 * GET /api/result/:jobId
 */
app.get('/api/result/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = analysisJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'ジョブが見つかりません' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ error: '診断がまだ完了していません' });
  }

  res.json({
    jobId,
    url: job.url,
    result: job.result,
    completedAt: job.completedAt
  });
});

/**
 * 総合スコアを計算するヘルパー関数
 */
function calculateTotalScoreFromResults(results) {
  const weights = {
    eeat: 0.20,
    llmo: 0.15,
    structuredData: 0.15,
    content: 0.15,
    entity: 0.10,
    seo: 0.10,
    performance: 0.05,
    statistics: 0.05,
    multimedia: 0.03,
    social: 0.02
  };

  let totalScoreRaw = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (results[key] && typeof results[key].score === 'number') {
      totalScoreRaw += results[key].score * weight;
      totalWeight += weight;
    }
  }

  // 加重平均スコア
  let score = totalWeight > 0 ? (totalScoreRaw / totalWeight) : 0;

  // ローカルビジネスの場合のみ加点評価（ボーナス）
  if (results.localSeo && results.localSeo.isLocalBusiness) {
    const localScore = results.localSeo.score || 0;
    const bonus = (localScore / 100) * 5; // 最大+5点
    score += bonus;
  }

  // 最後に一括で四捨五入し、上限100でキャップ
  return Math.min(100, Math.round(score));
}

/**
 * Webhook通知を送るヘルパー関数
 */
async function sendWebhook(webhookUrl, payload) {
  if (!webhookUrl) return;

  try {
    console.log(`Webhook送信開始: ${webhookUrl}`);
    await axios.post(webhookUrl, payload);
    console.log(`Webhook送信成功`);
  } catch (error) {
    console.error(`Webhook送信エラー: ${error.message}`);
  }
}

/**
 * 比較用の統計データを取得
 */
async function fetchComparisonStats(industryName) {
  try {
    const categories = [
      'content_score', 'entity_score', 'eeat_score', 'statistics_score',
      'structured_data_score', 'llmo_score', 'seo_score', 'performance_score',
      'multimedia_score', 'social_score'
    ];

    // 1. 全業種平均
    const { data: allData, error: allError } = await supabase
      .from('diagnosis_reports')
      .select(categories.join(','))
      .is('deleted_at', null);

    // 2. 同業種平均
    let industryData = [];
    if (industryName) {
      const { data, error } = await supabase
        .from('diagnosis_reports')
        .select(categories.join(','))
        .eq('industry_name', industryName)
        .is('deleted_at', null);
      if (!error) industryData = data;
    }

    const calculateAvg = (arr) => {
      if (!arr || arr.length === 0) return null;
      const sums = {};
      categories.forEach(cat => {
        const validValues = arr.map(item => item[cat]).filter(v => v !== null);
        sums[cat.replace('_score', '')] = validValues.length > 0 
          ? Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length)
          : 50; // データがない場合は中央値をデフォルトに
      });
      return sums;
    };

    return {
      all: calculateAvg(allData) || getDefaultAverages(),
      industry: calculateAvg(industryData)
    };
  } catch (err) {
    console.error('統計データ取得エラー:', err);
    return { all: getDefaultAverages(), industry: null };
  }
}

function getDefaultAverages() {
  return {
    content: 60, entity: 55, eeat: 50, statistics: 45,
    structuredData: 50, llmo: 40, seo: 65, performance: 70,
    multimedia: 50, social: 40
  };
}

/**
 * PDFをSupabase Storageにアップロードするヘルパー関数
 */
async function uploadPdfToSupabase(jobId, localPath) {
  try {
    const fileContent = fs.readFileSync(localPath);
    const fileName = `${jobId}.pdf`;

    // Storageにアップロード（reportsバケットを想定）
    const { data, error } = await supabase.storage
      .from('reports')
      .upload(fileName, fileContent, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) throw error;

    // 公開URLを取得
    const { data: publicUrlData } = supabase.storage
      .from('reports')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`[${jobId}] Supabase Storageアップロードエラー:`, error);
    return null;
  }
}

/**
 * 診断を実行する関数
 */
async function runAnalysis(jobId, url, options, companyName, industryName) {
  const job = analysisJobs.get(jobId);

  try {
    // ... (前のステップは省略)
    // ステップ1: クローリング
    job.status = 'crawling';
    job.progress = 10;
    console.log(`[${jobId}] クローリング開始: ${url}`);

    const crawlData = await crawlWebsite(url, options);

    if (!crawlData.success) {
      throw new Error(crawlData.error || 'クローリングに失敗しました');
    }

    job.progress = 30;

    // ステップ2: 全カテゴリ分析（10カテゴリ対応）
    job.status = 'analyzing';
    job.progress = 35;
    console.log(`[${jobId}] 分析開始`);

    // コンテンツ構造最適化
    const contentResults = analyzeContent(crawlData);
    job.progress = 40;

    // エンティティ・知識グラフ最適化
    const entityResults = analyzeEntity(crawlData);
    job.progress = 45;

    // E-E-A-T
    const eeatResults = analyzeEEAT(crawlData);
    job.progress = 50;

    // 統計データ
    const statisticsResults = analyzeStatistics(crawlData);
    job.progress = 55;

    // 構造化データ
    const structuredDataResults = analyzeStructuredData(crawlData);
    job.progress = 60;

    // AI引用最適化（LLMO）
    const llmoResults = await analyzeLLMO(crawlData);
    job.progress = 65;

    // テクニカルSEO
    const seoResults = analyzeSEO(crawlData);
    job.progress = 70;

    // パフォーマンス
    const performanceResults = analyzePerformance(crawlData);
    job.progress = 75;

    // マルチメディア
    const multimediaResults = analyzeMultimedia(crawlData);
    job.progress = 78;

    // ソーシャルシグナル
    const socialResults = analyzeSocial(crawlData);
    job.progress = 80;

    // ローカルSEO
    const localSeoResults = analyzeLocalSEO(crawlData);
    job.progress = 82;

    // 分析結果を統合
    const analysisResults = {
      url,
      companyName: companyName || null,
      industryName: industryName || null,
      content: contentResults,
      entity: entityResults,
      eeat: eeatResults,
      statistics: statisticsResults,
      structuredData: structuredDataResults,
      llmo: llmoResults,
      seo: seoResults,
      performance: performanceResults,
      multimedia: multimediaResults,
      social: socialResults,
      localSeo: localSeoResults,
      rawData: crawlData,
      analyzedAt: new Date().toISOString()
    };

    const stats = await fetchComparisonStats(industryName);
    analysisResults.comparisonStats = stats;

    const totalScore = calculateTotalScoreFromResults(analysisResults);
    analysisResults.totalScore = totalScore;

    // ステップ7: PDF生成
    job.status = 'generating-pdf';
    job.progress = 90;
    console.log(`[${jobId}] PDF生成中`);

    const pdfPath = path.join(__dirname, 'reports', `${jobId}.pdf`);
    await generatePDF(analysisResults, pdfPath);

    // Supabase Storageへアップロード
    const supabasePdfUrl = await uploadPdfToSupabase(jobId, pdfPath);
    if (supabasePdfUrl) {
      console.log(`[${jobId}] PDFをSupabase Storageにアップロード完了: ${supabasePdfUrl}`);
      job.pdfUrl = supabasePdfUrl;
    }

    job.progress = 100;
    job.status = 'completed';
    job.result = analysisResults;
    job.completedAt = new Date();

    console.log(`[${jobId}] 診断完了`);

    // Supabaseに診断結果を保存
    const { error: dbError } = await supabase
      .from('diagnosis_reports')
      .insert({
        job_id: jobId,
        url,
        company_name: companyName || null,
        industry_name: industryName || null,
        is_multi_page: false,
        crawl_data: crawlData,
        analysis_result: analysisResults,
        total_score: totalScore,
        content_score: contentResults?.score || null,
        entity_score: entityResults?.score || null,
        eeat_score: eeatResults?.score || null,
        statistics_score: statisticsResults?.score || null,
        structured_data_score: structuredDataResults?.score || null,
        llmo_score: llmoResults?.score || null,
        seo_score: seoResults?.score || null,
        performance_score: performanceResults?.score || null,
        multimedia_score: multimediaResults?.score || null,
        social_score: socialResults?.score || null,
        local_seo_score: localSeoResults?.score || null,
        pdf_path: supabasePdfUrl || pdfPath, // ストレージURLを優先保存
        completed_at: new Date().toISOString()
      });

    if (dbError) {
      console.error(`[${jobId}] データベース保存エラー:`, dbError);
    }

    // Webhook通知
    if (job.webhookUrl) {
      const reportUrl = `${job.serverBaseUrl}/api/report/${jobId}`;
      const resultUrl = `${job.serverBaseUrl}/api/result/${jobId}`;
      
      await sendWebhook(job.webhookUrl, {
        jobId,
        status: 'completed',
        url,
        totalScore,
        reportUrl,
        resultUrl,
        completedAt: job.completedAt
      });
    }

  } catch (error) {
    console.error(`[${jobId}] エラー:`, error);
    job.status = 'failed';
    job.error = error.message;

    if (job.webhookUrl) {
      await sendWebhook(job.webhookUrl, {
        jobId,
        status: 'failed',
        url,
        error: error.message
      });
    }
  }
}


/**
 * URL候補取得エンドポイント（複数ページ診断用）
 * POST /api/discover-urls
 */
app.post('/api/discover-urls', async (req, res) => {
  const { url, maxDepth = 2, useSitemap = true, respectRobots = true } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URLが必要です' });
  }

  try {
    const candidatesResult = await getCandidateUrls(url, {
      maxDepth,
      useSitemap,
      respectRobots,
      maxCandidates: 500
    });

    res.json({
      success: true,
      candidates: candidatesResult.candidates,
      totalFound: candidatesResult.totalFound,
      sources: candidatesResult.sources,
      categories: candidatesResult.categories
    });

  } catch (error) {
    console.error('URL候補取得エラー:', error);
    res.status(500).json({
      error: 'URL候補の取得に失敗しました',
      message: error.message
    });
  }
});

/**
 * 複数ページ診断開始エンドポイント
 * POST /api/analyze-multi
 */
app.post('/api/analyze-multi', async (req, res) => {
  const {
    baseUrl,
    selectedUrls = null,
    maxDepth = 2,
    maxPages = 50,
    useSitemap = true,
    respectRobots = true,
    companyName = null,
    industryName = null,
    webhookUrl = null
  } = req.body;

  if (!baseUrl) {
    return res.status(400).json({ error: 'ベースURLが必要です' });
  }

  // ジョブIDを生成
  const jobId = uuidv4();

  // サーバーのベースURLを取得
  const protocol = req.protocol;
  const host = req.get('host');
  const serverBaseUrl = `${protocol}://${host}`;

  // ジョブを登録
  analysisJobs.set(jobId, {
    status: 'pending',
    progress: 0,
    url: baseUrl,
    companyName: companyName || null,
    industryName: industryName || null,
    isMultiPage: true,
    webhookUrl: webhookUrl || null,
    serverBaseUrl,
    createdAt: new Date(),
    result: null,
    error: null,
    currentPage: 0,
    totalPages: maxPages
  });

  // レスポンスを即座に返す
  res.json({
    jobId,
    status: 'pending',
    message: '複数ページ診断を開始しました',
    estimatedTime: `${Math.ceil(maxPages * 0.5)}-${Math.ceil(maxPages * 1)}分`
  });

  // バックグラウンドで複数ページ診断を実行
  runMultiPageAnalysis(jobId, baseUrl, {
    selectedUrls,
    maxDepth,
    maxPages,
    useSitemap,
    respectRobots
  }, companyName, industryName);
});

/**
 * 集計結果取得エンドポイント
 * GET /api/aggregate/:jobId
 */
app.get('/api/aggregate/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = analysisJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'ジョブが見つかりません' });
  }

  if (!job.isMultiPage) {
    return res.status(400).json({ error: 'このジョブは複数ページ診断ではありません' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ error: '診断がまだ完了していません' });
  }

  // ガード追加
  if (!job.multiPageResults) {
    return res.status(500).json({ error: '集計データが見つかりません' });
  }

  // 集計結果を計算
  const aggregated = aggregateResults(job.multiPageResults);

  res.json({
    jobId,
    baseUrl: job.url,
    aggregated,
    completedAt: job.completedAt
  });
});

/**
 * 複数ページ診断を実行する関数
 */
async function runMultiPageAnalysis(jobId, baseUrl, options, companyName, industryName) {
  const job = analysisJobs.get(jobId);

  try {
    // 進捗コールバック
    const progressCallback = (progressInfo) => {
      job.status = progressInfo.stage;
      job.progress = progressInfo.progress;

      if (progressInfo.currentPage) {
        job.currentPage = progressInfo.currentPage;
      }

      if (progressInfo.totalPages) {
        job.totalPages = progressInfo.totalPages;
      }
    };

    // 複数ページクロール実行
    const multiPageResults = await crawlMultiplePages({
      startUrl: baseUrl,
      ...options
    }, progressCallback);

    if (!multiPageResults || !multiPageResults.pages) {
      throw new Error('クロール結果が空です。URLの設定やrobots.txtを確認してください。');
    }

    job.multiPageResults = multiPageResults;

    // 集計結果を計算
    const aggregated = aggregateResults(multiPageResults);

    // 統計データの取得（比較用）
    console.log(`[${jobId}] 比較統計データを取得中`);
    const stats = await fetchComparisonStats(industryName);

    // PDF生成
    job.status = 'generating-pdf';
    job.progress = 90;
    console.log(`[${jobId}] 複数ページPDF生成中`);

    const pdfPath = path.join(__dirname, 'reports', `${jobId}.pdf`);

    // 複数ページ用のレポート生成（集計結果を使用）
    const pdfData = {
      url: baseUrl,
      companyName: companyName || null,
      industryName: industryName || null,
      isMultiPage: true,
      aggregated,
      comparisonStats: stats,
      totalScore: aggregated.overall.averageScore,
      pages: multiPageResults.pages.map(p => ({
        url: p.url,
        totalScore: calculatePageTotalScore(p.analysis),
        ...p.analysis
      })),
      analyzedAt: new Date().toISOString()
    };

    await generatePDF(pdfData, pdfPath);

    // Supabase Storageへアップロード
    const supabasePdfUrl = await uploadPdfToSupabase(jobId, pdfPath);
    if (supabasePdfUrl) {
      console.log(`[${jobId}] 複数ページPDFをSupabase Storageにアップロード完了: ${supabasePdfUrl}`);
      job.pdfUrl = supabasePdfUrl;
    }

    job.progress = 100;
    job.status = 'completed';
    job.result = pdfData;
    job.completedAt = new Date();

    console.log(`[${jobId}] 複数ページ診断完了: ${multiPageResults.summary.totalCrawled}ページ`);

    // データベース保存用にデータを軽量化
    // crawlData内の重いデータ（html, textContentなど）を除外
    const sanitizedMultiPageResults = {
      ...multiPageResults,
      pages: multiPageResults.pages.map(page => {
        if (!page.crawlData) return page;
        
        // crawlDataの軽量なコピーを作成
        const { html, textContent, ...lightCrawlData } = page.crawlData;
        return {
          ...page,
          crawlData: lightCrawlData
        };
      })
    };

    // Supabaseに診断結果を保存
    const { error: dbError } = await supabase
      .from('diagnosis_reports')
      .insert({
        job_id: jobId,
        url: baseUrl,
        company_name: companyName || null,
        industry_name: industryName || null,
        is_multi_page: true,
        crawl_data: sanitizedMultiPageResults,
        analysis_result: pdfData,
        total_score: aggregated?.averageScores?.total || null,
        content_score: aggregated?.averageScores?.content || null,
        entity_score: aggregated?.averageScores?.entity || null,
        eeat_score: aggregated?.averageScores?.eeat || null,
        statistics_score: aggregated?.averageScores?.statistics || null,
        structured_data_score: aggregated?.averageScores?.structuredData || null,
        llmo_score: aggregated?.averageScores?.llmo || null,
        seo_score: aggregated?.averageScores?.seo || null,
        performance_score: aggregated?.averageScores?.performance || null,
        multimedia_score: aggregated?.averageScores?.multimedia || null,
        social_score: aggregated?.averageScores?.social || null,
        local_seo_score: aggregated?.averageScores?.localSeo || null,
        page_count: multiPageResults.summary?.totalCrawled || 1,
        aggregated_result: aggregated,
        pdf_path: supabasePdfUrl || pdfPath,
        completed_at: new Date().toISOString()
      });

    if (dbError) {
      console.error(`[${jobId}] データベース保存エラー:`, dbError);
    } else {
      console.log(`[${jobId}] データベースに保存完了`);
    }

    // Webhook通知
    if (job.webhookUrl) {
      const reportUrl = `${job.serverBaseUrl}/api/report/${jobId}`;
      const aggregateUrl = `${job.serverBaseUrl}/api/aggregate/${jobId}`;
      
      await sendWebhook(job.webhookUrl, {
        jobId,
        status: 'completed',
        url: baseUrl,
        reportUrl,
        aggregateUrl,
        totalScore: aggregated?.averageScores?.total,
        pageCount: multiPageResults.summary?.totalCrawled,
        completedAt: job.completedAt
      });
    }

  } catch (error) {
    console.error(`[${jobId}] 複数ページ診断エラー:`, error);
    job.status = 'failed';
    job.error = error.message;

    // Webhook通知（エラー）
    if (job.webhookUrl) {
      await sendWebhook(job.webhookUrl, {
        jobId,
        status: 'failed',
        url: baseUrl,
        error: error.message
      });
    }
  }
}

/**
 * 診断履歴一覧取得エンドポイント
 * GET /api/history
 */
app.get('/api/history', async (req, res) => {
  const {
    page = 1,
    limit = 20,
    companyName,
    industryName,
    sortBy = 'created_at',
    order = 'desc'
  } = req.query;

  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('diagnosis_reports')
      .select('id, job_id, url, company_name, industry_name, total_score, is_multi_page, page_count, created_at, completed_at', { count: 'exact' })
      .is('deleted_at', null)
      .order(sortBy, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    if (companyName) {
      query = query.ilike('company_name', `%${companyName}%`);
    }

    if (industryName) {
      query = query.eq('industry_name', industryName);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      data: data || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil((count || 0) / parseInt(limit))
    });

  } catch (error) {
    console.error('履歴取得エラー:', error);
    res.status(500).json({ error: '履歴の取得に失敗しました' });
  }
});

/**
 * 診断詳細取得エンドポイント
 * GET /api/history/:id
 */
app.get('/api/history/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('diagnosis_reports')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: '診断結果が見つかりません' });
    }

    res.json(data);

  } catch (error) {
    console.error('診断詳細取得エラー:', error);
    res.status(500).json({ error: '診断詳細の取得に失敗しました' });
  }
});

/**
 * 診断削除エンドポイント（ソフトデリート）
 * DELETE /api/history/:id
 */
app.delete('/api/history/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('diagnosis_reports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({ success: true, message: '診断結果を削除しました' });

  } catch (error) {
    console.error('診断削除エラー:', error);
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

/**
 * 業種マスタ取得エンドポイント
 * GET /api/industries
 */
app.get('/api/industries', async (req, res) => {
  // デフォルトの業種リスト（フォールバック用）
  const defaultIndustries = [
    { id: 1, name: 'IT・ソフトウェア' },
    { id: 2, name: '通信・インフラ' },
    { id: 3, name: '製造（機械・電気）' },
    { id: 4, name: '製造（食品・化学・その他）' },
    { id: 5, name: '建設・土木' },
    { id: 6, name: '不動産・賃貸' },
    { id: 7, name: '小売・EC' },
    { id: 8, name: '卸売・専門商社' },
    { id: 9, name: '金融・証券' },
    { id: 10, name: '保険' },
    { id: 11, name: '医療・病院' },
    { id: 12, name: '介護・福祉' },
    { id: 13, name: '美容・エステ' },
    { id: 14, name: 'ファッション・アパレル' },
    { id: 15, name: '飲食・レストラン' },
    { id: 16, name: '宿泊・ホテル・観光' },
    { id: 17, name: '教育・学習塾' },
    { id: 18, name: 'メディア・新聞・出版' },
    { id: 19, name: '広告・PR' },
    { id: 20, name: 'コンサルティング・士業' },
    { id: 21, name: '人材・採用' },
    { id: 22, name: 'エンターテインメント' },
    { id: 23, name: '公務・公共団体・NPO' },
    { id: 24, name: '物流・運送' },
    { id: 25, name: 'エネルギー・資源' },
    { id: 26, name: '自動車・モビリティ' },
    { id: 27, name: 'その他' }
  ];

  try {
    const { data, error } = await supabase
      .from('industries')
      .select('id, name')
      .order('display_order', { ascending: true });

    if (error) {
      console.warn('Supabaseからの業種取得に失敗しました。デフォルト値を使用します。', error.message);
      return res.json(defaultIndustries);
    }

    if (!data || data.length === 0) {
      console.log('業種データが空です。デフォルト値を使用します。');
      return res.json(defaultIndustries);
    }

    res.json(data);

  } catch (error) {
    console.error('業種マスタ取得エラー（フォールバック使用）:', error);
    // エラー時もデフォルト値を返してアプリが止まらないようにする
    res.json(defaultIndustries);
  }
});

/**
 * 診断履歴CSVエクスポートエンドポイント
 * GET /api/history/export/csv
 */
app.get('/api/history/export/csv', async (req, res) => {
  const { companyName, industryName, sortBy = 'created_at', order = 'desc' } = req.query;

  try {
    let query = supabase
      .from('diagnosis_reports')
      .select('id, job_id, url, company_name, industry_name, total_score, content_score, entity_score, eeat_score, statistics_score, structured_data_score, llmo_score, seo_score, performance_score, multimedia_score, social_score, local_seo_score, is_multi_page, page_count, created_at, completed_at')
      .is('deleted_at', null);

    // フィルター適用
    if (companyName) {
      query = query.ilike('company_name', `%${companyName}%`);
    }
    if (industryName) {
      query = query.eq('industry_name', industryName);
    }

    // ソート適用
    query = query.order(sortBy, { ascending: order === 'asc' });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // CSVヘッダー
    const headers = [
      'ID',
      'ジョブID',
      'URL',
      '会社名',
      '業種',
      '総合スコア',
      'コンテンツ',
      'エンティティ',
      'E-E-A-T',
      '統計',
      '構造化データ',
      'LLMO',
      'SEO',
      'パフォーマンス',
      'マルチメディア',
      'ソーシャル',
      'ローカルSEO',
      '診断タイプ',
      'ページ数',
      '診断開始日時',
      '診断完了日時'
    ];

    // CSVデータ行を生成
    const rows = (data || []).map(row => [
      row.id,
      row.job_id,
      row.url,
      row.company_name || '',
      row.industry_name || '',
      row.total_score ?? '',
      row.content_score ?? '',
      row.entity_score ?? '',
      row.eeat_score ?? '',
      row.statistics_score ?? '',
      row.structured_data_score ?? '',
      row.llmo_score ?? '',
      row.seo_score ?? '',
      row.performance_score ?? '',
      row.multimedia_score ?? '',
      row.social_score ?? '',
      row.local_seo_score ?? '',
      row.is_multi_page ? '複数ページ' : '単一ページ',
      row.page_count ?? 1,
      row.created_at ? new Date(row.created_at).toLocaleString('ja-JP') : '',
      row.completed_at ? new Date(row.completed_at).toLocaleString('ja-JP') : ''
    ]);

    // CSV文字列を生成（BOM付きUTF-8）
    const escapeCSV = (value) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // BOM付きUTF-8でレスポンス
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    // ファイル名に日時を含める
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `diagnosis_history_${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvWithBom);

  } catch (error) {
    console.error('CSVエクスポートエラー:', error);
    res.status(500).json({ error: 'CSVエクスポートに失敗しました', message: error.message });
  }
});

/**
 * 古いジョブの定期的なクリーンアップ（24時間以上古いジョブを削除）
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24時間

  for (const [jobId, job] of analysisJobs.entries()) {
    if (now - job.createdAt.getTime() > maxAge) {
      analysisJobs.delete(jobId);
      console.log(`古いジョブを削除: ${jobId}`);
    }
  }
}, 60 * 60 * 1000); // 1時間ごとに実行

// サーバー起動
app.listen(PORT, () => {
  console.log(`LLMO診断サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`診断を開始するには、POST /api/analyze にURLを送信してください`);
  if (process.env.API_KEY) {
    console.log('API認証: 有効');
  } else {
    console.log('API認証: 無効 (環境変数 API_KEY が未設定)');
  }
});