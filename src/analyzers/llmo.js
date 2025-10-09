const cheerio = require('cheerio');

/**
 * AI引用最適化評価（LLMO特化・詳細版）
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - LLMO分析結果
 */
function analyzeLLMO(crawlData) {
  const $ = cheerio.load(crawlData.html);
  const textContent = crawlData.textContent || '';
  const structuredData = crawlData.structuredData || [];

  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  // 1. 明確な回答形式（30点）

  // 「〜とは」定義
  const definitionPattern = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\w\s]+)とは、?([^。]+。)/g;
  const definitions = textContent.match(definitionPattern) || [];

  results.details.definitions = {
    count: definitions.length,
    examples: definitions.slice(0, 3),
    score: definitions.length >= 10 ? 10 : definitions.length,
    recommendation: definitions.length >= 10
      ? '明確な定義文が充実しています。'
      : '「〜とは」形式の定義文を10個以上追加することを推奨します。'
  };

  results.rawData.definitions = definitions.slice(0, 10);

  // 「方法・やり方」
  const methodKeywords = ['方法', 'やり方', '手順', 'ステップ', '手続き', 'How to', 'how to'];
  let methodCount = 0;
  const foundMethods = [];

  methodKeywords.forEach(keyword => {
    const matches = textContent.match(new RegExp(keyword, 'gi'));
    if (matches) {
      methodCount += matches.length;
      if (!foundMethods.includes(keyword)) {
        foundMethods.push(keyword);
      }
    }
  });

  results.details.howToContent = {
    count: methodCount,
    keywords: foundMethods,
    score: methodCount >= 5 ? 10 : methodCount * 2,
    recommendation: methodCount >= 5
      ? 'How-to形式の説明が充実しています。'
      : '「方法」「やり方」「手順」等のHow-to形式を5個以上追加することを推奨します。'
  };

  // 「理由・原因」
  const reasonKeywords = ['理由', '原因', 'なぜなら', 'から', 'ため', 'Why', 'why'];
  let reasonCount = 0;
  const foundReasons = [];

  reasonKeywords.forEach(keyword => {
    const matches = textContent.match(new RegExp(keyword, 'g'));
    if (matches) {
      reasonCount += matches.length;
      if (!foundReasons.includes(keyword)) {
        foundReasons.push(keyword);
      }
    }
  });

  results.details.whyContent = {
    count: reasonCount,
    keywords: foundReasons,
    score: reasonCount >= 3 ? 5 : Math.floor(reasonCount * 1.5),
    recommendation: reasonCount >= 3
      ? 'Why形式の説明があります。'
      : '「理由」「原因」「なぜ」等のWhy形式を3個以上追加することを推奨します。'
  };

  // 即答可能な情報（50文字以内の簡潔な回答）
  const sentences = textContent.split(/[。.！!？?]/);
  const shortAnswers = sentences.filter(s => s.length >= 10 && s.length <= 50);

  results.details.conciseAnswers = {
    count: shortAnswers.length,
    examples: shortAnswers.slice(0, 3),
    score: shortAnswers.length >= 10 ? 5 : Math.floor(shortAnswers.length * 0.5),
    recommendation: shortAnswers.length >= 10
      ? '即答可能な簡潔な情報があります。'
      : '50文字以内の簡潔な回答を追加することを推奨します。'
  };

  results.rawData.shortAnswers = shortAnswers.slice(0, 5);

  // 2. 会話的・自然言語（25点）

  // 質問形式の使用
  const questionPattern = /([^。？！.?!]+[？?])/g;
  const questions = textContent.match(questionPattern) || [];

  const rhetoricalQuestions = ['〜でしょうか', 'ですか', 'ませんか', 'ますか'];
  let rhetoricalCount = 0;
  rhetoricalQuestions.forEach(pattern => {
    const matches = textContent.match(new RegExp(pattern, 'g'));
    if (matches) rhetoricalCount += matches.length;
  });

  results.details.questionFormat = {
    total: questions.length,
    rhetorical: rhetoricalCount,
    examples: questions.slice(0, 3),
    score: rhetoricalCount >= 10 ? 10 : rhetoricalCount,
    recommendation: rhetoricalCount >= 10
      ? '質問形式が適切に使用されています。'
      : '「〜でしょうか」形式の質問を10回以上使用することを推奨します。'
  };

  results.rawData.questions = questions.slice(0, 10);

  // 対話的トーン（「あなた」「私たち」の使用）
  const dialogueKeywords = ['あなた', 'あなたの', 'あなたに', '私たち', '私たちの', '皆さん', '皆様'];
  let dialogueCount = 0;
  const foundDialogue = [];

  dialogueKeywords.forEach(keyword => {
    const matches = textContent.match(new RegExp(keyword, 'g'));
    if (matches) {
      dialogueCount += matches.length;
      if (!foundDialogue.includes(keyword)) {
        foundDialogue.push(keyword);
      }
    }
  });

  results.details.dialogueTone = {
    count: dialogueCount,
    keywords: foundDialogue,
    score: dialogueCount >= 5 ? 8 : Math.floor(dialogueCount * 1.5),
    recommendation: dialogueCount >= 5
      ? '対話的なトーンが使用されています。'
      : '「あなた」「私たち」等の人称代名詞を使用することを推奨します。'
  };

  // 自然な語り口（堅苦しくない表現）
  const informalPhrases = ['ですよね', 'かもしれません', 'と思います', 'といえます', 'ではないでしょうか'];
  let informalCount = 0;

  informalPhrases.forEach(phrase => {
    if (textContent.includes(phrase)) informalCount++;
  });

  results.details.naturalStyle = {
    count: informalCount,
    score: informalCount >= 3 ? 7 : informalCount * 2,
    recommendation: informalCount >= 3
      ? '自然な語り口が使用されています。'
      : 'より自然で親しみやすい表現を推奨します。'
  };

  // 3. 引用されやすい構造（25点）

  // 段落の独立性
  const paragraphs = $('p');
  let independentParagraphs = 0;

  paragraphs.each((i, el) => {
    const text = $(el).text();
    // 段落が主語と述語を含み、50文字以上なら独立していると判断
    if (text.length >= 50 && (text.includes('は') || text.includes('が'))) {
      independentParagraphs++;
    }
  });

  results.details.paragraphIndependence = {
    total: paragraphs.length,
    independent: independentParagraphs,
    rate: paragraphs.length > 0 ? (independentParagraphs / paragraphs.length) * 100 : 0,
    score: independentParagraphs >= 10 ? 10 : independentParagraphs,
    recommendation: independentParagraphs >= 10
      ? '各段落が単独で意味をなしています。'
      : '各段落を独立して理解できるように記述することを推奨します。'
  };

  // 要約文の存在
  const summaryKeywords = ['まとめ', '要約', '要点', 'ポイント', 'サマリー', 'まとめると'];
  let summaryCount = 0;

  summaryKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) summaryCount++;
  });

  results.details.summaries = {
    count: summaryCount,
    score: summaryCount >= 3 ? 8 : summaryCount * 2.5,
    recommendation: summaryCount >= 3
      ? '各セクションに要約があります。'
      : '「まとめ」「要約」等のセクションを追加することを推奨します。'
  };

  // キーポイント明示
  const emphasisKeywords = ['重要', 'ポイント', 'キーポイント', '注目', '注意', 'Point', 'point'];
  let emphasisCount = 0;

  emphasisKeywords.forEach(keyword => {
    const matches = textContent.match(new RegExp(keyword, 'g'));
    if (matches) emphasisCount += matches.length;
  });

  results.details.keyPointEmphasis = {
    count: emphasisCount,
    score: emphasisCount >= 5 ? 7 : Math.floor(emphasisCount * 1.4),
    recommendation: emphasisCount >= 5
      ? 'キーポイントが強調されています。'
      : '「重要：」「ポイント：」等で要点を強調することを推奨します。'
  };

  // 4. コンテンツ鮮度（20点）

  // 公開日
  const hasPublishDate = $('meta[property="article:published_time"]').length > 0 ||
    structuredData.some(d => d.datePublished) ||
    $('time[itemprop="datePublished"]').length > 0;

  results.details.publishDate = {
    implemented: hasPublishDate,
    score: hasPublishDate ? 5 : 0,
    recommendation: hasPublishDate
      ? '公開日が明示されています。'
      : 'datePublishedの実装を推奨します。'
  };

  // 更新日
  const hasModifiedDate = $('meta[property="article:modified_time"]').length > 0 ||
    structuredData.some(d => d.dateModified) ||
    $('time[itemprop="dateModified"]').length > 0;

  results.details.updateDate = {
    implemented: hasModifiedDate,
    score: hasModifiedDate ? 5 : 0,
    recommendation: hasModifiedDate
      ? '更新日が明示されています。'
      : 'dateModifiedの実装を推奨します。'
  };

  // 鮮度の言及（年号・「最新」の表記）
  const currentYear = new Date().getFullYear();
  const recentYears = [currentYear, currentYear - 1].map(y => y.toString());
  let yearMentions = 0;

  recentYears.forEach(year => {
    const matches = textContent.match(new RegExp(year + '年', 'g'));
    if (matches) yearMentions += matches.length;
  });

  const freshnessKeywords = ['最新', '最近', '最新版', '最新情報', '新しい', 'アップデート'];
  let freshnessCount = 0;

  freshnessKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) freshnessCount++;
  });

  results.details.freshnessMentions = {
    yearMentions: yearMentions,
    freshnessKeywords: freshnessCount,
    score: (yearMentions >= 3 || freshnessCount >= 2) ? 5 : Math.min(yearMentions + freshnessCount, 5),
    recommendation: (yearMentions >= 3 || freshnessCount >= 2)
      ? 'コンテンツの鮮度が示されています。'
      : '現在の年号や「最新」等の表記を追加することを推奨します。'
  };

  // 定期更新の証拠
  const updateHistoryKeywords = ['更新履歴', '変更履歴', '改訂履歴', '修正履歴', 'changelog'];
  const hasUpdateHistory = updateHistoryKeywords.some(keyword =>
    textContent.toLowerCase().includes(keyword.toLowerCase())
  );

  results.details.updateHistory = {
    hasHistory: hasUpdateHistory,
    score: hasUpdateHistory ? 5 : 0,
    recommendation: hasUpdateHistory
      ? '更新履歴が記載されています。'
      : '更新履歴セクションの追加を推奨します。'
  };

  // 総合スコア計算
  results.score = Math.round(
    results.details.definitions.score +
    results.details.howToContent.score +
    results.details.whyContent.score +
    results.details.conciseAnswers.score +
    results.details.questionFormat.score +
    results.details.dialogueTone.score +
    results.details.naturalStyle.score +
    results.details.paragraphIndependence.score +
    results.details.summaries.score +
    results.details.keyPointEmphasis.score +
    results.details.publishDate.score +
    results.details.updateDate.score +
    results.details.freshnessMentions.score +
    results.details.updateHistory.score
  );

  // AI引用適正スコア（総合評価）
  const overallCitationScore = (results.score / results.maxScore) * 100;
  results.details.aiCitationScore = {
    overall: overallCitationScore,
    recommendation: overallCitationScore >= 70
      ? 'AIによる引用に適した構造です。'
      : overallCitationScore >= 50
        ? 'AIによる引用適性は中程度です。改善の余地があります。'
        : 'AIによる引用適性が低いため、構造化と明確な回答形式の改善を推奨します。'
  };

  // FAQ関連（PDF生成用 - 実データはcontentアナライザーにあります）
  results.details.faqContent = {
    recommendation: '※FAQの詳細はコンテンツ構造評価を参照してください。'
  };

  results.rawData.faq = {
    totalQaPairs: 0,
    qaPairs: []
  };

  // 統計データ関連（PDF生成用 - 実データはstatisticsアナライザーにあります）
  results.details.statisticalData = {
    recommendation: '※統計データの詳細は統計データ評価を参照してください。'
  };

  results.rawData.statistics = {
    numberCount: 0,
    uniqueNumbers: [],
    sample: []
  };

  results.rawData.statisticalPhrases = [];

  // 権威性関連（PDF生成用 - 実データはE-E-A-Tアナライザーにあります）
  results.details.authority = {
    recommendation: '※権威性の詳細はE-E-A-T評価を参照してください。'
  };

  results.rawData.authority = {
    hasAuthorInfo: false,
    hasPublishDate: results.details.publishDate.implemented,
    hasCitations: false
  };

  return results;
}

module.exports = { analyzeLLMO };
