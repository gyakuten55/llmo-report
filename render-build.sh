#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. ライブラリをインストール
npm install

# 2. .puppeteerrc.cjs の設定に従い、node_modules 内にブラウザをインストール
echo "Installing Chrome into node_modules..."
npx puppeteer browsers install chrome

# 3. レポート保存用ディレクトリの作成
mkdir -p reports
