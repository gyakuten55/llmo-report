/**
 * 構造化データ評価
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - 構造化データ分析結果
 */
function analyzeStructuredData(crawlData) {
  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  const structuredData = crawlData.structuredData || [];

  // 構造化データの存在チェック
  results.rawData.structuredData = structuredData;
  results.rawData.count = structuredData.length;

  results.details.implementation = {
    hasData: structuredData.length > 0,
    count: structuredData.length,
    score: structuredData.length > 0 ? 20 : 0,
    recommendation: structuredData.length > 0
      ? '構造化データが実装されています。'
      : '構造化データの実装を強く推奨します。SEO及びLLMOに効果的です。'
  };

  // スキーマタイプの分析
  const schemaTypes = new Set();
  structuredData.forEach(data => {
    if (data['@type']) {
      if (Array.isArray(data['@type'])) {
        data['@type'].forEach(type => schemaTypes.add(type));
      } else {
        schemaTypes.add(data['@type']);
      }
    }
  });

  const schemaTypesArray = Array.from(schemaTypes);
  results.rawData.schemaTypes = schemaTypesArray;

  results.details.schemaTypes = {
    types: schemaTypesArray,
    count: schemaTypesArray.length,
    score: Math.min(schemaTypesArray.length * 10, 20),
    recommendation: schemaTypesArray.length > 0
      ? `${schemaTypesArray.join(', ')} が実装されています。`
      : 'Organization, WebPage, Article等の基本的なスキーマの実装を推奨します。'
  };

  // FAQスキーマのチェック
  const hasFAQ = structuredData.some(data =>
    data['@type'] === 'FAQPage' ||
    (Array.isArray(data['@type']) && data['@type'].includes('FAQPage'))
  );

  const faqData = structuredData.find(data =>
    data['@type'] === 'FAQPage' ||
    (Array.isArray(data['@type']) && data['@type'].includes('FAQPage'))
  );

  results.rawData.faq = faqData || null;

  results.details.faq = {
    implemented: hasFAQ,
    data: faqData || null,
    questionCount: faqData?.mainEntity?.length || 0,
    score: hasFAQ ? 15 : 0,
    recommendation: hasFAQ
      ? 'FAQスキーマが実装されています。LLMO対策に効果的です。'
      : 'FAQスキーマの実装を推奨します。AI検索での引用確率が向上します。'
  };

  // HowToスキーマのチェック
  const hasHowTo = structuredData.some(data =>
    data['@type'] === 'HowTo' ||
    (Array.isArray(data['@type']) && data['@type'].includes('HowTo'))
  );

  const howToData = structuredData.find(data =>
    data['@type'] === 'HowTo' ||
    (Array.isArray(data['@type']) && data['@type'].includes('HowTo'))
  );

  results.rawData.howTo = howToData || null;

  results.details.howTo = {
    implemented: hasHowTo,
    data: howToData || null,
    stepCount: howToData?.step?.length || 0,
    score: hasHowTo ? 10 : 0,
    recommendation: hasHowTo
      ? 'HowToスキーマが実装されています。'
      : '手順を説明するコンテンツがある場合、HowToスキーマの実装を推奨します。'
  };

  // Articleスキーマのチェック
  const hasArticle = structuredData.some(data =>
    ['Article', 'NewsArticle', 'BlogPosting'].includes(data['@type']) ||
    (Array.isArray(data['@type']) && data['@type'].some(t => ['Article', 'NewsArticle', 'BlogPosting'].includes(t)))
  );

  const articleData = structuredData.find(data =>
    ['Article', 'NewsArticle', 'BlogPosting'].includes(data['@type']) ||
    (Array.isArray(data['@type']) && data['@type'].some(t => ['Article', 'NewsArticle', 'BlogPosting'].includes(t)))
  );

  results.rawData.article = articleData || null;

  results.details.article = {
    implemented: hasArticle,
    data: articleData || null,
    hasAuthor: articleData?.author ? true : false,
    hasDatePublished: articleData?.datePublished ? true : false,
    score: hasArticle ? 10 : 0,
    recommendation: hasArticle
      ? 'Articleスキーマが実装されています。'
      : '記事コンテンツの場合、Articleスキーマの実装を推奨します。'
  };

  // Organization/LocalBusinessスキーマ分析
  const orgSchemas = structuredData.filter(data =>
    ['Organization', 'Corporation', 'LocalBusiness', 'Store', 'Restaurant'].includes(data['@type']) ||
    (Array.isArray(data['@type']) && data['@type'].some(t => ['Organization', 'Corporation', 'LocalBusiness', 'Store', 'Restaurant'].includes(t)))
  );

  const orgData = orgSchemas.length > 0 ? orgSchemas[0] : null;
  results.rawData.organization = orgData;

  let orgScore = 0;
  let orgRec = '組織情報の構造化データが見つかりません。';
  let hasLogo = false;
  let hasSameAs = false;

  if (orgData) {
    const type = orgData['@type'];
    const isLocal = ['LocalBusiness', 'Store', 'Restaurant'].includes(type) ||
                    (Array.isArray(type) && type.some(t => ['LocalBusiness', 'Store', 'Restaurant'].includes(t)));
    
    hasLogo = !!orgData.logo;
    hasSameAs = !!orgData.sameAs && (Array.isArray(orgData.sameAs) ? orgData.sameAs.length > 0 : !!orgData.sameAs);

    if (isLocal) {
      orgScore = 15;
      orgRec = 'LocalBusiness（またはそのサブタイプ）が実装されています。';
    } else {
      orgScore = 10;
      orgRec = 'Organizationが実装されています。実店舗がある場合はLocalBusinessへの変更を推奨します。';
    }

    if (hasLogo) {
      orgScore += 5;
    } else {
      orgRec += 'ロゴ（logo）プロパティの追加を推奨します。';
    }

    if (hasSameAs) {
      orgRec += ' 外部サイトとの接続（sameAs）が設定されています。';
    } else {
      orgRec += ' ナレッジグラフ確立のため、sameAs（SNSやWikipedia等へのリンク）の追加を強く推奨します。';
    }
  }

  results.details.organization = {
    implemented: !!orgData,
    data: orgData,
    hasLogo,
    hasSameAs,
    score: orgScore, // Max 20+ (can exceed but handled in total) -> adjusted to contribute to total
    recommendation: orgRec
  };

  // BreadcrumbListスキーマのチェック
  const hasBreadcrumb = structuredData.some(data =>
    data['@type'] === 'BreadcrumbList' ||
    (Array.isArray(data['@type']) && data['@type'].includes('BreadcrumbList'))
  );

  results.details.breadcrumb = {
    implemented: hasBreadcrumb,
    score: hasBreadcrumb ? 10 : 0,
    recommendation: hasBreadcrumb
      ? 'パンくずリストの構造化データが実装されています。'
      : 'パンくずリストがある場合、構造化データの実装を推奨します。'
  };

  // 総合スコア計算
  results.score = Math.min(100,
    results.details.implementation.score + // Max 20
    results.details.schemaTypes.score +    // Max 20
    results.details.faq.score +            // Max 15
    results.details.howTo.score +          // Max 10
    results.details.article.score +        // Max 10
    results.details.organization.score +   // Max 20 (base 15 + logo 5)
    results.details.breadcrumb.score       // Max 10
  );

  return results;
}

module.exports = { analyzeStructuredData };
