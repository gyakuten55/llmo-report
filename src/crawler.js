const puppeteer = require('puppeteer');

/**
 * Webサイトをクロールしてデータを収集
 * @param {string} url - クロール対象のURL
 * @param {Object} options - クロールオプション
 * @param {number} options.timeout - タイムアウト時間（ミリ秒）
 * @returns {Object} - クロール結果
 */
async function crawlWebsite(url, options = {}) {
  let browser;

  try {
    // タイムアウト設定（デフォルト90秒）
    const timeout = options.timeout || 90000;

    // ブラウザを起動
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // ページサイズを設定（デスクトップ）
    await page.setViewport({ width: 1920, height: 1080 });

    // ユーザーエージェントを設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // ページのパフォーマンスメトリクスを収集
    const startTime = Date.now();

    // ページにアクセス（HTMLの読み込み完了を待機）
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeout
    });

    const loadTime = Date.now() - startTime;

    // ページのHTMLを取得
    const html = await page.content();

    // ページタイトルを取得
    const title = await page.title();

    // メタ情報を取得
    const metaTags = await page.evaluate(() => {
      const metas = Array.from(document.querySelectorAll('meta'));
      return metas.map(meta => ({
        name: meta.getAttribute('name') || meta.getAttribute('property'),
        content: meta.getAttribute('content')
      })).filter(m => m.name);
    });

    // 構造化データを取得（強化版）
    const structuredData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      const data = [];
      scripts.forEach(script => {
        try {
          const content = JSON.parse(script.textContent);
          if (Array.isArray(content)) {
            data.push(...content);
          } else {
            data.push(content);
          }
        } catch (e) {
          // パースエラーはスキップ
        }
      });
      return data;
    });

    // 画像情報を取得
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => ({
        src: img.src,
        alt: img.alt || null,
        width: img.naturalWidth,
        height: img.naturalHeight
      }));
    });

    // リンク情報を取得
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors.map(a => ({
        href: a.href,
        text: a.textContent.trim(),
        isInternal: a.hostname === window.location.hostname
      }));
    });

    // 見出し構造を取得
    const headings = await page.evaluate(() => {
      const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      const result = {};

      headingTags.forEach(tag => {
        const elements = Array.from(document.querySelectorAll(tag));
        result[tag] = elements.map(el => el.textContent.trim());
      });

      return result;
    });

    // ページのテキストコンテンツを取得
    const textContent = await page.evaluate(() => {
      return document.body.innerText;
    });

    // リダイレクトチェーン
    const redirectChain = response.request().redirectChain();

    // HTTPステータス
    const status = response.status();

    // パフォーマンスメトリクスを取得
    const performanceMetrics = await page.evaluate(() => {
      const perfData = window.performance.timing;
      const navigation = window.performance.getEntriesByType('navigation')[0];

      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
        loadComplete: perfData.loadEventEnd - perfData.navigationStart,
        domInteractive: perfData.domInteractive - perfData.navigationStart,
        serverResponseTime: perfData.responseStart - perfData.requestStart,
        ...(navigation && {
          transferSize: navigation.transferSize,
          encodedBodySize: navigation.encodedBodySize,
          decodedBodySize: navigation.decodedBodySize
        })
      };
    });

    // Web Vitalsの取得（概算）
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        // LCP (Largest Contentful Paint)
        let lcp = 0;
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          lcp = lastEntry.renderTime || lastEntry.loadTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // CLS (Cumulative Layout Shift)
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              cls += entry.value;
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });

        // FID は実際のユーザーインタラクションが必要なため、ここでは0とする
        setTimeout(() => {
          resolve({ lcp, cls, fid: 0 });
        }, 500);
      });
    });

    await browser.close();

    return {
      success: true,
      url,
      status,
      loadTime,
      title,
      metaTags,
      structuredData,
      images,
      links,
      headings,
      textContent,
      html,
      redirectChain: redirectChain.map(r => r.url()),
      performanceMetrics,
      webVitals,
      crawledAt: new Date().toISOString()
    };

  } catch (error) {
    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      url,
      error: error.message,
      crawledAt: new Date().toISOString()
    };
  }
}

module.exports = { crawlWebsite };
