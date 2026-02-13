#!/usr/bin/env bash
# exit on error
set -o errexit

# この場所（プロジェクト内）にブラウザを入れろと指示
export PUPPETEER_CACHE_DIR=/opt/render/project/src/.cache/puppeteer

# インストール（ここでブラウザもダウンロードされる）
npm install

# レポート保存用ディレクトリの作成
mkdir -p reports
