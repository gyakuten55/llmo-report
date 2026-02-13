const axios = require('axios');
const robotsParser = require('robots-parser');

/**
 * robots.txtを解析してクロール可否を判定
 * @param {string} baseUrl - ベースURL
 * @param {Object} options - オプション
 * @returns {Promise<Object>} - robots.txt情報
 */
async function parseRobotsTxt(baseUrl, options = {}) {
  const {
    userAgent = 'LLMOBot',
    timeout = 10000
  } = options;

  try {
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const robotsUrl = `${normalizedBaseUrl}/robots.txt`;

    // robots.txtを取得
    const response = await axios.get(robotsUrl, {
      timeout,
      headers: {
        'User-Agent': `Mozilla/5.0 (compatible; ${userAgent}/1.0)`
      },
      validateStatus: (status) => status === 200 || status === 404
    });

    // robots.txtが存在しない場合
    if (response.status === 404) {
      return {
        exists: false,
        allowed: () => true,  // 全て許可
        crawlDelay: 1000,     // デフォルト1秒
        sitemaps: [],
        userAgent
      };
    }

    const robotsTxt = response.data;

    // robots-parserで解析
    const robots = robotsParser(robotsUrl, robotsTxt);

    // Crawl-delayを取得（User-agentに応じて）
    let crawlDelay = 1000; // デフォルト1秒
    const lines = robotsTxt.split('\n');
    let currentUserAgent = null;
    let foundUserAgentMatch = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // User-agent行
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmed.substring(11).trim();
        if (agent === '*' || agent.toLowerCase() === userAgent.toLowerCase()) {
          currentUserAgent = agent;
          foundUserAgentMatch = (agent.toLowerCase() === userAgent.toLowerCase());
        } else {
          currentUserAgent = null;
          foundUserAgentMatch = false;
        }
      }

      // Crawl-delay行（該当User-agent内）
      if (currentUserAgent && trimmed.toLowerCase().startsWith('crawl-delay:')) {
        const delay = parseFloat(trimmed.substring(12).trim());
        if (!isNaN(delay)) {
          crawlDelay = delay * 1000; // 秒をミリ秒に変換

          // 特定のUser-agentにマッチした場合は優先
          if (foundUserAgentMatch) {
            break;
          }
        }
      }
    }

    // サイトマップURLを抽出
    const sitemaps = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        const sitemapUrl = trimmed.substring(8).trim();
        sitemaps.push(sitemapUrl);
      }
    }

    return {
      exists: true,
      allowed: (url) => robots.isAllowed(url, userAgent),
      crawlDelay,
      sitemaps,
      userAgent,
      robotsTxt
    };

  } catch (error) {
    // エラー時は全て許可（安全側）
    return {
      exists: false,
      allowed: () => true,
      crawlDelay: 1000,
      sitemaps: [],
      userAgent,
      error: error.message
    };
  }
}

/**
 * URLがクロール可能かチェック
 * @param {Object} robotsInfo - parseRobotsTxtの結果
 * @param {string} url - チェックするURL
 * @returns {boolean} - クロール可能ならtrue
 */
function isUrlAllowed(robotsInfo, url) {
  if (!robotsInfo || !robotsInfo.exists) {
    return true; // robots.txtがない場合は許可
  }

  return robotsInfo.allowed(url);
}

/**
 * robots.txtに基づいてURLリストをフィルタリング
 * @param {Object} robotsInfo - parseRobotsTxtの結果
 * @param {Array<string>} urls - URLリスト
 * @returns {Object} - フィルタリング結果
 */
function filterUrlsByRobots(robotsInfo, urls) {
  const allowed = [];
  const disallowed = [];

  for (const url of urls) {
    if (isUrlAllowed(robotsInfo, url)) {
      allowed.push(url);
    } else {
      disallowed.push(url);
    }
  }

  return {
    allowed,
    disallowed,
    totalAllowed: allowed.length,
    totalDisallowed: disallowed.length
  };
}

module.exports = {
  parseRobotsTxt,
  isUrlAllowed,
  filterUrlsByRobots
};
