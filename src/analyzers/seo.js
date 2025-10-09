const cheerio = require('cheerio');

/**
 * 技術的SEO分析
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - SEO分析結果
 */
function analyzeSEO(crawlData) {
  const $ = cheerio.load(crawlData.html);
  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  // メタタイトル分析
  const title = $('title').text();
  const titleLength = title.length;
  results.rawData.title = title;
  results.details.title = {
    value: title,
    length: titleLength,
    score: 0,
    recommendation: ''
  };

  if (titleLength > 0 && titleLength <= 60) {
    results.details.title.score = 10;
    results.details.title.recommendation = '適切なタイトル長です。';
  } else if (titleLength > 60 && titleLength <= 70) {
    results.details.title.score = 7;
    results.details.title.recommendation = 'タイトルがやや長いです。60文字以内を推奨します。';
  } else if (titleLength === 0) {
    results.details.title.score = 0;
    results.details.title.recommendation = 'タイトルが設定されていません。';
  } else {
    results.details.title.score = 5;
    results.details.title.recommendation = 'タイトルが長すぎます。60文字以内を推奨します。';
  }

  // メタディスクリプション分析
  const description = $('meta[name="description"]').attr('content') || '';
  const descriptionLength = description.length;
  results.rawData.metaDescription = description;
  results.details.metaDescription = {
    value: description,
    length: descriptionLength,
    score: 0,
    recommendation: ''
  };

  if (descriptionLength > 0 && descriptionLength <= 160) {
    results.details.metaDescription.score = 10;
    results.details.metaDescription.recommendation = '適切なディスクリプション長です。';
  } else if (descriptionLength > 160 && descriptionLength <= 200) {
    results.details.metaDescription.score = 7;
    results.details.metaDescription.recommendation = 'ディスクリプションがやや長いです。160文字以内を推奨します。';
  } else if (descriptionLength === 0) {
    results.details.metaDescription.score = 0;
    results.details.metaDescription.recommendation = 'ディスクリプションが設定されていません。';
  } else {
    results.details.metaDescription.score = 5;
    results.details.metaDescription.recommendation = 'ディスクリプションが長すぎます。160文字以内を推奨します。';
  }

  // OGP (Open Graph Protocol) 分析
  const ogTags = {};
  $('meta[property^="og:"]').each((i, el) => {
    const property = $(el).attr('property');
    const content = $(el).attr('content');
    ogTags[property] = content;
  });

  results.rawData.ogTags = ogTags;
  const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url'];
  const foundOgTags = requiredOgTags.filter(tag => ogTags[tag]);

  results.details.ogp = {
    tags: ogTags,
    score: (foundOgTags.length / requiredOgTags.length) * 10,
    found: foundOgTags.length,
    required: requiredOgTags.length,
    recommendation: foundOgTags.length === requiredOgTags.length
      ? '必要なOGPタグが全て設定されています。'
      : `${requiredOgTags.filter(t => !ogTags[t]).join(', ')} の設定を推奨します。`
  };

  // Twitter Card 分析
  const twitterTags = {};
  $('meta[name^="twitter:"]').each((i, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    twitterTags[name] = content;
  });

  results.rawData.twitterTags = twitterTags;
  results.details.twitterCard = {
    tags: twitterTags,
    score: Object.keys(twitterTags).length > 0 ? 5 : 0,
    recommendation: Object.keys(twitterTags).length > 0
      ? 'Twitter Cardが設定されています。'
      : 'Twitter Cardの設定を推奨します。'
  };

  // Canonical URL 分析
  const canonical = $('link[rel="canonical"]').attr('href');
  results.rawData.canonical = canonical;
  results.details.canonical = {
    value: canonical || null,
    score: canonical ? 5 : 0,
    recommendation: canonical ? 'カノニカルURLが設定されています。' : 'カノニカルURLの設定を推奨します。'
  };

  // robots meta 分析
  const robotsMeta = $('meta[name="robots"]').attr('content');
  results.rawData.robotsMeta = robotsMeta;
  results.details.robotsMeta = {
    value: robotsMeta || 'なし',
    score: 5,
    recommendation: robotsMeta && robotsMeta.includes('noindex')
      ? '警告: noindexが設定されています。'
      : 'robots metaの設定を確認してください。'
  };

  // hreflang 分析
  const hreflangTags = [];
  $('link[rel="alternate"]').each((i, el) => {
    const hreflang = $(el).attr('hreflang');
    const href = $(el).attr('href');
    if (hreflang) {
      hreflangTags.push({ hreflang, href });
    }
  });

  results.rawData.hreflang = hreflangTags;
  results.details.hreflang = {
    tags: hreflangTags,
    count: hreflangTags.length,
    score: 5,
    recommendation: hreflangTags.length > 0
      ? '多言語対応が設定されています。'
      : '多言語サイトの場合、hreflangの設定を推奨します。'
  };

  // 構造化データの有無（簡易チェック）
  const hasStructuredData = crawlData.structuredData && crawlData.structuredData.length > 0;
  results.details.structuredData = {
    hasData: hasStructuredData,
    count: crawlData.structuredData ? crawlData.structuredData.length : 0,
    score: hasStructuredData ? 10 : 0,
    recommendation: hasStructuredData
      ? '構造化データが実装されています。'
      : '構造化データの実装を推奨します。'
  };

  // 画像のalt属性チェック
  const images = crawlData.images || [];
  const imagesWithAlt = images.filter(img => img.alt && img.alt.trim() !== '');
  const altRate = images.length > 0 ? (imagesWithAlt.length / images.length) * 100 : 0;

  results.rawData.images = {
    total: images.length,
    withAlt: imagesWithAlt.length,
    withoutAlt: images.length - imagesWithAlt.length
  };

  results.details.imageAlt = {
    total: images.length,
    withAlt: imagesWithAlt.length,
    rate: altRate,
    score: (altRate / 100) * 10,
    recommendation: altRate >= 90
      ? '画像のalt属性が適切に設定されています。'
      : `${images.length - imagesWithAlt.length}枚の画像にalt属性が不足しています。`
  };

  // H1タグチェック
  const h1Tags = $('h1');
  const h1Count = h1Tags.length;
  const h1Text = h1Tags.map((i, el) => $(el).text().trim()).get();

  results.rawData.h1 = h1Text;
  results.details.h1 = {
    count: h1Count,
    text: h1Text,
    score: h1Count === 1 ? 10 : (h1Count > 0 ? 5 : 0),
    recommendation: h1Count === 1
      ? 'H1タグが適切に設定されています。'
      : h1Count === 0
        ? 'H1タグが設定されていません。'
        : 'H1タグは1つのみ設定することを推奨します。'
  };

  // モバイルフレンドリーチェック
  const viewport = $('meta[name="viewport"]').attr('content');
  results.rawData.viewport = viewport;
  results.details.mobileOptimization = {
    hasViewport: !!viewport,
    viewportContent: viewport || 'なし',
    score: viewport ? 10 : 0,
    recommendation: viewport
      ? 'ビューポートが設定されています。'
      : 'モバイル対応のためビューポートの設定を推奨します。'
  };

  // リダイレクトチェック
  const redirectCount = crawlData.redirectChain ? crawlData.redirectChain.length : 0;
  results.details.redirects = {
    count: redirectCount,
    chain: crawlData.redirectChain || [],
    score: redirectCount === 0 ? 10 : Math.max(0, 10 - redirectCount * 2),
    recommendation: redirectCount === 0
      ? 'リダイレクトはありません。'
      : `${redirectCount}回のリダイレクトが検出されました。リダイレクトを減らすことを推奨します。`
  };

  // 総合スコア計算
  results.score = Math.round(
    results.details.title.score +
    results.details.metaDescription.score +
    results.details.ogp.score +
    results.details.twitterCard.score +
    results.details.canonical.score +
    results.details.robotsMeta.score +
    results.details.hreflang.score +
    results.details.structuredData.score +
    results.details.imageAlt.score +
    results.details.h1.score +
    results.details.mobileOptimization.score +
    results.details.redirects.score
  );

  return results;
}

module.exports = { analyzeSEO };
