const cheerio = require('cheerio');

/**
 * 統計データ・数値情報評価
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - 統計データ分析結果
 */
function analyzeStatistics(crawlData) {
  const $ = cheerio.load(crawlData.html);
  const textContent = crawlData.textContent || '';

  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  // 1. 数値データの充実度（40点）

  // ユニーク数値の検出
  const numberPatterns = [
    /\d{1,3}(,\d{3})+(\.\d+)?/g,  // カンマ区切りの数値
    /\d+\.\d+%/g,                  // パーセンテージ（小数点）
    /\d+%/g,                       // パーセンテージ
    /約?\d+[万億兆千百十]/g,       // 日本語の大きな数
    /\d+[円ドル元ユーロポンド]/g,  // 通貨
    /\d+[人件個枚本台回]/g,        // 単位付き数値
    /\d+倍/g,                      // 倍数
  ];

  let allNumbers = [];
  numberPatterns.forEach(pattern => {
    const matches = textContent.match(pattern);
    if (matches) {
      allNumbers = allNumbers.concat(matches);
    }
  });

  const uniqueNumbers = [...new Set(allNumbers)];

  results.rawData.numbers = {
    total: allNumbers.length,
    unique: uniqueNumbers.length,
    examples: uniqueNumbers.slice(0, 20)
  };

  results.details.numberCount = {
    total: allNumbers.length,
    unique: uniqueNumbers.length,
    score: uniqueNumbers.length >= 20 ? 20 :
           uniqueNumbers.length >= 10 ? 15 :
           uniqueNumbers.length >= 5 ? 10 :
           uniqueNumbers.length * 2,
    recommendation: uniqueNumbers.length >= 20
      ? '豊富な数値データが掲載されています。'
      : uniqueNumbers.length >= 10
        ? '数値データがありますが、さらに充実させることを推奨します。'
        : '統計データや具体的な数値の掲載を強く推奨します。'
  };

  // 統計用語の使用
  const statisticalPhrases = [
    '調査によると', '調査では', '研究によれば', '研究では',
    'データによると', 'データでは', '統計では', '統計によると',
    'レポート', '報告書', '白書', '調査結果', '研究結果',
    'アンケート', '集計', '分析', '測定'
  ];

  let statisticalPhraseCount = 0;
  const foundStatisticalPhrases = [];
  statisticalPhrases.forEach(phrase => {
    const matches = textContent.match(new RegExp(phrase, 'g'));
    if (matches) {
      statisticalPhraseCount += matches.length;
      foundStatisticalPhrases.push(phrase);
    }
  });

  results.details.statisticalPhrases = {
    count: statisticalPhraseCount,
    uniquePhrases: foundStatisticalPhrases.length,
    phrases: foundStatisticalPhrases,
    score: foundStatisticalPhrases.length >= 3 ? 10 :
           foundStatisticalPhrases.length * 3,
    recommendation: foundStatisticalPhrases.length >= 3
      ? '統計用語が適切に使用されています。'
      : '「調査によると」「統計では」等の統計用語の使用を推奨します。'
  };

  results.rawData.statisticalPhrases = foundStatisticalPhrases;

  // パーセンテージの使用
  const percentages = textContent.match(/\d+(\.\d+)?%/g) || [];
  const uniquePercentages = [...new Set(percentages)];

  results.details.percentageUsage = {
    count: percentages.length,
    unique: uniquePercentages.length,
    examples: uniquePercentages.slice(0, 5),
    score: uniquePercentages.length >= 5 ? 5 :
           uniquePercentages.length,
    recommendation: uniquePercentages.length >= 5
      ? 'パーセンテージ表記が充実しています。'
      : 'パーセンテージでの数値表現を推奨します。'
  };

  // 比較数値（増減）
  const comparisonKeywords = [
    '前年比', '昨年比', '増加', '減少', '上昇', '下降',
    '伸び', '倍増', '半減', '推移', '変化', '成長率'
  ];

  let comparisonCount = 0;
  const foundComparisons = [];
  comparisonKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) {
      comparisonCount++;
      foundComparisons.push(keyword);
    }
  });

  results.details.comparisonData = {
    hasComparison: comparisonCount > 0,
    keywordCount: comparisonCount,
    keywords: foundComparisons,
    score: comparisonCount >= 3 ? 5 : comparisonCount * 1.5,
    recommendation: comparisonCount >= 3
      ? '比較データが提示されています。'
      : '「前年比」「増加」等の比較データの追加を推奨します。'
  };

  // 2. データの出典明示（30点）

  // 公的機関データ
  const govLinks = (crawlData.links || []).filter(link => {
    const href = typeof link.href === 'string' ? link.href : String(link.href || '');
    return href.includes('.gov') ||
      href.includes('.go.jp') ||
      href.includes('stat.go.jp') ||
      href.includes('mhlw.go.jp') ||
      href.includes('meti.go.jp');
  });

  results.details.governmentData = {
    count: govLinks.length,
    links: govLinks.map(l => l.href),
    score: govLinks.length >= 2 ? 15 :
           govLinks.length * 7,
    recommendation: govLinks.length >= 2
      ? '公的機関のデータが引用されています。'
      : '政府機関（.gov, .go.jp）のデータ引用を推奨します。'
  };

  results.rawData.governmentSources = govLinks.map(l => l.href);

  // 学術論文引用
  const academicLinks = (crawlData.links || []).filter(link => {
    const href = typeof link.href === 'string' ? link.href : String(link.href || '');
    return href.includes('.ac.jp') ||
      href.includes('.edu') ||
      href.includes('doi.org') ||
      href.includes('scholar.google') ||
      href.includes('pubmed') ||
      href.includes('arxiv.org') ||
      href.includes('researchgate');
  });

  results.details.academicPapers = {
    count: academicLinks.length,
    links: academicLinks.map(l => l.href),
    score: academicLinks.length >= 2 ? 10 :
           academicLinks.length * 5,
    recommendation: academicLinks.length >= 2
      ? '学術論文が引用されています。'
      : '査読済み論文への引用を推奨します。'
  };

  results.rawData.academicSources = academicLinks.map(l => l.href);

  // 企業調査レポート
  const researchKeywords = [
    'リサーチ', 'Research', '調査会社', 'レポート', 'Report',
    'ガートナー', 'Gartner', 'IDC', 'Forrester',
    'マッキンゼー', 'McKinsey', 'デロイト', 'Deloitte'
  ];

  let researchMentionCount = 0;
  researchKeywords.forEach(keyword => {
    if (textContent.includes(keyword)) {
      researchMentionCount++;
    }
  });

  results.details.corporateResearch = {
    hasMention: researchMentionCount > 0,
    mentionCount: researchMentionCount,
    score: researchMentionCount >= 2 ? 5 : researchMentionCount * 2,
    recommendation: researchMentionCount >= 2
      ? '信頼できる調査会社のデータが言及されています。'
      : '調査会社のレポート引用を推奨します。'
  };

  // 3. データの視覚化（30点）

  // グラフ・チャート
  const graphKeywords = ['グラフ', 'チャート', 'graph', 'chart'];
  const graphImages = (crawlData.images || []).filter(img =>
    graphKeywords.some(keyword =>
      (img.alt && img.alt.toLowerCase().includes(keyword.toLowerCase())) ||
      (img.src && img.src.toLowerCase().includes(keyword.toLowerCase()))
    )
  );

  const hasSvg = $('svg').length > 0;

  results.details.graphsCharts = {
    imageCount: graphImages.length,
    hasSvg: hasSvg,
    total: graphImages.length + (hasSvg ? 1 : 0),
    score: (graphImages.length + (hasSvg ? 1 : 0)) >= 3 ? 15 :
           (graphImages.length + (hasSvg ? 1 : 0)) * 5,
    recommendation: (graphImages.length + hasSvg) >= 3
      ? 'グラフ・チャートが効果的に使用されています。'
      : 'データをグラフやチャートで視覚化することを推奨します。'
  };

  results.rawData.graphs = graphImages.map(img => ({
    src: img.src,
    alt: img.alt
  }));

  // 表形式データ
  const tables = $('table');
  let tableWithNumbers = 0;

  tables.each((i, table) => {
    const tableText = $(table).text();
    const hasNumbers = /\d+/.test(tableText);
    if (hasNumbers) tableWithNumbers++;
  });

  results.details.dataTable = {
    totalTables: tables.length,
    tablesWithNumbers: tableWithNumbers,
    score: tableWithNumbers >= 2 ? 10 :
           tableWithNumbers * 5,
    recommendation: tableWithNumbers >= 2
      ? 'データテーブルが活用されています。'
      : '数値データを表形式で整理することを推奨します。'
  };

  results.rawData.tables = {
    total: tables.length,
    withNumbers: tableWithNumbers
  };

  // インフォグラフィック
  const infographicKeywords = ['インフォグラフィック', 'infographic', '図解', 'ビジュアル'];
  const infographicImages = (crawlData.images || []).filter(img =>
    infographicKeywords.some(keyword =>
      (img.alt && img.alt.toLowerCase().includes(keyword.toLowerCase())) ||
      (img.src && img.src.toLowerCase().includes(keyword.toLowerCase()))
    )
  );

  results.details.infographics = {
    count: infographicImages.length,
    score: infographicImages.length >= 1 ? 5 : 0,
    recommendation: infographicImages.length >= 1
      ? 'インフォグラフィックが使用されています。'
      : 'データの視覚的表現（インフォグラフィック）の追加を推奨します。'
  };

  // 総合スコア計算
  results.score = Math.round(
    results.details.numberCount.score +
    results.details.statisticalPhrases.score +
    results.details.percentageUsage.score +
    results.details.comparisonData.score +
    results.details.governmentData.score +
    results.details.academicPapers.score +
    results.details.corporateResearch.score +
    results.details.graphsCharts.score +
    results.details.dataTable.score +
    results.details.infographics.score
  );

  return results;
}

module.exports = { analyzeStatistics };
