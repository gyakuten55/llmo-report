const axios = require('axios');
const { parseStringPromise } = require('xml2js');

/**
 * サイトマップを解析してURL一覧を取得
 * @param {string} baseUrl - ベースURL（例: https://example.com）
 * @param {Object} options - オプション
 * @returns {Promise<Object>} - URL一覧と情報
 */
async function parseSitemap(baseUrl, options = {}) {
  const {
    maxUrls = 1000,
    timeout = 30000
  } = options;

  try {
    // ベースURLの正規化
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // サイトマップURL候補
    const sitemapCandidates = [
      `${normalizedBaseUrl}/sitemap.xml`,
      `${normalizedBaseUrl}/sitemap_index.xml`,
      `${normalizedBaseUrl}/sitemap1.xml`,
      `${normalizedBaseUrl}/post-sitemap.xml`,
      `${normalizedBaseUrl}/page-sitemap.xml`
    ];

    let sitemapUrl = null;
    let sitemapContent = null;

    // サイトマップを検索
    for (const candidate of sitemapCandidates) {
      try {
        const response = await axios.get(candidate, {
          timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LLMOBot/1.0; +http://llmo-report.com/bot)'
          }
        });

        if (response.status === 200 && response.data) {
          sitemapUrl = candidate;
          sitemapContent = response.data;
          break;
        }
      } catch (error) {
        // このURLにはサイトマップがない、次を試す
        continue;
      }
    }

    if (!sitemapUrl || !sitemapContent) {
      return {
        success: false,
        urls: [],
        totalFound: 0,
        message: 'サイトマップが見つかりませんでした'
      };
    }

    // XMLをパース
    const parsed = await parseStringPromise(sitemapContent);

    let allUrls = [];

    // サイトマップインデックスの場合
    if (parsed.sitemapindex) {
      const sitemaps = parsed.sitemapindex.sitemap || [];

      for (const sitemap of sitemaps.slice(0, 10)) { // 最大10個のサイトマップ
        const subSitemapUrl = sitemap.loc[0];
        try {
          const subResponse = await axios.get(subSitemapUrl, { timeout });
          const subParsed = await parseStringPromise(subResponse.data);

          if (subParsed.urlset && subParsed.urlset.url) {
            const urls = extractUrlsFromUrlset(subParsed.urlset);
            allUrls = allUrls.concat(urls);
          }
        } catch (error) {
          console.error(`サブサイトマップの取得エラー: ${subSitemapUrl}`, error.message);
        }

        if (allUrls.length >= maxUrls) break;
      }
    }
    // 通常のサイトマップの場合
    else if (parsed.urlset && parsed.urlset.url) {
      allUrls = extractUrlsFromUrlset(parsed.urlset);
    }

    // 最大数に制限
    const limitedUrls = allUrls.slice(0, maxUrls);

    return {
      success: true,
      urls: limitedUrls,
      totalFound: allUrls.length,
      sitemapUrl,
      truncated: allUrls.length > maxUrls
    };

  } catch (error) {
    return {
      success: false,
      urls: [],
      totalFound: 0,
      error: error.message
    };
  }
}

/**
 * URLセットからURL情報を抽出
 */
function extractUrlsFromUrlset(urlset) {
  const urls = urlset.url || [];

  return urls.map(urlObj => {
    return {
      loc: urlObj.loc ? urlObj.loc[0] : null,
      priority: urlObj.priority ? parseFloat(urlObj.priority[0]) : 0.5,
      changefreq: urlObj.changefreq ? urlObj.changefreq[0] : 'monthly',
      lastmod: urlObj.lastmod ? urlObj.lastmod[0] : null
    };
  }).filter(url => url.loc); // locがあるもののみ
}

/**
 * robots.txtからサイトマップURLを取得
 */
async function getSitemapFromRobotsTxt(baseUrl, options = {}) {
  const { timeout = 10000 } = options;

  try {
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const robotsUrl = `${normalizedBaseUrl}/robots.txt`;

    const response = await axios.get(robotsUrl, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LLMOBot/1.0)'
      }
    });

    if (response.status === 200 && response.data) {
      const robotsTxt = response.data;
      const lines = robotsTxt.split('\n');

      const sitemapUrls = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith('sitemap:')) {
          const sitemapUrl = trimmed.substring(8).trim();
          sitemapUrls.push(sitemapUrl);
        }
      }

      return sitemapUrls;
    }

    return [];
  } catch (error) {
    return [];
  }
}

module.exports = {
  parseSitemap,
  getSitemapFromRobotsTxt
};
