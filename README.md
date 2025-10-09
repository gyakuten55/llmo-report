# LLMO診断レポートシステム

ウェブサイトのSEO、パフォーマンス、コンテンツ品質、構造化データ、LLMO対応を総合的に診断し、詳細なPDFレポートを生成するシステムです。

## 機能

### 診断項目

#### 1. 技術的SEO
- ページタイトル・メタディスクリプション分析（実データ表示付き）
- OGP（Open Graph Protocol）タグ分析
- Twitter Card分析
- Canonical URL確認
- H1タグ最適化チェック
- モバイルフレンドリー対応
- 画像Alt属性設定率
- リダイレクトチェーン分析

#### 2. パフォーマンス評価
- ページ読み込み速度測定
- Core Web Vitals（LCP、CLS、FID）
- サーバーレスポンスタイム
- DOM処理時間
- 画像最適化率
- モバイル最適化スコア
- レスポンシブデザイン対応状況

#### 3. コンテンツ品質評価
- コンテンツボリューム（総文字数・単語数）
- 見出し構造の最適化（H1-H6）
- 段落・リスト・テーブルの分析
- 内部リンク構造評価
- テキストと画像のバランス

#### 4. 構造化データ評価
- Schema.org構造化データ実装状況
- 実装済みスキーマタイプ一覧
- FAQスキーマ
- HowToスキーマ
- Articleスキーマ
- Organizationスキーマ
- エンティティ情報の明確性

#### 5. LLMO特化評価
- AI引用適正スコア
- FAQコンテンツの充実度（Q&Aペア検出）
- 統計データ・数値情報の掲載状況
- 引用元として認識されやすい構造の評価
- 権威性・信頼性の指標（著者情報、公開日、出典など）

## セットアップ

### 必要要件
- Node.js v16以上
- npm

### インストール

依存関係は既にインストール済みです。

### 起動

```bash
npm start
```

開発モード（自動リロード）:
```bash
npm run dev
```

サーバーが起動したら、ブラウザで以下にアクセス:
```
http://localhost:3000
```

## 使い方

### Webインターフェース

1. ブラウザで `http://localhost:3000` にアクセス
2. 診断したいウェブサイトのURLを入力
3. 「診断開始」ボタンをクリック
4. 診断が完了するまで待機（進捗が表示されます）
5. 診断完了後、スコアを確認
6. 「PDFレポートをダウンロード」ボタンでレポートを取得

### API エンドポイント

#### 診断開始
```bash
POST /api/analyze
Content-Type: application/json

{
  "url": "https://example.com"
}
```

レスポンス:
```json
{
  "jobId": "uuid",
  "status": "pending",
  "message": "診断を開始しました"
}
```

#### 診断状態確認
```bash
GET /api/analyze/:jobId
```

レスポンス:
```json
{
  "jobId": "uuid",
  "status": "analyzing-seo",
  "progress": 40,
  "url": "https://example.com"
}
```

#### 診断結果取得（JSON）
```bash
GET /api/result/:jobId
```

#### PDFレポート取得
```bash
GET /api/report/:jobId
```

## プロジェクト構造

```
/
├── package.json          # プロジェクト設定
├── server.js             # Expressサーバー
├── public/               # フロントエンド
│   ├── index.html        # メインHTML
│   ├── style.css         # スタイルシート
│   └── app.js            # フロントエンドロジック
├── src/
│   ├── crawler.js        # Webクローラー
│   ├── pdf-generator.js  # PDF生成
│   └── analyzers/        # 分析モジュール
│       ├── seo.js        # SEO分析
│       ├── performance.js    # パフォーマンス分析
│       ├── content.js        # コンテンツ分析
│       ├── structured-data.js # 構造化データ分析
│       └── llmo.js           # LLMO特化分析
└── reports/              # 生成されたPDF保存先
```

## レポートの内容

生成されるPDFレポートには以下が含まれます:

1. **総合スコア** - 全カテゴリの平均スコア
2. **カテゴリ別スコア** - 各評価項目のスコアとスコアバー
3. **実データ表示** - メタ情報、見出し、構造化データなどの実際のデータ
4. **詳細評価** - 各項目の詳細な分析結果
5. **改善提案** - 優先度別の具体的な改善アクション

## 注意事項

- Puppeteerを使用しているため、初回起動時にChromiumのダウンロードが行われます
- PDFファイルは24時間後に自動的に削除されます
- 大規模なサイトの診断には時間がかかる場合があります
- 構造化データは JSON-LD 形式のみ対応しています

## トラブルシューティング

### Puppeteerが起動しない
- Chromiumの依存関係が不足している可能性があります
- macOSの場合、追加のパッケージは不要です

### PDF生成エラー
- reportsディレクトリの書き込み権限を確認してください

### クロールエラー
- 対象サイトがrobots.txtでクローラーをブロックしている可能性があります
- ネットワーク接続を確認してください

## ライセンス

MIT

## 開発者向け

### 新しい分析項目を追加する

1. `src/analyzers/` に新しいモジュールを作成
2. `server.js` の `runAnalysis` 関数に分析処理を追加
3. `src/pdf-generator.js` にレポート出力処理を追加
4. `public/app.js` と `public/index.html` にUI表示を追加

### カスタマイズ

- スコアリングロジックは各analyzerモジュール内で調整可能
- PDFのデザインは `src/pdf-generator.js` で変更可能
- UIのスタイルは `public/style.css` で変更可能
