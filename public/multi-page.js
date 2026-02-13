/**
 * 複数ページ診断UI制御
 */

let discoveredUrls = [];
let selectedUrls = [];

// モード切り替え
document.getElementById('mode-single').addEventListener('change', function() {
  if (this.checked) {
    document.getElementById('multi-page-options').style.display = 'none';
  }
});

document.getElementById('mode-multi').addEventListener('change', function() {
  if (this.checked) {
    document.getElementById('multi-page-options').style.display = 'block';
  }
});

// URL候補取得ボタン
document.getElementById('discover-urls-btn').addEventListener('click', async function() {
  const url = document.getElementById('url-input').value.trim();

  if (!url) {
    alert('URLを入力してください');
    return;
  }

  const maxDepth = parseInt(document.getElementById('max-depth').value) || 2;
  const maxPages = parseInt(document.getElementById('max-pages').value) || 50;
  const useSitemap = document.getElementById('use-sitemap').checked;
  const respectRobots = document.getElementById('respect-robots').checked;

  this.disabled = true;
  this.textContent = 'URL取得中...';

  try {
    const response = await fetchWithAuth('/api/discover-urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        maxDepth,
        useSitemap,
        respectRobots
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'URL候補の取得に失敗しました');
    }

    if (result.success) {
      discoveredUrls = result.candidates || [];
      displayUrlSelection(result);
    }

  } catch (error) {
    alert(`エラー: ${error.message}`);
    console.error('URL候補取得エラー:', error);
  } finally {
    this.disabled = false;
    this.textContent = 'クロール対象URLを取得';
  }
});

/**
 * URL選択UIを表示
 */
function displayUrlSelection(result) {
  const section = document.getElementById('url-selection-section');
  const countText = document.getElementById('url-count-text');
  const urlList = document.getElementById('url-list');

  countText.textContent = `${result.totalFound}件のURLが見つかりました（サイトマップ: ${result.sources.sitemap}件、内部リンク: ${result.sources.internalLinks}件）`;

  // URL一覧を生成
  renderUrlList(discoveredUrls);

  section.style.display = 'block';
}

/**
 * URL一覧を描画
 */
function renderUrlList(urls) {
  const urlList = document.getElementById('url-list');
  urlList.innerHTML = '';

  // フィルタリング
  const filteredUrls = filterUrls(urls);

  filteredUrls.forEach((urlInfo, index) => {
    const item = document.createElement('div');
    item.className = 'url-list-item';

    const categoryBadge = getCategoryBadge(urlInfo.category);
    const importanceBadge = getImportanceBadge(urlInfo.estimatedImportance);

    item.innerHTML = `
      <label>
        <input type="checkbox" class="url-checkbox" data-url="${urlInfo.url}" data-index="${index}" checked>
        <span class="url-text">${urlInfo.url}</span>
        ${categoryBadge}
        ${importanceBadge}
        ${urlInfo.source === 'sitemap' ? '<span class="badge badge-info">sitemap</span>' : ''}
        ${urlInfo.priority !== undefined ? `<span class="priority-text">優先度: ${urlInfo.priority.toFixed(2)}</span>` : ''}
      </label>
    `;

    urlList.appendChild(item);
  });

  // 選択状態を更新
  updateSelectedUrls();
}

/**
 * URLをフィルタリング
 */
function filterUrls(urls) {
  const categoryFilters = Array.from(document.querySelectorAll('.category-filter:checked')).map(cb => cb.value);
  const importanceFilters = Array.from(document.querySelectorAll('.importance-filter:checked')).map(cb => cb.value);

  return urls.filter(urlInfo => {
    const categoryMatch = categoryFilters.includes(urlInfo.category);
    const importanceMatch = importanceFilters.includes(urlInfo.estimatedImportance);

    return categoryMatch && importanceMatch;
  });
}

/**
 * カテゴリバッジ
 */
function getCategoryBadge(category) {
  const badges = {
    static: '<span class="badge badge-primary">固定</span>',
    blog: '<span class="badge badge-success">ブログ</span>',
    product: '<span class="badge badge-warning">商品</span>',
    other: '<span class="badge badge-secondary">その他</span>'
  };

  return badges[category] || '';
}

/**
 * 重要度バッジ
 */
function getImportanceBadge(importance) {
  const badges = {
    high: '<span class="badge badge-danger">重要度: 高</span>',
    medium: '<span class="badge badge-info">重要度: 中</span>',
    low: '<span class="badge badge-light">重要度: 低</span>'
  };

  return badges[importance] || '';
}

// 全て選択チェックボックス
document.getElementById('select-all-urls').addEventListener('change', function() {
  const checkboxes = document.querySelectorAll('.url-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = this.checked;
  });
  updateSelectedUrls();
});

// URLチェックボックス変更時
document.addEventListener('change', function(e) {
  if (e.target.classList.contains('url-checkbox')) {
    updateSelectedUrls();
  }
});

/**
 * 選択されたURLを更新
 */
function updateSelectedUrls() {
  const checkboxes = document.querySelectorAll('.url-checkbox:checked');
  selectedUrls = Array.from(checkboxes).map(cb => cb.dataset.url);
}

// フィルター変更時
document.querySelectorAll('.category-filter, .importance-filter').forEach(filter => {
  filter.addEventListener('change', function() {
    renderUrlList(discoveredUrls);
  });
});

/**
 * 複数ページ診断を開始
 */
async function startMultiPageAnalysis(url, companyName, industryName, options) {
  try {
    const response = await fetchWithAuth('/api/analyze-multi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        baseUrl: url,
        selectedUrls: selectedUrls.length > 0 ? selectedUrls : null,
        maxDepth: options.maxDepth,
        maxPages: options.maxPages,
        useSitemap: options.useSitemap,
        respectRobots: options.respectRobots,
        companyName,
        industryName
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '診断開始に失敗しました');
    }

    return result.jobId;

  } catch (error) {
    throw error;
  }
}

/**
 * 複数ページ診断の進捗をポーリング
 */
async function pollMultiPageProgress(jobId) {
  try {
    const response = await fetchWithAuth(`/api/analyze/${jobId}`);
    const job = await response.json();

    if (!response.ok) {
      throw new Error(job.error || 'ステータス取得に失敗しました');
    }

    // 進捗更新
    updateProgress(job.progress, job.status);

    // 複数ページ診断の場合はページ数も表示
    if (job.currentPage && job.totalPages) {
      const pageProgressText = document.getElementById('page-progress-text');
      pageProgressText.textContent = `${job.currentPage} / ${job.totalPages} ページ`;
      pageProgressText.style.display = 'block';
    }

    if (job.status === 'completed') {
      return { completed: true, job };
    } else if (job.status === 'failed') {
      throw new Error(job.error || '診断に失敗しました');
    } else {
      // 2秒後に再度ポーリング
      await sleep(2000);
      return pollMultiPageProgress(jobId);
    }

  } catch (error) {
    throw error;
  }
}

/**
 * 複数ページ診断結果を表示
 */
async function displayMultiPageResults(jobId) {
  try {
    // 集計結果を取得
    const aggregateResponse = await fetchWithAuth(`/api/aggregate/${jobId}`);
    const aggregateData = await aggregateResponse.json();

    if (!aggregateResponse.ok) {
      throw new Error(aggregateData.error || '集計結果の取得に失敗しました');
    }

    // ページ詳細データも取得
    const resultResponse = await fetchWithAuth(`/api/result/${jobId}`);
    const resultData = await resultResponse.json();

    if (!resultResponse.ok) {
      throw new Error(resultData.error || '詳細結果の取得に失敗しました');
    }

    const { aggregated } = aggregateData;

    // 総合スコアを表示
    document.getElementById('total-score').textContent = aggregated.overall.averageScore;

    // カテゴリ別スコアを表示
    displayCategoryScores(aggregated.byCategory);

    // 結果データが空でないことを確認
    if (!resultData || !resultData.result) {
      console.error('resultData or resultData.result is null', resultData);
      throw new Error('診断結果データが見つかりません');
    }

    const pages = resultData.result.pages || [];

    // 失敗したページを除外
    const validPages = pages.filter(page =>
      page && !page.failed && (page.content || page.seo)
    );

    window.analysisResult = {
      isMultiPage: true,
      aggregated: aggregated,
      url: aggregateData.baseUrl,
      pages: validPages,
      analyzedAt: resultData.result.analyzedAt || new Date().toISOString()
    };

    // 詳細情報を追加（非表示で準備）
    displayAggregatedDetails(aggregated);

    // 結果セクションを表示
    showSection('result-section');

  } catch (error) {
    throw error;
  }
}

/**
 * カテゴリ別スコアを表示
 */
function displayCategoryScores(byCategory) {
  const categories = [
    { key: 'seo', id: 'seo' },
    { key: 'performance', id: 'performance' },
    { key: 'content', id: 'content' },
    { key: 'structuredData', id: 'structured' },
    { key: 'llmo', id: 'llmo' }
  ];

  categories.forEach(({ key, id }) => {
    const score = byCategory[key]?.avg || 0;
    document.getElementById(`${id}-score`).textContent = `${score}/100`;
    document.getElementById(`${id}-bar`).style.width = `${score}%`;
  });
}

/**
 * 集計結果の詳細を表示
 */
function displayAggregatedDetails(aggregated) {
  const detailsContent = document.getElementById('details-content');

  let html = '<div class="aggregated-details">';

  // 総合統計
  html += '<h4>総合統計</h4>';
  html += '<table class="details-table">';
  html += `<tr><td>診断ページ数</td><td>${aggregated.overall.totalPages}件</td></tr>`;
  html += `<tr><td>平均スコア</td><td>${aggregated.overall.averageScore}点</td></tr>`;
  html += `<tr><td>中央値</td><td>${aggregated.overall.medianScore}点</td></tr>`;
  html += `<tr><td>80点以上のページ</td><td>${aggregated.overall.scoreDistribution['80-100']}件</td></tr>`;
  html += `<tr><td>60-79点のページ</td><td>${aggregated.overall.scoreDistribution['60-79']}件</td></tr>`;
  html += `<tr><td>60点未満のページ</td><td>${aggregated.overall.scoreDistribution['40-59'] + aggregated.overall.scoreDistribution['0-39']}件</td></tr>`;
  html += '</table>';

  // トップページ
  html += '<h4>スコア上位ページ</h4>';
  html += '<ul class="page-list">';
  aggregated.topPages.forEach(page => {
    html += `<li><span class="score-badge">${page.score}点</span> ${page.url}</li>`;
  });
  html += '</ul>';

  // ボトムページ
  html += '<h4>スコア下位ページ</h4>';
  html += '<ul class="page-list">';
  aggregated.bottomPages.forEach(page => {
    html += `<li><span class="score-badge low">${page.score}点</span> ${page.url}</li>`;
  });
  html += '</ul>';

  // 改善提案
  html += '<h4>改善提案</h4>';
  if (aggregated.recommendations && aggregated.recommendations.length > 0) {
    html += '<div class="recommendations">';
    aggregated.recommendations.forEach(rec => {
      const priorityClass = rec.priority === 'high' ? 'priority-high' : rec.priority === 'medium' ? 'priority-medium' : 'priority-low';
      html += `
        <div class="recommendation-item ${priorityClass}">
          <div class="rec-header">
            <span class="priority-badge">${rec.priority === 'high' ? '高' : rec.priority === 'medium' ? '中' : '低'}</span>
            <strong>${rec.category}: ${rec.issue}</strong>
          </div>
          <p>${rec.suggestion}</p>
          <details>
            <summary>影響ページ (${rec.affectedPages.length}件)</summary>
            <ul>
              ${rec.affectedPages.map(url => `<li>${url}</li>`).join('')}
            </ul>
          </details>
        </div>
      `;
    });
    html += '</div>';
  } else {
    html += '<p>特に重大な問題は検出されませんでした。</p>';
  }

  // ページ詳細リスト（アコーディオン形式）
  html += '<h4 style="margin-top: 30px;">診断ページ詳細</h4>';
  html += '<div class="page-details-list" id="page-details-list"></div>';

  html += '</div>';

  detailsContent.innerHTML = html;

  // ページ詳細リストを生成（遅延ロード）
  renderPageDetailsList();
}

/**
 * ページ詳細リストを描画
 */
function renderPageDetailsList() {
  if (!window.analysisResult || !window.analysisResult.pages) {
    console.log('renderPageDetailsList: No analysisResult or pages');
    return;
  }

  const pages = window.analysisResult.pages;
  const container = document.getElementById('page-details-list');

  if (!container) {
    console.log('renderPageDetailsList: Container not found');
    return;
  }

  console.log('renderPageDetailsList: Rendering', pages.length, 'pages');

  if (pages.length === 0) {
    container.innerHTML = '<p>診断に成功したページがありません。</p>';
    return;
  }

  // スコア順にソート
  const sortedPages = [...pages].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

  let html = '';

  sortedPages.forEach((page, index) => {
    const scoreColor = getPageScoreColor(page.totalScore || 0);

    html += `
      <div class="page-item" data-page-index="${index}">
        <div class="page-header">
          <div class="page-info">
            <span class="page-score" style="color: ${scoreColor}; font-weight: bold;">${page.totalScore || 0}点</span>
            <span class="page-url">${page.url}</span>
          </div>
          <span class="expand-icon">▼</span>
        </div>
        <div class="page-details"></div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * スコアに応じた色を取得
 */
function getPageScoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#2563eb';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

/**
 * スリープ関数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ページ詳細のアコーディオン展開イベント
 */
document.addEventListener('click', function(e) {
  const pageHeader = e.target.closest('.page-header');
  if (!pageHeader) return;

  const pageItem = pageHeader.closest('.page-item');
  if (!pageItem) return;

  const pageIndex = parseInt(pageItem.dataset.pageIndex);
  const pageDetails = pageItem.querySelector('.page-details');
  const isExpanded = pageItem.classList.contains('expanded');

  if (isExpanded) {
    // 閉じる
    pageItem.classList.remove('expanded');
    pageDetails.style.display = 'none';
  } else {
    // 開く
    pageItem.classList.add('expanded');

    // 詳細がまだ生成されていない場合は生成
    if (!pageDetails.innerHTML) {
      const pages = window.analysisResult.pages;
      const sortedPages = [...pages].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
      const pageData = sortedPages[pageIndex];

      pageDetails.innerHTML = generatePageDetails(pageData);
    }

    pageDetails.style.display = 'block';
  }
});

/**
 * 個別ページの詳細HTMLを生成（単一診断と同じフォーマット）
 */
function generatePageDetails(pageData) {
  let html = '<div style="padding: 20px; background: white;">';

  // ヘッダー
  html += `<h5 style="margin-bottom: 20px; color: #1f2937;">${pageData.url}</h5>`;

  // 11カテゴリの詳細を表示
  if (pageData.content) {
    html += window.createCategorySection('コンテンツ構造最適化', pageData.content, [
      { label: 'コンテンツボリューム', key: 'contentVolume', metrics: ['characters', 'words'] },
      { label: '見出し構造', key: 'headingStructure', metrics: ['h1Count', 'h2Count', 'h3Count'] },
      { label: 'H1品質', key: 'h1Quality', metrics: ['count', 'text'] },
      { label: 'H2品質', key: 'h2Quality', metrics: ['count', 'questionCount'] },
      { label: 'FAQ構造', key: 'faqStructure', metrics: ['qaPairCount', 'faqElements'] },
      { label: '内部リンク', key: 'internalLinks', metrics: ['count'] },
      { label: 'リスト構造', key: 'bulletLists', metrics: ['count', 'itemCount'] },
      { label: '表の使用', key: 'tableUsage', metrics: ['count'] }
    ]);
  }

  if (pageData.entity) {
    html += window.createCategorySection('エンティティ分析', pageData.entity, [
      { label: 'Organization Schema', key: 'organizationSchema', metrics: ['implemented', 'hasName', 'hasLogo'] },
      { label: 'Person Schema', key: 'personSchema', metrics: ['implemented', 'personCount'] },
      { label: '@id実装', key: 'idImplementation', metrics: ['totalEntities', 'entitiesWithId', 'rate'] },
      { label: 'sameAs実装', key: 'sameAsImplementation', metrics: ['count', 'authoritativeCount'] },
      { label: 'NAP一貫性', key: 'napConsistency', metrics: ['hasName', 'hasAddress', 'hasPhone'] },
      { label: 'エンティティ関係', key: 'entityRelations', metrics: ['count'] }
    ]);
  }

  if (pageData.eeat) {
    html += window.createCategorySection('E-E-A-T評価', pageData.eeat, [
      { label: '一次情報', key: 'primaryInformation', metrics: ['keywordCount'] },
      { label: '体験記述', key: 'experienceDescription', metrics: ['count'] },
      { label: '日時明示', key: 'dateSpecification', metrics: ['dateCount', 'hasPublishDate'] },
      { label: '著者資格', key: 'authorCredentials', metrics: ['hasAuthorMeta', 'credentialCount'] },
      { label: '外部引用', key: 'externalCitations', metrics: ['totalExternal', 'authoritativeCount'] },
      { label: '引用明示', key: 'citationClarity', metrics: ['citationCount', 'hasCiteTag'] },
      { label: '連絡先情報', key: 'contactInformation', metrics: ['hasContactPage', 'hasEmail', 'hasPhone'] },
      { label: 'SSL証明書', key: 'sslCertificate', metrics: ['isHttps'] }
    ]);
  }

  if (pageData.statistics) {
    html += window.createCategorySection('統計データ・数値情報', pageData.statistics, [
      { label: '数値データ', key: 'numberCount', metrics: ['total', 'unique'] },
      { label: '統計用語', key: 'statisticalPhrases', metrics: ['count', 'uniquePhrases'] },
      { label: 'パーセンテージ', key: 'percentageUsage', metrics: ['count', 'unique'] },
      { label: '比較データ', key: 'comparisonData', metrics: ['hasComparison', 'keywordCount'] },
      { label: '政府データ', key: 'governmentData', metrics: ['count'] },
      { label: '学術論文', key: 'academicPapers', metrics: ['count'] },
      { label: 'グラフ・チャート', key: 'graphsCharts', metrics: ['total'] }
    ]);
  }

  if (pageData.structuredData) {
    html += window.createCategorySection('構造化データ', pageData.structuredData, [
      { label: '実装状況', key: 'implementation', metrics: ['hasData', 'count'] },
      { label: 'スキーマタイプ', key: 'schemaTypes', metrics: ['count'], customValue: pageData.structuredData.details?.schemaTypes?.types?.join(', ') || 'なし' },
      { label: 'FAQスキーマ', key: 'faq', metrics: ['implemented', 'questionCount'] },
      { label: 'HowToスキーマ', key: 'howTo', metrics: ['implemented', 'stepCount'] },
      { label: 'Articleスキーマ', key: 'article', metrics: ['implemented', 'hasAuthor'] },
      { label: 'Organizationスキーマ', key: 'organization', metrics: ['implemented', 'hasLogo'] },
      { label: 'Breadcrumbスキーマ', key: 'breadcrumb', metrics: ['implemented'] }
    ]);
  }

  if (pageData.llmo) {
    html += window.createCategorySection('LLMO特化評価 (AI引用最適化)', pageData.llmo, [
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
  }

  if (pageData.seo) {
    html += window.createCategorySection('テクニカルSEO', pageData.seo, [
      { label: 'タイトル', key: 'title', metrics: ['length'], customValue: pageData.seo.details?.title?.value || '' },
      { label: 'メタディスクリプション', key: 'metaDescription', metrics: ['length'], customValue: pageData.seo.details?.metaDescription?.value || '' },
      { label: 'OGPタグ', key: 'ogp', metrics: ['found', 'required'] },
      { label: 'Twitter Card', key: 'twitterCard', metrics: [], customValue: pageData.seo.details?.twitterCard?.tags?.['twitter:card'] || 'なし' },
      { label: 'Canonical URL', key: 'canonical', metrics: [], customValue: pageData.seo.details?.canonical?.value || 'なし' },
      { label: 'robots meta', key: 'robotsMeta', metrics: [], customValue: pageData.seo.details?.robotsMeta?.value || 'なし' },
      { label: '画像alt属性', key: 'imageAlt', metrics: ['total', 'withAlt', 'rate'] },
      { label: 'H1タグ', key: 'h1', metrics: ['count'] },
      { label: 'モバイル最適化', key: 'mobileOptimization', metrics: ['hasViewport'] }
    ]);
  }

  if (pageData.performance) {
    html += window.createCategorySection('パフォーマンス', pageData.performance, [
      { label: 'ページ読み込み時間', key: 'loadTime', metrics: ['value', 'unit'] },
      { label: 'LCP (Largest Contentful Paint)', key: 'lcp', metrics: ['value', 'unit'] },
      { label: 'CLS (Cumulative Layout Shift)', key: 'cls', metrics: ['value'] },
      { label: 'FID (First Input Delay)', key: 'fid', metrics: ['value', 'unit'] },
      { label: 'サーバーレスポンス時間', key: 'serverResponseTime', metrics: ['value', 'unit'] },
      { label: 'DOM処理時間', key: 'domInteractive', metrics: ['value', 'unit'] },
      { label: '画像最適化', key: 'imageOptimization', metrics: ['total', 'optimized', 'rate'] },
      { label: 'レスポンシブデザイン', key: 'responsiveDesign', metrics: ['hasMediaQuery'] }
    ]);
  }

  if (pageData.multimedia) {
    html += window.createCategorySection('マルチメディア最適化', pageData.multimedia, [
      { label: 'alt属性完全性', key: 'altCompleteness', metrics: ['total', 'withAlt', 'completeness'] },
      { label: 'alt属性品質', key: 'altQuality', metrics: ['descriptive', 'rate'] },
      { label: '次世代画像フォーマット', key: 'modernImageFormats', metrics: ['webp', 'avif', 'rate'] },
      { label: 'レスポンシブ画像', key: 'responsiveImages', metrics: ['total', 'withSrcset', 'rate'] },
      { label: '動画コンテンツ', key: 'videoContent', metrics: ['total', 'videoTags', 'youtubeEmbeds'] },
      { label: 'SVG使用', key: 'svgUsage', metrics: ['total', 'svgElements'] },
      { label: '図解・チャート', key: 'visualContent', metrics: ['count'] }
    ]);
  }

  if (pageData.social) {
    html += window.createCategorySection('ソーシャルシグナル', pageData.social, [
      { label: '必須OGPタグ', key: 'requiredOGP', metrics: ['completeness'] },
      { label: 'OGP画像品質', key: 'ogImageQuality', metrics: ['hasImage', 'width', 'height', 'optimalSize'] },
      { label: 'Twitter Card', key: 'twitterCard', metrics: ['cardType', 'completeness'] },
      { label: 'Twitter固有タグ', key: 'twitterSpecific', metrics: ['hasSite', 'hasCreator'] },
      { label: 'SNSプロフィール', key: 'socialProfiles', metrics: ['count'] },
      { label: '共有ボタン', key: 'shareButtons', metrics: ['totalButtons', 'majorPlatforms'] },
      { label: 'ロゴ一貫性', key: 'logoConsistency', metrics: ['logoCount', 'consistent'] }
    ]);
  }

  if (pageData.localSeo && pageData.localSeo.isLocalBusiness) {
    html += window.createCategorySection('ローカルSEO', pageData.localSeo, [
      { label: 'LocalBusiness Schema', key: 'localBusinessSchema', metrics: ['implemented', 'hasName', 'hasAddress', 'hasTelephone'] },
      { label: 'NAP情報', key: 'napInformation', metrics: ['hasName', 'hasAddress', 'hasPhone'] },
      { label: '営業時間', key: 'openingHours', metrics: ['implemented'], customValue: pageData.localSeo.details?.openingHours?.data || 'なし' },
      { label: 'Google Maps埋め込み', key: 'mapEmbed', metrics: ['hasMap'] },
      { label: 'Reviewスキーマ', key: 'reviewSchema', metrics: ['implemented', 'count'] },
      { label: '評価表示', key: 'aggregateRating', metrics: ['implemented', 'rating', 'reviewCount'] },
      { label: '地域言及', key: 'regionalMentions', metrics: ['count', 'uniqueKeywords'] },
      { label: 'アクセス情報', key: 'accessInformation', metrics: ['hasAccessSection', 'transportMethods'] }
    ]);
  }

  html += '</div>';

  return html;
}

// グローバルに公開（app.jsから使用）
window.MultiPageAnalysis = {
  startMultiPageAnalysis,
  pollMultiPageProgress,
  displayMultiPageResults
};
