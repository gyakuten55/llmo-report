const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // プロジェクト直下の .puppeteer フォルダにブラウザを保存
  cacheDirectory: join(__dirname, '.puppeteer'),
};
