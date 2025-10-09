const cheerio = require('cheerio');

/**
 * マルチメディア最適化評価
 * @param {Object} crawlData - クロールデータ
 * @returns {Object} - マルチメディア分析結果
 */
function analyzeMultimedia(crawlData) {
  const $ = cheerio.load(crawlData.html);
  const images = crawlData.images || [];
  const structuredData = crawlData.structuredData || [];

  const results = {
    score: 0,
    maxScore: 100,
    details: {},
    rawData: {}
  };

  // 1. 画像最適化（40点）

  // Alt属性完全性
  const imagesWithAlt = images.filter(img => img.alt && img.alt.trim() !== '');
  const altCompleteness = images.length > 0 ? (imagesWithAlt.length / images.length) * 100 : 0;

  results.details.altCompleteness = {
    total: images.length,
    withAlt: imagesWithAlt.length,
    withoutAlt: images.length - imagesWithAlt.length,
    completeness: altCompleteness,
    score: altCompleteness === 100 ? 15 :
           altCompleteness >= 80 ? 12 :
           Math.floor(altCompleteness / 10) * 1.5,
    recommendation: altCompleteness === 100
      ? '全画像にalt属性が設定されています。'
      : `${images.length - imagesWithAlt.length}枚の画像にalt属性が不足しています。`
  };

  results.rawData.imageAlt = {
    total: images.length,
    withAlt: imagesWithAlt.length,
    examples: images.slice(0, 5).map(img => ({
      src: img.src,
      alt: img.alt || 'なし',
      hasAlt: !!img.alt
    }))
  };

  // Alt属性の質（50文字以上の説明的alt）
  const descriptiveAlts = imagesWithAlt.filter(img => img.alt && img.alt.length >= 50);
  const descriptiveRate = imagesWithAlt.length > 0
    ? (descriptiveAlts.length / imagesWithAlt.length) * 100
    : 0;

  results.details.altQuality = {
    withAlt: imagesWithAlt.length,
    descriptive: descriptiveAlts.length,
    rate: descriptiveRate,
    score: descriptiveRate >= 50 ? 10 :
           descriptiveRate >= 30 ? 7 :
           Math.floor(descriptiveRate / 10) * 2,
    recommendation: descriptiveRate >= 50
      ? 'alt属性が説明的で詳細です（50文字以上）。'
      : 'alt属性をより説明的に（50文字以上推奨）することを推奨します。'
  };

  results.rawData.descriptiveAlts = descriptiveAlts.slice(0, 3).map(img => ({
    src: img.src,
    alt: img.alt,
    length: img.alt.length
  }));

  // 次世代フォーマット（WebP, AVIF）
  const webpImages = images.filter(img =>
    img.src.toLowerCase().includes('.webp')
  );
  const avifImages = images.filter(img =>
    img.src.toLowerCase().includes('.avif')
  );
  const modernFormatImages = [...webpImages, ...avifImages];
  const modernFormatRate = images.length > 0
    ? (modernFormatImages.length / images.length) * 100
    : 0;

  results.details.modernImageFormats = {
    total: images.length,
    webp: webpImages.length,
    avif: avifImages.length,
    modern: modernFormatImages.length,
    rate: modernFormatRate,
    score: modernFormatRate >= 80 ? 8 :
           modernFormatRate >= 50 ? 6 :
           Math.floor(modernFormatRate / 10) * 0.8,
    recommendation: modernFormatRate >= 80
      ? '次世代画像フォーマット（WebP/AVIF）が使用されています。'
      : modernFormatRate > 0
        ? 'より多くの画像を次世代フォーマットに変換することを推奨します。'
        : 'WebPまたはAVIFフォーマットの使用を推奨します。'
  };

  // レスポンシブ画像（srcset実装）
  const imagesWithSrcset = $('img[srcset]').length;
  const responsiveRate = images.length > 0 ? (imagesWithSrcset / images.length) * 100 : 0;

  results.details.responsiveImages = {
    total: images.length,
    withSrcset: imagesWithSrcset,
    rate: responsiveRate,
    score: responsiveRate >= 70 ? 7 :
           responsiveRate >= 40 ? 5 :
           Math.floor(responsiveRate / 10) * 0.7,
    recommendation: responsiveRate >= 70
      ? 'レスポンシブ画像（srcset）が実装されています。'
      : 'srcset属性によるレスポンシブ画像の実装を推奨します。'
  };

  // 2. 動画コンテンツ（30点）

  // 動画の存在
  const videoTags = $('video');
  const iframeTags = $('iframe');
  const youtubeEmbeds = iframeTags.filter((i, el) => {
    const src = $(el).attr('src') || '';
    return src.includes('youtube.com') || src.includes('youtu.be');
  }).length;
  const vimeoEmbeds = iframeTags.filter((i, el) => {
    const src = $(el).attr('src') || '';
    return src.includes('vimeo.com');
  }).length;

  const totalVideos = videoTags.length + youtubeEmbeds + vimeoEmbeds;

  results.details.videoContent = {
    videoTags: videoTags.length,
    youtubeEmbeds: youtubeEmbeds,
    vimeoEmbeds: vimeoEmbeds,
    total: totalVideos,
    score: totalVideos >= 2 ? 10 :
           totalVideos * 5,
    recommendation: totalVideos >= 2
      ? '動画コンテンツが実装されています。'
      : totalVideos > 0
        ? 'より多くの動画コンテンツの追加を推奨します。'
        : '説明動画の実装を推奨します。'
  };

  results.rawData.videos = {
    native: videoTags.length,
    youtube: youtubeEmbeds,
    vimeo: vimeoEmbeds
  };

  // VideoObject schema
  const hasVideoSchema = structuredData.some(data =>
    data['@type'] === 'VideoObject' ||
    (Array.isArray(data['@type']) && data['@type'].includes('VideoObject'))
  );

  const videoSchema = structuredData.find(data =>
    data['@type'] === 'VideoObject' ||
    (Array.isArray(data['@type']) && data['@type'].includes('VideoObject'))
  );

  results.details.videoSchema = {
    implemented: hasVideoSchema,
    data: videoSchema || null,
    score: hasVideoSchema ? 10 : 0,
    recommendation: hasVideoSchema
      ? 'VideoObject schemaが実装されています。'
      : '動画がある場合、VideoObject schemaの実装を推奨します。'
  };

  results.rawData.videoSchema = videoSchema;

  // 字幕・トランスクリプト
  const hasTrack = $('video track').length > 0;
  const transcriptKeywords = ['文字起こし', 'トランスクリプト', 'transcript', '字幕'];
  const textContent = crawlData.textContent || '';
  const hasTranscriptMention = transcriptKeywords.some(keyword =>
    textContent.toLowerCase().includes(keyword.toLowerCase())
  );

  results.details.videoAccessibility = {
    hasTrack: hasTrack,
    hasTranscript: hasTranscriptMention,
    score: (hasTrack || hasTranscriptMention) ? 10 : 0,
    recommendation: (hasTrack || hasTranscriptMention)
      ? '字幕または文字起こしが提供されています。'
      : '動画の字幕ファイルまたは文字起こしの提供を推奨します。'
  };

  // 3. インフォグラフィック（30点）

  // 視覚的コンテンツ（図解・チャート）
  const visualKeywords = ['図', '図解', 'チャート', 'グラフ', 'ダイアグラム', 'diagram', 'chart', 'graph'];
  const visualImages = images.filter(img =>
    visualKeywords.some(keyword =>
      (img.alt && img.alt.toLowerCase().includes(keyword.toLowerCase())) ||
      (img.src && img.src.toLowerCase().includes(keyword.toLowerCase()))
    )
  );

  results.details.visualContent = {
    count: visualImages.length,
    examples: visualImages.slice(0, 3).map(img => ({
      src: img.src,
      alt: img.alt
    })),
    score: visualImages.length >= 3 ? 15 :
           visualImages.length * 5,
    recommendation: visualImages.length >= 3
      ? '図解・チャートが充実しています。'
      : '3個以上の図解・チャート追加を推奨します。'
  };

  results.rawData.visualContent = visualImages.map(img => ({
    src: img.src,
    alt: img.alt
  }));

  // SVG使用
  const svgElements = $('svg');
  const svgImages = images.filter(img => img.src.toLowerCase().endsWith('.svg'));
  const totalSvg = svgElements.length + svgImages.length;

  results.details.svgUsage = {
    svgElements: svgElements.length,
    svgImages: svgImages.length,
    total: totalSvg,
    score: totalSvg >= 2 ? 10 :
           totalSvg * 5,
    recommendation: totalSvg >= 2
      ? 'SVGベクター画像が活用されています。'
      : 'ロゴや図解にSVGフォーマットの使用を推奨します。'
  };

  // 画像内テキストの代替
  // 画像周辺（前後の段落）にテキスト説明があるかチェック
  let imagesWithContext = 0;
  $('img').each((i, img) => {
    const $img = $(img);
    const prevText = $img.prev('p, div').text();
    const nextText = $img.next('p, div, figcaption').text();
    const parentText = $img.parent('figure').find('figcaption').text();

    if ((prevText && prevText.length > 20) ||
        (nextText && nextText.length > 20) ||
        (parentText && parentText.length > 20)) {
      imagesWithContext++;
    }
  });

  const contextRate = images.length > 0 ? (imagesWithContext / images.length) * 100 : 0;

  results.details.imageContext = {
    total: images.length,
    withContext: imagesWithContext,
    rate: contextRate,
    score: contextRate >= 70 ? 5 :
           Math.floor(contextRate / 20),
    recommendation: contextRate >= 70
      ? '画像の内容がテキストでも提供されています。'
      : '画像の内容を説明するテキストの追加を推奨します。'
  };

  // 総合スコア計算
  results.score = Math.round(
    results.details.altCompleteness.score +
    results.details.altQuality.score +
    results.details.modernImageFormats.score +
    results.details.responsiveImages.score +
    results.details.videoContent.score +
    results.details.videoSchema.score +
    results.details.videoAccessibility.score +
    results.details.visualContent.score +
    results.details.svgUsage.score +
    results.details.imageContext.score
  );

  return results;
}

module.exports = { analyzeMultimedia };
