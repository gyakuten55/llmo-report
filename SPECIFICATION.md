# LLMO診断レポートシステム - システム仕様書

**バージョン**: 1.0.0
**最終更新**: 2025-10-03

---

## 目次

1. [システム概要](#1-システム概要)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [機能仕様](#3-機能仕様)
4. [API仕様](#4-api仕様)
5. [処理フロー](#5-処理フロー)
6. [データ構造](#6-データ構造)
7. [PDFレポート仕様](#7-pdfレポート仕様)
8. [運用仕様](#8-運用仕様)
9. [UI/UX仕様](#9-uiux仕様)
10. [セキュリティ・エラーハンドリング](#10-セキュリティエラーハンドリング)
11. [拡張性](#11-拡張性)

---

## 1. システム概要

### 1.1 目的

WebサイトのSEO、パフォーマンス、コンテンツ品質、構造化データ、LLMO（Large Language Model Optimization）対応を総合的に診断し、詳細なPDFレポートを自動生成するシステム。

### 1.2 主な特徴

- **自動診断**: URLを入力するだけで自動的に多角的な分析を実行
- **実データ表示**: スコアだけでなく、実際に収集したデータも表示
- **PDF出力**: プロフェッショナルな診断レポートをPDF形式で生成
- **リアルタイム進捗**: 診断の進行状況をリアルタイムで表示
- **LLMO対策**: AI検索エンジン最適化に特化した評価項目

### 1.3 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|-----|----------|
| ランタイム | Node.js | v16以上 |
| Webフレームワーク | Express | ^4.18.2 |
| クローラー | Puppeteer | ^24.1.0 |
| パフォーマンス測定 | Lighthouse | ^11.4.0 |
| HTML解析 | Cheerio | ^1.0.0-rc.12 |
| PDF生成 | PDFKit | ^0.14.0 |
| その他 | CORS, UUID | - |

---

## 2. システムアーキテクチャ

### 2.1 全体構成

```
┌─────────────┐
│   Browser   │ ← ユーザー
└──────┬──────┘
       │ HTTP
       ↓
┌─────────────────────────────┐
│   Express Server (port 3000) │
│  ┌─────────────────────────┐│
│  │  Static Files (public/) ││
│  │  - index.html           ││
│  │  - style.css            ││
│  │  - app.js               ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │   API Endpoints         ││
│  │  - POST /api/analyze    ││
│  │  - GET  /api/analyze/:id││
│  │  - GET  /api/result/:id ││
│  │  - GET  /api/report/:id ││
│  └─────────────────────────┘│
└──────────┬──────────────────┘
           │
           ↓
    ┌─────────────┐
    │  Job Queue  │ (In-Memory Map)
    └──────┬──────┘
           │
           ↓
    ┌─────────────────────────┐
    │   Analysis Pipeline     │
    │  1. Crawler             │
    │  2. SEO Analyzer        │
    │  3. Performance Analyzer│
    │  4. Content Analyzer    │
    │  5. Structured Data     │
    │  6. LLMO Analyzer       │
    │  7. PDF Generator       │
    └─────────────────────────┘
           │
           ↓
    ┌─────────────┐
    │ reports/    │ (File System)
    │ {jobId}.pdf │
    └─────────────┘
```

### 2.2 ディレクトリ構造

```
LLMO-Report/
├── package.json                # プロジェクト設定・依存関係
├── package-lock.json           # 依存関係ロックファイル
├── server.js                   # Expressサーバー（メインエントリーポイント）
├── README.md                   # 使い方・セットアップガイド
├── SPECIFICATION.md            # 本仕様書
├── .gitignore                  # Git除外設定
│
├── public/                     # フロントエンド（静的ファイル）
│   ├── index.html             # メインHTML
│   ├── style.css              # CSSスタイル（コーポレートデザイン）
│   └── app.js                 # フロントエンドロジック
│
├── src/                        # バックエンドソースコード
│   ├── crawler.js             # Webクローラー（Puppeteer）
│   ├── pdf-generator.js       # PDFレポート生成（PDFKit）
│   └── analyzers/             # 分析モジュール群
│       ├── seo.js             # SEO分析
│       ├── performance.js     # パフォーマンス分析
│       ├── content.js         # コンテンツ分析
│       ├── structured-data.js # 構造化データ分析
│       └── llmo.js            # LLMO特化分析
│
└── reports/                    # 生成されたPDF保存先
    └── {jobId}.pdf            # 診断レポート（24時間後削除）
```

### 2.3 主要モジュール

#### 2.3.1 crawler.js
- **役割**: 対象URLにアクセスし、必要なデータを収集
- **使用技術**: Puppeteer（Chromium制御）
- **収集データ**:
  - HTML全体
  - メタタグ
  - 構造化データ（JSON-LD）
  - 画像情報
  - リンク情報
  - 見出し構造
  - パフォーマンスメトリクス
  - Web Vitals

#### 2.3.2 analyzers/
- **役割**: 収集データを分析しスコアリング
- **5つの独立したモジュール**:
  1. `seo.js` - 技術的SEO評価
  2. `performance.js` - パフォーマンス評価
  3. `content.js` - コンテンツ品質評価
  4. `structured-data.js` - 構造化データ評価
  5. `llmo.js` - LLMO特化評価

#### 2.3.3 pdf-generator.js
- **役割**: 分析結果をPDFレポートに変換
- **使用技術**: PDFKit
- **出力形式**: A4サイズ、複数ページ

---

## 3. 機能仕様

### 3.1 診断カテゴリ（5カテゴリ、各100点満点）

#### 3.1.1 技術的SEO（100点満点）

| 評価項目 | 配点 | 評価基準 | 実データ |
|---------|------|----------|---------|
| ページタイトル | 10点 | 60文字以内=10点、70文字以内=7点、それ以外=5点 | タイトル文字列、文字数 |
| メタディスクリプション | 10点 | 160文字以内=10点、200文字以内=7点 | ディスクリプション文字列、文字数 |
| OGPタグ | 10点 | 必須4タグ全て設定=10点、部分的=比例配点 | og:title, og:description, og:image, og:url |
| Twitter Card | 5点 | 設定あり=5点、なし=0点 | twitter:card, twitter:title等 |
| Canonical URL | 5点 | 設定あり=5点 | canonical URL |
| Robots Meta | 5点 | 基本5点、noindex警告あり | robots content |
| Hreflang | 5点 | 基本5点 | hreflang一覧 |
| 構造化データ | 10点 | あり=10点、なし=0点 | 実装数 |
| 画像Alt属性 | 10点 | 90%以上=10点、比例配点 | 総画像数、Alt設定数、設定率 |
| H1タグ | 10点 | 1個=10点、複数=5点、なし=0点 | H1テキスト一覧 |
| モバイル最適化 | 10点 | viewport設定=10点 | viewport content |
| リダイレクト | 10点 | なし=10点、1回毎に-2点 | リダイレクト回数、チェーン |

**合計**: 100点

#### 3.1.2 パフォーマンス評価（100点満点）

| 評価項目 | 配点 | 評価基準 | 実データ |
|---------|------|----------|---------|
| ページ読み込み速度 | 20点 | <1000ms=20点、<2000ms=15点、<3000ms=10点 | ミリ秒 |
| LCP | 15点 | <2500ms=15点、<4000ms=10点 | ミリ秒 |
| CLS | 15点 | <0.1=15点、<0.25=10点 | スコア |
| FID | 10点 | 実測困難のため10点 | 0ms（推定） |
| サーバーレスポンス | 10点 | <200ms=10点、<500ms=7点 | ミリ秒 |
| DOM処理時間 | 10点 | <2000ms=10点、<4000ms=7点 | ミリ秒 |
| 画像最適化率 | 10点 | 80%以上=10点、比例配点 | 総数、最適化数、率 |
| モバイル最適化 | 10点 | viewport設定=10点 | 有無 |
| レスポンシブデザイン | 10点 | メディアクエリあり=10点 | 有無 |
| キャッシュ活用 | 5点 | 基本5点 | - |

**合計**: 105点 → 100点に正規化

#### 3.1.3 コンテンツ品質評価（100点満点）

| 評価項目 | 配点 | 評価基準 | 実データ |
|---------|------|----------|---------|
| コンテンツボリューム | 20点 | ≥2000文字=20点、≥1000文字=15点、≥500文字=10点 | 総文字数、総単語数 |
| 見出し構造 | 20点 | H1=1個&H2≥2個=20点 | H1-H6の個数と内容 |
| コンテンツ深度 | 15点 | 段落+リスト+表≥10=15点、≥5=10点 | 段落数、リスト数、表数 |
| 内部リンク | 15点 | ≥5個=15点、≥2個=10点 | 内部リンク数、外部リンク数 |
| メディアバランス | 10点 | 画像あり&比率適切=10点 | 画像数、テキスト/画像比 |
| キーワード密度 | 10点 | 基本10点 | - |
| リスト使用 | 10点 | ≥3個=10点、>0個=7点 | リストアイテム数 |

**合計**: 100点

#### 3.1.4 構造化データ評価（100点満点）

| 評価項目 | 配点 | 評価基準 | 実データ |
|---------|------|----------|---------|
| 実装状況 | 20点 | あり=20点、なし=0点 | 構造化データ数 |
| スキーマタイプ | 20点 | タイプ数×10点（最大20点） | スキーマタイプ一覧 |
| FAQスキーマ | 15点 | 実装あり=15点 | 質問数、実際のJSON-LD |
| HowToスキーマ | 10点 | 実装あり=10点 | ステップ数、実際のJSON-LD |
| Articleスキーマ | 10点 | 実装あり=10点 | author、datePublished有無 |
| Organizationスキーマ | 10点 | 実装あり=10点 | logo、contactPoint有無 |
| Breadcrumbスキーマ | 5点 | 実装あり=5点 | - |
| エンティティ明確性 | 10点 | エンティティ数×5点（最大10点） | Organization、Person、Place等 |

**合計**: 100点

#### 3.1.5 LLMO特化評価（100点満点）

| 評価項目 | 配点 | 評価基準 | 実データ |
|---------|------|----------|---------|
| FAQコンテンツ充実度 | 25点 | ≥5ペア=25点、≥3ペア=15点、≥1ペア=10点 | Q&Aペア（質問と回答） |
| 統計データ・数値情報 | 20点 | ユニーク数値≥10&フレーズ≥2=20点 | 検出数値、統計フレーズ |
| 引用構造 | 25点 | 5指標×5点 | H1、H2、段落、リスト、構造化データ |
| 権威性・信頼性 | 20点 | 5指標×4点 | 著者、公開日、連絡先、会社情報、引用元 |
| 明確な回答提供 | 15点 | フレーズ数/10×5点（最大15点） | 「〜とは」「方法」等のフレーズ数 |
| AI引用適正スコア | 3点 | 5指標の充足率×3点 | 総合評価 |

**合計**: 108点 → 100点に正規化

### 3.2 総合スコア計算

```
総合スコア = (SEOスコア/100 + パフォーマンススコア/100 + コンテンツスコア/100
              + 構造化データスコア/100 + LLMOスコア/100) / 5 × 100

※ 小数点以下四捨五入
```

---

## 4. API仕様

### 4.1 ベースURL

```
http://localhost:3000
```

### 4.2 エンドポイント一覧

#### 4.2.1 診断開始

**エンドポイント**: `POST /api/analyze`

**リクエスト**:
```http
POST /api/analyze HTTP/1.1
Content-Type: application/json

{
  "url": "https://example.com",
  "options": {
    "timeout": 30
  }
}
```

**パラメータ**:
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| url | string | ✓ | 診断対象のURL（完全なURL） |
| options | object | - | オプション設定 |
| options.timeout | number | - | タイムアウト（秒）デフォルト: 30 |

**レスポンス** (200 OK):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "診断を開始しました"
}
```

**エラーレスポンス** (400 Bad Request):
```json
{
  "error": "URLが必要です"
}
```

---

#### 4.2.2 診断状態確認

**エンドポイント**: `GET /api/analyze/:jobId`

**リクエスト**:
```http
GET /api/analyze/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

**レスポンス** (200 OK):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "analyzing-seo",
  "progress": 40,
  "url": "https://example.com",
  "createdAt": "2025-10-03T12:00:00.000Z",
  "completedAt": null,
  "error": null
}
```

**ステータス値**:
| ステータス | 進捗率 | 説明 |
|-----------|--------|------|
| `pending` | 0% | 準備中 |
| `crawling` | 10-30% | Webサイトをクロール中 |
| `analyzing-seo` | 40-50% | SEO分析中 |
| `analyzing-performance` | 50-60% | パフォーマンス分析中 |
| `analyzing-content` | 60-70% | コンテンツ分析中 |
| `analyzing-structured-data` | 70-80% | 構造化データ分析中 |
| `analyzing-llmo` | 80-85% | LLMO分析中 |
| `generating-pdf` | 85-100% | PDFレポート生成中 |
| `completed` | 100% | 診断完了 |
| `failed` | - | エラー発生 |

**エラーレスポンス** (404 Not Found):
```json
{
  "error": "ジョブが見つかりません"
}
```

---

#### 4.2.3 診断結果取得（JSON）

**エンドポイント**: `GET /api/result/:jobId`

**リクエスト**:
```http
GET /api/result/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

**レスポンス** (200 OK):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com",
  "result": {
    "seo": {
      "score": 85,
      "maxScore": 100,
      "details": { ... },
      "rawData": { ... }
    },
    "performance": { ... },
    "content": { ... },
    "structuredData": { ... },
    "llmo": { ... },
    "analyzedAt": "2025-10-03T12:05:00.000Z"
  },
  "completedAt": "2025-10-03T12:05:00.000Z"
}
```

**エラーレスポンス** (400 Bad Request):
```json
{
  "error": "診断がまだ完了していません"
}
```

---

#### 4.2.4 PDFレポート取得

**エンドポイント**: `GET /api/report/:jobId`

**リクエスト**:
```http
GET /api/report/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

**レスポンス** (200 OK):
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="llmo-report-550e8400-e29b-41d4-a716-446655440000.pdf"

[PDF Binary Data]
```

**エラーレスポンス** (404 Not Found):
```json
{
  "error": "ジョブが見つかりません"
}
```

---

## 5. 処理フロー

### 5.1 診断プロセス全体図

```
[ユーザー] URL入力
    ↓
[サーバー] ジョブID生成 (UUID v4)
    ↓
[サーバー] ジョブをMapに登録
    ↓
[レスポンス] jobId返却（即座）
    ↓
━━━━━ バックグラウンド処理開始 ━━━━━
    ↓
[1] Puppeteerでクローリング (progress: 10%)
    - ブラウザ起動
    - ページアクセス
    - 待機（networkidle2）
    ↓
[2] データ収集 (progress: 20-30%)
    - HTML取得
    - メタタグ抽出
    - 構造化データ抽出（JSON-LD）
    - 画像情報収集
    - リンク情報収集
    - 見出し構造解析
    - パフォーマンスメトリクス
    - Web Vitals測定
    - モバイルビュー確認
    ↓
[3] SEO分析 (progress: 40-50%)
    - タイトル・ディスクリプション評価
    - OGP/Twitter Card評価
    - H1タグ評価
    - 画像Alt評価
    - その他SEO項目
    ↓
[4] パフォーマンス分析 (progress: 50-60%)
    - 読み込み速度評価
    - Core Web Vitals評価
    - サーバーレスポンス評価
    - 画像最適化評価
    ↓
[5] コンテンツ分析 (progress: 60-70%)
    - ボリューム評価
    - 見出し構造評価
    - 内部リンク評価
    ↓
[6] 構造化データ分析 (progress: 70-80%)
    - スキーマ実装評価
    - FAQ/Article等評価
    ↓
[7] LLMO分析 (progress: 80-85%)
    - FAQ充実度評価
    - 統計データ評価
    - 権威性評価
    ↓
[8] 結果統合 (progress: 85%)
    - 5カテゴリのスコア集計
    - 総合スコア計算
    ↓
[9] PDF生成 (progress: 90-100%)
    - PDFKit初期化
    - タイトルページ生成
    - 各セクション生成
    - 改善提案生成
    - ファイル保存
    ↓
[完了] status: 'completed' (progress: 100%)
━━━━━ バックグラウンド処理終了 ━━━━━
    ↓
[ユーザー] 結果表示・PDFダウンロード
```

### 5.2 エラーハンドリングフロー

```
[処理中]
    ↓
  エラー発生？
    ├─ Yes → status: 'failed'
    │         error: エラーメッセージ
    │         ブラウザクローズ
    │         処理終了
    │
    └─ No → 処理続行
```

---

## 6. データ構造

### 6.1 crawlData（クローリング結果）

```javascript
{
  success: Boolean,              // 成功フラグ
  url: String,                   // 対象URL
  status: Number,                // HTTPステータス
  loadTime: Number,              // 読み込み時間（ms）
  title: String,                 // ページタイトル
  metaTags: Array<{              // メタタグ配列
    name: String,
    content: String
  }>,
  structuredData: Array<Object>, // 構造化データ（JSON-LD）
  images: Array<{                // 画像情報
    src: String,
    alt: String | null,
    width: Number,
    height: Number
  }>,
  links: Array<{                 // リンク情報
    href: String,
    text: String,
    isInternal: Boolean
  }>,
  headings: {                    // 見出し構造
    h1: Array<String>,
    h2: Array<String>,
    h3: Array<String>,
    h4: Array<String>,
    h5: Array<String>,
    h6: Array<String>
  },
  textContent: String,           // テキストコンテンツ全体
  html: String,                  // HTML全体
  mobileHtml: String,            // モバイルビューHTML
  redirectChain: Array<String>,  // リダイレクトチェーン
  performanceMetrics: {          // パフォーマンスメトリクス
    domContentLoaded: Number,
    loadComplete: Number,
    domInteractive: Number,
    serverResponseTime: Number,
    transferSize: Number,
    encodedBodySize: Number,
    decodedBodySize: Number
  },
  webVitals: {                   // Web Vitals
    lcp: Number,                 // Largest Contentful Paint
    cls: Number,                 // Cumulative Layout Shift
    fid: Number                  // First Input Delay
  },
  crawledAt: String              // クロール日時（ISO 8601）
}
```

### 6.2 analysisResult（分析結果）

```javascript
{
  score: Number,        // カテゴリスコア（0-100）
  maxScore: Number,     // 最大スコア（100）
  details: {            // 詳細評価
    [項目名]: {
      value: Any,           // 評価値
      score: Number,        // 項目スコア
      recommendation: String // 推奨事項
      // その他項目固有のフィールド
    }
  },
  rawData: {            // 実データ
    [項目名]: Any       // 実際に収集したデータ
  }
}
```

### 6.3 jobObject（ジョブ管理）

```javascript
{
  status: String,       // ステータス（pending, crawling, analyzing-*, completed, failed）
  progress: Number,     // 進捗率（0-100）
  url: String,          // 対象URL
  createdAt: Date,      // 作成日時
  completedAt: Date,    // 完了日時（完了時のみ）
  result: Object,       // 分析結果（完了時のみ）
  error: String         // エラーメッセージ（失敗時のみ）
}
```

### 6.4 データフロー図

```
URL
  ↓
crawlData {
  html,
  metaTags,
  structuredData,
  images,
  links,
  headings,
  textContent,
  performanceMetrics,
  webVitals
}
  ↓
┌──────────────────────────────┐
│   5つの分析モジュール並行実行   │
├──────────────────────────────┤
│ analyzeSEO(crawlData)        │ → seoResult
│ analyzePerformance(crawlData)│ → performanceResult
│ analyzeContent(crawlData)    │ → contentResult
│ analyzeStructuredData(...)   │ → structuredDataResult
│ analyzeLLMO(crawlData)       │ → llmoResult
└──────────────────────────────┘
  ↓
analysisResults {
  url,
  seo: { score, details, rawData },
  performance: { ... },
  content: { ... },
  structuredData: { ... },
  llmo: { ... },
  analyzedAt
}
  ↓
generatePDF(analysisResults) → PDF File
```

---

## 7. PDFレポート仕様

### 7.1 ページ構成

| ページ | セクション | 内容 |
|-------|-----------|------|
| 1 | タイトルページ | タイトル、診断URL、生成日時 |
| 1 | 総合スコア | 5カテゴリの平均スコア、カテゴリ別スコアバー |
| 2-3 | 技術的SEO | タイトル、ディスクリプション、OGP、H1等の実データ+評価 |
| 3-4 | パフォーマンス | 読み込み速度、Core Web Vitals、サーバーレスポンス実測値 |
| 4-5 | コンテンツ品質 | 文字数、見出し構造、H2一覧、リンク数 |
| 5-6 | 構造化データ | 実装済みスキーマ、FAQスキーマ実データ |
| 6-8 | LLMO特化 | AI引用適正、FAQ実データ抜粋、統計データサンプル |
| 8-9 | 改善提案 | 優先度：高、優先度：中 |

### 7.2 デザイン仕様

**フォーマット**: A4サイズ

**マージン**:
- 上下左右: 50pt

**フォント**:
- 標準: システムフォント
- 注: 日本語フォント対応には別途フォントファイルが必要

**カラー**:
- ヘッダー: 評価に応じた色分け
  - 80%以上: 緑 (#4CAF50)
  - 50-80%: 黄 (#FFC107)
  - 50%未満: 赤 (#F44336)

### 7.3 セクション詳細

#### 7.3.1 タイトルページ
```
LLMO診断レポート
診断URL: https://example.com
生成日時: 2025-10-03 12:05:00
```

#### 7.3.2 総合スコア
```
総合スコア: 85/100

SEO:               85/100 [████████████████    ]
Performance:       72/100 [██████████████      ]
Content:           90/100 [██████████████████  ]
Structured Data:   65/100 [█████████████       ]
LLMO:              78/100 [███████████████     ]
```

#### 7.3.3 技術的SEO（例）
```
1. 技術的SEO
スコア: 85/100

ページタイトル
実データ: "LLMO診断レポートシステム - 総合SEO診断ツール"
文字数: 28文字
評価: 適切なタイトル長です。

メタディスクリプション
実データ: "WebサイトのSEO、パフォーマンス、LLMO対応を総合診断..."
文字数: 95文字
評価: 適切なディスクリプション長です。

OGP (Open Graph Protocol)
og:title: LLMO診断レポートシステム
og:description: WebサイトのSEO、パフォーマンス...
og:image: https://example.com/og-image.png
og:url: https://example.com
評価: 必要なOGPタグが全て設定されています。

H1タグ
1. "LLMO診断レポートシステム"
評価: H1タグが適切に設定されています。
```

#### 7.3.4 改善提案
```
改善提案

優先度：高
- 構造化データの実装（最優先）
- FAQコンテンツの追加（LLMO対策）

優先度：中
- 内部リンクの追加
- 統計データや数値情報の追加
```

---

## 8. 運用仕様

### 8.1 システム要件

**必須要件**:
- Node.js: v16以上
- npm: v7以上
- メモリ: 最小2GB推奨
- ディスク: 500MB以上（Chromiumを含む）

**OS対応**:
- macOS
- Linux
- Windows（WSL推奨）

### 8.2 起動・停止

**起動**:
```bash
# 本番モード
npm start

# 開発モード（自動リロード）
npm run dev
```

**停止**:
```bash
Ctrl + C
```

### 8.3 設定

**ポート番号**:
- デフォルト: 3000
- 環境変数で変更可能: `PORT=8080 npm start`

**タイムアウト**:
- Puppeteerページロード: 30秒（デフォルト）
- API調整可能（optionsパラメータ）

### 8.4 データ管理

**ジョブデータ**:
- 保存場所: メモリ内（Map）
- 保持期間: 24時間
- 自動削除: 1時間毎にクリーンアップ

**PDFファイル**:
- 保存場所: `reports/` ディレクトリ
- 保持期間: 手動削除まで永続
- ファイル名: `{jobId}.pdf`

### 8.5 パフォーマンス

**同時診断数**:
- 制限なし（メモリ依存）
- 推奨: 10件まで同時実行

**診断時間目安**:
- 小規模サイト（10ページ未満）: 30-60秒
- 中規模サイト: 1-2分
- 大規模サイト: 2-5分

### 8.6 ログ

**コンソールログ**:
```
[550e8400-e29b-41d4-a716-446655440000] クローリング開始: https://example.com
[550e8400-e29b-41d4-a716-446655440000] SEO分析中
[550e8400-e29b-41d4-a716-446655440000] パフォーマンス分析中
...
[550e8400-e29b-41d4-a716-446655440000] 診断完了
```

---

## 9. UI/UX仕様

### 9.1 デザインシステム

**カラーパレット（コーポレート）**:
```css
--primary-dark:   #1e3a8a  /* ネイビー（ヘッダー） */
--primary:        #1e40af  /* ブルー（ボタン、リンク） */
--primary-light:  #2563eb  /* ライトブルー（ホバー） */
--accent:         #3b82f6  /* アクセント */

--bg-main:        #ffffff  /* 白（メイン背景） */
--bg-light:       #f8fafc  /* ライトグレー（カード背景） */
--bg-lighter:     #f1f5f9  /* より薄いグレー（ページ背景） */

--text-primary:   #1f2937  /* ダークグレー（本文） */
--text-secondary: #4b5563  /* グレー（副文） */
--text-muted:     #64748b  /* ミュートグレー（補足） */

--border:         #e2e8f0  /* ボーダー */
--border-light:   #f1f5f9  /* 薄いボーダー */
```

**タイポグラフィ**:
```css
/* 見出し */
H1: 2rem, font-weight: 600
H2: 1.5rem, font-weight: 600
H3: 1.25rem, font-weight: 600

/* ラベル */
Label: 0.875rem, font-weight: 500, text-transform: uppercase

/* ボタン */
Button: 0.875rem, font-weight: 500, text-transform: uppercase, letter-spacing: 0.05em

/* 本文 */
Body: 1rem, line-height: 1.5
```

**スペーシング**:
- セクション間: 48px
- 要素間: 24px
- フォーム要素間: 24px

**ボーダー・角丸**:
- ボタン: border-radius: 2px
- カード: border-radius: 0px（角丸なし）
- インプット: border-radius: 2px

### 9.2 画面仕様

#### 9.2.1 診断開始画面
```
┌────────────────────────────────┐
│  LLMO診断レポートシステム       │
│  Webサイトの包括的SEO...        │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 診断開始                        │
│                                 │
│ 診断するURL                     │
│ [https://example.com         ] │
│                                 │
│ ☐ 詳細オプション                │
│                                 │
│ [ 診断を開始する ]               │
└────────────────────────────────┘
```

#### 9.2.2 診断中画面
```
┌────────────────────────────────┐
│ 診断実行中                      │
│                                 │
│ ████████████░░░░░░░░            │
│              60%                │
│                                 │
│ SEO分析中...                    │
└────────────────────────────────┘
```

#### 9.2.3 結果表示画面
```
┌────────────────────────────────┐
│ 診断完了                        │
│                                 │
│ 総合スコア                      │
│  ┌──────┐                       │
│  │  85  │                       │
│  │ /100 │                       │
│  └──────┘                       │
└────────────────────────────────┘
┌────────────────────────────────┐
│ SEO              85/100         │
│ ████████████████░░░░            │
│                                 │
│ パフォーマンス    72/100         │
│ ██████████████░░░░░░            │
│ ...                             │
└────────────────────────────────┘
┌────────────────────────────────┐
│ [ レポートをダウンロード ]       │
│ [ 詳細データを表示 ]             │
│ [ 新規診断を実行 ]               │
└────────────────────────────────┘
```

### 9.3 レスポンシブデザイン

**ブレークポイント**:
- デスクトップ: 769px以上
- タブレット: 481-768px
- モバイル: 480px以下

**モバイル対応**:
- ボタンを100%幅に変更
- スコアカードを1カラムに変更
- フォントサイズ縮小

---

## 10. セキュリティ・エラーハンドリング

### 10.1 セキュリティ

**CORS**:
- 有効化済み（全オリジン許可）
- 本番環境では特定オリジンのみ許可を推奨

**入力検証**:
- URL形式チェック（基本的なバリデーション）
- SQLインジェクション対策: 不要（DBなし）
- XSS対策: 要検討（現状未実装）

**認証・認可**:
- 現状: なし
- 推奨: Basic認証またはAPIキー認証の追加

**レート制限**:
- 現状: なし
- 推奨: IPベースのレート制限追加

### 10.2 エラーハンドリング

**クローリングエラー**:
```javascript
try {
  const crawlData = await crawlWebsite(url);
  if (!crawlData.success) {
    throw new Error(crawlData.error);
  }
} catch (error) {
  job.status = 'failed';
  job.error = error.message;
}
```

**タイムアウト**:
- Puppeteer: 30秒でタイムアウト
- エラーメッセージ: "ページのロードがタイムアウトしました"

**不正なURL**:
- HTTPステータス: 400
- エラーメッセージ: "URLが必要です"

**ジョブが見つからない**:
- HTTPステータス: 404
- エラーメッセージ: "ジョブが見つかりません"

**PDF生成エラー**:
- HTTPステータス: 500
- エラーメッセージ: "PDFの生成に失敗しました"

### 10.3 ログ・モニタリング

**現状**:
- コンソールログのみ
- エラーログ: console.error

**推奨改善**:
- 構造化ログ（JSON形式）
- ファイル出力
- エラートラッキング（Sentry等）

---

## 11. 拡張性

### 11.1 新規分析項目の追加

**手順**:
1. `src/analyzers/` に新モジュール作成
   ```javascript
   // src/analyzers/accessibility.js
   function analyzeAccessibility(crawlData) {
     return {
       score: 0,
       maxScore: 100,
       details: {},
       rawData: {}
     };
   }
   module.exports = { analyzeAccessibility };
   ```

2. `server.js` の `runAnalysis()` に追加
   ```javascript
   const { analyzeAccessibility } = require('./src/analyzers/accessibility');

   async function runAnalysis(jobId, url, options) {
     // ...
     const accessibilityResults = analyzeAccessibility(crawlData);

     const analysisResults = {
       // ...
       accessibility: accessibilityResults
     };
   }
   ```

3. `src/pdf-generator.js` にレポート出力追加
4. フロントエンド（`public/index.html`, `public/app.js`）にUI追加

### 11.2 データベース対応

**現状**: メモリ内Map

**移行手順**:
1. MongoDB/PostgreSQL等のDB選定
2. スキーマ設計
3. `analysisJobs` MapをDB操作に置き換え
4. PDFファイルをDB（GridFS）またはS3に保存

### 11.3 認証機能追加

**推奨実装**:
```javascript
// ミドルウェア例
function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/analyze', authenticate, async (req, res) => {
  // ...
});
```

### 11.4 スケーラビリティ

**現状**: 単一サーバー

**スケールアウト方法**:
1. **ワーカープロセス分離**
   - Express API サーバー
   - 診断ワーカー（別プロセス）
   - メッセージキュー（Redis/RabbitMQ）

2. **負荷分散**
   - Nginxリバースプロキシ
   - 複数Expressインスタンス
   - セッションストア（Redis）

3. **キャッシング**
   - 同一URL診断結果のキャッシュ（TTL: 24時間）

### 11.5 カスタマイズポイント

| 箇所 | ファイル | カスタマイズ内容 |
|-----|---------|----------------|
| スコアリングロジック | `src/analyzers/*.js` | 各項目の配点・評価基準 |
| PDFデザイン | `src/pdf-generator.js` | フォント、色、レイアウト |
| UIスタイル | `public/style.css` | カラー、タイポグラフィ |
| 診断項目 | `src/analyzers/` | 新規モジュール追加 |

---

## 12. トラブルシューティング

### 12.1 よくある問題

**Puppeteerが起動しない**:
- 原因: Chromiumの依存関係不足
- 解決: macOSでは通常不要。Linuxの場合は以下をインストール
  ```bash
  sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils
  ```

**PDF生成エラー**:
- 原因: `reports/` ディレクトリの書き込み権限不足
- 解決:
  ```bash
  mkdir -p reports
  chmod 755 reports
  ```

**クロールエラー**:
- 原因1: 対象サイトがrobots.txtでブロック
- 原因2: ネットワーク接続問題
- 原因3: タイムアウト
- 解決: タイムアウト延長、URLの確認

**メモリ不足**:
- 原因: 大量の同時診断
- 解決: 同時実行数を制限、メモリ増設

### 12.2 デバッグ方法

**ログ確認**:
```bash
# 開発モード起動（詳細ログ）
npm run dev
```

**手動テスト**:
```bash
# curlでAPI呼び出し
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# 結果確認
curl http://localhost:3000/api/analyze/{jobId}
```

**ブラウザDevTools**:
- Network タブでAPI通信確認
- Console タブでJSエラー確認

---

## 13. 今後の改善予定

### 13.1 機能追加

- [ ] アクセシビリティ評価モジュール
- [ ] セキュリティ診断（HTTPS、CSP等）
- [ ] モバイルフレンドリー詳細評価
- [ ] 競合サイト比較機能
- [ ] 履歴管理・トレンド分析

### 13.2 技術改善

- [ ] データベース導入（MongoDB/PostgreSQL）
- [ ] 認証・認可機能
- [ ] レート制限
- [ ] キャッシング機能
- [ ] ワーカープロセス分離
- [ ] WebSocket対応（リアルタイム進捗）

### 13.3 UI/UX改善

- [ ] ダークモード対応
- [ ] 多言語対応（i18n）
- [ ] グラフ・チャート表示
- [ ] カスタムレポートテンプレート
- [ ] メール送信機能

---

## 14. 参考資料

### 14.1 外部リンク

- [Puppeteer Documentation](https://pptr.dev/)
- [Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse/overview/)
- [PDFKit Documentation](http://pdfkit.org/)
- [Schema.org](https://schema.org/)
- [Core Web Vitals](https://web.dev/vitals/)

### 14.2 関連ドキュメント

- `README.md` - セットアップ・使い方
- `package.json` - 依存関係・スクリプト

---

**ドキュメント終了**
