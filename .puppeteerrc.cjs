const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // node_modulesの中にキャッシュを置くことでRenderの再起動後もブラウザを保持させる
  cacheDirectory: join(__dirname, 'node_modules', '.puppeteer_cache'),
};
