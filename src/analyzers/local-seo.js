const cheerio = require('cheerio');

/**
 * ローカルSEO・地域最適化評価
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - ローカルSEO分析結果
 */
function analyzeLocalSEO(crawlData) {
  const $ = cheerio.load(crawlData.html);
  const textContent = crawlData.textContent || '';
  const structuredData = crawlData.structuredData || [];

  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {},
    isLocalBusiness: false
  };

  // ローカルビジネスかどうかを判定
  const localBusinessTypes = [
    'LocalBusiness', 'Restaurant', 'Store', 'Hotel', 'MedicalBusiness',
    'ProfessionalService', 'HomeAndConstructionBusiness', 'LegalService',
    'RealEstateAgent', 'TravelAgency', 'FinancialService'
  ];

  const hasLocalBusinessSchema = structuredData.some(data =>
    localBusinessTypes.includes(data['@type']) ||
    (Array.isArray(data['@type']) && data['@type'].some(t => localBusinessTypes.includes(t)))
  );

  results.isLocalBusiness = hasLocalBusinessSchema;

  // ローカルビジネスでない場合は基本点のみ返す
  if (!hasLocalBusinessSchema) {
    results.details.businessType = {
      isLocal: false,
      score: 0,
      recommendation: 'ローカルビジネスではないため、ローカルSEO評価は適用されません。'
    };
    return results;
  }

  // 1. LocalBusiness schema（40点）

  const localBusinessSchema = structuredData.find(data =>
    localBusinessTypes.includes(data['@type']) ||
    (Array.isArray(data['@type']) && data['@type'].some(t => localBusinessTypes.includes(t)))
  );

  // LocalBusiness実装
  const hasCompleteSchema = localBusinessSchema &&
    localBusinessSchema.name &&
    localBusinessSchema.address &&
    localBusinessSchema.telephone;

  results.details.localBusinessSchema = {
    implemented: !!localBusinessSchema,
    type: localBusinessSchema?.['@type'],
    hasName: !!localBusinessSchema?.name,
    hasAddress: !!localBusinessSchema?.address,
    hasTelephone: !!localBusinessSchema?.telephone,
    complete: hasCompleteSchema,
    score: hasCompleteSchema ? 20 : (localBusinessSchema ? 10 : 0),
    recommendation: hasCompleteSchema
      ? 'LocalBusiness schemaが完全に実装されています。'
      : localBusinessSchema
        ? 'LocalBusiness schemaにname, address, telephoneの追加を推奨します。'
        : 'LocalBusiness schemaの実装を推奨します。'
  };

  results.rawData.localBusinessSchema = localBusinessSchema;

  // NAP情報（Name, Address, Phone）
  const napInfo = {
    name: localBusinessSchema?.name || null,
    address: localBusinessSchema?.address?.streetAddress ||
             (typeof localBusinessSchema?.address === 'string' ? localBusinessSchema.address : null),
    telephone: localBusinessSchema?.telephone || null
  };

  // HTMLからも電話番号を検索して一致を確認
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{3,4}/g;
  const phonesInText = textContent.match(phonePattern) || [];

  const napConsistent = napInfo.name && napInfo.address && napInfo.telephone;

  results.details.napInformation = {
    hasName: !!napInfo.name,
    hasAddress: !!napInfo.address,
    hasPhone: !!napInfo.telephone,
    phonesFoundInText: phonesInText.length,
    consistent: napConsistent,
    score: napConsistent ? 10 : 5,
    recommendation: napConsistent
      ? 'NAP情報（Name, Address, Phone）が完全に定義されています。'
      : 'NAP情報を完全に記載することを推奨します。'
  };

  results.rawData.nap = napInfo;

  // 営業時間
  const hasOpeningHours = localBusinessSchema?.openingHoursSpecification ||
    localBusinessSchema?.openingHours;

  results.details.openingHours = {
    implemented: !!hasOpeningHours,
    data: hasOpeningHours || null,
    score: hasOpeningHours ? 5 : 0,
    recommendation: hasOpeningHours
      ? '営業時間が構造化データで定義されています。'
      : 'openingHoursSpecificationの実装を推奨します。'
  };

  // 地図埋め込み
  const hasMapEmbed = $('iframe').filter((i, el) => {
    const src = $(el).attr('src') || '';
    return src.includes('google.com/maps') || src.includes('maps.google');
  }).length > 0;

  results.details.mapEmbed = {
    hasMap: hasMapEmbed,
    score: hasMapEmbed ? 5 : 0,
    recommendation: hasMapEmbed
      ? 'Google Mapsが埋め込まれています。'
      : 'Google Mapsの埋め込みを推奨します。'
  };

  // 2. レビュー・評価（30点）

  // Review schema
  const hasReviewSchema = structuredData.some(data =>
    data['@type'] === 'Review' ||
    (Array.isArray(data['@type']) && data['@type'].includes('Review'))
  );

  const reviewSchemas = structuredData.filter(data =>
    data['@type'] === 'Review' ||
    (Array.isArray(data['@type']) && data['@type'].includes('Review'))
  );

  results.details.reviewSchema = {
    implemented: hasReviewSchema,
    count: reviewSchemas.length,
    score: reviewSchemas.length >= 5 ? 15 :
           reviewSchemas.length * 3,
    recommendation: reviewSchemas.length >= 5
      ? 'レビュースキーマが充実しています。'
      : hasReviewSchema
        ? 'より多くのレビューをスキーマで実装することを推奨します。'
        : 'Review schemaの実装を推奨します。'
  };

  results.rawData.reviews = reviewSchemas;

  // aggregateRating
  const hasAggregateRating = localBusinessSchema?.aggregateRating ||
    structuredData.some(data => data.aggregateRating);

  const aggregateRatingData = localBusinessSchema?.aggregateRating ||
    structuredData.find(data => data.aggregateRating)?.aggregateRating;

  results.details.aggregateRating = {
    implemented: !!hasAggregateRating,
    rating: aggregateRatingData?.ratingValue || null,
    reviewCount: aggregateRatingData?.reviewCount || null,
    score: hasAggregateRating ? 10 : 0,
    recommendation: hasAggregateRating
      ? '集計評価（aggregateRating）が表示されています。'
      : 'aggregateRatingの実装を推奨します。'
  };

  results.rawData.aggregateRating = aggregateRatingData;

  // レビュー数（HTML内のレビュー表示）
  const reviewKeywords = ['レビュー', '口コミ', 'クチコミ', 'review', '評価', '星'];
  let reviewMentionCount = 0;
  reviewKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) reviewMentionCount++;
  });

  results.details.reviewDisplay = {
    hasReviewKeywords: reviewMentionCount > 0,
    keywordCount: reviewMentionCount,
    score: reviewMentionCount >= 3 ? 5 : 0,
    recommendation: reviewMentionCount >= 3
      ? 'レビュー・評価が表示されています。'
      : 'レビューや評価の表示を推奨します。'
  };

  // 3. 地域コンテンツ（30点）

  // 地域名の言及
  const regionalKeywords = [
    '東京', '大阪', '名古屋', '札幌', '福岡', '京都', '神戸', '横浜',
    '市', '区', '町', '村', '県', '都', '府', '道'
  ];

  let regionalMentionCount = 0;
  const foundRegionalKeywords = [];
  regionalKeywords.forEach(keyword => {
    const matches = textContent.match(new RegExp(keyword, 'g'));
    if (matches) {
      regionalMentionCount += matches.length;
      if (!foundRegionalKeywords.includes(keyword)) {
        foundRegionalKeywords.push(keyword);
      }
    }
  });

  results.details.regionalMentions = {
    count: regionalMentionCount,
    uniqueKeywords: foundRegionalKeywords.length,
    keywords: foundRegionalKeywords,
    score: regionalMentionCount >= 10 ? 15 :
           regionalMentionCount >= 5 ? 10 :
           Math.min(regionalMentionCount * 2, 15),
    recommendation: regionalMentionCount >= 10
      ? '地域名が適切に言及されています。'
      : '地域名（市区町村名）を10回以上言及することを推奨します。'
  };

  results.rawData.regionalKeywords = foundRegionalKeywords;

  // ローカル情報
  const localInfoKeywords = [
    'アクセス', '行き方', '最寄り駅', '駅から', '徒歩', '分', 'バス',
    '駐車場', 'パーキング', '地図', 'マップ', '周辺', '近く'
  ];

  let localInfoCount = 0;
  const foundLocalInfo = [];
  localInfoKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) {
      localInfoCount++;
      foundLocalInfo.push(keyword);
    }
  });

  results.details.localInformation = {
    hasLocalInfo: localInfoCount > 0,
    keywordCount: localInfoCount,
    keywords: foundLocalInfo,
    score: localInfoCount >= 5 ? 10 :
           localInfoCount * 2,
    recommendation: localInfoCount >= 5
      ? '地域特有の情報が提供されています。'
      : 'アクセス情報や周辺情報など、地域特有の情報を追加することを推奨します。'
  };

  // アクセス情報
  const accessKeywords = ['アクセス', '行き方', '最寄り駅', '所在地', '住所', 'address'];
  const hasAccessInfo = accessKeywords.some(keyword =>
    textContent.toLowerCase().includes(keyword.toLowerCase())
  );

  // アクセス方法の詳細度
  const transportKeywords = ['徒歩', '電車', 'バス', '車', 'タクシー', '自転車'];
  let transportMethodCount = 0;
  transportKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) transportMethodCount++;
  });

  results.details.accessInformation = {
    hasAccessSection: hasAccessInfo,
    transportMethods: transportMethodCount,
    score: (hasAccessInfo && transportMethodCount >= 2) ? 5 :
           hasAccessInfo ? 3 : 0,
    recommendation: hasAccessInfo && transportMethodCount >= 2
      ? '詳細な交通アクセス情報があります。'
      : hasAccessInfo
        ? 'より詳細なアクセス方法（徒歩、電車、車等）の記載を推奨します。'
        : 'アクセス情報セクションの追加を推奨します。'
  };

  // 総合スコア計算（ローカルビジネスの場合のみ）
  results.score = Math.round(
    results.details.localBusinessSchema.score +
    results.details.napInformation.score +
    results.details.openingHours.score +
    results.details.mapEmbed.score +
    results.details.reviewSchema.score +
    results.details.aggregateRating.score +
    results.details.reviewDisplay.score +
    results.details.regionalMentions.score +
    results.details.localInformation.score +
    results.details.accessInformation.score
  );

  return results;
}

module.exports = { analyzeLocalSEO };
