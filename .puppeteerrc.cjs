const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // キャッシュの場所をプロジェクト内のディレクトリに固定
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
