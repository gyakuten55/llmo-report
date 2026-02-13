#!/usr/bin/env bash
# exit on error
set -o errexit

# キャッシュディレクトリをプロジェクト直下に指定
export PUPPETEER_CACHE_DIR=$(pwd)/.cache/puppeteer

npm install

# 指定したディレクトリにChromeをインストール
echo "Installing Chrome to $PUPPETEER_CACHE_DIR..."
npx puppeteer browsers install chrome

# レポート保存用ディレクトリの作成
mkdir -p reports
