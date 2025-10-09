const cheerio = require('cheerio');

/**
 * エンティティ・知識グラフ最適化評価
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - エンティティ分析結果
 */
function analyzeEntity(crawlData) {
  const $ = cheerio.load(crawlData.html);
  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  const structuredData = crawlData.structuredData || [];

  // 1. 基本エンティティ定義（25点）

  // Organization schemaの評価
  const orgSchema = structuredData.find(data =>
    data['@type'] === 'Organization' ||
    (Array.isArray(data['@type']) && data['@type'].includes('Organization'))
  );

  const orgComplete = orgSchema &&
    orgSchema.name &&
    orgSchema.logo &&
    orgSchema.contactPoint;

  results.details.organizationSchema = {
    implemented: !!orgSchema,
    hasName: orgSchema?.name ? true : false,
    hasLogo: orgSchema?.logo ? true : false,
    hasContactPoint: orgSchema?.contactPoint ? true : false,
    score: orgComplete ? 8 : (orgSchema ? 4 : 0),
    recommendation: orgComplete
      ? 'Organization schemaが完全に実装されています。'
      : orgSchema
        ? 'Organization schemaにname, logo, contactPointの追加を推奨します。'
        : 'Organization schemaの実装を推奨します。'
  };

  // Person schema（著者）の評価
  const personSchemas = structuredData.filter(data =>
    data['@type'] === 'Person' ||
    (Array.isArray(data['@type']) && data['@type'].includes('Person'))
  );

  // Articleの著者情報もチェック
  const articleSchemas = structuredData.filter(data =>
    ['Article', 'BlogPosting', 'NewsArticle'].includes(data['@type']) ||
    (Array.isArray(data['@type']) && data['@type'].some(t => ['Article', 'BlogPosting', 'NewsArticle'].includes(t)))
  );

  const hasAuthorInfo = articleSchemas.some(article => article.author) || personSchemas.length > 0;
  const authorComplete = personSchemas.some(person =>
    person.name && person.jobTitle && person.worksFor
  );

  results.details.personSchema = {
    implemented: hasAuthorInfo,
    personCount: personSchemas.length,
    hasFullInfo: authorComplete,
    score: authorComplete ? 7 : (hasAuthorInfo ? 3 : 0),
    recommendation: authorComplete
      ? '著者情報が詳細に記載されています。'
      : hasAuthorInfo
        ? '著者の資格・経歴情報の追加を推奨します。'
        : '著者情報（Person schema）の実装を推奨します。'
  };

  results.rawData.authors = personSchemas.map(p => ({
    name: p.name,
    jobTitle: p.jobTitle,
    worksFor: p.worksFor
  }));

  // @id 実装の評価
  const entitiesWithId = structuredData.filter(data => data['@id']);
  const idImplementationRate = structuredData.length > 0
    ? (entitiesWithId.length / structuredData.length) * 100
    : 0;

  results.details.idImplementation = {
    totalEntities: structuredData.length,
    entitiesWithId: entitiesWithId.length,
    rate: idImplementationRate,
    score: idImplementationRate >= 80 ? 10 : Math.floor(idImplementationRate / 10),
    recommendation: idImplementationRate >= 80
      ? '全エンティティに@idが実装されています。'
      : '全主要エンティティに@id（URI）の実装を推奨します。'
  };

  results.rawData.entitiesWithId = entitiesWithId.map(e => ({
    type: e['@type'],
    id: e['@id']
  }));

  // 2. 外部エンティティリンク（30点）

  // sameAs実装の評価
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

  const uniqueSameAs = [...new Set(sameAsLinks)];

  // Wikipedia, Wikidataなどの権威あるソースをチェック
  const authoritativeSources = uniqueSameAs.filter(link =>
    link.includes('wikipedia.org') ||
    link.includes('wikidata.org') ||
    link.includes('dbpedia.org')
  );

  results.details.sameAsImplementation = {
    count: uniqueSameAs.length,
    links: uniqueSameAs,
    authoritativeCount: authoritativeSources.length,
    score: uniqueSameAs.length >= 5 ? 15 : uniqueSameAs.length * 3,
    recommendation: uniqueSameAs.length >= 5
      ? '外部エンティティリンクが充実しています。'
      : 'Wikipedia、Wikidata等への5個以上のsameAs実装を推奨します。'
  };

  results.rawData.sameAs = uniqueSameAs;

  // NAP情報の一貫性（Name, Address, Phone）
  const napInfo = {
    name: null,
    address: null,
    phone: null
  };

  if (orgSchema) {
    napInfo.name = orgSchema.name;
    napInfo.address = orgSchema.address?.streetAddress || orgSchema.address;
    napInfo.phone = orgSchema.telephone || orgSchema.contactPoint?.telephone;
  }

  // HTMLからも情報を取得して比較
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{3,4}/g;
  const textContent = crawlData.textContent || '';
  const phonesInText = textContent.match(phonePattern) || [];

  const napConsistent = napInfo.name && (napInfo.address || napInfo.phone);

  results.details.napConsistency = {
    hasName: !!napInfo.name,
    hasAddress: !!napInfo.address,
    hasPhone: !!napInfo.phone,
    consistent: napConsistent,
    score: napConsistent ? 10 : 5,
    recommendation: napConsistent
      ? 'NAP情報（Name, Address, Phone）が構造化されています。'
      : 'NAP情報の一貫した実装を推奨します。'
  };

  results.rawData.nap = napInfo;

  // 業界データベース連携
  const industryDbLinks = sameAsLinks.filter(link =>
    !link.includes('facebook.com') &&
    !link.includes('twitter.com') &&
    !link.includes('instagram.com') &&
    !link.includes('linkedin.com') &&
    !link.includes('youtube.com') &&
    !link.includes('wikipedia.org') &&
    !link.includes('wikidata.org')
  );

  results.details.industryDatabase = {
    count: industryDbLinks.length,
    links: industryDbLinks,
    score: industryDbLinks.length > 0 ? 5 : 0,
    recommendation: industryDbLinks.length > 0
      ? '業界特有のデータベースへのリンクがあります。'
      : '業界特有の権威DBへのリンクを推奨します。'
  };

  // 3. 内部エンティティ関係（25点）

  // エンティティ間リンクの評価
  const entityRelations = [];
  structuredData.forEach(data => {
    if (data.worksFor || data.memberOf || data.parentOrganization) {
      entityRelations.push({
        entity: data['@type'],
        relation: data.worksFor ? 'worksFor' : data.memberOf ? 'memberOf' : 'parentOrganization',
        target: data.worksFor || data.memberOf || data.parentOrganization
      });
    }
  });

  results.details.entityRelations = {
    count: entityRelations.length,
    relations: entityRelations,
    score: Math.min(entityRelations.length * 4, 12),
    recommendation: entityRelations.length >= 3
      ? 'エンティティ間の関係が明確に定義されています。'
      : 'エンティティ間の関係（worksFor, memberOf等）の定義を推奨します。'
  };

  results.rawData.entityRelations = entityRelations;

  // コンテキスト明確性（曖昧性回避）
  const entitiesWithDescription = structuredData.filter(data => data.description);
  const clarityRate = structuredData.length > 0
    ? (entitiesWithDescription.length / structuredData.length) * 100
    : 0;

  results.details.contextClarity = {
    total: structuredData.length,
    withDescription: entitiesWithDescription.length,
    rate: clarityRate,
    score: clarityRate >= 70 ? 8 : Math.floor(clarityRate / 10),
    recommendation: clarityRate >= 70
      ? 'エンティティの説明が充実し、曖昧性が回避されています。'
      : '各エンティティにdescriptionを追加し、曖昧性を回避することを推奨します。'
  };

  // 階層構造の評価
  const hierarchicalEntities = structuredData.filter(data =>
    data.isPartOf || data.parentOrganization || data.parent
  );

  results.details.hierarchicalStructure = {
    count: hierarchicalEntities.length,
    score: hierarchicalEntities.length > 0 ? 5 : 0,
    recommendation: hierarchicalEntities.length > 0
      ? '階層構造が定義されています。'
      : 'isPartOf、parentOrganization等で階層構造の明示を推奨します。'
  };

  // 4. Knowledge Graph統合性（20点）

  // 全体的一貫性（エンティティ定義の重複・矛盾チェック）
  const entityTypes = structuredData.map(d => d['@type']).flat();
  const typeCount = {};
  entityTypes.forEach(type => {
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  // 同じ@idが複数あるかチェック
  const ids = structuredData.map(d => d['@id']).filter(Boolean);
  const uniqueIds = new Set(ids);
  const hasDuplicateIds = ids.length !== uniqueIds.size;

  results.details.overallConsistency = {
    uniqueTypes: Object.keys(typeCount).length,
    totalEntities: structuredData.length,
    hasDuplicateIds: hasDuplicateIds,
    consistent: !hasDuplicateIds && structuredData.length > 0,
    score: !hasDuplicateIds && structuredData.length > 0 ? 10 : 5,
    recommendation: !hasDuplicateIds && structuredData.length > 0
      ? 'エンティティ定義が一貫しています。'
      : 'エンティティ定義の重複・矛盾を確認してください。'
  };

  results.rawData.entityTypes = typeCount;

  // RDFトリプル完全性（主語・述語・目的語）
  const completeTriples = structuredData.filter(data => {
    // @type（クラス）、@id（主語）、少なくとも1つのプロパティ（述語+目的語）があるか
    const hasType = data['@type'];
    const hasId = data['@id'];
    const hasProperties = Object.keys(data).filter(k =>
      k !== '@type' && k !== '@id' && k !== '@context'
    ).length > 0;
    return hasType && hasId && hasProperties;
  });

  const tripleCompleteness = structuredData.length > 0
    ? (completeTriples.length / structuredData.length) * 100
    : 0;

  results.details.rdfCompleteness = {
    total: structuredData.length,
    complete: completeTriples.length,
    rate: tripleCompleteness,
    score: tripleCompleteness >= 80 ? 10 : Math.floor(tripleCompleteness / 10),
    recommendation: tripleCompleteness >= 80
      ? 'RDFトリプルが完全に定義されています。'
      : '全エンティティに@type、@id、プロパティの完全な定義を推奨します。'
  };

  // 総合スコア計算
  results.score = Math.round(
    results.details.organizationSchema.score +
    results.details.personSchema.score +
    results.details.idImplementation.score +
    results.details.sameAsImplementation.score +
    results.details.napConsistency.score +
    results.details.industryDatabase.score +
    results.details.entityRelations.score +
    results.details.contextClarity.score +
    results.details.hierarchicalStructure.score +
    results.details.overallConsistency.score +
    results.details.rdfCompleteness.score
  );

  return results;
}

module.exports = { analyzeEntity };
