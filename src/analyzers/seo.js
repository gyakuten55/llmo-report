const cheerio = require('cheerio');

/**
 * 技術的SEO分析（2025年モバイルファースト・LLMO対応版）
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

  // 1. メタタイトル分析（10点満点）
  const title = $('title').text();
  const titleLength = title.length;
  results.rawData.title = title;
  
  let titleScore = 0;
  let titleRec = '';
  if (titleLength > 0 && titleLength <= 32) {
    titleScore = 10;
    titleRec = 'モバイル検索に最適なタイトル長です（32文字以内）。';
  } else if (titleLength > 32 && titleLength <= 60) {
    titleScore = 7;
    titleRec = '許容範囲内ですが、重要なキーワードは冒頭30文字以内に収めてください。';
  } else if (titleLength === 0) {
    titleScore = 0;
    titleRec = 'タイトルが設定されていません。';
  } else {
    titleScore = 4;
    titleRec = 'タイトルが長すぎます。スマートフォンでは省略される可能性が高いです。';
  }
  results.details.title = { value: title, length: titleLength, score: titleScore, recommendation: titleRec };

  // 2. メタディスクリプション分析（10点満点）
  const description = $('meta[name="description"]').attr('content') || '';
  const descriptionLength = description.length;
  results.rawData.metaDescription = description;
  
  let descScore = 0;
  let descRec = '';
  if (descriptionLength > 50 && descriptionLength <= 100) {
    descScore = 10;
    descRec = 'モバイル検索に最適なディスクリプション長です（100文字以内）。';
  } else if (descriptionLength > 100 && descriptionLength <= 160) {
    descScore = 7;
    descRec = 'PCには適していますが、スマホでは省略されます。重要な情報は前半に。';
  } else if (descriptionLength === 0) {
    descScore = 0;
    descRec = 'ディスクリプションが未設定です。クリック率に悪影響を与えます。';
  } else {
    descScore = 4;
    descRec = 'ディスクリプションが長すぎます。100文字程度に要約してください。';
  }
  results.details.metaDescription = { value: description, length: descriptionLength, score: descScore, recommendation: descRec };

  // 3. OGPタグ分析（10点満点）
  const ogTags = {};
  $('meta[property^="og:"]').each((i, el) => {
    ogTags[$(el).attr('property')] = $(el).attr('content');
  });
  const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url'];
  const foundOgTags = requiredOgTags.filter(tag => ogTags[tag]);
  results.details.ogp = {
    score: Math.round((foundOgTags.length / requiredOgTags.length) * 10),
    found: foundOgTags.length,
    recommendation: foundOgTags.length === 4 ? '必須OGPタグが全て設定されています。' : 'SNS拡散のため、主要なOGPタグの実装を推奨します。'
  };

  // 4. Twitter Card（5点満点）
  const hasTwitter = $('meta[name^="twitter:"]').length > 0;
  results.details.twitterCard = {
    score: hasTwitter ? 5 : 0,
    recommendation: hasTwitter ? 'Twitter Cardが設定されています。' : 'Twitterでの表示最適化のため設定を推奨します。'
  };

  // 5. Canonical URL（5点満点）
  const canonical = $('link[rel="canonical"]').attr('href');
  results.details.canonical = {
    score: canonical ? 5 : 0,
    recommendation: canonical ? 'カノニカルURLが設定されています。' : '重複コンテンツ防止のため設定を強く推奨します。'
  };

  // 6. robots meta & max-image-preview（5点満点）
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';
  let robotsScore = 3;
  if (robotsMeta.includes('max-image-preview:large')) robotsScore = 5;
  else if (robotsMeta.includes('noindex')) robotsScore = 5;
  results.details.robotsMeta = {
    score: robotsScore,
    recommendation: robotsScore === 5 ? '適切な設定です。' : 'Google Discover対策に max-image-preview:large の追加を推奨します。'
  };

  // 7. hreflang（5点満点）
  const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;
  results.details.hreflang = {
    score: hasHreflang ? 5 : 5, // 多言語でなければ5点、多言語で設定なしなら減点だが、判定が難しいため基本5点とする
    recommendation: '多言語展開時はhreflangの設定が必須です。'
  };

  // 8. 構造化データ実装（10点満点）
  const hasSD = crawlData.structuredData && crawlData.structuredData.length > 0;
  results.details.structuredData = {
    score: hasSD ? 10 : 0,
    recommendation: hasSD ? '構造化データが検出されました。' : 'JSON-LDによる構造化データの実装を強く推奨します。'
  };

  // 9. 画像Alt属性（10点満点）
  const images = crawlData.images || [];
  const withAlt = images.filter(i => i.alt && i.alt.trim() !== '').length;
  const altRate = images.length > 0 ? (withAlt / images.length) : 1;
  results.details.imageAlt = {
    score: Math.round(altRate * 10),
    recommendation: altRate > 0.9 ? '画像のAlt属性が適切に設定されています。' : '画像に代替テキスト(alt)を設定して、クローラビリティを向上させてください。'
  };

  // 10. H1タグ（10点満点）
  const h1Count = $('h1').length;
  results.details.h1 = {
    score: h1Count === 1 ? 10 : (h1Count > 1 ? 5 : 0),
    recommendation: h1Count === 1 ? 'H1タグが適切に1つ設定されています。' : 'H1タグはページ主旨を伝えるため、1つだけ設定してください。'
  };

  // 11. モバイル最適化（10点満点）
  const hasVp = crawlData.html.includes('viewport');
  results.details.mobileOptimization = {
    score: hasVp ? 10 : 0,
    recommendation: hasVp ? 'モバイル対応(viewport)が設定されています。' : 'viewportの設定がありません。スマホ対応が必須です。'
  };

  // 12. リダイレクト（10点満点）
  const redirects = crawlData.redirectChain ? crawlData.redirectChain.length : 0;
  const redScore = Math.max(0, 10 - (redirects * 3));
  results.details.redirects = {
    score: redScore,
    recommendation: redirects === 0 ? '不要なリダイレクトはありません。' : 'リダイレクト回数を減らしてクローラ効率を改善してください。'
  };

  // 総合スコア計算（各項目の満点の合計 = 10+10+10+5+5+5+5+10+10+10+10+10 = 100）
  results.score = 
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
    results.details.redirects.score;

  return results;
}

module.exports = { analyzeSEO };