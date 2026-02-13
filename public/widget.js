/**
 * LLMO Diagnostic Widget - Single Page Only
 * 
 * Usage:
 * <div id="llmo-diagnostic-widget" data-api-url="https://your-api-server.com"></div>
 * <script src="https://your-api-server.com/widget.js"></script>
 */

(function() {
  // --- 1. Configuration ---
  const SCRIPT_ID = 'llmo-diagnostic-widget';
  const API_KEY = 'hero_aivo_2025_secret'; // 既存のAPIキーを使用
  
  const container = document.getElementById(SCRIPT_ID);
  if (!container) {
    console.error('LLMO Widget: Container #llmo-diagnostic-widget not found.');
    return;
  }

  // Get API URL from data attribute or script source
  let apiUrl = container.getAttribute('data-api-url');
  if (!apiUrl) {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
      if (script.src.includes('widget.js')) {
        apiUrl = new URL(script.src).origin;
        break;
      }
    }
  }
  apiUrl = apiUrl || window.location.origin;

  // --- 2. Styles ---
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    #llmo-widget-root {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 600px;
      margin: 20px auto;
      padding: 30px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
      color: #1f2937;
      line-height: 1.5;
      border: 1px solid #e5e7eb;
    }
    #llmo-widget-root h2 {
      margin: 0 0 10px 0;
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      text-align: center;
    }
    #llmo-widget-root p.desc {
      font-size: 14px;
      color: #6b7280;
      text-align: center;
      margin-bottom: 25px;
    }
    .llmo-form-group {
      margin-bottom: 20px;
    }
    .llmo-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #4b5563;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .llmo-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 15px;
      transition: all 0.2s;
      box-sizing: border-box;
    }
    .llmo-input:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
    }
    .llmo-btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, opacity 0.2s;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    }
    .llmo-btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
    .llmo-btn:active {
      transform: translateY(0);
    }
    .llmo-btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      box-shadow: none;
    }
    /* Progress */
    #llmo-progress-area {
      display: none;
      text-align: center;
      margin-top: 20px;
    }
    .llmo-progress-bg {
      width: 100%;
      height: 10px;
      background: #f3f4f6;
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .llmo-progress-fill {
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #06b6d4);
      transition: width 0.4s ease;
    }
    .llmo-status-msg {
      font-size: 14px;
      color: #4b5563;
    }
    /* Result */
    #llmo-result-area {
      display: none;
      text-align: center;
      margin-top: 25px;
      padding-top: 25px;
      border-top: 1px solid #f3f4f6;
    }
    .llmo-score-display {
      margin-bottom: 20px;
    }
    .llmo-score-val {
      font-size: 48px;
      font-weight: 800;
      color: #1e40af;
      line-height: 1;
    }
    .llmo-score-label {
      font-size: 14px;
      color: #6b7280;
      margin-top: 5px;
    }
    .llmo-download-link {
      display: inline-block;
      padding: 10px 20px;
      background: #f3f4f6;
      color: #1e40af;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .llmo-download-link:hover {
      background: #e5e7eb;
    }
    .llmo-error {
      color: #dc2626;
      font-size: 14px;
      margin-top: 15px;
      display: none;
      text-align: center;
    }
  `;
  document.head.appendChild(styleTag);

  // --- 3. HTML Structure ---
  container.innerHTML = `
    <div id="llmo-widget-root">
      <h2>単一ページLLMO診断</h2>
      <p class="desc">WebサイトのAI引用最適化状況を無料で診断します。</p>
      
      <div id="llmo-input-area">
        <div class="llmo-form-group">
          <label class="llmo-label">診断するURL</label>
          <input type="url" id="llmo-url-input" class="llmo-input" placeholder="https://example.com" required>
        </div>
        <button id="llmo-start-btn" class="llmo-btn">診断を開始する</button>
      </div>

      <div id="llmo-progress-area">
        <div class="llmo-progress-bg">
          <div id="llmo-progress-fill" class="llmo-progress-fill"></div>
        </div>
        <div id="llmo-status-msg" class="llmo-status-msg">準備中...</div>
      </div>

      <div id="llmo-result-area">
        <div class="llmo-score-display">
          <div id="llmo-score-val" class="llmo-score-val">0</div>
          <div class="llmo-score-label">総合スコア</div>
        </div>
        <a id="llmo-pdf-link" href="#" class="llmo-download-link" target="_blank">📄 詳細レポート(PDF)をダウンロード</a>
        <div style="margin-top: 20px;">
           <button id="llmo-reset-btn" style="background:none; border:none; color:#6b7280; font-size:12px; cursor:pointer; text-decoration:underline;">別のURLを診断する</button>
        </div>
      </div>

      <div id="llmo-error-msg" class="llmo-error"></div>
    </div>
  `;

  // --- 4. Logic ---
  const urlInput = document.getElementById('llmo-url-input');
  const startBtn = document.getElementById('llmo-start-btn');
  const inputArea = document.getElementById('llmo-input-area');
  const progressArea = document.getElementById('llmo-progress-area');
  const progressFill = document.getElementById('llmo-progress-fill');
  const statusMsg = document.getElementById('llmo-status-msg');
  const resultArea = document.getElementById('llmo-result-area');
  const scoreVal = document.getElementById('llmo-score-val');
  const pdfLink = document.getElementById('llmo-pdf-link');
  const errorMsg = document.getElementById('llmo-error-msg');
  const resetBtn = document.getElementById('llmo-reset-btn');

  let pollInterval = null;

  async function startAnalysis() {
    const url = urlInput.value.trim();
    if (!url) {
      showError('URLを入力してください。');
      return;
    }

    // Reset UI
    errorMsg.style.display = 'none';
    inputArea.style.display = 'none';
    progressArea.style.display = 'block';
    updateProgress(10, '診断リクエストを送信中...');

    try {
      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '診断の開始に失敗しました。');

      const jobId = data.jobId;
      startPolling(jobId);

    } catch (err) {
      showError(err.message);
      inputArea.style.display = 'block';
      progressArea.style.display = 'none';
    }
  }

  function startPolling(jobId) {
    pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/analyze/${jobId}`, {
          headers: { 'x-api-key': API_KEY }
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || '進捗の取得に失敗しました。');

        updateProgress(data.progress, getStatusMessage(data.status));

        if (data.status === 'completed') {
          stopPolling();
          showResults(jobId);
        } else if (data.status === 'failed') {
          stopPolling();
          showError(data.error || '診断に失敗しました。');
          inputArea.style.display = 'block';
          progressArea.style.display = 'none';
        }
      } catch (err) {
        stopPolling();
        showError(err.message);
        inputArea.style.display = 'block';
        progressArea.style.display = 'none';
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function showResults(jobId) {
    try {
      const response = await fetch(`${apiUrl}/api/result/${jobId}`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await response.json();

      scoreVal.textContent = data.result.totalScore || 0;
      pdfLink.href = `${apiUrl}/api/report/${jobId}`;
      
      progressArea.style.display = 'none';
      resultArea.style.display = 'block';
    } catch (err) {
      showError('結果の取得に失敗しました。');
    }
  }

  function updateProgress(percent, msg) {
    progressFill.style.width = `${percent}%`;
    statusMsg.textContent = msg;
  }

  function getStatusMessage(status) {
    const msgs = {
      'pending': '準備中...',
      'crawling': 'サイトをスキャン中...',
      'analyzing': 'AI適正を分析中...',
      'generating-pdf': 'レポートを作成中...',
      'completed': '完了しました！'
    };
    return msgs[status] || '解析中...';
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  function resetWidget() {
    resultArea.style.display = 'none';
    inputArea.style.display = 'block';
    urlInput.value = '';
    updateProgress(0, '');
  }

  // Events
  startBtn.addEventListener('click', startAnalysis);
  resetBtn.addEventListener('click', resetWidget);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startAnalysis();
  });

})();
