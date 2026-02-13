#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
# Puppeteerのブラウザ（Chromium）を確実にダウンロード
# Renderの環境では通常必要ありませんが、明示的に行うことで安定します
# npx puppeteer browsers install chrome
