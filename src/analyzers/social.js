const cheerio = require('cheerio');

/**
 * ソーシャルシグナル評価
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - ソーシャルシグナル分析結果
 */
function analyzeSocial(crawlData) {
  const $ = cheerio.load(crawlData.html);
  const structuredData = crawlData.structuredData || [];

  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  // 1. OGP最適化（30点）

  // 必須OGPタグ
  const ogTags = {};
  $('meta[property^="og:"]').each((i, el) => {
    const property = $(el).attr('property');
    const content = $(el).attr('content');
    ogTags[property] = content;
  });

  const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url'];
  const foundRequiredTags = requiredOgTags.filter(tag => ogTags[tag]);

  results.details.requiredOGP = {
    tags: ogTags,
    required: requiredOgTags,
    found: foundRequiredTags,
    completeness: (foundRequiredTags.length / requiredOgTags.length) * 100,
    score: (foundRequiredTags.length / requiredOgTags.length) * 15,
    recommendation: foundRequiredTags.length === requiredOgTags.length
      ? '必須OGPタグが全て設定されています。'
      : `${requiredOgTags.filter(t => !ogTags[t]).join(', ')} の設定を推奨します。`
  };

  results.rawData.ogTags = ogTags;

  // OGP画像の質（サイズ推奨: 1200x630px）
  const ogImage = ogTags['og:image'];
  const ogImageWidth = ogTags['og:image:width'];
  const ogImageHeight = ogTags['og:image:height'];

  const hasOptimalSize = ogImageWidth && ogImageHeight &&
    parseInt(ogImageWidth) >= 1200 &&
    parseInt(ogImageHeight) >= 600;

  results.details.ogImageQuality = {
    hasImage: !!ogImage,
    width: ogImageWidth || 'unknown',
    height: ogImageHeight || 'unknown',
    optimalSize: hasOptimalSize,
    score: hasOptimalSize ? 10 :
           (ogImage ? 5 : 0),
    recommendation: hasOptimalSize
      ? 'OGP画像が最適なサイズ（1200x630px以上）です。'
      : ogImage
        ? 'OGP画像のサイズを1200x630px以上に設定することを推奨します。'
        : 'OGP画像の設定を推奨します。'
  };

  // OGP説明文の質
  const ogDescription = ogTags['og:description'];
  const descLength = ogDescription ? ogDescription.length : 0;
  const isOptimalLength = descLength >= 100 && descLength <= 200;

  results.details.ogDescriptionQuality = {
    hasDescription: !!ogDescription,
    length: descLength,
    optimalLength: isOptimalLength,
    score: isOptimalLength ? 5 :
           (descLength >= 50 && descLength <= 300) ? 3 :
           (descLength > 0 ? 1 : 0),
    recommendation: isOptimalLength
      ? 'OGP説明文が最適な長さ（100-200文字）です。'
      : descLength > 200
        ? 'OGP説明文が長すぎます。100-200文字を推奨します。'
        : descLength > 0
          ? 'OGP説明文を100-200文字に調整することを推奨します。'
          : 'OGP説明文の設定を推奨します。'
  };

  // 2. Twitter Card（20点）

  // Twitter Cardタグ
  const twitterTags = {};
  $('meta[name^="twitter:"]').each((i, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    twitterTags[name] = content;
  });

  const hasTwitterCard = twitterTags['twitter:card'] === 'summary_large_image';
  const hasTwitterTitle = !!twitterTags['twitter:title'];
  const hasTwitterDescription = !!twitterTags['twitter:description'];
  const hasTwitterImage = !!twitterTags['twitter:image'];

  const twitterCompleteness = [
    hasTwitterCard,
    hasTwitterTitle,
    hasTwitterDescription,
    hasTwitterImage
  ].filter(Boolean).length;

  results.details.twitterCard = {
    tags: twitterTags,
    cardType: twitterTags['twitter:card'] || 'なし',
    hasLargeImage: hasTwitterCard,
    completeness: (twitterCompleteness / 4) * 100,
    score: twitterCompleteness * 3.75,
    recommendation: twitterCompleteness === 4
      ? 'Twitter Cardが完全に実装されています（summary_large_image推奨）。'
      : hasTwitterCard
        ? 'Twitter Cardのtitle, description, imageの追加を推奨します。'
        : 'Twitter Cardの実装を推奨します（summary_large_image）。'
  };

  results.rawData.twitterTags = twitterTags;

  // Twitter固有情報
  const hasTwitterSite = !!twitterTags['twitter:site'];
  const hasTwitterCreator = !!twitterTags['twitter:creator'];

  results.details.twitterSpecific = {
    hasSite: hasTwitterSite,
    hasCreator: hasTwitterCreator,
    siteHandle: twitterTags['twitter:site'] || 'なし',
    creatorHandle: twitterTags['twitter:creator'] || 'なし',
    score: (hasTwitterSite ? 2.5 : 0) + (hasTwitterCreator ? 2.5 : 0),
    recommendation: (hasTwitterSite && hasTwitterCreator)
      ? 'Twitterアカウント情報が設定されています。'
      : 'twitter:siteとtwitter:creatorの設定を推奨します。'
  };

  // 3. ソーシャル統合（30点）

  // ソーシャルプロフィール（sameAs）
  const sameAsLinks = [];
  structuredData.forEach(data => {
    if (data.sameAs) {
      if (Array.isArray(data.sameAs)) {
        sameAsLinks.push(...data.sameAs);
      } else {
        sameAsLinks.push(data.sameAs);
      }
    }
  });

  const socialPlatforms = [
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'linkedin.com',
    'youtube.com',
    'tiktok.com',
    'pinterest.com'
  ];

  const socialLinks = sameAsLinks.filter(link =>
    socialPlatforms.some(platform => link.includes(platform))
  );

  results.details.socialProfiles = {
    count: socialLinks.length,
    platforms: socialLinks,
    score: socialLinks.length >= 5 ? 15 :
           socialLinks.length * 3,
    recommendation: socialLinks.length >= 5
      ? '5つ以上のSNSプロフィールが連携されています。'
      : socialLinks.length > 0
        ? 'より多くのSNSプロフィール（5つ以上）の連携を推奨します。'
        : 'sameAsプロパティでSNSプロフィールを連携することを推奨します。'
  };

  results.rawData.socialProfiles = socialLinks;

  // 共有ボタン
  const shareButtonKeywords = [
    'share', 'シェア', '共有', 'tweet', 'ツイート',
    'facebook', 'twitter', 'line', 'linkedin'
  ];

  let shareButtonCount = 0;
  $('a, button').each((i, el) => {
    const text = $(el).text().toLowerCase();
    const classes = $(el).attr('class')?.toLowerCase() || '';
    const href = $(el).attr('href')?.toLowerCase() || '';

    const hasShareKeyword = shareButtonKeywords.some(keyword =>
      text.includes(keyword) || classes.includes(keyword) || href.includes(keyword)
    );

    if (hasShareKeyword) shareButtonCount++;
  });

  // 主要SNSの共有ボタンがあるか
  const hasFacebookShare = shareButtonCount > 0 &&
    $('a[href*="facebook.com/sharer"], button:contains("Facebook"), a:contains("Facebook")').length > 0;
  const hasTwitterShare = shareButtonCount > 0 &&
    $('a[href*="twitter.com/intent"], a[href*="x.com/intent"], button:contains("Tweet"), button:contains("ツイート")').length > 0;
  const hasLineShare = shareButtonCount > 0 &&
    $('a[href*="line.me"], button:contains("LINE")').length > 0;

  const majorPlatforms = [hasFacebookShare, hasTwitterShare, hasLineShare].filter(Boolean).length;

  results.details.shareButtons = {
    totalButtons: shareButtonCount,
    hasFacebook: hasFacebookShare,
    hasTwitter: hasTwitterShare,
    hasLine: hasLineShare,
    majorPlatforms: majorPlatforms,
    score: majorPlatforms >= 3 ? 10 :
           shareButtonCount > 0 ? 7 : 0,
    recommendation: majorPlatforms >= 3
      ? '主要SNSの共有ボタンが実装されています。'
      : shareButtonCount > 0
        ? 'Facebook, Twitter, LINE等の主要SNSの共有ボタンを推奨します。'
        : 'SNS共有ボタンの実装を推奨します。'
  };

  // ソーシャル言及（外部APIが必要なため、代替指標を使用）
  const socialMentionKeywords = ['話題', '注目', 'バズ', 'viral', 'trending'];
  const textContent = crawlData.textContent || '';
  const hasSocialMention = socialMentionKeywords.some(keyword =>
    textContent.includes(keyword)
  );

  results.details.socialMention = {
    hasMentionKeywords: hasSocialMention,
    score: hasSocialMention ? 5 : 0,
    recommendation: hasSocialMention
      ? 'ソーシャルメディアでの言及を示すキーワードがあります。'
      : '※実際のSNSでの言及数は外部APIで測定できます。'
  };

  // 4. ブランド一貫性（20点）

  // ロゴの一貫性
  const logoUrls = [];

  // 構造化データからロゴを取得
  structuredData.forEach(data => {
    if (data.logo) {
      if (typeof data.logo === 'string') {
        logoUrls.push(data.logo);
      } else if (data.logo.url) {
        logoUrls.push(data.logo.url);
      }
    }
  });

  // OGP画像もチェック
  if (ogTags['og:logo']) {
    logoUrls.push(ogTags['og:logo']);
  }

  const uniqueLogos = [...new Set(logoUrls)];
  const logoConsistent = uniqueLogos.length <= 1 && uniqueLogos.length > 0;

  results.details.logoConsistency = {
    logoCount: logoUrls.length,
    uniqueLogos: uniqueLogos.length,
    logos: uniqueLogos,
    consistent: logoConsistent,
    score: logoConsistent ? 10 :
           uniqueLogos.length > 0 ? 5 : 0,
    recommendation: logoConsistent
      ? 'ロゴが一貫して使用されています。'
      : uniqueLogos.length > 1
        ? '複数の異なるロゴが検出されました。統一を推奨します。'
        : 'ロゴの設定を推奨します。'
  };

  results.rawData.logos = uniqueLogos;

  // ブランド名の統一
  const brandNames = [];

  // 構造化データから組織名を取得
  structuredData.forEach(data => {
    if (data['@type'] === 'Organization' && data.name) {
      brandNames.push(data.name);
    }
  });

  // タイトルとOGPからも取得
  const pageTitle = $('title').text();
  if (pageTitle) brandNames.push(pageTitle.split(/[-|–—]/)[0].trim());

  if (ogTags['og:site_name']) {
    brandNames.push(ogTags['og:site_name']);
  }

  const uniqueBrands = [...new Set(brandNames.filter(name => name.length > 0))];
  const brandConsistent = uniqueBrands.length <= 2; // 多少のバリエーションは許容

  results.details.brandNameConsistency = {
    brandNames: brandNames,
    uniqueBrands: uniqueBrands,
    consistent: brandConsistent,
    score: brandConsistent && uniqueBrands.length > 0 ? 10 : 5,
    recommendation: brandConsistent && uniqueBrands.length > 0
      ? 'ブランド名が統一されています。'
      : uniqueBrands.length > 2
        ? 'ブランド名に表記ゆれがあります。統一を推奨します。'
        : 'ブランド名の明示を推奨します。'
  };

  results.rawData.brandNames = uniqueBrands;

  // 総合スコア計算
  results.score = Math.round(
    results.details.requiredOGP.score +
    results.details.ogImageQuality.score +
    results.details.ogDescriptionQuality.score +
    results.details.twitterCard.score +
    results.details.twitterSpecific.score +
    results.details.socialProfiles.score +
    results.details.shareButtons.score +
    results.details.socialMention.score +
    results.details.logoConsistency.score +
    results.details.brandNameConsistency.score
  );

  return results;
}

module.exports = { analyzeSocial };
