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

  // Organizationスキーマのチェック
  const hasOrganization = structuredData.some(data =>
    data['@type'] === 'Organization' ||
    (Array.isArray(data['@type']) && data['@type'].includes('Organization'))
  );

  const orgData = structuredData.find(data =>
    data['@type'] === 'Organization' ||
    (Array.isArray(data['@type']) && data['@type'].includes('Organization'))
  );

  results.rawData.organization = orgData || null;

  results.details.organization = {
    implemented: hasOrganization,
    data: orgData || null,
    hasLogo: orgData?.logo ? true : false,
    hasContactPoint: orgData?.contactPoint ? true : false,
    score: hasOrganization ? 10 : 0,
    recommendation: hasOrganization
      ? 'Organizationスキーマが実装されています。'
      : 'Organizationスキーマの実装を推奨します。企業情報の明確化に有効です。'
  };

  // BreadcrumbListスキーマのチェック
  const hasBreadcrumb = structuredData.some(data =>
    data['@type'] === 'BreadcrumbList' ||
    (Array.isArray(data['@type']) && data['@type'].includes('BreadcrumbList'))
  );

  results.details.breadcrumb = {
    implemented: hasBreadcrumb,
    score: hasBreadcrumb ? 5 : 0,
    recommendation: hasBreadcrumb
      ? 'パンくずリストの構造化データが実装されています。'
      : 'パンくずリストがある場合、構造化データの実装を推奨します。'
  };

  // エンティティ情報の明確性
  // Organization, Person, Placeなどのエンティティがどれだけ詳細に記述されているか
  const entitySchemas = ['Organization', 'Person', 'Place', 'Product'];
  const foundEntities = structuredData.filter(data =>
    entitySchemas.includes(data['@type']) ||
    (Array.isArray(data['@type']) && data['@type'].some(t => entitySchemas.includes(t)))
  );

  results.rawData.entities = foundEntities;

  results.details.entityClarity = {
    count: foundEntities.length,
    entities: foundEntities.map(e => ({
      type: e['@type'],
      name: e.name || null,
      description: e.description || null
    })),
    score: Math.min(foundEntities.length * 5, 10),
    recommendation: foundEntities.length > 0
      ? 'エンティティ情報が構造化データで定義されています。'
      : '主要なエンティティ（組織、人物、場所など）の構造化データ実装を推奨します。'
  };

  // 総合スコア計算
  results.score = Math.round(
    results.details.implementation.score +
    results.details.schemaTypes.score +
    results.details.faq.score +
    results.details.howTo.score +
    results.details.article.score +
    results.details.organization.score +
    results.details.breadcrumb.score +
    results.details.entityClarity.score
  );

  return results;
}

module.exports = { analyzeStructuredData };
