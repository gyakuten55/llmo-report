const PQueue = require('p-queue').default || require('p-queue');
const { crawlWebsite } = require('./crawler');
const { parseRobotsTxt, isUrlAllowed } = require('./robots-parser');
const { getCandidateUrls } = require('./url-selector');

// 既存アナライザー
const { analyzeSEO } = require('./analyzers/seo');
const { analyzePerformance } = require('./analyzers/performance');
const { analyzeContent } = require('./analyzers/content');
const { analyzeStructuredData } = require('./analyzers/structured-data');
const { analyzeLLMO } = require('./analyzers/llmo');
const { analyzeEntity } = require('./analyzers/entity');
const { analyzeEEAT } = require('./analyzers/eeat');
const { analyzeStatistics } = require('./analyzers/statistics');
const { analyzeMultimedia } = require('./analyzers/multimedia');
const { analyzeSocial } = require('./analyzers/social');
const { analyzeLocalSEO } = require('./analyzers/local-seo');

/**
 * 複数ページを効率的にクロール・分析
 * @param {Object} options - クロールオプション
 * @param {Function} progressCallback - 進捗コールバック
 * @returns {Promise<Object>} - クロール結果
 */
async function crawlMultiplePages(options, progressCallback = null) {
  const {
    startUrl,
    maxDepth = 2,
    maxPages = 50,
    followInternal = true,
    useSitemap = true,
    respectRobots = true,
    selectedUrls = null,
    concurrency = 3  // 並列実行数
  } = options;

  const results = {
    pages: [],
    summary: {
      totalCrawled: 0,
      totalSkipped: 0,
      totalFailed: 0,
      errors: []
    },
    robotsInfo: null,
    startedAt: new Date().toISOString(),
    completedAt: null
  };

  try {
    // 1. robots.txt解析
    if (respectRobots) {
      if (progressCallback) {
        progressCallback({ stage: 'robots', progress: 5, message: 'robots.txt解析中...' });
      }

      results.robotsInfo = await parseRobotsTxt(startUrl);
    }

    // 2. クロール対象URL取得
    let targetUrls = [];

    if (selectedUrls && selectedUrls.length > 0) {
      // ユーザーが選択したURL
      targetUrls = selectedUrls.map(url => ({
        url,
        depth: 0,
        parent: null
      }));
    } else {
      // 自動検出
      if (progressCallback) {
        progressCallback({ stage: 'discovering', progress: 10, message: 'クロール対象URL検出中...' });
      }

      const candidatesResult = await getCandidateUrls(startUrl, {
        maxDepth,
        useSitemap,
        respectRobots,
        maxCandidates: maxPages
      });

      targetUrls = candidatesResult.candidates
        .slice(0, maxPages)
        .map(candidate => ({
          url: candidate.url,
          depth: candidate.depth || 0,
          parent: null,
          priority: candidate.priority,
          category: candidate.category
        }));
    }

    if (targetUrls.length === 0) {
      throw new Error('クロール対象URLが見つかりませんでした');
    }

    console.log(`クロール対象: ${targetUrls.length}ページ`);

    // 3. 並列クロール実行
    const queue = new PQueue({ concurrency });
    const crawlDelayMs = results.robotsInfo?.crawlDelay || 1000;

    let completedCount = 0;
    const totalUrls = targetUrls.length;

    const crawlPromises = targetUrls.map((urlInfo, index) => {
      return queue.add(async () => {
        // Crawl-delay遵守
        if (index > 0) {
          await sleep(crawlDelayMs);
        }

        try {
          // robots.txtチェック
          if (respectRobots && results.robotsInfo) {
            if (!isUrlAllowed(results.robotsInfo, urlInfo.url)) {
              console.log(`スキップ（robots.txt拒否）: ${urlInfo.url}`);
              results.summary.totalSkipped++;
              return null;
            }
          }

          // 進捗通知
          if (progressCallback) {
            const progress = 15 + Math.floor((completedCount / totalUrls) * 70);
            progressCallback({
              stage: 'crawling',
              progress,
              message: `クロール中: ${urlInfo.url}`,
              currentPage: completedCount + 1,
              totalPages: totalUrls
            });
          }

          console.log(`[${completedCount + 1}/${totalUrls}] クロール: ${urlInfo.url}`);

          // クロール実行（リトライ付き）
          let crawlData = await crawlWebsite(urlInfo.url, { timeout: 90000 });

          // タイムアウト時は1回だけリトライ
          if (!crawlData.success && crawlData.error.includes('timeout')) {
            console.log(`タイムアウト - リトライ中: ${urlInfo.url}`);
            crawlData = await crawlWebsite(urlInfo.url, { timeout: 90000 });
          }

          if (!crawlData.success) {
            throw new Error(crawlData.error || 'クロール失敗');
          }

          // 分析実行
          const analysisResults = await analyzePageData(crawlData);

          completedCount++;
          results.summary.totalCrawled++;

          return {
            url: urlInfo.url,
            depth: urlInfo.depth,
            parent: urlInfo.parent,
            category: urlInfo.category,
            priority: urlInfo.priority,
            crawlData,
            analysis: analysisResults,
            crawledAt: new Date().toISOString()
          };

        } catch (error) {
          const errorType = error.message.includes('timeout') ? 'タイムアウト' : 'クロールエラー';
          console.error(`${errorType}: ${urlInfo.url}`, error.message);

          results.summary.totalFailed++;
          results.summary.errors.push({
            url: urlInfo.url,
            error: error.message,
            type: errorType
          });

          completedCount++;

          return {
            url: urlInfo.url,
            depth: urlInfo.depth,
            error: error.message,
            errorType,
            failed: true
          };
        }
      });
    });

    // 全てのクロール完了を待つ
    const crawledPages = await Promise.all(crawlPromises);

    // 成功したページのみを結果に追加
    const validCrawledPages = (crawledPages || []).filter(page => page && !page.failed);
    results.pages = validCrawledPages;

    // 完了通知
    if (progressCallback) {
      progressCallback({
        stage: 'completed',
        progress: 100,
        message: `完了: ${validCrawledPages.length}ページ診断完了`
      });
    }

    results.completedAt = new Date().toISOString();

    if (results.pages.length === 0) {
      throw new Error('診断に成功したページが1つもありませんでした。サイトへのアクセス制限がないか確認してください。');
    }

    return results;

  } catch (error) {
    console.error('複数ページクロールエラー:', error);
    throw error;
  }
}

/**
 * クロールデータを分析
 */
async function analyzePageData(crawlData) {
  try {
    return {
      url: crawlData.url,
      content: analyzeContent(crawlData),
      entity: analyzeEntity(crawlData),
      eeat: analyzeEEAT(crawlData),
      statistics: analyzeStatistics(crawlData),
      structuredData: analyzeStructuredData(crawlData),
      llmo: await analyzeLLMO(crawlData),
      seo: analyzeSEO(crawlData),
      performance: analyzePerformance(crawlData),
      multimedia: analyzeMultimedia(crawlData),
      social: analyzeSocial(crawlData),
      localSeo: analyzeLocalSEO(crawlData),
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('分析エラー:', error);
    throw error;
  }
}

/**
 * スリープ関数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  crawlMultiplePages,
  analyzePageData
};
