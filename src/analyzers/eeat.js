const cheerio = require('cheerio');

/**
 * E-E-A-T（Experience, Expertise, Authoritativeness, Trustworthiness）評価
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - E-E-A-T分析結果
 */
function analyzeEEAT(crawlData) {
  const $ = cheerio.load(crawlData.html);
  const textContent = crawlData.textContent || '';
  const structuredData = crawlData.structuredData || [];

  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  // 1. Experience（実体験）評価（25点）

  // 一次情報の提供
  const primaryInfoKeywords = ['調査', '実験', 'テスト', '検証', '分析', '実測', '計測'];
  let primaryInfoCount = 0;
  primaryInfoKeywords.forEach(keyword => {
    const matches = textContent.match(new RegExp(keyword, 'g'));
    if (matches) primaryInfoCount += matches.length;
  });

  results.details.primaryInformation = {
    keywordCount: primaryInfoCount,
    keywords: primaryInfoKeywords.filter(kw => textContent.includes(kw)),
    score: primaryInfoCount >= 5 ? 10 : Math.min(primaryInfoCount * 2, 10),
    recommendation: primaryInfoCount >= 5
      ? '一次情報（調査・実験データ）が提供されています。'
      : 'オリジナルの調査・実験データの追加を推奨します。'
  };

  // 実体験の記述
  const experiencePatterns = [
    '実際に', '使ってみた', '試してみた', 'やってみた', '体験した',
    '使用した', '利用した', '実践した', '経験した'
  ];

  let experienceCount = 0;
  const foundExperiencePatterns = [];
  experiencePatterns.forEach(pattern => {
    const matches = textContent.match(new RegExp(pattern, 'g'));
    if (matches) {
      experienceCount += matches.length;
      foundExperiencePatterns.push(pattern);
    }
  });

  results.details.experienceDescription = {
    count: experienceCount,
    patterns: foundExperiencePatterns,
    score: experienceCount >= 5 ? 8 : Math.min(experienceCount * 1.6, 8),
    recommendation: experienceCount >= 5
      ? '実体験に基づく記述が充実しています。'
      : '「実際に〜した」形式の実体験記述を推奨します。'
  };

  // ビフォーアフター（結果の実例）
  const beforeAfterKeywords = ['ビフォーアフター', '結果', '成果', '効果', '改善', '変化', '比較'];
  let beforeAfterCount = 0;
  beforeAfterKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) beforeAfterCount++;
  });

  const hasImages = (crawlData.images || []).length > 0;

  results.details.beforeAfter = {
    hasResultKeywords: beforeAfterCount > 0,
    keywordCount: beforeAfterCount,
    hasImages: hasImages,
    score: (beforeAfterCount >= 2 && hasImages) ? 4 : (beforeAfterCount > 0 ? 2 : 0),
    recommendation: beforeAfterCount >= 2
      ? '結果の実例が提示されています。'
      : 'ビフォーアフター等の結果実例の追加を推奨します。'
  };

  // 日付の明示
  const datePatterns = [
    /\d{4}年\d{1,2}月\d{1,2}日/g,
    /\d{4}\/\d{1,2}\/\d{1,2}/g,
    /\d{4}-\d{1,2}-\d{1,2}/g
  ];

  let dateCount = 0;
  datePatterns.forEach(pattern => {
    const matches = textContent.match(pattern);
    if (matches) dateCount += matches.length;
  });

  const hasPublishDate = $('meta[property="article:published_time"]').length > 0 ||
    $('time').length > 0 ||
    structuredData.some(d => d.datePublished);

  results.details.dateSpecification = {
    dateCount: dateCount,
    hasPublishDate: hasPublishDate,
    score: (dateCount >= 3 || hasPublishDate) ? 3 : 0,
    recommendation: (dateCount >= 3 || hasPublishDate)
      ? '体験・情報の日時が明示されています。'
      : '体験した日時や情報の日付を明示することを推奨します。'
  };

  // 2. Expertise（専門性）評価（25点）

  // 著者の資格明示
  const credentialKeywords = [
    '資格', '認定', '博士', '修士', '学士', 'PhD', 'MBA',
    '専門家', 'エキスパート', 'スペシャリスト', '認定資格',
    '国家資格', '技術士', '一級', '二級'
  ];

  let credentialCount = 0;
  const foundCredentials = [];
  credentialKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) {
      credentialCount++;
      foundCredentials.push(keyword);
    }
  });

  const hasAuthorMeta = $('meta[name="author"]').length > 0 ||
    $('[rel="author"]').length > 0 ||
    structuredData.some(d => d.author);

  results.details.authorCredentials = {
    hasAuthorMeta: hasAuthorMeta,
    credentialCount: credentialCount,
    credentials: foundCredentials,
    score: (credentialCount >= 2 && hasAuthorMeta) ? 10 : (credentialCount > 0 ? 5 : 0),
    recommendation: credentialCount >= 2
      ? '著者の専門資格が明示されています。'
      : '著者の専門資格・学位の記載を推奨します。'
  };

  results.rawData.authorCredentials = foundCredentials;

  // 専門用語の適切な使用
  const technicalTermsPattern = /[ぁ-ん一-龯]+（[A-Za-z\s]+）/g;
  const technicalTerms = textContent.match(technicalTermsPattern) || [];

  results.details.technicalTerms = {
    count: technicalTerms.length,
    examples: technicalTerms.slice(0, 5),
    score: technicalTerms.length >= 5 ? 7 : Math.min(technicalTerms.length * 1.4, 7),
    recommendation: technicalTerms.length >= 5
      ? '専門用語が適切に定義されています。'
      : '専門用語を使用し、適切な説明を加えることを推奨します。'
  };

  // 深い知識の提示（コンテンツ深度）
  const paragraphs = $('p').length;
  const lists = $('ul, ol').length;
  const tables = $('table').length;
  const headings = $('h2, h3, h4').length;

  const contentDepth = paragraphs + lists * 2 + tables * 3 + headings;

  results.details.knowledgeDepth = {
    paragraphs: paragraphs,
    lists: lists,
    tables: tables,
    headings: headings,
    depthScore: contentDepth,
    score: contentDepth >= 30 ? 8 : Math.min(Math.floor(contentDepth / 4), 8),
    recommendation: contentDepth >= 30
      ? '深い知識が体系的に提示されています。'
      : '段落、リスト、表等を活用し、より詳細な解説を推奨します。'
  };

  // 3. Authoritativeness（権威性）評価（25点）

  // 外部引用・被リンク（クロール時には取得困難なため、代替指標を使用）
  const externalLinks = (crawlData.links || []).filter(link => !link.isInternal);
  const authoritativeDomains = externalLinks.filter(link =>
    link.href.includes('.gov') ||
    link.href.includes('.go.jp') ||
    link.href.includes('.ac.jp') ||
    link.href.includes('.edu') ||
    link.href.includes('wikipedia.org') ||
    link.href.includes('doi.org')
  );

  results.details.externalCitations = {
    totalExternal: externalLinks.length,
    authoritativeCount: authoritativeDomains.length,
    domains: authoritativeDomains.map(l => l.href).slice(0, 5),
    score: authoritativeDomains.length >= 3 ? 10 : authoritativeDomains.length * 3,
    recommendation: authoritativeDomains.length >= 3
      ? '権威あるサイトからの引用があります。'
      : '政府機関、大学、学術サイト等への引用を推奨します。'
  };

  results.rawData.authoritativeCitations = authoritativeDomains.map(l => l.href);

  // メディア掲載実績
  const mediaKeywords = ['掲載', 'メディア', '取材', '紹介された', '特集', '記事', 'インタビュー'];
  let mediaCount = 0;
  mediaKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) mediaCount++;
  });

  results.details.mediaExposure = {
    hasMediaKeywords: mediaCount > 0,
    keywordCount: mediaCount,
    score: mediaCount >= 3 ? 7 : Math.min(mediaCount * 2, 7),
    recommendation: mediaCount >= 3
      ? 'メディア掲載の実績が記載されています。'
      : 'メディア掲載実績を記載することを推奨します。'
  };

  // 業界での認知度（賞・認定）
  const recognitionKeywords = ['賞', 'アワード', '受賞', '認定', '承認', '公認', '登録', '選出'];
  let recognitionCount = 0;
  recognitionKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) recognitionCount++;
  });

  results.details.industryRecognition = {
    hasRecognition: recognitionCount > 0,
    keywordCount: recognitionCount,
    score: recognitionCount >= 2 ? 8 : Math.min(recognitionCount * 4, 8),
    recommendation: recognitionCount >= 2
      ? '業界での認知・受賞実績があります。'
      : '受賞歴や業界認定を記載することを推奨します。'
  };

  // 4. Trustworthiness（信頼性）評価（25点）

  // 引用元の明示
  const citationKeywords = ['出典', '参考', '引用', 'source', 'via', 'から引用'];
  let citationCount = 0;
  citationKeywords.forEach(keyword => {
    const matches = textContent.match(new RegExp(keyword, 'gi'));
    if (matches) citationCount += matches.length;
  });

  const hasCiteTag = $('cite').length > 0;
  const hasBlockquote = $('blockquote').length > 0;

  results.details.citationClarity = {
    citationCount: citationCount,
    hasCiteTag: hasCiteTag,
    hasBlockquote: hasBlockquote,
    score: (citationCount >= 3 || (hasCiteTag && hasBlockquote)) ? 10 : Math.min(citationCount * 2, 10),
    recommendation: citationCount >= 3
      ? '引用元が明確に記載されています。'
      : '全ての主張に出典リンクを追加することを推奨します。'
  };

  // 連絡先情報
  const contactKeywords = ['お問い合わせ', '連絡先', 'お問合せ', 'コンタクト', 'contact'];
  const hasContactInfo = contactKeywords.some(keyword => textContent.includes(keyword));
  const hasMailtoLink = $('a[href^="mailto:"]').length > 0;
  const hasTelLink = $('a[href^="tel:"]').length > 0;

  const contactMethods = [hasContactInfo, hasMailtoLink, hasTelLink].filter(Boolean).length;

  results.details.contactInformation = {
    hasContactPage: hasContactInfo,
    hasEmail: hasMailtoLink,
    hasPhone: hasTelLink,
    methodCount: contactMethods,
    score: contactMethods >= 2 ? 5 : contactMethods * 2,
    recommendation: contactMethods >= 2
      ? '複数の連絡方法が提供されています。'
      : '電話・メール等の複数の連絡方法を提供することを推奨します。'
  };

  // プライバシーポリシー
  const privacyKeywords = ['プライバシーポリシー', 'privacy policy', '個人情報保護方針', '個人情報'];
  const hasPrivacyPolicy = privacyKeywords.some(keyword =>
    textContent.toLowerCase().includes(keyword.toLowerCase())
  );

  results.details.privacyPolicy = {
    hasPolicy: hasPrivacyPolicy,
    score: hasPrivacyPolicy ? 4 : 0,
    recommendation: hasPrivacyPolicy
      ? 'プライバシーポリシーが確認できます。'
      : '詳細なプライバシーポリシーページの設置を推奨します。'
  };

  // SSL証明書（HTTPS）
  const isHttps = crawlData.url.startsWith('https://');

  results.details.sslCertificate = {
    isHttps: isHttps,
    score: isHttps ? 3 : 0,
    recommendation: isHttps
      ? 'HTTPS通信が実装されています。'
      : 'SSL証明書を導入し、HTTPS化することを推奨します。'
  };

  // 更新日時の表示
  const hasModifiedDate = $('meta[property="article:modified_time"]').length > 0 ||
    structuredData.some(d => d.dateModified);

  const updateKeywords = ['更新日', '最終更新', '更新', 'updated'];
  const hasUpdateInfo = updateKeywords.some(keyword =>
    textContent.toLowerCase().includes(keyword.toLowerCase())
  );

  results.details.updateDate = {
    hasModifiedMeta: hasModifiedDate,
    hasUpdateInfo: hasUpdateInfo,
    score: (hasModifiedDate || hasUpdateInfo) ? 3 : 0,
    recommendation: (hasModifiedDate || hasUpdateInfo)
      ? '最終更新日が表示されています。'
      : '最終更新日時を明示することを推奨します。'
  };

  // 総合スコア計算
  results.score = Math.round(
    results.details.primaryInformation.score +
    results.details.experienceDescription.score +
    results.details.beforeAfter.score +
    results.details.dateSpecification.score +
    results.details.authorCredentials.score +
    results.details.technicalTerms.score +
    results.details.knowledgeDepth.score +
    results.details.externalCitations.score +
    results.details.mediaExposure.score +
    results.details.industryRecognition.score +
    results.details.citationClarity.score +
    results.details.contactInformation.score +
    results.details.privacyPolicy.score +
    results.details.sslCertificate.score +
    results.details.updateDate.score
  );

  return results;
}

module.exports = { analyzeEEAT };
