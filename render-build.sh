#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

# Puppeteer用のブラウザ（Chrome）をインストール
echo "Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

# レポート保存用ディレクトリの作成
mkdir -p reports
