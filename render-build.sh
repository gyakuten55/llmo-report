#!/usr/bin/env bash
# exit on error
set -o errexit

# npmインストール
npm install

# .puppeteerrc.cjs の設定に従ってChromeをインストール
echo "Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

# レポート保存用ディレクトリの作成
mkdir -p reports
