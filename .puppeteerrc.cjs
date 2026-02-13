const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // node_modulesの中にキャッシュを置くことでRenderに確実に保持させる
  cacheDirectory: join(__dirname, 'node_modules', '.puppeteer_cache'),
};
