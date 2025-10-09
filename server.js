const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { crawlWebsite } = require('./src/crawler');

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

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
 * Body: { url: string, options?: object }
 */
app.post('/api/analyze', async (req, res) => {
  const { url, clientName, options = {} } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URLが必要です' });
  }

  // ジョブIDを生成
  const jobId = uuidv4();

  // ジョブを登録
  analysisJobs.set(jobId, {
    status: 'pending',
    progress: 0,
    url,
    clientName: clientName || null,
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
  runAnalysis(jobId, url, options, clientName);
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
    return res.status(404).json({ error: 'ジョブが見つかりません' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ error: '診断がまだ完了していません' });
  }

  if (job.error) {
    return res.status(500).json({ error: job.error });
  }

  // PDFファイルを返す
  const pdfPath = path.join(__dirname, 'reports', `${jobId}.pdf`);

  res.download(pdfPath, `llmo-report-${jobId}.pdf`, (err) => {
    if (err) {
      console.error('PDF送信エラー:', err);
      res.status(500).json({ error: 'PDFの送信に失敗しました' });
    }
  });
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
 * 診断を実行する関数
 */
async function runAnalysis(jobId, url, options, clientName) {
  const job = analysisJobs.get(jobId);

  try {
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
    console.log(`[${jobId}] コンテンツ構造分析中`);
    const contentResults = analyzeContent(crawlData);
    job.progress = 40;

    // エンティティ・知識グラフ最適化
    console.log(`[${jobId}] エンティティ分析中`);
    const entityResults = analyzeEntity(crawlData);
    job.progress = 45;

    // E-E-A-T
    console.log(`[${jobId}] E-E-A-T分析中`);
    const eeatResults = analyzeEEAT(crawlData);
    job.progress = 50;

    // 統計データ
    console.log(`[${jobId}] 統計データ分析中`);
    const statisticsResults = analyzeStatistics(crawlData);
    job.progress = 55;

    // 構造化データ
    console.log(`[${jobId}] 構造化データ分析中`);
    const structuredDataResults = analyzeStructuredData(crawlData);
    job.progress = 60;

    // AI引用最適化（LLMO）
    console.log(`[${jobId}] LLMO分析中`);
    const llmoResults = analyzeLLMO(crawlData);
    job.progress = 65;

    // テクニカルSEO
    console.log(`[${jobId}] SEO分析中`);
    const seoResults = analyzeSEO(crawlData);
    job.progress = 70;

    // パフォーマンス
    console.log(`[${jobId}] パフォーマンス分析中`);
    const performanceResults = analyzePerformance(crawlData);
    job.progress = 75;

    // マルチメディア
    console.log(`[${jobId}] マルチメディア分析中`);
    const multimediaResults = analyzeMultimedia(crawlData);
    job.progress = 78;

    // ソーシャルシグナル
    console.log(`[${jobId}] ソーシャルシグナル分析中`);
    const socialResults = analyzeSocial(crawlData);
    job.progress = 80;

    // ローカルSEO
    console.log(`[${jobId}] ローカルSEO分析中`);
    const localSeoResults = analyzeLocalSEO(crawlData);
    job.progress = 82;

    // 分析結果を統合（10カテゴリ）
    const analysisResults = {
      url,
      clientName: clientName || null,
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
      rawData: crawlData,  // クローラーの生データを追加
      analyzedAt: new Date().toISOString()
    };

    // ステップ7: PDF生成
    job.status = 'generating-pdf';
    job.progress = 90;
    console.log(`[${jobId}] PDF生成中`);

    const pdfPath = path.join(__dirname, 'reports', `${jobId}.pdf`);
    await generatePDF(analysisResults, pdfPath);

    job.progress = 100;
    job.status = 'completed';
    job.result = analysisResults;
    job.completedAt = new Date();

    console.log(`[${jobId}] 診断完了`);

  } catch (error) {
    console.error(`[${jobId}] エラー:`, error);
    job.status = 'failed';
    job.error = error.message;
  }
}

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
});
