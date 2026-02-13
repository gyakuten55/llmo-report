#!/usr/bin/env bash
# exit on error
set -o errexit

# キャッシュディレクトリをホームディレクトリ配下に設定（Renderの標準的な場所）
export PUPPETEER_CACHE_DIR=$HOME/.cache/puppeteer

# npmインストール
npm install

# Puppeteer 24が使用する最新のブラウザをインストール
echo "Installing chrome-headless-shell for Puppeteer..."
npx puppeteer browsers install chrome-headless-shell

# レポート保存用ディレクトリの作成
mkdir -p reports
