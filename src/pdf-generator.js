const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Japanese Category Mapping
const CAT_MAP = {
  content: 'コンテンツ品質',
  entity: 'ブランド信頼性(Entity)',
  eeat: '専門性・権威性(E-E-A-T)',
  statistics: 'データの信頼性',
  structuredData: '構造化データ',
  llmo: 'AI市場シェア(LLMO)',
  seo: 'SEOポテンシャル',
  performance: 'ユーザー体験(UX)',
  multimedia: 'メディア活用',
  social: 'SNS拡散力',
  localSeo: '地域シェア(MEO)'
};

const SCHEMA_JA = {
  'Organization': '組織・会社', 'Corporation': '組織・会社', 'LocalBusiness': '店舗・会社', 'Person': '人物・著者',
  'Article': '記事・情報', 'BlogPosting': 'ブログ記事', 'WebSite': '公式サイト', 'WebPage': 'Webページ',
  'BreadcrumbList': '階層構造', 'Review': '評価・口コミ', 'Rating': '評価点', 'Address': '住所',
  'Phone': '電話番号', 'Name': '名称', 'External': '外部証明', 'PostalAddress': '住所情報'
};

/**
 * Generates a PDF report using Puppeteer
 */
async function generatePDF(analysisResults, outputPath) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
    });
    const page = await browser.newPage();
    const htmlContent = generateReportHTML(analysisResults);
    
    await page.setContent(htmlContent, { waitUntil: ['load', 'networkidle0'] });
    await page.evaluateHandle('document.fonts.ready');

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 7px; font-family: 'Noto Sans JP', sans-serif; width: 100%; text-align: center; color: #cbd5e1; padding-bottom: 10px;">
          <span>戦略的Web診断レポート - LLMO Diagnosis v3.8</span>
          <span style="margin-left: 20px;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
      margin: { top: '0px', bottom: '20px', left: '0px', right: '0px' }
    });

    return outputPath;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Generates the full HTML string
 */
function generateReportHTML(results) {
  const date = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalScore = calculateTotalScore(results);
  const chartSVG = generateRadarChartSVG(results);
  const networkSVG = generateEntityGraphSVG(results);
  const priorities = getPriorities(results);
  
  const perfImpact = results.performance?.businessImpact || null;
  const llmoImpact = results.llmo?.businessImpact || null;

  const isMulti = results.isMultiPage;

  return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap');
        :root { --primary: #0f172a; --accent: #2563eb; --text: #334155; --text-light: #94a3b8; --border: #e2e8f0; --success: #10b981; --warning: #f59e0b; --danger: #ef4444; --bg-light: #f8fafc; }
        body { font-family: 'Noto Sans JP', sans-serif; color: var(--text); margin: 0; padding: 0; -webkit-print-color-adjust: exact; background: #fff; line-height: 1.4; }
        .page { width: 210mm; min-height: 296mm; position: relative; box-sizing: border-box; padding: 40px 50px; page-break-after: always; }
        .cover-header { background-color: var(--primary); height: 160px; padding: 50px; color: #ffffff; }
        .cover-title { font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 0.05em; }
        .cover-subtitle { font-size: 12px; color: #94a3b8; font-weight: 500; text-transform: uppercase; margin-top: 5px; }
        .cover-body { padding: 50px; }
        .meta-group { margin-bottom: 30px; border-bottom: 1px solid var(--border); padding-bottom: 5px; }
        .meta-label { font-size: 10px; color: var(--text-light); font-weight: 700; }
        .meta-value { font-size: 16px; color: var(--primary); font-weight: 500; }
        .score-big { font-size: 120px; font-weight: 300; line-height: 0.8; letter-spacing: -0.05em; }
        .score-total { font-size: 20px; color: var(--text-light); margin-left: 15px; }
        .maturity-map { display: flex; justify-content: space-between; margin-top: 40px; border-top: 2px solid var(--border); padding-top: 20px; }
        .maturity-step { flex: 1; text-align: center; font-size: 10px; color: var(--text-light); position: relative; }
        .maturity-step.active { color: var(--primary); font-weight: 700; }
        .maturity-step.active::after { content: ''; position: absolute; top: -26px; left: 50%; transform: translateX(-50%); width: 10px; height: 10px; background: var(--accent); border-radius: 50%; }
        .impact-card { border-left: 4px solid var(--border); padding: 10px 20px; margin-bottom: 20px; background: #fff; }
        .impact-critical { border-left-color: var(--danger); }
        .impact-medium { border-left-color: var(--warning); }
        .impact-low { border-left-color: var(--success); }
        .impact-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .impact-title { font-weight: 700; font-size: 13px; color: var(--primary); }
        .impact-label { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 2px; background: var(--bg-light); }
        .impact-desc { font-size: 11px; line-height: 1.5; color: var(--text); }
        .section-header { margin-top: 20px; border-bottom: 2px solid var(--primary); padding-bottom: 5px; margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: 700; color: var(--primary); }
        .two-column-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .category-block { margin-bottom: 25px; break-inside: avoid; }
        .progress-container { height: 4px; background: var(--border); border-radius: 2px; margin-bottom: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent); }
        .fill-good { background: var(--success); }
        .fill-avg { background: var(--warning); }
        .fill-poor { background: var(--danger); }
        .detail-item { display: flex; justify-content: space-between; font-size: 9.5px; color: #64748b; padding: 3px 0; border-bottom: 1px dashed #f1f5f9; }
        .detail-val { font-weight: 500; color: var(--text); }
        .chart-legend { display: flex; flex-direction: column; gap: 8px; margin-left: 30px; min-width: 100px; }
        .legend-item { display: flex; align-items: center; font-size: 10px; color: var(--text); white-space: nowrap; }
        .legend-color { width: 12px; height: 12px; border-radius: 2px; margin-right: 8px; flex-shrink: 0; }
        .network-section { margin-bottom: 40px; padding-top: 10px; }
        .graph-label { font-size: 12px; font-weight: 700; color: var(--primary); margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 5px; }
        .network-footer { display: flex; gap: 15px; margin-top: 15px; }
        .network-legend-item { display: flex; align-items: center; font-size: 8px; color: var(--text); font-weight: 500; }
        .node-dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
      </style>
    </head>
    <body>
      <div class="page" style="padding:0; display:flex; flex-direction:column;">
        <div class="cover-header">
          <div class="cover-subtitle">STRATEGIC ANALYSIS ${isMulti ? '(複数ページ診断)' : ''}</div>
          <h1 class="cover-title">LLMO診断</h1>
        </div>
        <div class="cover-body">
          <div class="meta-group"><div class="meta-label">診断先</div><div class="meta-value">${results.companyName || '未設定'} 様</div></div>
          <div class="meta-group"><div class="meta-label">対象URL</div><div class="meta-value" style="font-size:14px;">${results.url}</div></div>
          <div class="meta-group"><div class="meta-label">診断実施日</div><div class="meta-value">${date}</div></div>
          <div class="score-section">
            <div class="meta-label">総合戦略スコア ${isMulti ? '(平均値)' : ''}</div>
            <div class="score-display"><span class="score-big">${totalScore}</span><span class="score-total">/ 100</span></div>
          </div>
          <div class="maturity-map">
            <div class="maturity-step ${totalScore < 50 ? 'active' : ''}">AI INVISIBLE<br>(AIから認識不能)</div>
            <div class="maturity-step ${totalScore >= 50 && totalScore < 80 ? 'active' : ''}">AI READY<br>(AI検索への適応中)</div>
            <div class="maturity-step ${totalScore >= 80 ? 'active' : ''}">AI NATIVE<br>(次世代検索の覇者)</div>
          </div>
        </div>
      </div>

      <div class="page">
        <div class="section-header"><div class="section-title">経営インパクト・重要課題</div></div>
        <div class="impact-section">
          ${renderImpactCard(perfImpact)}
          ${renderImpactCard(llmoImpact)}
        </div>
        <div style="display:flex; gap:30px; margin-bottom:30px; align-items:center;">
          <div style="flex:0 0 320px; height:240px; display:flex; align-items:center;">
            ${chartSVG}
            <div class="chart-legend">
              <div class="legend-item"><div class="legend-color" style="background:#2563eb;"></div>当サイト</div>
              <div class="legend-item"><div class="legend-color" style="background:#94a3b8;"></div>全業種平均</div>
              ${results.comparisonStats?.industry ? `<div class="legend-item"><div class="legend-color" style="background:#10b981;"></div>同業種平均</div>` : ''}
            </div>
          </div>
          <div style="flex:1;">
            <div style="font-size:10px; font-weight:700; color:var(--text-light); margin-bottom:10px;">最優先改善アクション</div>
            ${priorities.length > 0 ? priorities.map(p => `
              <div style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed var(--border);">
                <div style="font-size:12px; font-weight:700; color:var(--primary);">${p.category}</div>
                <div style="font-size:11px; color:var(--text); line-height:1.4;">${p.suggestion}</div>
              </div>
            `).join('') : '<div style="font-size:11px; color:var(--text-light);">サイト全体の平均値において、特筆すべき重大な課題は見つかりませんでした。</div>'}
          </div>
        </div>
        <div class="network-section">
          <div class="graph-label"><span>AIによる「情報の関連性」理解度マップ（代表ページのナレッジグラフ解析図）</span></div>
          <div style="display:flex; gap:30px; align-items:flex-start;">
            <div style="flex:1; height:220px;">${networkSVG}</div>
            <div style="flex:0 0 240px; font-size:9.5px; color:var(--text); line-height:1.7;">
              <div style="font-weight:700; margin-bottom:8px; border-bottom:2px solid var(--primary); padding-bottom:3px;">情報の繋がりと経営への影響</div>
              ${isMulti ? '複数ページ診断では、サイト内の代表的なエンティティ構造を抽出しています。<br><br>' : ''}
              ● <strong>網の目が太い</strong>：情報の正確性を確信し、推薦回答に採用されやすくなります。<br>
              ● <strong>線が途切れている</strong>：AIにとって信頼できない断片データとなり、認知リスクが高まります。<br>
              ● <strong>黒枠の点</strong>：AIが「公式な実体」として特定済みの強固なデータです。
              <div class="network-footer">
                <div class="network-legend-item"><div class="node-dot" style="background:#2563eb;"></div>組織</div>
                <div class="network-legend-item"><div class="node-dot" style="background:#8b5cf6;"></div>人物</div>
                <div class="network-legend-item"><div class="node-dot" style="background:#f59e0b;"></div>情報</div>
                <div class="network-legend-item"><div class="node-dot" style="background:#10b981;"></div>NAP</div>
              </div>
            </div>
          </div>
        </div>
        <div class="section-header" style="margin-top:0;"><div class="section-title">詳細分析データ（全体平均）</div></div>
        <div class="two-column-grid">
          <div>
            ${renderCategoryBlock('content', isMulti ? results.aggregated.byCategory.content : results.content)}
            ${renderCategoryBlock('entity', isMulti ? results.aggregated.byCategory.entity : results.entity)}
            ${renderCategoryBlock('eeat', isMulti ? results.aggregated.byCategory.eeat : results.eeat)}
          </div>
          <div>
            ${renderCategoryBlock('structuredData', isMulti ? results.aggregated.byCategory.structuredData : results.structuredData)}
            ${renderCategoryBlock('llmo', isMulti ? results.aggregated.byCategory.llmo : results.llmo)}
            ${renderCategoryBlock('statistics', isMulti ? results.aggregated.byCategory.statistics : results.statistics)}
          </div>
        </div>
      </div>

      <div class="page">
        <div class="section-header"><div class="section-title">詳細分析データ（全体平均）</div></div>
        <div class="two-column-grid">
          <div>
            ${renderCategoryBlock('seo', isMulti ? results.aggregated.byCategory.seo : results.seo)}
            ${renderCategoryBlock('performance', isMulti ? results.aggregated.byCategory.performance : results.performance)}
          </div>
          <div>
            ${renderCategoryBlock('multimedia', isMulti ? results.aggregated.byCategory.multimedia : results.multimedia)}
            ${renderCategoryBlock('social', isMulti ? results.aggregated.byCategory.social : results.social)}
          </div>
        </div>
        <div style="margin-top: 50px; text-align: center; color: #cbd5e1; font-size: 9px;">Generated by HERO AIVO Strategic Engine</div>
      </div>
    </body>
    </html>`;
}

// --- Helpers ---

function calculateTotalScore(results) {
  if (results.totalScore !== undefined && typeof results.totalScore === 'number') return results.totalScore;
  if (results.isMultiPage && results.aggregated?.overall?.averageScore) return results.aggregated.overall.averageScore;
  return 0;
}

function extractCategoryScores(results) {
  const s = {};
  const isMulti = results.isMultiPage;
  for (const k in CAT_MAP) {
    if (isMulti && results.aggregated?.byCategory?.[k]) {
      s[k] = results.aggregated.byCategory[k].avg || 0;
    } else if (results[k]) {
      s[k] = results[k].score || 0;
    } else {
      s[k] = 0;
    }
  }
  return s;
}

function getPriorities(results) {
  if (results.isMultiPage && results.aggregated?.recommendations) {
    // 複数ページ診断の場合はaggregated.recommendationsから上位を抽出
    return results.aggregated.recommendations.slice(0, 4).map(r => ({
      category: r.category,
      suggestion: r.suggestion
    }));
  }
  
  const priorities = [];
  for (const k in CAT_MAP) {
    const data = results[k];
    if (data && typeof data.score === 'number' && data.score < 75) {
      let worst = null, minS = 100;
      if (data.details) {
        Object.values(data.details).forEach(dV => {
          if (dV && typeof dV.score === 'number' && dV.score < minS) { minS = dV.score; worst = dV; }
        });
      }
      if (worst) priorities.push({ category: CAT_MAP[k], suggestion: worst.recommendation || `${CAT_MAP[k]}の最適化を推奨します。` });
    }
  }
  return priorities.slice(0, 4);
}

function renderCategoryBlock(key, data) {
  if (!data) return '';
  const title = CAT_MAP[key] || key;
  // 複数ページ診断のデータ構造(avg)か、単一ページの構造(score)か判定
  const score = typeof data.avg === 'number' ? data.avg : (data.score || 0);
  const colorClass = score >= 80 ? 'fill-good' : score >= 50 ? 'fill-avg' : 'fill-poor';
  const textClass = score >= 80 ? 'score-good' : score >= 50 ? 'score-avg' : 'score-poor';
  
  let detailsHtml = '';
  if (data.details) {
    detailsHtml = Object.entries(data.details).slice(0, 6).map(([dKey, val]) => `
      <div class="detail-item"><span>${camelToLabel(dKey)}</span><span class="detail-val ${val.score < 5 ? 'val-low' : ''}">${val.score}</span></div>
    `).join('');
  } else if (typeof data.avg === 'number') {
    detailsHtml = `<div class="detail-item"><span>分析ページ数</span><span class="detail-val">${data.pagesAnalyzed}件</span></div>
                   <div class="detail-item"><span>中央値 / 最小 / 最大</span><span class="detail-val">${data.median} / ${data.min} / ${data.max}</span></div>`;
  }

  return `<div class="category-block"><div class="cat-header"><span class="cat-title">${title}</span><span class="cat-score ${textClass}">${score}点</span></div><div class="progress-container"><div class="progress-fill ${colorClass}" style="width:${score}%;"></div></div><div class="detail-list">${detailsHtml}</div></div>`;
}

function renderImpactCard(impact) {
  if (!impact) return '';
  let levelClass = 'impact-medium', labelText = '要確認';
  if (impact.level === 'low') { levelClass = 'impact-low'; labelText = '良好'; }
  else if (impact.level === 'critical' || impact.level === 'high') { levelClass = 'impact-critical'; labelText = '重大リスク'; }
  return `<div class="impact-card ${levelClass}"><div class="impact-header"><div class="impact-title">${impact.title}</div><div style="display:flex; align-items:center;"><span class="impact-label" style="margin-left:10px;">${labelText}</span></div></div><div class="impact-desc">${impact.description}</div></div>`;
}

function camelToLabel(str) {
  const map = { contentVolume: '情報量', headingStructure: '論理構成', h1Quality: '主題の明確性', h2Quality: '小見出し', organizationSchema: '組織信頼性', personSchema: '著者透明性', idImplementation: 'データ連携', primaryInformation: '独自情報', experienceDescription: '体験的価値', authorCredentials: '専門資格', numberCount: '定量データ', statisticalPhrases: '客観的根拠', implementation: 'スキーマ実装', faq: 'Q&A構造', aiCitationScore: 'AI引用適性', llmsTxt: 'AIサイトマップ', definitions: '用語定義', questionFormat: '対話対応', title: '検索タイトル', metaDescription: 'クリック率対策', ogp: 'SNS表示', loadTime: '表示速度', lcp: '最大描画時間', cls: '視覚的安定性', imageOptimization: '画像圧縮', responsiveDesign: 'レスポンシブ', altQuality: 'Alt品質', videoContent: '動画', ogImageQuality: 'OGP画像', twitterCard: 'TwitterCard', shareButtons: '共有ボタン' };
  return map[str] || str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function generateRadarChartSVG(results) {
  const currentScores = extractCategoryScores(results);
  const comparison = results.comparisonStats || { all: {}, industry: null };
  const keys = ['content', 'entity', 'eeat', 'statistics', 'structuredData', 'llmo', 'seo', 'performance', 'multimedia', 'social'];
  const width = 500, height = 400, centerX = 250, centerY = 200, radius = 120, count = keys.length, angleStep = (Math.PI * 2) / count;
  const getPoints = (scoreMap) => keys.map((key, i) => { const val = (scoreMap && typeof scoreMap[key] === 'number') ? scoreMap[key] : 0; const angle = i * angleStep - Math.PI / 2; const r = (val / 100) * radius; return `${(centerX + Math.cos(angle) * r).toFixed(1)},${(centerY + Math.sin(angle) * r).toFixed(1)}`; }).join(' ');
  const currentPoints = getPoints(currentScores), allAvgPoints = getPoints(comparison.all), industryAvgPoints = comparison.industry ? getPoints(comparison.industry) : null;
  let webs = '';
  for (let i = 1; i <= 4; i++) { const r = (i / 4) * radius; const webPoints = Array.from({length: count}).map((_, j) => { const angle = j * angleStep - Math.PI / 2; return `${(centerX + Math.cos(angle) * r).toFixed(1)},${(centerY + Math.sin(angle) * r).toFixed(1)}`; }).join(' '); webs += `<polygon points="${webPoints}" fill="none" stroke="#e2e8f0" stroke-width="1" />`; }
  let axes = '', labelText = '';
  keys.forEach((key, i) => { const angle = i * angleStep - Math.PI / 2; const lx = centerX + Math.cos(angle) * (radius + 35), ly = centerY + Math.sin(angle) * (radius + 35); axes += `<line x1="${centerX}" y1="${centerY}" x2="${(centerX + Math.cos(angle) * radius).toFixed(1)}" y2="${(centerY + Math.sin(angle) * radius).toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />`; let anchor = Math.abs(lx - centerX) < 10 ? 'middle' : (lx > centerX ? 'start' : 'end'); labelText += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" font-size="10" fill="#64748b" font-family="Noto Sans JP" font-weight="500">${CAT_MAP[key]}</text>`; });
  return `<svg width="260" height="240" viewBox="0 0 ${width} ${height}">${webs}${axes}<polygon points="${allAvgPoints}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,2" />${industryAvgPoints ? `<polygon points="${industryAvgPoints}" fill="none" stroke="#10b981" stroke-width="1.5" opacity="0.6" />` : ''}<polygon points="${currentPoints}" fill="rgba(37, 99, 235, 0.25)" stroke="#2563eb" stroke-width="3" /><circle cx="${centerX}" cy="${centerY}" r="3" fill="#2563eb" />${labelText}</svg>`;
}

function generateEntityGraphSVG(results) {
  let structuredData = [];
  
  if (results.isMultiPage && results.pages && results.pages.length > 0) {
    // 複数ページ診断の場合、最もデータ量の多い（実体が多い）ページを代表として抽出
    const pagesWithData = results.pages.filter(p => p.structuredData && p.structuredData.rawData);
    
    if (pagesWithData.length > 0) {
      const representativePage = pagesWithData.reduce((prev, current) => 
        ((current.structuredData.rawData.count || 0) > (prev.structuredData.rawData.count || 0)) ? current : prev
      );
      structuredData = representativePage.structuredData.rawData.structuredData || [];
    }
  } else if (results.structuredData && results.structuredData.rawData) {
    // 単一ページ
    structuredData = results.structuredData.rawData.structuredData || [];
  } else if (results.rawData && results.rawData.structuredData) {
    // rawData直下にある場合（バックアップ）
    structuredData = results.rawData.structuredData;
  }

  if (!structuredData || structuredData.length === 0) return `<svg width="400" height="220" viewBox="0 0 500 320"><text x="250" y="160" text-anchor="middle" fill="#94a3b8" font-size="12">構造化データが検出されませんでした</text></svg>`;

  const nodes = [], links = [];
  structuredData.forEach((d, idx) => {
    const rawType = Array.isArray(d['@type']) ? d['@type'][0] : d['@type'];
    if (!rawType) return;
    const id = d['@id'] || `node-${idx}`;
    let label = SCHEMA_JA[rawType] || rawType, color = '#2563eb', r = 10;
    if (rawType.includes('Person')) { color = '#8b5cf6'; label = d.name || '人物'; }
    else if (rawType.includes('WebSite')) { color = '#3b82f6'; r = 12; label = 'サイト'; }
    else if (rawType.includes('Article')) { color = '#f59e0b'; label = '記事'; }
    nodes.push({ id, label, color, r, isVerified: !!d['@id'] });
    const checkProp = (obj, propName) => { if (obj[propName]) { const target = obj[propName]['@id'] || (typeof obj[propName] === 'string' ? obj[propName] : null); if (target) links.push({ source: id, target }); } };
    checkProp(d, 'author'); checkProp(d, 'publisher');
  });
  
  const uniqueNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values());
  const validLinks = links.filter(l => uniqueNodes.find(n => n.id === l.source) && uniqueNodes.find(n => n.id === l.target));
  const width = 500, height = 320, cx = 250, cy = 150; 
  uniqueNodes.forEach((node, i) => { if (i === 0 && uniqueNodes.length > 1) { node.x = cx; node.y = cy; } else { const angle = (i / (uniqueNodes.length)) * Math.PI * 2; const dist = node.r > 10 ? 80 : 115; node.x = cx + Math.cos(angle) * dist; node.y = cy + Math.sin(angle) * dist; } });
  let linkElems = validLinks.map(l => { const s = uniqueNodes.find(n => n.id === l.source), t = uniqueNodes.find(n => n.id === l.target); return `<line x1="${s.x.toFixed(1)}" y1="${s.y.toFixed(1)}" x2="${t.x.toFixed(1)}" y2="${t.y.toFixed(1)}" stroke="#cbd5e1" stroke-width="1" opacity="0.6" />`; }).join('');
  let nodeElems = uniqueNodes.map(n => `<g><circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r}" fill="${n.color}" stroke="${n.isVerified ? '#0f172a' : 'none'}" stroke-width="2" /><text x="${n.x.toFixed(1)}" y="${(n.y + n.r + 12).toFixed(1)}" text-anchor="middle" font-size="9" fill="#334155" font-weight="700" font-family="Noto Sans JP">${n.label}</text></g>`).join('');
  return `<svg width="400" height="220" viewBox="0 0 ${width} ${height}">${linkElems}${nodeElems}</svg>`;
}

module.exports = { generatePDF };
