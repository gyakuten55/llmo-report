// グローバル変数
let currentJobId = null;
let pollInterval = null;

// DOM要素
const inputSection = document.getElementById('input-section');
const progressSection = document.getElementById('progress-section');
const resultSection = document.getElementById('result-section');
const errorSection = document.getElementById('error-section');
const detailsSection = document.getElementById('details-section');

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

  // クライアント名を取得
  const clientNameInput = document.getElementById('client-name');
  const clientName = clientNameInput ? clientNameInput.value.trim() : '';

  // セクション切り替え
  hideAllSections();
  progressSection.style.display = 'block';

  // 進捗をリセット
  updateProgress(0, '診断を開始しています...');

  try {
    // APIリクエスト
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        clientName: clientName || null,
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

  } catch (error) {
    showError(error.message);
  }
}

// 進捗のポーリング開始
function startPolling() {
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/analyze/${currentJobId}`);
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
    const response = await fetch(`/api/result/${currentJobId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '結果の取得に失敗しました');
    }

    const result = data.result;

    // 総合スコア計算（PDFと同じロジック）
    const weights = {
      content: 0.15,
      entity: 0.15,
      eeat: 0.20,
      statistics: 0.10,
      structuredData: 0.15,
      llmo: 0.10,
      seo: 0.08,
      performance: 0.04,
      multimedia: 0.02,
      social: 0.01
    };

    if (result.localSeo && result.localSeo.isLocalBusiness) {
      weights.localSeo = 0.02;
    }

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    const totalScore = Math.round(
      (result.content.score / result.content.maxScore * weights.content +
       result.entity.score / result.entity.maxScore * weights.entity +
       result.eeat.score / result.eeat.maxScore * weights.eeat +
       result.statistics.score / result.statistics.maxScore * weights.statistics +
       result.structuredData.score / result.structuredData.maxScore * weights.structuredData +
       result.llmo.score / result.llmo.maxScore * weights.llmo +
       result.seo.score / result.seo.maxScore * weights.seo +
       result.performance.score / result.performance.maxScore * weights.performance +
       result.multimedia.score / result.multimedia.maxScore * weights.multimedia +
       result.social.score / result.social.maxScore * weights.social +
       (result.localSeo && result.localSeo.isLocalBusiness ?
         result.localSeo.score / result.localSeo.maxScore * weights.localSeo : 0)
      ) / totalWeight * 100
    );

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
function handleDownloadPdf() {
  if (!currentJobId) {
    alert('ジョブIDがありません');
    return;
  }

  window.location.href = `/api/report/${currentJobId}`;
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
}
