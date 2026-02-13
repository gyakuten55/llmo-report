const cheerio = require('cheerio');

/**
 * コンテンツ構造最適化評価（2025年最新LLMO/RAG対応版）
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - コンテンツ分析結果
 */
function analyzeContent(crawlData) {
  const $ = cheerio.load(crawlData.html);
  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  const textContent = crawlData.textContent || '';
  const totalCharacters = textContent.length;

  // --- 1. コンテンツボリューム (15点) ---
  if (totalCharacters >= 3000) results.details.contentVolume = { score: 15, recommendation: '十分な情報量です。' };
  else if (totalCharacters >= 1500) results.details.contentVolume = { score: 10, recommendation: '標準的な情報量です。' };
  else results.details.contentVolume = { score: 5, recommendation: 'AIの推論を助けるため、1500文字以上の情報を推奨します。' };

  // --- 2. H1戦略：グローバルコンテキスト (20点) ---
  const h1s = $('h1');
  const h1Count = h1s.length;
  const h1Text = h1s.first().text().trim();
  const h1Length = h1Text.length;
  
  let h1Score = 0;
  let h1Rec = '';

  if (h1Count === 1) {
    h1Score += 10; // 一意性
    // 長さ評価 (15-35文字の日本語を理想とする)
    if (h1Length >= 15 && h1Length <= 35) h1Score += 5;
    // エンティティ特定評価 (漢字・固有名詞の密度が高いか)
    const hasEntity = /[\u4E00-\u9FFF]{2,}/.test(h1Text); 
    if (hasEntity) h1Score += 5;

    h1Rec = h1Score === 20 ? 'H1がエンティティを明確に特定しており、AIにとって理想的なコンテキストです。' 
            : 'H1には具体的な製品名・サービス名を含め、15-30文字程度で記述してください。';
  } else {
    h1Rec = h1Count === 0 ? 'H1タグが存在しません。AIがページの主題を特定できません。' : 'H1が複数あります。AIのエンティティ特定を妨げます。';
  }
  results.details.h1Quality = { score: h1Score, recommendation: h1Rec, text: h1Text };

  // --- 3. 見出し階層とチャンキング適正 (25点) ---
  const headings = $('h1, h2, h3, h4, h5, h6');
  let hierarchyScore = 0;
  let idAttributeCount = 0;
  let semanticWrapCount = 0;
  let hasSkippedLevel = false;
  let hasDeepLevel = false;

  let prevLevel = 1;
  headings.each((i, el) => {
    const currentLevel = parseInt(el.tagName.substring(1));
    if (currentLevel > prevLevel + 1) hasSkippedLevel = true;
    if (currentLevel > 4) hasDeepLevel = true;
    if ($(el).attr('id')) idAttributeCount++;
    if ($(el).parents('article, section').length > 0) semanticWrapCount++;
    prevLevel = currentLevel;
  });

  // 階層の論理正当性 (10点)
  if (!hasSkippedLevel) hierarchyScore += 10;
  
  // AIチャンキング適正: 見出し1つあたりの平均文字数 (10点)
  // 理想は1見出しあたり400-800文字（日本語）
  const totalHeadings = headings.length || 1;
  const charsPerChunk = totalCharacters / totalHeadings;
  if (charsPerChunk >= 400 && charsPerChunk <= 900) hierarchyScore += 10;
  else if (charsPerChunk < 400) hierarchyScore += 5; // 細切れすぎ

  // 引用可能性（ID属性） & セマンティクス (5点)
  if (idAttributeCount > totalHeadings / 2) hierarchyScore += 5;

  results.details.headingStructure = {
    score: hierarchyScore,
    recommendation: `平均チャンクサイズ: ${Math.round(charsPerChunk)}文字。` + 
      (hasSkippedLevel ? '見出し階層を飛ばさないでください。' : '') +
      (idAttributeCount === 0 ? '見出しにid属性を付与するとAIの引用精度が向上します。' : '')
  };

  // --- 4. 質問形式の見出し (10点) ---
  const h2h3Texts = $('h2, h3').map((i, el) => $(el).text()).get().join(' ');
  const questionCount = (h2h3Texts.match(/[\?？]|とは|なぜ|どうすれば/g) || []).length;
  const questionScore = questionCount >= 3 ? 10 : (questionCount > 0 ? 5 : 0);
  
  results.details.questionBasedHeadings = {
    score: questionScore,
    recommendation: questionScore === 10 ? 'ユーザーの問いに答える構造です。' : 'H2/H3に質問形式を取り入れると、AI Overviewsに採用されやすくなります。'
  };

  // --- 5. FAQ・Q&A構造 (10点) ---
  const qaPairs = []; // (既存のロジックを簡略化して維持)
  $('dt, h2, h3, h4').each((i, el) => {
    if ($(el).text().match(/^(Q|質問|Question|\?|Q\.)/i) || $(el).text().includes('？')) {
      const next = $(el).next();
      if (next.is('dd, p, div')) qaPairs.push(1);
    }
  });
  const faqScore = qaPairs.length >= 3 ? 10 : (qaPairs.length > 0 ? 5 : 0);
  results.details.faqStructure = { score: faqScore, recommendation: faqScore === 10 ? 'FAQが構造化されています。' : 'FAQセクションの追加を推奨します。' };

  // --- 6. リスト・表構造 (10点) ---
  const hasTables = $('table').length > 0;
  const listCount = $('ul, ol').length;
  const tableScore = (hasTables ? 5 : 0) + (listCount >= 3 ? 5 : (listCount > 0 ? 2 : 0));
  results.details.tableUsage = { score: tableScore, recommendation: hasTables ? 'データが表形式で整理されています。' : '比較データは表(table)を使うとAIが正確に抽出できます。' };

  // --- 7. 内部リンク (10点) ---
  const internalLinks = (crawlData.links || []).filter(l => l.isInternal).length;
  const linkScore = internalLinks >= 10 ? 10 : (internalLinks >= 5 ? 5 : 0);
  results.details.internalLinks = { score: linkScore, recommendation: 'トピッククラスター形成のため内部リンクを意識してください。' };

  // 総合スコア計算
  results.score = 
    results.details.contentVolume.score +
    results.details.h1Quality.score +
    results.details.headingStructure.score +
    results.details.questionBasedHeadings.score +
    results.details.faqStructure.score +
    results.details.tableUsage.score +
    results.details.internalLinks.score;

  return results;
}

module.exports = { analyzeContent };