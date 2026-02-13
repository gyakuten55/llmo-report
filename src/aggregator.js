/**
 * 複数ページの診断結果を集計
 * @param {Object} multiPageResults - crawlMultiplePagesの結果
 * @returns {Object} - 集計結果
 */
function aggregateResults(multiPageResults) {
  // ガード追加: multiPageResultsがnullまたは不完全な場合
  if (!multiPageResults || !multiPageResults.pages) {
    console.error('aggregateResults: multiPageResults is null or missing pages');
    return {
      overall: { totalPages: 0, averageScore: 0, medianScore: 0, scoreDistribution: {}, crawledPages: 0, failedPages: 0 },
      byCategory: {},
      topPages: [],
      bottomPages: [],
      recommendations: [],
      pages: []
    };
  }

  const { pages } = multiPageResults;

  if (!pages || pages.length === 0) {
    return {
      overall: {
        totalPages: 0,
        averageScore: 0,
        medianScore: 0,
        scoreDistribution: {}
      },
      byCategory: {},
      topPages: [],
      bottomPages: [],
      recommendations: []
    };
  }

  // 失敗したページを除外（analysisがないか、failed: trueのページ）
  const validPages = pages.filter(page => !page.failed && page.analysis);

  // カテゴリ一覧
  const categories = [
    'content', 'entity', 'eeat', 'statistics', 'structuredData',
    'llmo', 'seo', 'performance', 'multimedia', 'social', 'localSeo'
  ];

  // 1. 各ページの総合スコア計算（validPagesのみ）
  const pagesWithScores = validPages.map(page => {
    const totalScore = calculatePageTotalScore(page.analysis);
    return { ...page, totalScore };
  });

  // 2. 総合スコアの統計
  const scores = pagesWithScores.map(p => p.totalScore).sort((a, b) => b - a);
  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const medianScore = scores[Math.floor(scores.length / 2)];

  // スコア分布
  const scoreDistribution = {
    '80-100': scores.filter(s => s >= 80).length,
    '60-79': scores.filter(s => s >= 60 && s < 80).length,
    '40-59': scores.filter(s => s >= 40 && s < 60).length,
    '0-39': scores.filter(s => s < 40).length
  };

  // 3. カテゴリ別集計
  const byCategory = {};

  for (const category of categories) {
    const categoryScores = pagesWithScores
      .map(p => p.analysis && p.analysis[category] ? p.analysis[category].score : 0)
      .filter(s => s > 0);

    if (categoryScores.length > 0) {
      const sorted = categoryScores.sort((a, b) => a - b);

      byCategory[category] = {
        avg: Math.round(categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length),
        median: sorted[Math.floor(sorted.length / 2)],
        min: Math.min(...categoryScores),
        max: Math.max(...categoryScores),
        pagesAnalyzed: categoryScores.length
      };
    } else {
      byCategory[category] = {
        avg: 0,
        median: 0,
        min: 0,
        max: 0,
        pagesAnalyzed: 0
      };
    }
  }

  // 4. トップ/ボトムページ
  const topPages = pagesWithScores
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5)
    .map(p => ({
      url: p.url,
      score: p.totalScore,
      category: p.category
    }));

  const bottomPages = pagesWithScores
    .sort((a, b) => a.totalScore - b.totalScore)
    .slice(0, 5)
    .map(p => ({
      url: p.url,
      score: p.totalScore,
      category: p.category
    }));

  // 5. 改善提案の生成
  const recommendations = generateRecommendations(pagesWithScores, byCategory);

  return {
    overall: {
      totalPages: validPages.length,  // 成功したページ数のみ
      averageScore,
      medianScore,
      scoreDistribution,
      crawledPages: multiPageResults.summary.totalCrawled,
      failedPages: multiPageResults.summary.totalFailed
    },
    byCategory,
    topPages,
    bottomPages,
    recommendations,
    pages: pagesWithScores.map(p => ({
      url: p.url,
      totalScore: p.totalScore,
      category: p.category,
      scores: extractCategoryScores(p.analysis)
    }))
  };
}

/**
 * ページの総合スコアを計算（重み付け平均）
 */
function calculatePageTotalScore(analysis) {
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
    if (analysis[key] && typeof analysis[key].score === 'number') {
      totalScoreRaw += analysis[key].score * weight;
      totalWeight += weight;
    }
  }

  // 加重平均（まだ丸めない）
  let score = totalWeight > 0 ? (totalScoreRaw / totalWeight) : 0;

  // ローカルSEOボーナス（最大+5点）
  if (analysis.localSeo && analysis.localSeo.isLocalBusiness) {
    const localScore = analysis.localSeo.score || 0;
    const bonus = (localScore / 100) * 5;
    score += bonus;
  }

  // 最後に一回だけ四捨五入する（これで1点のズレを防ぐ）
  return Math.min(100, Math.round(score));
}

/**
 * カテゴリ別スコアを抽出
 */
function extractCategoryScores(analysis) {
  if (!analysis) return {};

  return {
    content: analysis.content?.score || 0,
    entity: analysis.entity?.score || 0,
    eeat: analysis.eeat?.score || 0,
    statistics: analysis.statistics?.score || 0,
    structuredData: analysis.structuredData?.score || 0,
    llmo: analysis.llmo?.score || 0,
    seo: analysis.seo?.score || 0,
    performance: analysis.performance?.score || 0,
    multimedia: analysis.multimedia?.score || 0,
    social: analysis.social?.score || 0,
    localSeo: analysis.localSeo?.score || 0
  };
}

/**
 * 改善提案を生成
 */
function generateRecommendations(pagesWithScores, byCategory) {
  const recommendations = [];

  // カテゴリ別の問題検出
  for (const [category, stats] of Object.entries(byCategory)) {
    if (stats.avg < 60) {
      // 低スコアページを特定
      const lowScorePages = pagesWithScores
        .filter(p => p.analysis && p.analysis[category] && p.analysis[category].score < 60)
        .map(p => p.url);

      if (lowScorePages.length >= 3) {
        recommendations.push({
          priority: stats.avg < 40 ? 'high' : 'medium',
          category: getCategoryName(category),
          issue: `${lowScorePages.length}ページで${getCategoryName(category)}のスコアが低い（平均${stats.avg}点）`,
          affectedPages: lowScorePages.slice(0, 5),
          suggestion: getCategorySuggestion(category)
        });
      }
    }
  }

  // H1タグの問題
  const h1Issues = pagesWithScores.filter(p =>
    p.analysis?.seo?.details?.h1?.count !== 1
  );

  if (h1Issues.length >= 3) {
    recommendations.push({
      priority: 'high',
      category: 'SEO',
      issue: `${h1Issues.length}ページでH1タグが適切に設定されていません`,
      affectedPages: h1Issues.slice(0, 5).map(p => p.url),
      suggestion: '各ページにH1タグを1つのみ設定してください'
    });
  }

  // 構造化データの問題
  const noStructuredData = pagesWithScores.filter(p =>
    p.analysis?.structuredData?.score === 0
  );

  if (noStructuredData.length >= 3) {
    recommendations.push({
      priority: 'high',
      category: '構造化データ',
      issue: `${noStructuredData.length}ページで構造化データが実装されていません`,
      affectedPages: noStructuredData.slice(0, 5).map(p => p.url),
      suggestion: 'Schema.org構造化データ（JSON-LD）の実装を推奨します'
    });
  }

  // パフォーマンスの問題
  const slowPages = pagesWithScores.filter(p =>
    p.analysis?.performance?.score < 50
  );

  if (slowPages.length >= 3) {
    recommendations.push({
      priority: 'medium',
      category: 'パフォーマンス',
      issue: `${slowPages.length}ページで読み込み速度が遅い`,
      affectedPages: slowPages.slice(0, 5).map(p => p.url),
      suggestion: '画像最適化、キャッシュ設定、サーバーレスポンス改善を推奨します'
    });
  }

  // 優先度順にソート
  recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return recommendations;
}

/**
 * カテゴリ名を日本語に変換
 */
function getCategoryName(category) {
  const names = {
    content: 'コンテンツ構造',
    entity: 'エンティティ最適化',
    eeat: 'E-E-A-T',
    statistics: '統計データ',
    structuredData: '構造化データ',
    llmo: 'AI引用最適化',
    seo: 'テクニカルSEO',
    performance: 'パフォーマンス',
    multimedia: 'マルチメディア',
    social: 'ソーシャルシグナル',
    localSeo: 'ローカルSEO'
  };

  return names[category] || category;
}

/**
 * カテゴリ別の改善提案
 */
function getCategorySuggestion(category) {
  const suggestions = {
    content: 'H1-H2見出し構造の改善、FAQ追加、内部リンクの強化を推奨します',
    entity: 'Organization/Person schemaの実装、sameAsプロパティの追加を推奨します',
    eeat: '著者情報、専門資格、引用元の明示を推奨します',
    statistics: '統計データ、数値情報、グラフの追加を推奨します',
    structuredData: 'FAQスキーマ、Articleスキーマの実装を推奨します',
    llmo: '「〜とは」形式の定義文、質問形式の見出しを追加してください',
    seo: 'タイトル・メタディスクリプション、OGPタグの最適化を推奨します',
    performance: '画像最適化（WebP）、サーバーレスポンス改善を推奨します',
    multimedia: '画像のalt属性設定、動画コンテンツの追加を推奨します',
    social: 'OGP画像の最適化、SNSシェアボタンの実装を推奨します',
    localSeo: 'LocalBusiness schema、営業時間、地図の実装を推奨します'
  };

  return suggestions[category] || '詳細な分析結果を確認してください';
}

module.exports = {
  aggregateResults,
  calculatePageTotalScore,
  extractCategoryScores
};
