// グローバル変数
const API_KEY = 'hero_aivo_2025_secret'; // .envで設定したAPI_KEYをここに入力してください
let currentJobId = null;
let pollInterval = null;
let currentHistoryPage = 1;

// APIリクエスト用のヘルパー関数
async function fetchWithAuth(url, options = {}) {
  const headers = {
    ...options.headers,
    'x-api-key': API_KEY
  };
  
  // Content-Typeが指定されていない場合で、bodyがあるときはJSONとみなす（簡易判定）
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(url, { ...options, headers });
}

// DOM要素
const inputSection = document.getElementById('input-section');
const progressSection = document.getElementById('progress-section');
const resultSection = document.getElementById('result-section');
const errorSection = document.getElementById('error-section');
const detailsSection = document.getElementById('details-section');
const historySection = document.getElementById('history-section');
const historyDetailSection = document.getElementById('history-detail-section');

const analyzeForm = document.getElementById('analyze-form');
const urlInput = document.getElementById('url-input');
const advancedOptionsToggle = document.getElementById('advanced-options-toggle');
const advancedOptions = document.getElementById('advanced-options');

const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const statusText = document.getElementById('status-text');

const totalScoreEl = document.getElementById('total-score');
const seoScoreEl = document.getElementById('seo-score');
const performanceScoreEl = document.getElementById('performance-score');
const contentScoreEl = document.getElementById('content-score');
const structuredScoreEl = document.getElementById('structured-score');
const llmoScoreEl = document.getElementById('llmo-score');

const seoBarEl = document.getElementById('seo-bar');
const performanceBarEl = document.getElementById('performance-bar');
const contentBarEl = document.getElementById('content-bar');
const structuredBarEl = document.getElementById('structured-bar');
const llmoBarEl = document.getElementById('llmo-bar');

const downloadPdfBtn = document.getElementById('download-pdf-btn');
const viewDetailsBtn = document.getElementById('view-details-btn');
const newAnalysisBtn = document.getElementById('new-analysis-btn');
const retryBtn = document.getElementById('retry-btn');

const errorMessage = document.getElementById('error-message');
const detailsContent = document.getElementById('details-content');

// イベントリスナー
analyzeForm.addEventListener('submit', handleAnalyzeSubmit);
advancedOptionsToggle.addEventListener('change', toggleAdvancedOptions);
downloadPdfBtn.addEventListener('click', handleDownloadPdf);
viewDetailsBtn.addEventListener('click', handleViewDetails);
newAnalysisBtn.addEventListener('click', handleNewAnalysis);
retryBtn.addEventListener('click', handleRetry);

// 詳細オプションの表示切り替え
function toggleAdvancedOptions() {
  advancedOptions.style.display = advancedOptionsToggle.checked ? 'block' : 'none';
}

// 診断開始
async function handleAnalyzeSubmit(e) {
  e.preventDefault();

  const url = urlInput.value.trim();

  if (!url) {
    alert('URLを入力してください');
    return;
  }

  // タイムアウト値を取得（秒→ミリ秒に変換）
  const timeoutInput = document.getElementById('timeout');
  const timeout = timeoutInput ? parseInt(timeoutInput.value) * 1000 : 30000;

  // 会社名を取得
  const companyNameInput = document.getElementById('company-name');
  const companyName = companyNameInput ? companyNameInput.value.trim() : '';

  // 業種名を取得
  const industryNameInput = document.getElementById('industry-name');
  const industryName = industryNameInput ? industryNameInput.value : '';

  // 診断モードを判定
  const isMultiPage = document.getElementById('mode-multi').checked;

  // セクション切り替え
  hideAllSections();
  progressSection.style.display = 'block';

  // 進捗をリセット
  updateProgress(0, '診断を開始しています...');

  try {
    if (isMultiPage) {
      // 複数ページ診断
      const maxDepth = parseInt(document.getElementById('max-depth').value) || 2;
      const maxPages = parseInt(document.getElementById('max-pages').value) || 50;
      const useSitemap = document.getElementById('use-sitemap').checked;
      const respectRobots = document.getElementById('respect-robots').checked;

      currentJobId = await window.MultiPageAnalysis.startMultiPageAnalysis(url, companyName, industryName, {
        maxDepth,
        maxPages,
        useSitemap,
        respectRobots
      });

      // 複数ページ診断の進捗をポーリング
      const result = await window.MultiPageAnalysis.pollMultiPageProgress(currentJobId);

      if (result.completed) {
        // 複数ページ診断結果を表示
        await window.MultiPageAnalysis.displayMultiPageResults(currentJobId);
      }

    } else {
      // 単一ページ診断
      const response = await fetchWithAuth('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          companyName: companyName || null,
          industryName: industryName || null,
          options: { timeout }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '診断の開始に失敗しました');
      }

      currentJobId = data.jobId;

      // 進捗をポーリング
      startPolling();
    }

  } catch (error) {
    showError(error.message);
  }
}

// 進捗のポーリング開始
function startPolling() {
  pollInterval = setInterval(async () => {
    try {
      const response = await fetchWithAuth(`/api/analyze/${currentJobId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '進捗の取得に失敗しました');
      }

      // 進捗を更新
      updateProgress(data.progress, getStatusMessage(data.status));

      // 完了またはエラーの場合
      if (data.status === 'completed') {
        stopPolling();
        await showResults();
      } else if (data.status === 'failed') {
        stopPolling();
        showError(data.error || '診断に失敗しました');
      }

    } catch (error) {
      stopPolling();
      showError(error.message);
    }
  }, 2000); // 2秒ごとにポーリング
}

// ポーリング停止
function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// 進捗更新
function updateProgress(progress, message) {
  progressFill.style.width = `${progress}%`;
  progressText.textContent = `${progress}%`;
  statusText.textContent = message;
}

// グローバルに公開（multi-page.jsから使用）
window.updateProgress = updateProgress;
window.hideAllSections = hideAllSections;
window.showSection = function(sectionId) {
  hideAllSections();
  const section = document.getElementById(sectionId);
  if (section) section.style.display = 'block';
};
window.createCategorySection = createCategorySection;
window.formatMetricLabel = formatMetricLabel;

// ステータスメッセージ取得
function getStatusMessage(status) {
  const messages = {
    'pending': '準備中...',
    'crawling': 'ウェブサイトをクロール中...',
    'analyzing-seo': 'SEO分析中...',
    'analyzing-performance': 'パフォーマンス分析中...',
    'analyzing-content': 'コンテンツ分析中...',
    'analyzing-structured-data': '構造化データ分析中...',
    'analyzing-llmo': 'LLMO分析中...',
    'generating-pdf': 'PDFレポート生成中...',
    'completed': '診断完了!'
  };

  return messages[status] || '処理中...';
}

// 結果表示
async function showResults() {
  try {
    const response = await fetchWithAuth(`/api/result/${currentJobId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '結果の取得に失敗しました');
    }

    const result = data.result;

    // APIで計算済みのスコアをそのまま使用（PDFとの完全一致を保証）
    const totalScore = result.totalScore || 0;

    // スコア表示
    totalScoreEl.textContent = totalScore;

    const seoPercentage = (result.seo.score / result.seo.maxScore) * 100;
    const performancePercentage = (result.performance.score / result.performance.maxScore) * 100;
    const contentPercentage = (result.content.score / result.content.maxScore) * 100;
    const structuredPercentage = (result.structuredData.score / result.structuredData.maxScore) * 100;
    const llmoPercentage = (result.llmo.score / result.llmo.maxScore) * 100;

    seoScoreEl.textContent = `${result.seo.score}/${result.seo.maxScore}`;
    performanceScoreEl.textContent = `${result.performance.score}/${result.performance.maxScore}`;
    contentScoreEl.textContent = `${result.content.score}/${result.content.maxScore}`;
    structuredScoreEl.textContent = `${result.structuredData.score}/${result.structuredData.maxScore}`;
    llmoScoreEl.textContent = `${result.llmo.score}/${result.llmo.maxScore}`;

    // スコアバー更新
    setTimeout(() => {
      seoBarEl.style.width = `${seoPercentage}%`;
      performanceBarEl.style.width = `${performancePercentage}%`;
      contentBarEl.style.width = `${contentPercentage}%`;
      structuredBarEl.style.width = `${structuredPercentage}%`;
      llmoBarEl.style.width = `${llmoPercentage}%`;
    }, 100);

    // 詳細データを保存
    window.analysisResult = result;

    // セクション切り替え
    hideAllSections();
    resultSection.style.display = 'block';

  } catch (error) {
    showError(error.message);
  }
}

// 詳細表示
function handleViewDetails() {
  if (!window.analysisResult) {
    alert('結果データがありません');
    return;
  }

  const result = window.analysisResult;

  // 複数ページ診断の場合は既に詳細が表示されているのでスクロール
  if (result.isMultiPage) {
    const detailsSection = document.getElementById('details-section');
    if (detailsSection.style.display === 'block') {
      detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      detailsSection.style.display = 'block';
      detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }

  let html = '';

  // ヘッダー
  html += '<div style="margin-bottom: 30px;">';
  html += `<h3>詳細分析レポート - ${result.url}</h3>`;
  html += `<p style="color: #666;">分析日時: ${new Date(result.analyzedAt).toLocaleString('ja-JP')}</p>`;
  html += '</div>';

  // 1. コンテンツ構造最適化
  html += createCategorySection('コンテンツ構造最適化', result.content, [
    { label: 'コンテンツボリューム', key: 'contentVolume', metrics: ['characters', 'words'] },
    { label: '見出し構造', key: 'headingStructure', metrics: ['h1Count', 'h2Count', 'h3Count'] },
    { label: 'H1品質', key: 'h1Quality', metrics: ['count', 'text'] },
    { label: 'H2品質', key: 'h2Quality', metrics: ['count', 'questionCount'] },
    { label: 'FAQ構造', key: 'faqStructure', metrics: ['qaPairCount', 'faqElements'] },
    { label: '内部リンク', key: 'internalLinks', metrics: ['count'] },
    { label: 'リスト構造', key: 'bulletLists', metrics: ['count', 'itemCount'] },
    { label: '表の使用', key: 'tableUsage', metrics: ['count'] }
  ]);

  // 2. エンティティ分析
  html += createCategorySection('エンティティ分析', result.entity, [
    { label: 'Organization Schema', key: 'organizationSchema', metrics: ['implemented', 'hasName', 'hasLogo'] },
    { label: 'Person Schema', key: 'personSchema', metrics: ['implemented', 'personCount'] },
    { label: '@id実装', key: 'idImplementation', metrics: ['totalEntities', 'entitiesWithId', 'rate'] },
    { label: 'sameAs実装', key: 'sameAsImplementation', metrics: ['count', 'authoritativeCount'] },
    { label: 'NAP一貫性', key: 'napConsistency', metrics: ['hasName', 'hasAddress', 'hasPhone'] },
    { label: 'エンティティ関係', key: 'entityRelations', metrics: ['count'] }
  ]);

  // 3. E-E-A-T評価
  html += createCategorySection('E-E-A-T評価', result.eeat, [
    { label: '一次情報', key: 'primaryInformation', metrics: ['keywordCount'] },
    { label: '体験記述', key: 'experienceDescription', metrics: ['count'] },
    { label: '日時明示', key: 'dateSpecification', metrics: ['dateCount', 'hasPublishDate'] },
    { label: '著者資格', key: 'authorCredentials', metrics: ['hasAuthorMeta', 'credentialCount'] },
    { label: '外部引用', key: 'externalCitations', metrics: ['totalExternal', 'authoritativeCount'] },
    { label: '引用明示', key: 'citationClarity', metrics: ['citationCount', 'hasCiteTag'] },
    { label: '連絡先情報', key: 'contactInformation', metrics: ['hasContactPage', 'hasEmail', 'hasPhone'] },
    { label: 'SSL証明書', key: 'sslCertificate', metrics: ['isHttps'] }
  ]);

  // 4. 統計データ・数値情報
  html += createCategorySection('統計データ・数値情報', result.statistics, [
    { label: '数値データ', key: 'numberCount', metrics: ['total', 'unique'] },
    { label: '統計用語', key: 'statisticalPhrases', metrics: ['count', 'uniquePhrases'] },
    { label: 'パーセンテージ', key: 'percentageUsage', metrics: ['count', 'unique'] },
    { label: '比較データ', key: 'comparisonData', metrics: ['hasComparison', 'keywordCount'] },
    { label: '政府データ', key: 'governmentData', metrics: ['count'] },
    { label: '学術論文', key: 'academicPapers', metrics: ['count'] },
    { label: 'グラフ・チャート', key: 'graphsCharts', metrics: ['total'] }
  ]);

  // 5. 構造化データ
  html += createCategorySection('構造化データ', result.structuredData, [
    { label: '実装状況', key: 'implementation', metrics: ['hasData', 'count'] },
    { label: 'スキーマタイプ', key: 'schemaTypes', metrics: ['count'], customValue: result.structuredData.details.schemaTypes.types.join(', ') },
    { label: 'FAQスキーマ', key: 'faq', metrics: ['implemented', 'questionCount'] },
    { label: 'HowToスキーマ', key: 'howTo', metrics: ['implemented', 'stepCount'] },
    { label: 'Articleスキーマ', key: 'article', metrics: ['implemented', 'hasAuthor'] },
    { label: 'Organizationスキーマ', key: 'organization', metrics: ['implemented', 'hasLogo'] },
    { label: 'Breadcrumbスキーマ', key: 'breadcrumb', metrics: ['implemented'] }
  ]);

  // 6. LLMO特化評価
  html += createCategorySection('LLMO特化評価 (AI引用最適化)', result.llmo, [
    { label: 'AI引用適正スコア', key: 'aiCitationScore', metrics: ['overall'] },
    { label: 'llms.txt実装', key: 'llmsTxt', metrics: ['implemented', 'hasH1', 'projectName', 'hasSummary', 'sectionCount'] },
    { label: '定義文（〜とは）', key: 'definitions', metrics: ['count'] },
    { label: 'How-toコンテンツ', key: 'howToContent', metrics: ['count'] },
    { label: 'Why形式', key: 'whyContent', metrics: ['count'] },
    { label: '簡潔な回答', key: 'conciseAnswers', metrics: ['count'] },
    { label: '質問形式', key: 'questionFormat', metrics: ['total', 'rhetorical'] },
    { label: '対話的トーン', key: 'dialogueTone', metrics: ['count'] },
    { label: '段落独立性', key: 'paragraphIndependence', metrics: ['total', 'independent', 'rate'] },
    { label: '公開日', key: 'publishDate', metrics: ['implemented'] },
    { label: '更新日', key: 'updateDate', metrics: ['implemented'] },
    { label: 'コンテンツ鮮度', key: 'freshnessMentions', metrics: ['yearMentions', 'freshnessKeywords'] }
  ]);

  // 7. テクニカルSEO
  html += createCategorySection('テクニカルSEO', result.seo, [
    { label: 'タイトル', key: 'title', metrics: ['length'], customValue: result.seo.details.title.value },
    { label: 'メタディスクリプション', key: 'metaDescription', metrics: ['length'], customValue: result.seo.details.metaDescription.value },
    { label: 'OGPタグ', key: 'ogp', metrics: ['found', 'required'] },
    { label: 'Twitter Card', key: 'twitterCard', metrics: [], customValue: result.seo.details.twitterCard.tags['twitter:card'] },
    { label: 'Canonical URL', key: 'canonical', metrics: [], customValue: result.seo.details.canonical.value },
    { label: 'robots meta', key: 'robotsMeta', metrics: [], customValue: result.seo.details.robotsMeta.value },
    { label: '画像alt属性', key: 'imageAlt', metrics: ['total', 'withAlt', 'rate'] },
    { label: 'H1タグ', key: 'h1', metrics: ['count'] },
    { label: 'モバイル最適化', key: 'mobileOptimization', metrics: ['hasViewport'] }
  ]);

  // 8. パフォーマンス
  html += createCategorySection('パフォーマンス', result.performance, [
    { label: 'ページ読み込み時間', key: 'loadTime', metrics: ['value', 'unit'] },
    { label: 'LCP (Largest Contentful Paint)', key: 'lcp', metrics: ['value', 'unit'] },
    { label: 'CLS (Cumulative Layout Shift)', key: 'cls', metrics: ['value'] },
    { label: 'FID (First Input Delay)', key: 'fid', metrics: ['value', 'unit'] },
    { label: 'サーバーレスポンス時間', key: 'serverResponseTime', metrics: ['value', 'unit'] },
    { label: 'DOM処理時間', key: 'domInteractive', metrics: ['value', 'unit'] },
    { label: '画像最適化', key: 'imageOptimization', metrics: ['total', 'optimized', 'rate'] },
    { label: 'レスポンシブデザイン', key: 'responsiveDesign', metrics: ['hasMediaQuery'] }
  ]);

  // 9. マルチメディア最適化
  html += createCategorySection('マルチメディア最適化', result.multimedia, [
    { label: 'alt属性完全性', key: 'altCompleteness', metrics: ['total', 'withAlt', 'completeness'] },
    { label: 'alt属性品質', key: 'altQuality', metrics: ['descriptive', 'rate'] },
    { label: '次世代画像フォーマット', key: 'modernImageFormats', metrics: ['webp', 'avif', 'rate'] },
    { label: 'レスポンシブ画像', key: 'responsiveImages', metrics: ['total', 'withSrcset', 'rate'] },
    { label: '動画コンテンツ', key: 'videoContent', metrics: ['total', 'videoTags', 'youtubeEmbeds'] },
    { label: 'SVG使用', key: 'svgUsage', metrics: ['total', 'svgElements'] },
    { label: '図解・チャート', key: 'visualContent', metrics: ['count'] }
  ]);

  // 10. ソーシャルシグナル
  html += createCategorySection('ソーシャルシグナル', result.social, [
    { label: '必須OGPタグ', key: 'requiredOGP', metrics: ['completeness'] },
    { label: 'OGP画像品質', key: 'ogImageQuality', metrics: ['hasImage', 'width', 'height', 'optimalSize'] },
    { label: 'Twitter Card', key: 'twitterCard', metrics: ['cardType', 'completeness'] },
    { label: 'Twitter固有タグ', key: 'twitterSpecific', metrics: ['hasSite', 'hasCreator'] },
    { label: 'SNSプロフィール', key: 'socialProfiles', metrics: ['count'] },
    { label: '共有ボタン', key: 'shareButtons', metrics: ['totalButtons', 'majorPlatforms'] },
    { label: 'ロゴ一貫性', key: 'logoConsistency', metrics: ['logoCount', 'consistent'] }
  ]);

  // 11. ローカルSEO（ローカルビジネスの場合のみ表示）
  if (result.localSeo && result.localSeo.isLocalBusiness) {
    html += createCategorySection('ローカルSEO', result.localSeo, [
      { label: 'LocalBusiness Schema', key: 'localBusinessSchema', metrics: ['implemented', 'hasName', 'hasAddress', 'hasTelephone'] },
      { label: 'NAP情報', key: 'napInformation', metrics: ['hasName', 'hasAddress', 'hasPhone'] },
      { label: '営業時間', key: 'openingHours', metrics: ['implemented'], customValue: result.localSeo.details?.openingHours?.data || 'なし' },
      { label: 'Google Maps埋め込み', key: 'mapEmbed', metrics: ['hasMap'] },
      { label: 'Reviewスキーマ', key: 'reviewSchema', metrics: ['implemented', 'count'] },
      { label: '評価表示', key: 'aggregateRating', metrics: ['implemented', 'rating', 'reviewCount'] },
      { label: '地域言及', key: 'regionalMentions', metrics: ['count', 'uniqueKeywords'] },
      { label: 'アクセス情報', key: 'accessInformation', metrics: ['hasAccessSection', 'transportMethods'] }
    ]);
  }

  detailsContent.innerHTML = html;
  detailsSection.style.display = 'block';

  // 詳細セクションまでスクロール
  detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// カテゴリーセクション作成ヘルパー関数
function createCategorySection(title, categoryData, items) {
  const percentage = Math.round((categoryData.score / categoryData.maxScore) * 100);
  const scoreColor = percentage >= 70 ? '#22c55e' : percentage >= 50 ? '#f59e0b' : '#ef4444';

  let html = `
    <div class="detail-category" style="margin-bottom: 30px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background: white;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h4 style="margin: 0; font-size: 20px;">${title}</h4>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px; font-weight: bold; color: ${scoreColor};">${categoryData.score}/${categoryData.maxScore}</span>
          <span style="font-size: 16px; color: #666;">(${percentage}%)</span>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
  `;

  items.forEach(item => {
    const detail = categoryData.details[item.key];
    if (!detail) return;

    const itemScore = detail.score || 0;
    const itemColor = itemScore >= 7 ? '#22c55e' : itemScore >= 4 ? '#f59e0b' : '#ef4444';

    html += `
      <div style="padding: 12px; background: #f9fafb; border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong style="color: #374151;">${item.label}</strong>
          <span style="color: ${itemColor}; font-weight: bold;">${itemScore}点</span>
        </div>
    `;

    // カスタム値がある場合
    if (item.customValue) {
      html += `<p style="margin: 4px 0; color: #6b7280; font-size: 14px;">${item.customValue}</p>`;
    }

    // メトリクスを表示
    if (item.metrics && item.metrics.length > 0) {
      item.metrics.forEach(metric => {
        const value = detail[metric];
        if (value !== undefined && value !== null) {
          const displayValue = typeof value === 'boolean' ? (value ? '○' : '×') :
                              typeof value === 'number' && metric.includes('rate') ? `${value.toFixed(1)}%` :
                              value;
          html += `<p style="margin: 4px 0; color: #6b7280; font-size: 14px;">• ${formatMetricLabel(metric)}: ${displayValue}</p>`;
        }
      });
    }

    // 推奨事項を表示
    if (detail.recommendation) {
      const icon = itemScore >= 7 ? '○' : itemScore >= 4 ? '△' : '×';
      html += `<p style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #4b5563; font-size: 13px;">${icon} ${detail.recommendation}</p>`;
    }

    html += `</div>`;
  });

  html += '</div></div>';
  return html;
}

// メトリクスラベルをフォーマット
function formatMetricLabel(metric) {
  const labels = {
    'characters': '文字数',
    'words': '単語数',
    'h1Count': 'H1数',
    'h2Count': 'H2数',
    'h3Count': 'H3数',
    'count': '数',
    'total': '総数',
    'unique': 'ユニーク数',
    'rate': '割合',
    'implemented': '実装',
    'hasName': '名前',
    'hasLogo': 'ロゴ',
    'hasAddress': '住所',
    'hasPhone': '電話番号',
    'hasEmail': 'メール',
    'text': 'テキスト',
    'questionCount': '質問数',
    'qaPairCount': 'Q&Aペア数',
    'faqElements': 'FAQ要素数',
    'itemCount': 'アイテム数',
    'totalEntities': '総エンティティ数',
    'entitiesWithId': 'ID付きエンティティ数',
    'authoritativeCount': '権威サイト数',
    'personCount': '人物数',
    'dateCount': '日付数',
    'hasPublishDate': '公開日',
    'hasAuthorMeta': '著者メタ',
    'credentialCount': '資格数',
    'totalExternal': '外部リンク総数',
    'citationCount': '引用数',
    'hasCiteTag': 'citeタグ',
    'hasContactPage': '連絡先ページ',
    'isHttps': 'HTTPS',
    'keywordCount': 'キーワード数',
    'uniquePhrases': 'ユニークフレーズ数',
    'hasComparison': '比較データ',
    'hasData': 'データあり',
    'questionCount': '質問数',
    'stepCount': 'ステップ数',
    'hasAuthor': '著者情報',
    'overall': '総合評価',
    'hasH1': 'H1見出し',
    'projectName': 'プロジェクト名',
    'hasSummary': '概要',
    'sectionCount': 'セクション数',
    'rhetorical': '修辞疑問',
    'independent': '独立段落数',
    'yearMentions': '年号言及',
    'freshnessKeywords': '鮮度キーワード',
    'length': '長さ',
    'found': '検出数',
    'required': '必須数',
    'withAlt': 'alt属性あり',
    'value': '値',
    'unit': '単位',
    'optimized': '最適化済み',
    'hasMediaQuery': 'メディアクエリ',
    'completeness': '完全性',
    'descriptive': '説明的',
    'webp': 'WebP',
    'avif': 'AVIF',
    'withSrcset': 'srcset付き',
    'videoTags': '動画タグ',
    'youtubeEmbeds': 'YouTube埋め込み',
    'svgElements': 'SVG要素',
    'hasImage': '画像あり',
    'width': '幅',
    'height': '高さ',
    'optimalSize': '最適サイズ',
    'cardType': 'カードタイプ',
    'hasSite': 'siteタグ',
    'hasCreator': 'creatorタグ',
    'totalButtons': 'ボタン総数',
    'majorPlatforms': '主要プラットフォーム',
    'logoCount': 'ロゴ数',
    'consistent': '一貫性',
    'hasTelephone': '電話番号',
    'hasMap': 'マップ',
    'rating': '評価',
    'reviewCount': 'レビュー数',
    'uniqueKeywords': 'ユニークキーワード数',
    'hasAccessSection': 'アクセス情報',
    'transportMethods': '交通手段数'
  };
  return labels[metric] || metric;
}

// PDFダウンロード
async function handleDownloadPdf() {
  if (!currentJobId) {
    alert('ジョブIDがありません');
    return;
  }

  try {
    const downloadBtn = document.getElementById('download-pdf-btn');
    const originalText = downloadBtn.textContent;
    downloadBtn.textContent = 'ダウンロード中...';
    downloadBtn.disabled = true;

    const response = await fetchWithAuth(`/api/report/${currentJobId}`);
    
    if (!response.ok) {
      throw new Error('PDFのダウンロードに失敗しました');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LLMO診断.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    downloadBtn.textContent = originalText;
    downloadBtn.disabled = false;
  } catch (error) {
    console.error('PDFダウンロードエラー:', error);
    alert('PDFのダウンロードに失敗しました: ' + error.message);
    const downloadBtn = document.getElementById('download-pdf-btn');
    downloadBtn.textContent = 'PDFレポートをダウンロード';
    downloadBtn.disabled = false;
  }
}

// 新規診断
function handleNewAnalysis() {
  currentJobId = null;
  window.analysisResult = null;

  urlInput.value = '';
  detailsSection.style.display = 'none';

  hideAllSections();
  inputSection.style.display = 'block';
}

// 再試行
function handleRetry() {
  hideAllSections();
  inputSection.style.display = 'block';
}

// エラー表示
function showError(message) {
  errorMessage.textContent = message;
  hideAllSections();
  errorSection.style.display = 'block';
}

// 全セクション非表示
function hideAllSections() {
  inputSection.style.display = 'none';
  progressSection.style.display = 'none';
  resultSection.style.display = 'none';
  errorSection.style.display = 'none';
  if (historySection) historySection.style.display = 'none';
  if (historyDetailSection) historyDetailSection.style.display = 'none';
}

// ===== 履歴機能 =====

// 業種マスタを読み込む
async function loadIndustries() {
  try {
    const response = await fetchWithAuth('/api/industries');
    const industries = await response.json();

    // 診断フォームの業種セレクト
    const industrySelect = document.getElementById('industry-name');
    if (industrySelect) {
      industries.forEach(industry => {
        const option = document.createElement('option');
        option.value = industry.name;
        option.textContent = industry.name;
        industrySelect.appendChild(option);
      });
    }

    // 履歴フィルターの業種セレクト
    const historyFilterIndustry = document.getElementById('history-filter-industry');
    if (historyFilterIndustry) {
      industries.forEach(industry => {
        const option = document.createElement('option');
        option.value = industry.name;
        option.textContent = industry.name;
        historyFilterIndustry.appendChild(option);
      });
    }
  } catch (error) {
    console.error('業種マスタ読み込みエラー:', error);
  }
}

// 履歴を読み込む
async function loadHistory(page = 1) {
  currentHistoryPage = page;

  const companyName = document.getElementById('history-search-company')?.value || '';
  const industryName = document.getElementById('history-filter-industry')?.value || '';
  const sortValue = document.getElementById('history-sort')?.value || 'created_at:desc';
  const [sortBy, order] = sortValue.split(':');

  const params = new URLSearchParams({
    page,
    limit: 20,
    sortBy,
    order
  });

  if (companyName) params.append('companyName', companyName);
  if (industryName) params.append('industryName', industryName);

  try {
    const response = await fetchWithAuth(`/api/history?${params}`);
    const data = await response.json();

    // 診断データ数を更新
    const totalCountEl = document.getElementById('history-total-count');
    if (totalCountEl) {
      totalCountEl.textContent = `(${data.total || 0}件)`;
    }

    renderHistoryList(data.data || []);
    renderPagination(data.page, data.totalPages);
  } catch (error) {
    console.error('履歴読み込みエラー:', error);
    document.getElementById('history-list').innerHTML = '<p class="error-text">履歴の読み込みに失敗しました</p>';
  }
}

// 履歴一覧をレンダリング
function renderHistoryList(items) {
  const container = document.getElementById('history-list');

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="no-data-text">診断履歴がありません</p>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="history-item" data-id="${item.id}">
      <div class="history-item-header">
        <span class="company-name">${item.company_name || '未設定'}</span>
        <span class="industry-badge">${item.industry_name || '-'}</span>
        <span class="score-badge ${getScoreClass(item.total_score)}">${item.total_score || '-'}点</span>
      </div>
      <div class="history-item-body">
        <p class="url">${item.url}</p>
        <p class="date">${formatDate(item.created_at)}</p>
        <p class="mode">${item.is_multi_page ? `複数ページ (${item.page_count}ページ)` : '単一ページ'}</p>
      </div>
      <div class="history-item-actions">
        <button class="btn btn-sm" onclick="viewHistoryReport('${item.id}')">詳細</button>
        <button class="btn btn-sm" onclick="downloadHistoryPdf('${item.job_id}')">PDF</button>
        <button class="btn btn-sm btn-danger" onclick="deleteHistoryReport('${item.id}')">削除</button>
      </div>
    </div>
  `).join('');
}

// ページネーションをレンダリング
function renderPagination(currentPage, totalPages) {
  const container = document.getElementById('history-pagination');

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // 前へボタン
  if (currentPage > 1) {
    html += `<button class="btn btn-sm" onclick="loadHistory(${currentPage - 1})">←</button>`;
  }

  // ページ番号
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      html += `<span class="page-current">${i}</span>`;
    } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="btn btn-sm" onclick="loadHistory(${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="page-ellipsis">...</span>`;
    }
  }

  // 次へボタン
  if (currentPage < totalPages) {
    html += `<button class="btn btn-sm" onclick="loadHistory(${currentPage + 1})">→</button>`;
  }

  container.innerHTML = html;
}

// 履歴詳細を表示
async function viewHistoryReport(id) {
  try {
    const response = await fetchWithAuth(`/api/history/${id}`);
    const report = await response.json();

    if (!response.ok) {
      throw new Error(report.error || '詳細の取得に失敗しました');
    }

    // 詳細を表示
    window.analysisResult = report.analysis_result;
    currentJobId = report.job_id;

    // 結果画面に表示するためのスコア更新
    if (report.analysis_result) {
      const result = report.analysis_result;

      // 総合スコア
      totalScoreEl.textContent = report.total_score || 0;

      // 各カテゴリのスコア
      if (result.seo) {
        seoScoreEl.textContent = `${result.seo.score}/${result.seo.maxScore}`;
        seoBarEl.style.width = `${(result.seo.score / result.seo.maxScore) * 100}%`;
      }
      if (result.performance) {
        performanceScoreEl.textContent = `${result.performance.score}/${result.performance.maxScore}`;
        performanceBarEl.style.width = `${(result.performance.score / result.performance.maxScore) * 100}%`;
      }
      if (result.content) {
        contentScoreEl.textContent = `${result.content.score}/${result.content.maxScore}`;
        contentBarEl.style.width = `${(result.content.score / result.content.maxScore) * 100}%`;
      }
      if (result.structuredData) {
        structuredScoreEl.textContent = `${result.structuredData.score}/${result.structuredData.maxScore}`;
        structuredBarEl.style.width = `${(result.structuredData.score / result.structuredData.maxScore) * 100}%`;
      }
      if (result.llmo) {
        llmoScoreEl.textContent = `${result.llmo.score}/${result.llmo.maxScore}`;
        llmoBarEl.style.width = `${(result.llmo.score / result.llmo.maxScore) * 100}%`;
      }
    }

    // 結果セクションを表示
    hideAllSections();
    resultSection.style.display = 'block';
    detailsSection.style.display = 'none';

  } catch (error) {
    console.error('履歴詳細表示エラー:', error);
    alert('詳細の表示に失敗しました: ' + error.message);
  }
}

// 履歴からPDFをダウンロード
async function downloadHistoryPdf(jobId) {
  try {
    const response = await fetchWithAuth(`/api/report/${jobId}`);
    
    if (!response.ok) {
      throw new Error('PDFのダウンロードに失敗しました');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LLMO診断.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('PDFダウンロードエラー:', error);
    alert('PDFのダウンロードに失敗しました: ' + error.message);
  }
}

// 履歴を削除
async function deleteHistoryReport(id) {
  if (!confirm('この診断結果を削除しますか？')) return;

  try {
    const response = await fetchWithAuth(`/api/history/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '削除に失敗しました');
    }

    // 履歴を再読み込み
    loadHistory(currentHistoryPage);
  } catch (error) {
    console.error('履歴削除エラー:', error);
    alert('削除に失敗しました: ' + error.message);
  }
}

// 履歴をCSVエクスポート
function exportHistoryCsv() {
  const companyName = document.getElementById('history-search-company')?.value || '';
  const industryName = document.getElementById('history-filter-industry')?.value || '';
  const sortValue = document.getElementById('history-sort')?.value || 'created_at:desc';
  const [sortBy, order] = sortValue.split(':');

  // クエリパラメータを構築
  const params = new URLSearchParams();
  if (companyName) params.append('companyName', companyName);
  if (industryName) params.append('industryName', industryName);
  params.append('sortBy', sortBy);
  params.append('order', order);

  // CSVダウンロード
  window.location.href = `/api/history/export/csv?${params.toString()}`;
}

// スコアに応じたクラスを取得
function getScoreClass(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

// 日付をフォーマット
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ナビゲーション切り替え
function setupNavigation() {
  const navDiagnosis = document.getElementById('nav-diagnosis');
  const navHistory = document.getElementById('nav-history');

  if (navDiagnosis) {
    navDiagnosis.addEventListener('click', () => {
      navDiagnosis.classList.add('active');
      navHistory.classList.remove('active');
      hideAllSections();
      inputSection.style.display = 'block';
    });
  }

  if (navHistory) {
    navHistory.addEventListener('click', () => {
      navHistory.classList.add('active');
      navDiagnosis.classList.remove('active');
      hideAllSections();
      historySection.style.display = 'block';
      loadHistory(1);
    });
  }

  // 履歴検索ボタン
  const historySearchBtn = document.getElementById('history-search-btn');
  if (historySearchBtn) {
    historySearchBtn.addEventListener('click', () => loadHistory(1));
  }

  // CSVエクスポートボタン
  const historyExportCsvBtn = document.getElementById('history-export-csv-btn');
  if (historyExportCsvBtn) {
    historyExportCsvBtn.addEventListener('click', exportHistoryCsv);
  }

  // 履歴詳細から戻るボタン
  const backToHistoryBtn = document.getElementById('back-to-history-btn');
  if (backToHistoryBtn) {
    backToHistoryBtn.addEventListener('click', () => {
      hideAllSections();
      historySection.style.display = 'block';
    });
  }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
  loadIndustries();
  setupNavigation();
});
