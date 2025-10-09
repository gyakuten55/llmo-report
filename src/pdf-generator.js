const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// コーポレートカラー定義
const COLORS = {
  primary: '#1e3a8a',        // ネイビー
  primaryLight: '#2563eb',   // ブルー
  accent: '#3b82f6',         // アクセント
  success: '#22c55e',        // グリーン
  warning: '#f59e0b',        // オレンジ
  danger: '#ef4444',         // レッド
  text: '#1f2937',           // ダークグレー
  textSecondary: '#6b7280',  // グレー
  border: '#e5e7eb',         // ライトグレー
  background: '#f9fafb'      // 背景グレー
};

// レイアウト定数
const LAYOUT = {
  pageWidth: 595.28,      // A4幅（ポイント）
  pageHeight: 841.89,     // A4高さ（ポイント）
  marginX: 72,            // 左右マージン
  marginY: 72,            // 上下マージン
  contentWidth: 451.28,   // コンテンツ幅
  headerY: 30,
  footerY: 791.89
};

/**
 * LLMO診断レポートPDFを生成
 * @param {Object} analysisResults - 分析結果
 * @param {string} outputPath - 出力ファイルパス
 * @returns {Promise<string>} - 生成されたPDFのパス
 */
async function generatePDF(analysisResults, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: LAYOUT.marginY,
          bottom: LAYOUT.marginY,
          left: LAYOUT.marginX,
          right: LAYOUT.marginX
        },
        bufferPages: true,
        info: {
          Title: 'LLMO診断レポート',
          Subject: `${analysisResults.url}の診断結果`,
          Author: 'LLMO Report System'
        }
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // 日本語フォント対応
      const fontPath = path.join(__dirname, '..', 'fonts', 'NotoSansJP-Regular.ttf');
      doc.registerFont('NotoSans', fontPath);
      doc.font('NotoSans');

      let pageNumber = 0;

      // ========== カバーページ ==========
      drawCoverPage(doc, analysisResults);
      pageNumber++;

      // ========== エグゼクティブサマリー ==========
      doc.addPage();
      pageNumber++;
      addHeader(doc, pageNumber);
      drawExecutiveSummary(doc, analysisResults);

      // ========== 詳細セクション ==========
      const sections = [
        { title: 'テクニカルSEO', key: 'seo', drawer: drawSEOSection },
        { title: 'パフォーマンス', key: 'performance', drawer: drawPerformanceSection },
        { title: 'コンテンツ構造', key: 'content', drawer: drawContentSection },
        { title: 'エンティティ最適化', key: 'entity', drawer: drawEntitySection },
        { title: 'E-E-A-T評価', key: 'eeat', drawer: drawEEATSection },
        { title: '統計データ', key: 'statistics', drawer: drawStatisticsSection },
        { title: '構造化データ', key: 'structuredData', drawer: drawStructuredDataSection },
        { title: 'AI引用最適化(LLMO)', key: 'llmo', drawer: drawLLMOSection },
        { title: 'マルチメディア', key: 'multimedia', drawer: drawMultimediaSection },
        { title: 'ソーシャルシグナル', key: 'social', drawer: drawSocialSection },
        { title: 'サイト情報', key: 'rawData', drawer: drawRawDataSection }
      ];

      sections.forEach((section, index) => {
        // 各セクション開始時にスペースをチェック
        // セクションタイトル(35) + スコアボックス(55) + 最低1項目(60) = 150pt必要
        const needsNewPage = doc.y > 620;

        if (needsNewPage) {
          doc.addPage();
          pageNumber++;
          addHeader(doc, pageNumber);
        }

        section.drawer(doc, analysisResults[section.key]);
      });

      // ローカルSEO（該当する場合のみ）
      if (analysisResults.localSeo && analysisResults.localSeo.isLocalBusiness) {
        if (doc.y > 620) {
          doc.addPage();
          pageNumber++;
          addHeader(doc, pageNumber);
        }
        drawLocalSEOSection(doc, analysisResults.localSeo);
      }

      // ========== 改善提案 ==========
      if (doc.y > 620) {
        doc.addPage();
        pageNumber++;
        addHeader(doc, pageNumber);
      }
      drawRecommendations(doc, analysisResults);

      // すべてのページにフッターを追加（bufferPagesを使用）
      const totalPages = pageNumber;
      for (let i = 1; i <= totalPages; i++) {
        doc.switchToPage(i);
        addFooter(doc, i);
      }

      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * カバーページを描画
 */
function drawCoverPage(doc, analysisResults) {
  // クライアント名の有無で背景高さを調整
  const headerHeight = analysisResults.clientName ? 190 : 150;

  // ヘッダーバー（ネイビー）
  doc.rect(0, 0, LAYOUT.pageWidth, headerHeight)
    .fill(COLORS.primary);

  // タイトル
  doc.fillColor('#ffffff')
    .fontSize(32)
    .text('LLMO診断レポート', LAYOUT.marginX, 60, {
      align: 'left',
      width: LAYOUT.contentWidth
    });

  doc.fontSize(14)
    .fillColor('#e0e7ff')
    .text('Website Analysis & Optimization Report', LAYOUT.marginX, 105, {
      align: 'left',
      width: LAYOUT.contentWidth
    });

  // クライアント名（ある場合のみ表示）
  let clientNameHeight = 0;
  if (analysisResults.clientName) {
    doc.fillColor('#ffffff')
      .fontSize(18)
      .text(`${analysisResults.clientName} 様向けレポート`, LAYOUT.marginX, 135, {
        align: 'left',
        width: LAYOUT.contentWidth
      });
    clientNameHeight = 40;
  }

  // 診断URL
  const urlY = 200 + clientNameHeight;
  doc.fillColor(COLORS.text)
    .fontSize(12)
    .text('診断対象URL', LAYOUT.marginX, urlY, { width: LAYOUT.contentWidth });

  const urlTextY = urlY + 20;
  doc.fontSize(11)
    .fillColor(COLORS.primaryLight)
    .text(analysisResults.url, LAYOUT.marginX, urlTextY, {
      width: LAYOUT.contentWidth,
      link: analysisResults.url,
      underline: true
    });

  // 生成日時
  const dateY = urlTextY + 40;
  doc.fillColor(COLORS.text)
    .fontSize(12)
    .text('レポート生成日', LAYOUT.marginX, dateY, { width: LAYOUT.contentWidth });

  const dateTextY = dateY + 20;
  doc.fontSize(11)
    .fillColor(COLORS.textSecondary)
    .text(new Date().toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }), LAYOUT.marginX, dateTextY, { width: LAYOUT.contentWidth });

  // 総合スコア（シンプル表記）
  const totalScore = calculateTotalScore(analysisResults);
  const scoreCardY = dateTextY + 80 + clientNameHeight;
  const scoreCardHeight = 140;
  const scoreColor = getScoreColor(totalScore);
  const rating = getScoreRating(totalScore);

  // カード背景
  doc.save();
  doc.roundedRect(LAYOUT.marginX, scoreCardY, LAYOUT.contentWidth, scoreCardHeight, 10)
    .fill('#ffffff')
    .strokeColor('#e5e7eb')
    .lineWidth(1.5)
    .stroke();
  doc.restore();

  // 中央配置の計算
  const centerX = LAYOUT.marginX + LAYOUT.contentWidth / 2;
  const centerY = scoreCardY + scoreCardHeight / 2;

  // "総合スコア"ラベル
  doc.fillColor(COLORS.textSecondary)
    .fontSize(12)
    .text('総合スコア', centerX - 50, centerY - 50, {
      width: 100,
      align: 'center',
      lineBreak: false
    });

  // スコア数値
  doc.fillColor(scoreColor)
    .fontSize(48)
    .text(totalScore.toString(), centerX - 40, centerY - 25, {
      width: 80,
      align: 'center',
      lineBreak: false
    });

  // "/100"
  doc.fillColor(COLORS.textSecondary)
    .fontSize(14)
    .text('/100', centerX + 30, centerY + 5, {
      lineBreak: false
    });

  // 評価ラベル
  doc.fillColor(scoreColor)
    .fontSize(13)
    .text(rating, centerX - 50, centerY + 30, {
      width: 100,
      align: 'center',
      lineBreak: false
    });

  // フッター
  doc.fillColor(COLORS.textSecondary)
    .fontSize(9)
    .text('このレポートは機密情報を含む可能性があります。取り扱いにご注意ください。',
      LAYOUT.marginX, LAYOUT.pageHeight - 100, {
      align: 'center',
      width: LAYOUT.contentWidth
    });
}

/**
 * ヘッダーを追加
 */
function addHeader(doc, pageNumber) {
  // ヘッダーライン
  doc.save();
  doc.moveTo(LAYOUT.marginX, 50)
    .lineTo(LAYOUT.pageWidth - LAYOUT.marginX, 50)
    .lineWidth(2)
    .strokeColor(COLORS.primary)
    .stroke();
  doc.restore();

  doc.fillColor(COLORS.text)
    .fontSize(10)
    .text('LLMO診断レポート', LAYOUT.marginX, LAYOUT.headerY, {
      width: LAYOUT.contentWidth / 2
    });

  doc.fillColor(COLORS.textSecondary)
    .fontSize(9)
    .text(`Page ${pageNumber}`, LAYOUT.marginX + LAYOUT.contentWidth / 2, LAYOUT.headerY, {
      width: LAYOUT.contentWidth / 2,
      align: 'right'
    });

  // コンテンツ開始位置を設定
  doc.y = 70;
}

/**
 * フッターを追加（既存ページに対して）
 */
function addFooter(doc, pageNumber) {
  const footerY = LAYOUT.pageHeight - 50;

  // 現在の状態を保存
  doc.save();

  // フッターライン
  doc.moveTo(LAYOUT.marginX, footerY)
    .lineTo(LAYOUT.pageWidth - LAYOUT.marginX, footerY)
    .lineWidth(1)
    .strokeColor(COLORS.border)
    .stroke();

  // フッターテキスト
  doc.fillColor(COLORS.textSecondary)
    .fontSize(8);

  // 左側：生成日
  const generatedText = `Generated: ${new Date().toLocaleDateString('ja-JP')}`;
  doc.text(generatedText, LAYOUT.marginX, footerY + 10, {
    width: LAYOUT.contentWidth / 2,
    lineBreak: false,
    continued: false
  });

  // 右側：Confidential（同じY位置に描画）
  doc.text('Confidential', LAYOUT.marginX + LAYOUT.contentWidth / 2, footerY + 10, {
    width: LAYOUT.contentWidth / 2,
    align: 'right',
    lineBreak: false,
    continued: false
  });

  // 状態を復元
  doc.restore();
}

/**
 * エグゼクティブサマリーを描画
 */
function drawExecutiveSummary(doc, analysisResults) {
  drawSectionTitle(doc, 'エグゼクティブサマリー');

  doc.fontSize(10)
    .fillColor(COLORS.text)
    .text('本レポートは、Webサイトの包括的な診断結果をまとめたものです。SEO、パフォーマンス、コンテンツ品質、AI検索最適化など、10の評価軸から分析を行いました。',
    LAYOUT.marginX, doc.y, {
      width: LAYOUT.contentWidth,
      align: 'left',
      lineGap: 4
    });

  doc.moveDown(1.5);

  // カテゴリ別スコア表
  drawScoreTable(doc, analysisResults);
}

/**
 * スコア表を描画
 */
function drawScoreTable(doc, analysisResults) {
  const categories = [
    { name: 'コンテンツ構造', data: analysisResults.content, weight: 15 },
    { name: 'エンティティ最適化', data: analysisResults.entity, weight: 15 },
    { name: 'E-E-A-T評価', data: analysisResults.eeat, weight: 20 },
    { name: '統計データ', data: analysisResults.statistics, weight: 10 },
    { name: '構造化データ', data: analysisResults.structuredData, weight: 15 },
    { name: 'AI引用最適化', data: analysisResults.llmo, weight: 10 },
    { name: 'テクニカルSEO', data: analysisResults.seo, weight: 8 },
    { name: 'パフォーマンス', data: analysisResults.performance, weight: 4 },
    { name: 'マルチメディア', data: analysisResults.multimedia, weight: 2 },
    { name: 'ソーシャル', data: analysisResults.social, weight: 1 }
  ];

  const tableX = LAYOUT.marginX;
  const startY = doc.y;
  const tableWidth = LAYOUT.contentWidth;
  const rowHeight = 25;
  const headerHeight = 25;

  // テーブルヘッダー背景
  doc.save();
  doc.rect(tableX, startY, tableWidth, headerHeight)
    .fill(COLORS.primary);
  doc.restore();

  // ヘッダーテキスト
  doc.fillColor('#ffffff')
    .fontSize(9);

  doc.text('カテゴリ', tableX + 10, startY + 8, { width: 180, continued: false });
  doc.text('スコア', tableX + 200, startY + 8, { width: 70, continued: false });
  doc.text('重要度', tableX + 280, startY + 8, { width: 70, continued: false });
  doc.text('達成率', tableX + 360, startY + 8, { width: 90, continued: false });

  let currentY = startY + headerHeight;

  // テーブル行
  categories.forEach((cat, index) => {
    const percentage = Math.round((cat.data.score / cat.data.maxScore) * 100);
    const bgColor = index % 2 === 0 ? '#ffffff' : COLORS.background;

    // 行背景
    doc.save();
    doc.rect(tableX, currentY, tableWidth, rowHeight)
      .fill(bgColor);
    doc.restore();

    // カテゴリ名
    doc.fillColor(COLORS.text)
      .fontSize(9)
      .text(cat.name, tableX + 10, currentY + 8, {
        width: 180,
        continued: false
      });

    // スコア
    doc.fillColor(COLORS.textSecondary)
      .text(`${cat.data.score}/${cat.data.maxScore}`, tableX + 200, currentY + 8, {
        width: 70,
        continued: false
      });

    // 重要度
    doc.text(`${cat.weight}%`, tableX + 280, currentY + 8, {
      width: 70,
      continued: false
    });

    // 達成率バー
    const barX = tableX + 360;
    const barY = currentY + 10;
    const barWidth = 60;
    const barHeight = 8;

    doc.save();

    // バー背景
    doc.rect(barX, barY, barWidth, barHeight)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    // バー塗りつぶし
    const fillWidth = Math.max(0, (barWidth * percentage) / 100);
    const barColor = getScoreColor(percentage);
    if (fillWidth > 0) {
      doc.rect(barX, barY, fillWidth, barHeight)
        .fill(barColor);
    }

    doc.restore();

    // パーセンテージ
    doc.fillColor(COLORS.text)
      .fontSize(8)
      .text(`${percentage}%`, tableX + 430, currentY + 8, {
        width: 30,
        continued: false
      });

    currentY += rowHeight;
  });

  // テーブル外枠
  doc.save();
  doc.rect(tableX, startY, tableWidth, currentY - startY)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke();
  doc.restore();

  doc.y = currentY + 20;
}

/**
 * セクションタイトルを描画
 */
function drawSectionTitle(doc, title) {
  const titleHeight = 35;
  const titleX = LAYOUT.marginX;
  const titleY = doc.y;

  // タイトル背景
  doc.save();
  doc.rect(titleX, titleY, LAYOUT.contentWidth, titleHeight)
    .fill(COLORS.primary);
  doc.restore();

  // タイトルテキスト
  doc.fillColor('#ffffff')
    .fontSize(16)
    .text(title, titleX + 10, titleY + 9, {
      width: LAYOUT.contentWidth - 20
    });

  doc.y = titleY + titleHeight + 10;
}

/**
 * スコアボックスを描画
 */
function drawScore(doc, score, maxScore) {
  const percentage = Math.round((score / maxScore) * 100);
  const scoreColor = getScoreColor(percentage);

  const boxX = LAYOUT.marginX;
  const boxY = doc.y;
  const boxWidth = LAYOUT.contentWidth;
  const boxHeight = 55;

  // スコアボックス背景
  doc.save();
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 5)
    .fill(COLORS.background);
  doc.restore();

  // 「カテゴリスコア」ラベル
  doc.fillColor(COLORS.text)
    .fontSize(11)
    .text('カテゴリスコア', boxX + 10, boxY + 10, {
      width: 150,
      continued: false
    });

  // スコア数値
  doc.fillColor(scoreColor)
    .fontSize(24)
    .text(`${score}`, boxX + 280, boxY + 10, {
      width: 50,
      align: 'right',
      continued: false
    });

  doc.fillColor(COLORS.textSecondary)
    .fontSize(14)
    .text(`/ ${maxScore}`, boxX + 335, boxY + 16, {
      width: 50,
      continued: false
    });

  doc.fillColor(COLORS.text)
    .fontSize(10)
    .text(`${percentage}%`, boxX + 390, boxY + 18, {
      width: 50,
      continued: false
    });

  // プログレスバー
  const barX = boxX + 10;
  const barY = boxY + 42;
  const barWidth = boxWidth - 20;
  const barHeight = 6;

  doc.save();

  // バー背景
  doc.rect(barX, barY, barWidth, barHeight)
    .fill('#ffffff');

  // バー塗りつぶし
  const fillWidth = Math.max(0, (barWidth * percentage) / 100);
  if (fillWidth > 0) {
    doc.rect(barX, barY, fillWidth, barHeight)
      .fill(scoreColor);
  }

  doc.restore();

  doc.y = boxY + boxHeight + 15;
}

/**
 * 詳細項目を描画（動的な高さ調整）
 */
function drawDetailItem(doc, label, detail, rawData = null) {
  if (!detail) {
    console.warn(`Detail is undefined for label: ${label}`);
    return;
  }

  const itemX = LAYOUT.marginX;
  const itemWidth = LAYOUT.contentWidth;
  const padding = 10;
  const lineSpacing = 4;

  // 必要な高さを計算
  let requiredHeight = padding * 2 + 20; // 基本の高さ（ラベル + パディング）

  // 実データの高さを計算
  let rawDataHeight = 0;
  if (rawData) {
    // 長いテキストは200文字まで表示
    const displayData = rawData.length > 200 ? rawData.substring(0, 200) + '...' : rawData;
    doc.fontSize(8);
    rawDataHeight = doc.heightOfString(`実データ: ${displayData}`, {
      width: itemWidth - 20,
      lineGap: lineSpacing
    });
    requiredHeight += rawDataHeight + lineSpacing;
  }

  // 推奨事項の高さを計算
  let recommendationHeight = 0;
  if (detail.recommendation) {
    doc.fontSize(8);
    recommendationHeight = doc.heightOfString(detail.recommendation, {
      width: itemWidth - 20,
      lineGap: lineSpacing
    });
    requiredHeight += recommendationHeight + lineSpacing;
  }

  // 最小高さを確保
  const itemHeight = Math.max(55, requiredHeight);

  // ページ溢れチェック
  if (doc.y + itemHeight > 720) {
    doc.addPage();
    doc.y = 70;
  }

  const itemY = doc.y;
  const itemScore = detail.score || 0;
  const scoreColor = itemScore >= 7 ? COLORS.success : itemScore >= 4 ? COLORS.warning : COLORS.danger;

  // 項目ボックス枠
  doc.save();
  doc.rect(itemX, itemY, itemWidth, itemHeight)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke();
  doc.restore();

  // ラベル
  doc.fillColor(COLORS.text)
    .fontSize(10)
    .text(label, itemX + padding, itemY + padding, {
      width: itemWidth - 100,
      continued: false
    });

  // スコア
  doc.fillColor(scoreColor)
    .fontSize(11)
    .text(`${itemScore}点`, itemX + itemWidth - 60, itemY + padding, {
      width: 50,
      align: 'right',
      continued: false
    });

  let currentY = itemY + padding + 20;

  // 実データ
  if (rawData) {
    const displayData = rawData.length > 200 ? rawData.substring(0, 200) + '...' : rawData;
    doc.fillColor(COLORS.textSecondary)
      .fontSize(8)
      .text(`実データ: ${displayData}`, itemX + padding, currentY, {
        width: itemWidth - 20,
        lineGap: lineSpacing,
        continued: false
      });
    currentY += rawDataHeight + lineSpacing;
  }

  // 推奨事項
  if (detail.recommendation) {
    doc.fillColor(COLORS.text)
      .fontSize(8)
      .text(detail.recommendation, itemX + padding, currentY, {
        width: itemWidth - 20,
        lineGap: lineSpacing,
        continued: false
      });
  }

  doc.y = itemY + itemHeight + 5;
}

/**
 * SEOセクションを描画
 */
function drawSEOSection(doc, data) {
  drawSectionTitle(doc, 'テクニカルSEO');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    {
      label: 'ページタイトル',
      detail: data.details.title,
      rawData: data.rawData.title
    },
    {
      label: 'メタディスクリプション',
      detail: data.details.metaDescription,
      rawData: data.rawData.metaDescription
    },
    {
      label: 'H1タグ',
      detail: data.details.h1,
      rawData: data.rawData.h1.join(', ')
    },
    {
      label: '画像Alt属性',
      detail: data.details.imageAlt
    },
    {
      label: 'OGPタグ',
      detail: data.details.ogp
    },
    {
      label: 'Canonical URL',
      detail: data.details.canonical
    },
    {
      label: 'モバイル最適化',
      detail: data.details.mobileOptimization
    }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail, item.rawData);
    }
  });
}

/**
 * パフォーマンスセクションを描画
 */
function drawPerformanceSection(doc, data) {
  drawSectionTitle(doc, 'パフォーマンス');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    {
      label: 'ページ読み込み速度',
      detail: data.details.loadTime,
      rawData: `${data.rawData.loadTime}ms`
    },
    {
      label: 'LCP (Largest Contentful Paint)',
      detail: data.details.lcp,
      rawData: `${data.rawData.webVitals.lcp}ms`
    },
    {
      label: 'CLS (Cumulative Layout Shift)',
      detail: data.details.cls,
      rawData: data.rawData.webVitals.cls.toFixed(3)
    },
    {
      label: 'サーバーレスポンスタイム',
      detail: data.details.serverResponseTime,
      rawData: `${data.rawData.serverResponseTime}ms`
    },
    {
      label: 'DOM処理時間',
      detail: data.details.domInteractive
    },
    {
      label: '画像最適化',
      detail: data.details.imageOptimization
    },
    {
      label: 'レスポンシブデザイン',
      detail: data.details.responsiveDesign
    }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail, item.rawData);
    }
  });
}

/**
 * コンテンツセクションを描画
 */
function drawContentSection(doc, data) {
  drawSectionTitle(doc, 'コンテンツ構造最適化');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    {
      label: 'コンテンツボリューム',
      detail: data.details.contentVolume,
      rawData: `${data.rawData.textContent.totalCharacters}文字`
    },
    {
      label: '見出し構造',
      detail: data.details.headingStructure,
      rawData: `H1:${data.details.headingStructure.h1Count} / H2:${data.details.headingStructure.h2Count} / H3:${data.details.headingStructure.h3Count}`
    },
    {
      label: 'H1品質',
      detail: data.details.h1Quality
    },
    {
      label: 'H2品質',
      detail: data.details.h2Quality
    },
    {
      label: '内部リンク',
      detail: data.details.internalLinks,
      rawData: `${data.rawData.links.internal}個`
    },
    {
      label: 'FAQ構造',
      detail: data.details.faqStructure
    },
    {
      label: 'リスト構造',
      detail: data.details.bulletLists
    }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail, item.rawData);
    }
  });
}

/**
 * エンティティセクションを描画
 */
function drawEntitySection(doc, data) {
  drawSectionTitle(doc, 'エンティティ・知識グラフ最適化');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    { label: 'Organization Schema', detail: data.details.organizationSchema },
    { label: 'Person Schema', detail: data.details.personSchema },
    { label: '@id実装', detail: data.details.idImplementation },
    { label: 'sameAs実装', detail: data.details.sameAsImplementation },
    { label: 'NAP一貫性', detail: data.details.napConsistency },
    { label: 'エンティティ関係', detail: data.details.entityRelations }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail);
    }
  });
}

/**
 * E-E-A-Tセクションを描画
 */
function drawEEATSection(doc, data) {
  drawSectionTitle(doc, 'E-E-A-T評価');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    { label: '一次情報', detail: data.details.primaryInformation },
    { label: '体験記述', detail: data.details.experienceDescription },
    { label: '日時明示', detail: data.details.dateSpecification },
    { label: '著者資格', detail: data.details.authorCredentials },
    { label: '外部引用', detail: data.details.externalCitations },
    { label: '引用明示', detail: data.details.citationClarity },
    { label: '連絡先情報', detail: data.details.contactInformation }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail);
    }
  });
}

/**
 * 統計データセクションを描画
 */
function drawStatisticsSection(doc, data) {
  drawSectionTitle(doc, '統計データ・数値情報');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    { label: '数値データ', detail: data.details.numberCount },
    { label: '統計用語', detail: data.details.statisticalPhrases },
    { label: 'パーセンテージ', detail: data.details.percentageUsage },
    { label: '比較データ', detail: data.details.comparisonData },
    { label: '政府データ', detail: data.details.governmentData },
    { label: '学術論文', detail: data.details.academicPapers },
    { label: 'グラフ・チャート', detail: data.details.graphsCharts }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail);
    }
  });
}

/**
 * 構造化データセクションを描画
 */
function drawStructuredDataSection(doc, data) {
  drawSectionTitle(doc, '構造化データ');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    {
      label: '実装状況',
      detail: data.details.implementation,
      rawData: `${data.rawData.count}個`
    },
    { label: 'スキーマタイプ', detail: data.details.schemaTypes },
    { label: 'FAQスキーマ', detail: data.details.faq },
    { label: 'HowToスキーマ', detail: data.details.howTo },
    { label: 'Articleスキーマ', detail: data.details.article },
    { label: 'Organizationスキーマ', detail: data.details.organization },
    { label: 'Breadcrumbスキーマ', detail: data.details.breadcrumb }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail, item.rawData);
    }
  });
}

/**
 * LLMOセクションを描画
 */
function drawLLMOSection(doc, data) {
  drawSectionTitle(doc, 'AI引用最適化 (LLMO)');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    {
      label: 'AI引用適正スコア',
      detail: data.details.aiCitationScore,
      rawData: `${data.details.aiCitationScore.overall.toFixed(1)}%`
    },
    {
      label: '定義文（〜とは）',
      detail: data.details.definitions
    },
    {
      label: 'How-toコンテンツ',
      detail: data.details.howToContent
    },
    {
      label: 'Why形式',
      detail: data.details.whyContent
    },
    {
      label: '簡潔な回答',
      detail: data.details.conciseAnswers
    },
    {
      label: '質問形式',
      detail: data.details.questionFormat
    },
    {
      label: '段落独立性',
      detail: data.details.paragraphIndependence
    }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail, item.rawData);
    }
  });
}

/**
 * マルチメディアセクションを描画
 */
function drawMultimediaSection(doc, data) {
  drawSectionTitle(doc, 'マルチメディア最適化');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    { label: 'alt属性完全性', detail: data.details.altCompleteness },
    { label: 'alt属性品質', detail: data.details.altQuality },
    { label: '次世代画像フォーマット', detail: data.details.modernImageFormats },
    { label: 'レスポンシブ画像', detail: data.details.responsiveImages },
    { label: '動画コンテンツ', detail: data.details.videoContent },
    { label: 'SVG使用', detail: data.details.svgUsage }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail);
    }
  });
}

/**
 * ソーシャルセクションを描画
 */
function drawSocialSection(doc, data) {
  drawSectionTitle(doc, 'ソーシャルシグナル');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    { label: '必須OGPタグ', detail: data.details.requiredOGP },
    { label: 'OGP画像品質', detail: data.details.ogImageQuality },
    { label: 'Twitter Card', detail: data.details.twitterCard },
    { label: 'Twitter固有タグ', detail: data.details.twitterSpecific },
    { label: 'SNSプロフィール', detail: data.details.socialProfiles },
    { label: '共有ボタン', detail: data.details.shareButtons }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail);
    }
  });
}

/**
 * ローカルSEOセクションを描画
 */
function drawLocalSEOSection(doc, data) {
  drawSectionTitle(doc, 'ローカルSEO');
  drawScore(doc, data.score, data.maxScore);

  const items = [
    { label: 'LocalBusiness Schema', detail: data.details.localBusinessSchema },
    { label: 'NAP情報', detail: data.details.napInformation },
    { label: '営業時間', detail: data.details.openingHours },
    { label: 'Google Maps埋め込み', detail: data.details.mapEmbed },
    { label: 'Reviewスキーマ', detail: data.details.reviewSchema },
    { label: '評価表示', detail: data.details.aggregateRating },
    { label: '地域言及', detail: data.details.regionalMentions }
  ];

  items.forEach(item => {
    if (item.detail) {
      drawDetailItem(doc, item.label, item.detail);
    }
  });
}

/**
 * サイト情報セクションを描画
 */
function drawRawDataSection(doc, data) {
  drawSectionTitle(doc, 'サイト情報');

  if (!data) {
    doc.fontSize(10)
      .fillColor(COLORS.text)
      .text('サイト情報が取得できませんでした。', LAYOUT.marginX, doc.y, {
        width: LAYOUT.contentWidth
      });
    return;
  }

  // HTTPステータス
  drawInfoBox(doc, 'HTTPステータス', `${data.status || 'N/A'}`);

  // クロール日時
  if (data.crawledAt) {
    const crawledDate = new Date(data.crawledAt).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    drawInfoBox(doc, 'クロール日時', crawledDate);
  }

  // リダイレクト情報
  if (data.redirectChain && data.redirectChain.length > 0) {
    drawInfoBox(doc, 'リダイレクト', `${data.redirectChain.length}回のリダイレクト`);
  }

  // 主要メタタグ
  if (data.metaTags && data.metaTags.length > 0) {
    const descMeta = data.metaTags.find(m => m.name === 'description');
    if (descMeta) {
      const truncatedDesc = descMeta.content.length > 150
        ? descMeta.content.substring(0, 150) + '...'
        : descMeta.content;
      drawInfoBox(doc, 'メタディスクリプション', truncatedDesc);
    }

    const ogTitle = data.metaTags.find(m => m.name === 'og:title');
    if (ogTitle) {
      drawInfoBox(doc, 'OGタイトル', ogTitle.content);
    }

    const ogDesc = data.metaTags.find(m => m.name === 'og:description');
    if (ogDesc) {
      const truncatedOgDesc = ogDesc.content.length > 150
        ? ogDesc.content.substring(0, 150) + '...'
        : ogDesc.content;
      drawInfoBox(doc, 'OGディスクリプション', truncatedOgDesc);
    }
  }

  // 構造化データ概要
  if (data.structuredData && data.structuredData.length > 0) {
    const schemaTypes = data.structuredData
      .map(sd => sd['@type'])
      .filter(Boolean)
      .join(', ');
    drawInfoBox(doc, '構造化データタイプ', schemaTypes || '検出済み');
  }

  // 画像統計
  if (data.images) {
    drawInfoBox(doc, '画像数', `${data.images.length}個`);
    const imagesWithAlt = data.images.filter(img => img.alt).length;
    const altRate = data.images.length > 0
      ? Math.round((imagesWithAlt / data.images.length) * 100)
      : 0;
    drawInfoBox(doc, 'Alt属性率', `${altRate}% (${imagesWithAlt}/${data.images.length})`);
  }

  // リンク統計
  if (data.links) {
    const internalLinks = data.links.filter(l => l.isInternal).length;
    const externalLinks = data.links.length - internalLinks;
    drawInfoBox(doc, 'リンク統計', `内部: ${internalLinks}, 外部: ${externalLinks}`);
  }
}

/**
 * 情報ボックスを描画（スコアなし）
 */
function drawInfoBox(doc, label, value) {
  // ラベルと値のテキスト高さを計算
  const padding = 10;
  const labelFontSize = 10;
  const valueFontSize = 9;
  const boxWidth = LAYOUT.contentWidth;
  const textWidth = boxWidth - 20;

  // ラベルの高さを計算
  doc.fontSize(labelFontSize);
  const labelHeight = doc.heightOfString(label, {
    width: textWidth,
    lineGap: 2
  });

  // 値の高さを計算
  doc.fontSize(valueFontSize);
  const valueHeight = doc.heightOfString(value, {
    width: textWidth,
    lineGap: 2
  });

  // ボックス全体の高さ（余白含む）
  const boxHeight = padding + labelHeight + 6 + valueHeight + padding;

  // ページ溢れチェック
  if (doc.y + boxHeight > 720) {
    if (doc.addPage) {
      doc.addPage();
      doc.y = 70;
    }
  }

  const boxX = LAYOUT.marginX;
  const boxY = doc.y;

  // ボックス枠
  doc.save();
  doc.rect(boxX, boxY, boxWidth, boxHeight)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke();
  doc.restore();

  // ラベル
  doc.fillColor(COLORS.text)
    .fontSize(labelFontSize)
    .text(label, boxX + padding, boxY + padding, {
      width: textWidth,
      lineGap: 2,
      continued: false
    });

  // 値
  doc.fillColor(COLORS.textSecondary)
    .fontSize(valueFontSize)
    .text(value, boxX + padding, boxY + padding + labelHeight + 6, {
      width: textWidth,
      lineGap: 2,
      continued: false
    });

  doc.y = boxY + boxHeight + 5;
}

/**
 * 改善提案を描画
 */
function drawRecommendations(doc, analysisResults) {
  drawSectionTitle(doc, '改善提案');

  // 優先度：高
  const highPriority = [
    analysisResults.seo.details.title.score < 5 ? 'ページタイトルの最適化が必要です' : null,
    !analysisResults.structuredData.details.implementation.hasData ? '構造化データの実装を最優先で行ってください' : null,
    analysisResults.llmo.details.faqContent.qaPairCount < 3 ? 'FAQコンテンツを追加してLLMO対策を強化してください' : null,
    analysisResults.performance.details.loadTime.score < 10 ? 'ページ読み込み速度の改善が必要です' : null,
    analysisResults.eeat.score < 50 ? 'E-E-A-T評価の改善（著者情報、引用元の明記）が必要です' : null
  ].filter(Boolean);

  if (highPriority.length > 0) {
    drawRecommendationBox(doc, '優先度：高', COLORS.danger, highPriority);
  }

  // 優先度：中
  const mediumPriority = [
    analysisResults.content.details.headingStructure.score < 15 ? '見出し構造の改善を推奨します' : null,
    analysisResults.content.details.internalLinks.score < 10 ? '内部リンクを増やすことを推奨します' : null,
    !analysisResults.structuredData.details.faq.implemented ? 'FAQスキーマの実装を推奨します' : null,
    analysisResults.statistics.score < 50 ? '統計データや数値情報の追加を推奨します' : null,
    analysisResults.multimedia.score < 50 ? '画像のalt属性や次世代フォーマットの使用を推奨します' : null
  ].filter(Boolean);

  if (mediumPriority.length > 0) {
    drawRecommendationBox(doc, '優先度：中', COLORS.warning, mediumPriority);
  }

  // 優先度：低
  const lowPriority = [
    analysisResults.social.score < 70 ? 'ソーシャルメディア対応の強化を検討してください' : null,
    analysisResults.multimedia.details.modernImageFormats.rate < 50 ? '次世代画像フォーマット（WebP、AVIF）の採用を検討してください' : null
  ].filter(Boolean);

  if (lowPriority.length > 0) {
    drawRecommendationBox(doc, '優先度：低', COLORS.primaryLight, lowPriority);
  }

  // 良好な状態メッセージ
  if (analysisResults.seo.score >= 80 && analysisResults.performance.score >= 80 &&
      analysisResults.llmo.score >= 70 && analysisResults.eeat.score >= 70) {
    doc.moveDown(1);
    doc.fontSize(10)
      .fillColor(COLORS.success)
      .text('全体的に良好な状態です。現在の品質を維持しながら、継続的な改善を行ってください。',
        LAYOUT.marginX, doc.y, {
        width: LAYOUT.contentWidth,
        lineGap: 3
      });
  }
}

/**
 * 改善提案ボックスを描画
 */
function drawRecommendationBox(doc, title, color, items) {
  if (items.length === 0) {
    return;
  }

  const titleHeight = 25;
  const itemHeight = 22;
  const boxHeight = titleHeight + (items.length * itemHeight) + 15;

  // ページ溢れチェック
  if (doc.y + boxHeight > 720) {
    // ページ遷移ヘルパーを使用
    if (doc.addPageWithFooter) {
      doc.addPageWithFooter();
    } else {
      doc.addPage();
      doc.y = 70;
    }
  }

  const boxX = LAYOUT.marginX;
  const boxY = doc.y;
  const boxWidth = LAYOUT.contentWidth;

  // タイトルバー
  doc.save();
  doc.rect(boxX, boxY, boxWidth, titleHeight)
    .fill(color);
  doc.restore();

  doc.fillColor('#ffffff')
    .fontSize(11)
    .text(title, boxX + 10, boxY + 7, {
      width: boxWidth - 20,
      continued: false
    });

  // コンテンツ背景
  doc.save();
  doc.rect(boxX, boxY + titleHeight, boxWidth, boxHeight - titleHeight)
    .fill('#ffffff')
    .strokeColor(color)
    .lineWidth(1)
    .stroke();
  doc.restore();

  // アイテムリスト
  doc.fillColor(COLORS.text)
    .fontSize(9);

  let itemY = boxY + titleHeight + 10;
  items.forEach((item, index) => {
    doc.text(`${index + 1}. ${item}`, boxX + 10, itemY, {
      width: boxWidth - 20,
      continued: false
    });
    itemY += itemHeight;
  });

  doc.y = boxY + boxHeight + 15;
}

/**
 * 総合スコアを計算
 */
function calculateTotalScore(analysisResults) {
  const weights = {
    content: 0.15,
    entity: 0.15,
    eeat: 0.20,
    statistics: 0.10,
    structuredData: 0.15,
    llmo: 0.10,
    seo: 0.08,
    performance: 0.04,
    multimedia: 0.02,
    social: 0.01
  };

  if (analysisResults.localSeo && analysisResults.localSeo.isLocalBusiness) {
    weights.localSeo = 0.02;
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  return Math.round(
    (analysisResults.content.score / analysisResults.content.maxScore * weights.content +
      analysisResults.entity.score / analysisResults.entity.maxScore * weights.entity +
      analysisResults.eeat.score / analysisResults.eeat.maxScore * weights.eeat +
      analysisResults.statistics.score / analysisResults.statistics.maxScore * weights.statistics +
      analysisResults.structuredData.score / analysisResults.structuredData.maxScore * weights.structuredData +
      analysisResults.llmo.score / analysisResults.llmo.maxScore * weights.llmo +
      analysisResults.seo.score / analysisResults.seo.maxScore * weights.seo +
      analysisResults.performance.score / analysisResults.performance.maxScore * weights.performance +
      analysisResults.multimedia.score / analysisResults.multimedia.maxScore * weights.multimedia +
      analysisResults.social.score / analysisResults.social.maxScore * weights.social +
      (analysisResults.localSeo && analysisResults.localSeo.isLocalBusiness ?
        analysisResults.localSeo.score / analysisResults.localSeo.maxScore * weights.localSeo : 0)
    ) / totalWeight * 100
  );
}

/**
 * スコアに応じた色を取得
 */
function getScoreColor(percentage) {
  if (percentage >= 80) return COLORS.success;
  if (percentage >= 60) return COLORS.primaryLight;
  if (percentage >= 40) return COLORS.warning;
  return COLORS.danger;
}

/**
 * スコアの評価を取得
 */
function getScoreRating(score) {
  if (score >= 90) return '優秀';
  if (score >= 80) return '良好';
  if (score >= 70) return '普通';
  if (score >= 60) return '要改善';
  return '改善が必要';
}

module.exports = { generatePDF };
