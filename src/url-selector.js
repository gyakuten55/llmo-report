const { parseSitemap } = require('./sitemap-parser');
const { parseRobotsTxt, filterUrlsByRobots } = require('./robots-parser');
const { crawlWebsite } = require('./crawler');

/**
 * クロール候補URLを取得してフィルタリング
 * @param {string} baseUrl - ベースURL
 * @param {Object} options - オプション
 * @returns {Promise<Object>} - 候補URL一覧
 */
async function getCandidateUrls(baseUrl, options = {}) {
  const {
    maxDepth = 2,
    useSitemap = true,
    respectRobots = true,
    maxCandidates = 500
  } = options;

  const results = {
    candidates: [],
    totalFound: 0,
    sources: {
      sitemap: 0,
      internalLinks: 0
    },
    categories: {
      static: 0,
      blog: 0,
      product: 0,
      other: 0
    },
    robotsInfo: null
  };

  try {
    // 1. robots.txt解析
    if (respectRobots) {
      results.robotsInfo = await parseRobotsTxt(baseUrl);
    }

    const urlSet = new Set();
    const urlInfoMap = new Map();

    // 2. サイトマップから取得
    if (useSitemap) {
      const sitemapResult = await parseSitemap(baseUrl, { maxUrls: maxCandidates });

      if (sitemapResult.success && sitemapResult.urls) {
        for (const urlInfo of sitemapResult.urls) {
          if (urlInfo.loc) {
            urlSet.add(urlInfo.loc);
            urlInfoMap.set(urlInfo.loc, {
              url: urlInfo.loc,
              source: 'sitemap',
              priority: urlInfo.priority || 0.5,
              changefreq: urlInfo.changefreq,
              lastmod: urlInfo.lastmod,
              depth: 0
            });
            results.sources.sitemap++;
          }
        }
      }
    }

    // 3. トップページから内部リンク探索（軽量クロール）
    if (maxDepth >= 1 && urlSet.size < maxCandidates) {
      try {
        const topPageData = await crawlWebsite(baseUrl, { timeout: 15000 });

        if (topPageData.success && topPageData.links) {
          const internalLinks = topPageData.links
            .filter(link => link.isInternal)
            .map(link => link.href)
            .filter(href => {
              try {
                const url = new URL(href);
                // ハッシュ、クエリパラメータを除外
                return url.origin + url.pathname;
              } catch {
                return null;
              }
            })
            .filter(Boolean);

          for (const url of internalLinks) {
            if (!urlSet.has(url) && urlSet.size < maxCandidates) {
              urlSet.add(url);
              urlInfoMap.set(url, {
                url,
                source: 'internal-link',
                priority: 0.5,
                depth: 1
              });
              results.sources.internalLinks++;
            }
          }
        }
      } catch (error) {
        console.error('内部リンク探索エラー:', error.message);
      }
    }

    // 4. robots.txtでフィルタリング
    let allowedUrls = Array.from(urlSet);

    if (respectRobots && results.robotsInfo) {
      const filtered = filterUrlsByRobots(results.robotsInfo, allowedUrls);
      allowedUrls = filtered.allowed;

      console.log(`robots.txtフィルタリング: ${filtered.totalAllowed}件許可, ${filtered.totalDisallowed}件拒否`);
    }

    // 5. カテゴリ分類と優先度設定
    for (const url of allowedUrls) {
      const urlInfo = urlInfoMap.get(url) || {
        url,
        source: 'unknown',
        priority: 0.5,
        depth: 0
      };

      // カテゴリ判定
      const category = categorizeUrl(url);
      urlInfo.category = category;
      results.categories[category]++;

      // 重要度推定
      urlInfo.estimatedImportance = estimateImportance(url, urlInfo);

      results.candidates.push(urlInfo);
    }

    // 6. 優先度順にソート
    results.candidates.sort((a, b) => {
      // 重要度優先
      const importanceOrder = { high: 3, medium: 2, low: 1 };
      const importanceDiff = importanceOrder[b.estimatedImportance] - importanceOrder[a.estimatedImportance];
      if (importanceDiff !== 0) return importanceDiff;

      // 次にpriorityでソート
      return b.priority - a.priority;
    });

    results.totalFound = results.candidates.length;

    return results;

  } catch (error) {
    return {
      candidates: [],
      totalFound: 0,
      sources: { sitemap: 0, internalLinks: 0 },
      categories: { static: 0, blog: 0, product: 0, other: 0 },
      error: error.message
    };
  }
}

/**
 * URLをカテゴリ分類
 */
function categorizeUrl(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();

    // ブログ・記事
    if (path.includes('/blog/') || path.includes('/article/') || path.includes('/post/') ||
        path.includes('/news/') || path.match(/\/\d{4}\/\d{2}\//)) {
      return 'blog';
    }

    // 商品
    if (path.includes('/product/') || path.includes('/item/') || path.includes('/shop/')) {
      return 'product';
    }

    // 固定ページ（about, contact等）
    const staticPages = ['/about', '/contact', '/company', '/service', '/price', '/faq'];
    if (path === '/' || staticPages.some(page => path.includes(page))) {
      return 'static';
    }

    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * URL

の重要度を推定
 */
function estimateImportance(url, urlInfo) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // トップページは常に高
    if (path === '/' || path === '') {
      return 'high';
    }

    // サイトマップのpriority値を考慮
    if (urlInfo.priority >= 0.8) {
      return 'high';
    }

    // 主要な固定ページ
    const importantPages = ['/about', '/contact', '/service', '/company', '/price'];
    if (importantPages.some(page => path.toLowerCase().includes(page))) {
      return 'high';
    }

    // サイトマップに記載されているページは中程度
    if (urlInfo.source === 'sitemap') {
      return 'medium';
    }

    // それ以外
    return 'low';
  } catch {
    return 'low';
  }
}

/**
 * ユーザーが選択したURLのみを抽出
 */
function filterSelectedUrls(candidates, selectedUrls) {
  if (!selectedUrls || selectedUrls.length === 0) {
    return candidates;
  }

  const selectedSet = new Set(selectedUrls);
  return candidates.filter(candidate => selectedSet.has(candidate.url));
}

module.exports = {
  getCandidateUrls,
  categorizeUrl,
  estimateImportance,
  filterSelectedUrls
};
