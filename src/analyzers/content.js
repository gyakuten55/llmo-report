const cheerio = require('cheerio');

/**
 * コンテンツ構造最適化評価（詳細版）
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

  // テキストコンテンツ分析
  const textContent = crawlData.textContent || '';
  const totalCharacters = textContent.length;
  const totalWords = textContent.split(/\s+/).filter(w => w.length > 0).length;

  results.rawData.textContent = {
    totalCharacters,
    totalWords,
    sample: textContent.substring(0, 500)
  };

  results.details.contentVolume = {
    characters: totalCharacters,
    words: totalWords,
    score: 0,
    recommendation: ''
  };

  // 文字数によるスコアリング（厳格化）
  if (totalCharacters >= 3000) {
    results.details.contentVolume.score = 12;
    results.details.contentVolume.recommendation = '十分なコンテンツボリュームがあります。';
  } else if (totalCharacters >= 2000) {
    results.details.contentVolume.score = 8;
    results.details.contentVolume.recommendation = 'コンテンツボリュームは良好です。';
  } else if (totalCharacters >= 1000) {
    results.details.contentVolume.score = 4;
    results.details.contentVolume.recommendation = 'コンテンツの充実化を推奨します。';
  } else {
    results.details.contentVolume.score = 0;
    results.details.contentVolume.recommendation = 'コンテンツが不足しています。より詳細な情報の追加を推奨します。';
  }

  // 1. 見出し構造の最適化（20点）
  const headings = crawlData.headings || {};
  const h1Count = (headings.h1 || []).length;
  const h2Count = (headings.h2 || []).length;
  const h3Count = (headings.h3 || []).length;
  const h4Count = (headings.h4 || []).length;
  const h5Count = (headings.h5 || []).length;
  const h6Count = (headings.h6 || []).length;

  results.rawData.headings = {
    h1: headings.h1 || [],
    h2: headings.h2 || [],
    h3: headings.h3 || [],
    h4: headings.h4 || [],
    h5: headings.h5 || [],
    h6: headings.h6 || []
  };

  // 見出し構造サマリー（PDF生成用）
  results.details.headingStructure = {
    h1Count,
    h2Count,
    h3Count,
    h4Count,
    h5Count,
    h6Count,
    recommendation: h1Count === 1 && h2Count >= 3 && h2Count <= 8
      ? '適切な見出し構造です。'
      : h1Count !== 1
        ? 'H1タグは1つのみにすることを推奨します。'
        : h2Count < 3
          ? 'H2タグを3個以上追加することを推奨します。'
          : 'H2タグが多すぎます。3-8個を推奨します。'
  };

  // H1の質
  const h1Text = (headings.h1 || [])[0] || '';
  const h1IsQuestion = /[\?？]|とは|方法|やり方|なぜ|どう/.test(h1Text);

  results.details.h1Quality = {
    count: h1Count,
    text: h1Text,
    isQuestion: h1IsQuestion,
    score: h1Count === 1 ? (h1IsQuestion ? 5 : 3) : 0,
    recommendation: h1Count === 1
      ? (h1IsQuestion ? 'H1が質問形式で適切です。' : 'H1を質問形式にすることを推奨します。')
      : h1Count === 0 ? 'H1タグの設定が必要です。' : 'H1タグは1つのみにすることを推奨します。'
  };

  // H2の質と数
  const h2Texts = headings.h2 || [];
  const h2Questions = h2Texts.filter(h => /[\?？]|とは|方法|やり方|なぜ|どう/.test(h)).length;

  results.details.h2Quality = {
    count: h2Count,
    questionCount: h2Questions,
    score: h2Count >= 3 && h2Count <= 8 ? (h2Questions >= 2 ? 8 : 5) : (h2Count > 0 ? 3 : 0),
    recommendation: h2Count >= 3 && h2Count <= 8
      ? (h2Questions >= 2 ? 'H2が適切な数と質問形式です。' : 'H2に質問形式を含めることを推奨します。')
      : h2Count > 8 ? 'H2が多すぎます。3-8個を推奨します。' : 'H2タグを3個以上追加することを推奨します。'
  };

  // 階層構造
  const hasH3 = h3Count > 0;
  const hierarchyDepth = hasH3 ? (h4Count > 0 ? 3 : 2) : 1;

  results.details.headingHierarchy = {
    depth: hierarchyDepth,
    score: hierarchyDepth >= 2 && hierarchyDepth <= 3 ? 4 : 2,
    recommendation: hierarchyDepth >= 2 && hierarchyDepth <= 3
      ? '論理的な階層構造です。'
      : '2-3階層の見出し構造を推奨します。'
  };

  // 質問ベース見出し率
  const totalHeadings = h1Count + h2Count + h3Count;
  const questionHeadings = (h1IsQuestion ? 1 : 0) + h2Questions;
  const questionRate = totalHeadings > 0 ? (questionHeadings / totalHeadings) * 100 : 0;

  results.details.questionBasedHeadings = {
    total: totalHeadings,
    questions: questionHeadings,
    rate: questionRate,
    score: questionRate >= 30 ? 2 : (questionRate >= 20 ? 1 : 0),
    recommendation: questionRate >= 30
      ? '見出しに質問形式が適切に使用されています。'
      : '見出しの30%以上を質問形式にすることを推奨します。'
  };

  // 2. FAQ・Q&A構造（25点）
  const faqElements = $('*').filter((i, el) => {
    const text = $(el).text().toLowerCase();
    const className = $(el).attr('class') || '';
    const id = $(el).attr('id') || '';
    return className.includes('faq') ||
      id.includes('faq') ||
      text.includes('よくある質問') ||
      text.includes('q&a') ||
      text.includes('faq');
  }).length;

  const qaPairs = [];
  $('dt, h2, h3, h4, strong, b').each((i, el) => {
    const text = $(el).text();
    if (text.match(/^(Q|質問|Question|\?|Q\.|\d+\.)/i)) {
      const question = text;
      let answer = '';
      const next = $(el).next();
      if (next.is('dd, p, div')) {
        answer = next.text().substring(0, 200);
      }
      if (answer) {
        qaPairs.push({ question, answer });
      }
    }
  });

  results.details.faqStructure = {
    faqElements: faqElements,
    qaPairCount: qaPairs.length,
    qaPairs: qaPairs.slice(0, 10),
    score: qaPairs.length >= 10 ? 10 : qaPairs.length,
    recommendation: qaPairs.length >= 10
      ? 'FAQ構造が充実しています。'
      : qaPairs.length >= 5 ? 'FAQはありますが、10個以上を推奨します。' : 'FAQ・Q&A構造の追加を推奨します。'
  };

  results.rawData.faqPairs = qaPairs.slice(0, 10);

  // FAQ回答の質
  const faqWithLongAnswers = qaPairs.filter(qa => qa.answer.length >= 100).length;

  results.details.faqQuality = {
    total: qaPairs.length,
    withLongAnswers: faqWithLongAnswers,
    score: qaPairs.length > 0 ? Math.min(Math.floor(faqWithLongAnswers * 1.75), 7) : 0,
    recommendation: faqWithLongAnswers >= 5
      ? 'FAQ回答が具体的です。'
      : 'FAQ回答を100文字以上の具体的な内容にすることを推奨します。'
  };

  // FAQ配置
  const faqNearTop = $('*').slice(0, 20).filter((i, el) => {
    const text = $(el).text().toLowerCase();
    return text.includes('faq') || text.includes('よくある質問');
  }).length > 0;

  results.details.faqPlacement = {
    nearTop: faqNearTop,
    score: faqNearTop ? 4 : (qaPairs.length > 0 ? 2 : 0),
    recommendation: faqNearTop
      ? 'FAQが適切な位置に配置されています。'
      : 'FAQをページ上部またはセクション末尾に配置することを推奨します。'
  };


  // 3. コンテンツ完結性（20点）
  const paragraphs = $('p').length;

  // 自己完結型コンテンツ（各段落が独立して理解できるか）
  const paragraphTexts = [];
  $('p').each((i, el) => {
    const text = $(el).text();
    if (text.length > 50) {
      paragraphTexts.push(text);
    }
  });

  results.details.selfContainedContent = {
    totalParagraphs: paragraphs,
    substantialParagraphs: paragraphTexts.length,
    score: paragraphTexts.length >= 5 ? 7 : Math.min(paragraphTexts.length * 1.4, 7),
    recommendation: paragraphTexts.length >= 5
      ? '各セクションが自己完結しています。'
      : '各セクションを単独で理解可能にすることを推奨します。'
  };

  // 明確な回答提供
  const definitiveStatements = textContent.match(/(です|ます|できます|あります|なります)/g) || [];

  results.details.clearAnswers = {
    count: definitiveStatements.length,
    score: definitiveStatements.length >= 20 ? 6 : Math.min(definitiveStatements.length * 0.3, 6),
    recommendation: definitiveStatements.length >= 20
      ? '明確な回答形式が使用されています。'
      : '「〜です」「〜できます」形式の明示的回答を推奨します。'
  };

  // 結論の明示
  const conclusionKeywords = ['まとめ', '結論', 'つまり', 'したがって', '要約すると'];
  const hasConclusion = conclusionKeywords.some(keyword => textContent.includes(keyword));

  results.details.conclusionClarity = {
    hasConclusion: hasConclusion,
    score: hasConclusion ? 5 : 0,
    recommendation: hasConclusion
      ? '各セクションに結論があります。'
      : '「まとめ」「結論」「つまり」などで結論を明示することを推奨します。'
  };

  // 4. リスト・表構造（15点）
  const lists = $('ul, ol').length;
  const listItems = $('li').length;
  const tables = $('table').length;

  results.rawData.contentStructure = {
    paragraphs,
    lists,
    listItems,
    tables
  };

  // 箇条書きリスト
  results.details.bulletLists = {
    count: lists,
    itemCount: listItems,
    score: listItems >= 5 ? 6 : listItems,
    recommendation: listItems >= 5
      ? '箇条書きが適切に使用されています。'
      : '5個以上のリスト要素を推奨します。'
  };

  // 表の使用
  results.details.tableUsage = {
    count: tables,
    score: tables >= 1 ? 5 : 0,
    recommendation: tables >= 1
      ? '比較表や一覧表が実装されています。'
      : '比較情報を表形式で整理することを推奨します。'
  };

  // ステップバイステップ
  const orderedLists = $('ol').length;

  results.details.stepByStep = {
    count: orderedLists,
    score: orderedLists >= 1 ? 4 : 0,
    recommendation: orderedLists >= 1
      ? '手順説明が順序付きリストで実装されています。'
      : '手順説明に番号付きリストの使用を推奨します。'
  };

  // 5. トピッククラスター（20点）

  // 内部リンク分析
  const links = crawlData.links || [];
  const internalLinks = links.filter(link => link.isInternal);
  const externalLinks = links.filter(link => !link.isInternal);

  results.rawData.links = {
    total: links.length,
    internal: internalLinks.length,
    external: externalLinks.length,
    internalLinksSample: internalLinks.slice(0, 10).map(l => ({ href: l.href, text: l.text })),
    externalLinksSample: externalLinks.slice(0, 10).map(l => ({ href: l.href, text: l.text }))
  };

  // 関連コンテンツリンク（厳格化）
  results.details.relatedContentLinks = {
    count: internalLinks.length,
    score: internalLinks.length >= 10 ? 8 : (internalLinks.length >= 5 ? 5 : internalLinks.length >= 3 ? 2 : 0),
    recommendation: internalLinks.length >= 10
      ? '関連コンテンツリンクが充実しています。'
      : '10個以上の内部リンクを推奨します。'
  };

  // 内部リンク（PDF生成用エイリアス）
  results.details.internalLinks = results.details.relatedContentLinks;

  // リンクの文脈適性（アンカーテキスト）
  const descriptiveAnchors = internalLinks.filter(link =>
    link.text && link.text.length >= 10 && !link.text.includes('こちら') && !link.text.includes('click')
  );

  results.details.linkContext = {
    total: internalLinks.length,
    descriptive: descriptiveAnchors.length,
    rate: internalLinks.length > 0 ? (descriptiveAnchors.length / internalLinks.length) * 100 : 0,
    score: descriptiveAnchors.length >= 3 ? 5 : (descriptiveAnchors.length >= 2 ? 3 : descriptiveAnchors.length),
    recommendation: descriptiveAnchors.length >= 3
      ? 'アンカーテキストが説明的です。'
      : 'アンカーテキストをより説明的に（10文字以上）することを推奨します。'
  };

  // パンくずリスト
  const hasBreadcrumb = $('nav[aria-label*="breadcrumb"], .breadcrumb, [itemtype*="BreadcrumbList"]').length > 0;

  results.details.breadcrumbList = {
    implemented: hasBreadcrumb,
    score: hasBreadcrumb ? 2 : 0,
    recommendation: hasBreadcrumb
      ? 'パンくずリストが実装されています。'
      : 'パンくずリストの実装を推奨します（3階層以上）。'
  };

  // 総合スコア計算（100点満点）
  results.score = Math.round(
    results.details.contentVolume.score +
    results.details.h1Quality.score +
    results.details.h2Quality.score +
    results.details.headingHierarchy.score +
    results.details.questionBasedHeadings.score +
    results.details.faqStructure.score +
    results.details.faqQuality.score +
    results.details.faqPlacement.score +
    results.details.selfContainedContent.score +
    results.details.clearAnswers.score +
    results.details.conclusionClarity.score +
    results.details.bulletLists.score +
    results.details.tableUsage.score +
    results.details.stepByStep.score +
    results.details.relatedContentLinks.score +
    results.details.linkContext.score +
    results.details.breadcrumbList.score
  );

  return results;
}

module.exports = { analyzeContent };
