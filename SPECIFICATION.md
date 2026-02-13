# LLMO診断レポートシステム 総合仕様書 (The Bible)

**バージョン**: 3.1.0 (Comprehensive Edition)
**最終更新**: 2025-12-28
**システムステータス**: Production Ready

---

## 1. システム全体像と目的

本システムは、Webサイトが「LLM（大規模言語モデル）時代の検索エンジン（AI検索）」および「従来の検索エンジン（Google等）」の両方において、いかに**発見され（Discovery）**、**理解され（Understanding）**、**引用されるか（Citation）**を評価・改善するための包括的な診断プラットフォームです。

従来のSEOツールとは異なり、構造化データ、エンティティの明確性、情報の信頼性（E-E-A-T）、そしてAIが読み取りやすいコンテンツ構造（LLMO）に重点を置いています。

### 1.1 コアバリュー
1.  **ハイブリッド評価**: 人間向け（UX/Performance）と機械向け（Schema/LLMO）の両面からサイトを採点。
2.  **実行可能なレポート**: 単なるスコア表示ではなく、具体的な改善アクションをPDFレポートとして提供。
3.  **スケーラビリティ**: 単一ページから数百ページ規模のサイト全体診断まで対応可能な並列処理アーキテクチャ。

---

## 2. 詳細技術スタックとバージョン

| コンポーネント | 技術/ライブラリ | バージョン | 選定理由 |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | v22.12.0+ | 最新のV8エンジンによる高速処理、トップレベルawaitの活用。 |
| **Framework** | Express | ^4.18.2 | 堅牢で拡張性の高いREST API基盤。 |
| **Headless Browser** | Puppeteer | ^24.1.0 | 最新のChromeを制御し、SPAを含む完全なレンダリング結果を取得可能。PDF生成にも流用。 |
| **Audit Engine** | Lighthouse | ^11.4.0 | Google標準のパフォーマンス・アクセシビリティ計測指標の取得。 |
| **Queue Manager** | p-queue | ^6.6.2 | 複数ページクロール時の並列数制御（DoS攻撃防止とサーバー負荷軽減）。 |
| **HTML Parser** | Cheerio | ^1.0.0-rc.12 | 高速なDOM操作とデータ抽出（Puppeteerよりも軽量な処理に利用）。 |
| **Database** | Supabase (PostgreSQL) | ^2.86.0 | 診断結果の永続化、JSONB型による柔軟なデータ構造の保存。 |
| **HTTP Client** | Axios | ^1.12.2 | Webhook通知や外部API連携用。 |
| **Robots Parser** | robots-parser | ^3.0.1 | `robots.txt`の解析とクロール可否の厳密な判定。 |

---

## 3. システムアーキテクチャ詳細

### 3.1 ディレクトリ構成と役割分担

```text
/
├── server.js                   # [Core] アプリケーションのエントリーポイント
│                               # - Express設定、ミドルウェア（CORS, Auth）
│                               # - APIルーティング定義
│                               # - ジョブライフサイクル管理
│
├── public/                     # [Frontend] クライアントサイドリソース
│   ├── index.html              # SPAのエントリーポイント
│   ├── style.css               # UIスタイル定義
│   ├── app.js                  # 単一ページ診断ロジック、認証付きFetch、Blob処理
│   └── multi-page.js           # 複数ページ診断UI、WebSocket/Polling制御
│
├── src/                        # [Backend Logic]
│   ├── crawler.js              # [Engine] Puppeteer制御、Lighthouse実行、生データ収集
│   ├── multi-crawler.js        # [Engine] p-queueを用いた並列クロール制御、深さ制限管理
│   ├── url-selector.js         # [Utility] Sitemap解析、内部リンク探索、URLフィルタリング
│   ├── aggregator.js           # [Logic] 複数ページ結果の集計、統計計算、総合スコア算出
│   ├── pdf-generator.js        # [Output] Puppeteerを用いたHTML→PDF変換、SVGチャート生成
│   │
│   └── analyzers/              # [Logic] 11の専門分析モジュール
│       ├── content.js          # コンテンツ量、見出し構造、FAQ構造
│       ├── entity.js           # 知識グラフ、スキーマ(@id, sameAs)、NAP
│       ├── eeat.js             # 経験・専門性・権威性・信頼性の指標分析
│       ├── statistics.js       # 数値データ、統計用語、信頼できる引用元
│       ├── structured-data.js  # JSON-LD解析、スキーマバリデーション
│       ├── llmo.js             # AI読み取りやすさ、llms.txt有無、段落構造
│       ├── seo.js              # メタタグ、Canonical、Hreflang、Alt属性
│       ├── performance.js      # CWV (LCP, CLS, FID)、リソースサイズ
│       ├── multimedia.js       # 画像フォーマット、動画、SVG活用度
│       ├── social.js           # OGP完全性、Twitter Card
│       └── local-seo.js        # ローカルビジネス固有のスキーマと情報
│
├── reports/                    # [Storage] 生成されたPDFの一時保存場所
├── .env                        # [Config] 環境変数（APIキー、DB接続情報）
└── SPECIFICATION.md            # [Doc] 本仕様書
```

### 3.2 データフローの全貌

1.  **リクエスト受信**: クライアントからAPIキー付きで `POST /api/analyze`。
2.  **ジョブ生成**: UUID v4を発行し、メモリ上のJob Mapに初期ステータス `pending` で登録。即座にJob IDを返却。
3.  **非同期処理開始**:
    *   **Phase 1: クローリング**: Puppeteerを起動し、対象URLへアクセス。DOM、ネットワークログ、Lighthouseスコアを取得。
    *   **Phase 2: 分析 (Parallel)**: 収集した生データを11個のAnalyzer関数に渡し、スコアと詳細データを並列計算。
    *   **Phase 3: レポート生成**: 分析結果を統合し、`pdf-generator.js` でHTMLを構築。PuppeteerでPDF化してディスクに保存。
    *   **Phase 4: 保存**: 全データをSupabaseの `diagnosis_reports` テーブルにJSONBとしてINSERT。
4.  **結果返却**: クライアントはポーリングで進捗を確認し、完了後に結果JSONとPDFダウンロード用Blobを取得。

---

## 4. 分析ロジックの深層仕様

各アナライザーは `0-100` の正規化されたスコアを返します。

### 4.1 LLMO (AI引用最適化) - `src/analyzers/llmo.js`
AIエージェントがコンテンツをどのように「理解」するかをシミュレートします。
*   **llms.txt**: ルートドメイン直下の `/llms.txt` の存在と内容をチェック。AIへの道案内があるかを評価。
*   **定義文構造**: 「〜とは」という形式の定義文が含まれているか。これはRAG（検索拡張生成）で抜粋されやすいパターンです。
*   **段落の独立性**: 各段落が文脈なしでも意味が通じるか（代名詞の多用などを減点要因とする簡易ロジック）。
*   **構造化フォーマット**: 箇条書き、番号付きリスト、テーブルが適切に使われているか。

### 4.2 エンティティ最適化 - `src/analyzers/entity.js`
Google Knowledge Graphへの登録されやすさを評価します。
*   **@idの活用**: JSON-LD内で `@id` を使用し、ノード間の参照関係が明確か。
*   **sameAs**: Wikipedia、Crunchbase、公式SNSなど、外部の信頼できるソースへのリンクがあるか。
*   **NAP整合性**: 名前（Name）、住所（Address）、電話番号（Phone）がページ内で統一されているか。

### 4.3 コンテンツ構造 - `src/analyzers/content.js`
*   **見出し階層**: H1 -> H2 -> H3 の論理構造が守られているか（H2の後にH4が来ていないか等）。
*   **FAQ構造**: `Question` と `Answer` のパターンがテキストまたは構造化データで明確か。

### 4.4 統計データ - `src/analyzers/statistics.js`
*   **定量的根拠**: テキスト内に具体的な数値（%, 円, 年など）がどれだけ含まれているか。
*   **一次情報源**: 政府ドメイン（.go.jp）、教育機関（.ac.jp）への発リンクがあるか。

---

## 5. データベーススキーマ詳細 (Supabase)

PostgreSQLを使用し、半構造化データ（JSONB）の強みを活かしています。

### テーブル: `diagnosis_reports`

| カラム名 | 型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | PRIMARY KEY | レコードの一意なID |
| `job_id` | uuid | UNIQUE, NOT NULL | アプリケーション側のジョブID |
| `url` | text | NOT NULL | 診断対象URL |
| `company_name` | text | | クライアント名（任意） |
| `industry_name` | text | | 業種（任意） |
| `total_score` | integer | | 総合スコア (0-100) |
| `is_multi_page` | boolean | DEFAULT false | 複数ページ診断かどうか |
| `page_count` | integer | DEFAULT 1 | 診断したページ数 |
| `analysis_result` | **jsonb** | | **重要**: 11カテゴリの詳細スコア、各項目の判定結果を含む完全なオブジェクト |
| `crawl_data` | **jsonb** | | クロール時のメタデータ（軽量化済み） |
| `pdf_path` | text | | 生成されたPDFのパス（サーバーローカル） |
| `created_at` | timestamptz | DEFAULT now() | 診断開始日時 |
| `completed_at` | timestamptz | | 診断完了日時 |
| `deleted_at` | timestamptz | | 論理削除用フラグ |

### テーブル: `industries`
業種マスタ。UIのセレクトボックス用。
*   `id`: integer
*   `name`: text ("IT・通信", "製造業" など)
*   `display_order`: integer

---

## 6. PDFレポート生成仕様 (v3.0.0)

`src/pdf-generator.js` は、Puppeteerを使用してHTMLをレンダリングし、それをPDFとして印刷する方式を採用しています。これにより、CSS Flexbox/Gridを用いた複雑なレイアウトが可能になりました。

### 6.1 デザインコンセプト
*   **用紙**: A4
*   **配色**:
    *   Base: White (#ffffff)
    *   Primary: Dark Navy (#0f172a) - 信頼感、知性
    *   Accent: Royal Blue (#2563eb) - 技術、先進性
    *   Alert: Red (#ef4444) - 警告、要改善
*   **フォント**: Noto Sans JP (Google Fonts)

### 6.2 ページ構成
1.  **Cover Page (表紙)**
    *   ヘッダー: 濃紺背景に白文字タイトル。
    *   メタ情報: クライアント名、URL、日付をリスト表示。
    *   スコア: 巨大なタイポグラフィで総合点数を表示。装飾を削ぎ落としたミニマルデザイン。
2.  **Analysis Summary (サマリー)**
    *   **レーダーチャート**: SVGを動的に生成・埋め込み。10軸でサイトの傾向を一目で把握。
    *   **Priority Improvements**: スコアが低い（<70点）カテゴリから、最も改善効果が高い具体的施策を最大4つ自動抽出して表示。
3.  **Details (詳細)**
    *   2カラムレイアウト。
    *   各カテゴリのスコアと、その構成要素（例: SEOならTitle, H1, OGPなど）の採点結果をリスト表示。
    *   区切り線を使用したクリーンなUI。

---

## 7. APIエンドポイント完全リファレンス

すべての保護されたエンドポイントはヘッダー `x-api-key` を要求します。

### 診断制御
*   `POST /api/analyze`: 単一ページ診断を開始。
*   `POST /api/analyze-multi`: 複数ページ診断を開始（ベースURL指定）。
*   `POST /api/discover-urls`: 複数ページ診断の前に、クロール候補URLを探索して返す。
*   `GET /api/analyze/:jobId`: 現在の進行状況（%）とステータスを取得。

### 結果取得
*   `GET /api/result/:jobId`: 診断完了後の詳細JSONデータを取得。
*   `GET /api/report/:jobId`: **PDFファイルのバイナリストリーム**を返却。Content-Type: application/pdf。
*   `GET /api/aggregate/:jobId`: 複数ページ診断の集計結果（平均点、分布など）を取得。

### 履歴・管理
*   `GET /api/history`: 過去の診断レポート一覧をページネーション付きで取得。
*   `GET /api/history/:id`: 特定の履歴の詳細を取得。
*   `DELETE /api/history/:id`: 履歴を論理削除。
*   `GET /api/history/export/csv`: 履歴データをCSV形式でダウンロード。
*   `GET /api/industries`: 業種リストを取得。

---

## 8. 複数ページ診断のアルゴリズム

### 8.1 探索フェーズ (`url-selector.js`)
サイト内の全ページを無差別に診断するのではなく、**重要度が高いページ**を優先的に選定します。
1.  `robots.txt` を確認し、クロール禁止領域を除外。
2.  `sitemap.xml` を解析し、定義されたURLを取得。
3.  トップページから指定深度（Depth）までリンクを辿り、内部リンクを収集。
4.  URLパターン（`/blog/`, `/products/`など）に基づきカテゴリ分類。
5.  優先度スコアリングを行い、上位Nページ（デフォルト50）を選定。

### 8.2 クロールフェーズ (`multi-crawler.js`)
*   **Queue**: `p-queue` で同時実行数を3に制限。サーバー負荷を抑える。
*   **Retry**: タイムアウト（60秒）時は一度だけリトライ（90秒）を行う。
*   **Progress**: 1ページ完了ごとに進捗率を再計算し、ジョブステータスを更新。

### 8.3 集計フェーズ (`aggregator.js`)
*   全ページの平均スコア、中央値を算出。
*   カテゴリごとのスコア分布ヒストグラムを作成。
*   「高スコアページTop5」と「低スコアページBottom5」を特定。
*   サイト全体で共通して見られる弱点（例: 「80%のページでH1タグが重複している」）を検出し、全体改善提案として提示。

---

## 9. セキュリティと運用

### 9.1 認証 (Authentication)
*   **方式**: API Key認証。
*   **実装**: Expressミドルウェアでヘッダー `x-api-key` を検証。
*   **適用範囲**: 静的リソースと業種マスタ取得を除く全API。

### 9.2 サンドボックスと権限
*   **Puppeteer**: `--no-sandbox` フラグで実行（Docker環境等での互換性のため）。
*   **ファイルシステム**: `reports/` ディレクトリへの書き込み権限が必要。

### 9.3 エラーハンドリング
*   **クローラー**: ページ遷移失敗、セレクタが見つからない等のエラーは `try-catch` で捕捉し、そのカテゴリを0点として処理を継続（システム全体をクラッシュさせない）。
*   **PDF生成**: 生成失敗時はログを出力し、APIは500エラーを返す。

---

## 10. 拡張開発ガイド

### 新しい分析カテゴリを追加する場合
1.  `src/analyzers/new-category.js` を作成し、分析ロジックを実装。
2.  `server.js` でモジュールをインポートし、`runAnalysis` 関数内で呼び出す。
3.  `src/pdf-generator.js` の `CAT_MAP` に日本語名を追加し、レポート出力ループに含める。
4.  データベーススキーマにカラム `new_category_score` を追加（任意、JSONB内には自動で含まれる）。

### フロントエンドを変更する場合
1.  `public/app.js` または `multi-page.js` を編集。
2.  ビルドプロセスは不要（Vanilla JS）。リロードのみで反映。

---
**Document End**
