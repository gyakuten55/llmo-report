/**
 * パフォーマンス分析
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - パフォーマンス分析結果
 */
function analyzePerformance(crawlData) {
  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  // ページ読み込み速度分析
  const loadTime = crawlData.loadTime || 0;
  results.rawData.loadTime = loadTime;
  results.details.loadTime = {
    value: loadTime,
    unit: 'ms',
    score: 0,
    recommendation: ''
  };

  if (loadTime < 1000) {
    results.details.loadTime.score = 18;
    results.details.loadTime.recommendation = '優秀なページ読み込み速度です。';
  } else if (loadTime < 2000) {
    results.details.loadTime.score = 12;
    results.details.loadTime.recommendation = '良好なページ読み込み速度です。';
  } else if (loadTime < 3000) {
    results.details.loadTime.score = 6;
    results.details.loadTime.recommendation = 'ページ読み込み速度の改善余地があります。';
  } else {
    results.details.loadTime.score = 2;
    results.details.loadTime.recommendation = 'ページ読み込み速度の大幅な改善が必要です。';
  }

  // Core Web Vitals 分析
  const webVitals = crawlData.webVitals || { lcp: 0, cls: 0, fid: 0 };
  results.rawData.webVitals = webVitals;

  // LCP (Largest Contentful Paint)
  const lcp = webVitals.lcp;
  results.details.lcp = {
    value: lcp,
    unit: 'ms',
    score: 0,
    recommendation: ''
  };

  if (lcp < 2500) {
    results.details.lcp.score = 15;
    results.details.lcp.recommendation = 'LCPが良好です。';
  } else if (lcp < 4000) {
    results.details.lcp.score = 10;
    results.details.lcp.recommendation = 'LCPの改善が必要です。';
  } else {
    results.details.lcp.score = 5;
    results.details.lcp.recommendation = 'LCPの大幅な改善が必要です。';
  }

  // CLS (Cumulative Layout Shift)
  const cls = webVitals.cls;
  results.details.cls = {
    value: cls,
    unit: '',
    score: 0,
    recommendation: ''
  };

  if (cls < 0.1) {
    results.details.cls.score = 15;
    results.details.cls.recommendation = 'CLSが良好です。';
  } else if (cls < 0.25) {
    results.details.cls.score = 10;
    results.details.cls.recommendation = 'CLSの改善が必要です。';
  } else {
    results.details.cls.score = 5;
    results.details.cls.recommendation = 'CLSの大幅な改善が必要です。';
  }

  // FID (First Input Delay) - 実測が難しいため簡易評価
  results.details.fid = {
    value: 0,
    unit: 'ms',
    score: 10,
    recommendation: 'FIDは実際のユーザーインタラクションで測定されます。'
  };

  // サーバーレスポンスタイム
  const performanceMetrics = crawlData.performanceMetrics || {};
  const serverResponseTime = performanceMetrics.serverResponseTime || 0;
  results.rawData.serverResponseTime = serverResponseTime;
  results.details.serverResponseTime = {
    value: serverResponseTime,
    unit: 'ms',
    score: 0,
    recommendation: ''
  };

  if (serverResponseTime < 200) {
    results.details.serverResponseTime.score = 8;
    results.details.serverResponseTime.recommendation = '優秀なサーバーレスポンス速度です。';
  } else if (serverResponseTime < 500) {
    results.details.serverResponseTime.score = 5;
    results.details.serverResponseTime.recommendation = '良好なサーバーレスポンス速度です。';
  } else {
    results.details.serverResponseTime.score = 2;
    results.details.serverResponseTime.recommendation = 'サーバーレスポンスの改善が必要です。';
  }

  // DOM処理時間
  const domInteractive = performanceMetrics.domInteractive || 0;
  results.rawData.domInteractive = domInteractive;
  results.details.domInteractive = {
    value: domInteractive,
    unit: 'ms',
    score: domInteractive < 2000 ? 8 : (domInteractive < 4000 ? 5 : 2),
    recommendation: domInteractive < 2000
      ? 'DOM処理時間が良好です。'
      : 'DOM処理の最適化が推奨されます。'
  };

  // 画像最適化率
  const images = crawlData.images || [];
  const totalImages = images.length;
  let optimizedImages = 0;

  // 画像サイズの簡易評価（実際のサイズは取得できないため、存在チェックのみ）
  images.forEach(img => {
    // WebP、AVIF形式、または適切なalt属性がある画像を最適化済みとみなす
    if (img.src && (img.src.includes('.webp') || img.src.includes('.avif') || img.alt)) {
      optimizedImages++;
    }
  });

  const imageOptimizationRate = totalImages > 0 ? (optimizedImages / totalImages) * 100 : 100;
  results.rawData.imageOptimization = {
    total: totalImages,
    optimized: optimizedImages,
    rate: imageOptimizationRate
  };

  let imageOptScore = 0;
  let imageOptRecommendation = '';
  if (imageOptimizationRate >= 90) {
    imageOptScore = 10;
    imageOptRecommendation = '画像が適切に最適化されています。';
  } else if (imageOptimizationRate >= 70) {
    imageOptScore = 7;
    imageOptRecommendation = '画像の最適化率が良好です。さらなる改善の余地があります。';
  } else if (imageOptimizationRate >= 50) {
    imageOptScore = 4;
    imageOptRecommendation = '画像の最適化（WebP形式への変換、圧縮など）を推奨します。';
  } else {
    imageOptScore = 0;
    imageOptRecommendation = '画像の大幅な最適化が必要です。';
  }

  results.details.imageOptimization = {
    total: totalImages,
    optimized: optimizedImages,
    rate: imageOptimizationRate,
    score: imageOptScore,
    recommendation: imageOptRecommendation
  };

  // モバイル最適化
  const hasViewport = crawlData.html.includes('viewport');
  const mobileScore = hasViewport ? 8 : 0;
  results.details.mobileOptimization = {
    hasViewport,
    score: mobileScore,
    recommendation: hasViewport
      ? 'モバイル対応が確認できます。'
      : 'ビューポート設定によるモバイル最適化が必要です。'
  };

  // レスポンシブデザイン対応（簡易チェック）
  const hasMediaQuery = crawlData.html.includes('@media') || crawlData.html.includes('media=');
  results.details.responsiveDesign = {
    hasMediaQuery,
    score: hasMediaQuery ? 6 : 2,
    recommendation: hasMediaQuery
      ? 'レスポンシブデザインが実装されています。'
      : 'メディアクエリを使用したレスポンシブデザインの実装を推奨します。'
  };

  // キャッシュ活用状況（簡易評価）
  // 実際のHTTPヘッダーが必要ですが、ここでは基本的な評価のみ
  results.details.caching = {
    score: 2,
    recommendation: 'ブラウザキャッシュの適切な設定を確認してください。'
  };

  // 総合スコア計算
  results.score = Math.round(
    results.details.loadTime.score +
    results.details.lcp.score +
    results.details.cls.score +
    results.details.fid.score +
    results.details.serverResponseTime.score +
    results.details.domInteractive.score +
    results.details.imageOptimization.score +
    results.details.mobileOptimization.score +
    results.details.responsiveDesign.score +
    results.details.caching.score
  );

  return results;
}

module.exports = { analyzePerformance };
