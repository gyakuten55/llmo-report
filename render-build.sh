#!/usr/bin/env bash
# exit on error
set -o errexit

# npm installを実行。package.jsonのpostinstallによって自動的にブラウザも入ります。
npm install

# レポート保存用ディレクトリの作成
mkdir -p reports
