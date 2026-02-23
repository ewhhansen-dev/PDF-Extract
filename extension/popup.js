const buttons = {
  'clip-page':               { format: 'clipboard',      scope: 'page' },
  'clip-selection':          { format: 'clipboard',      scope: 'selection' },
  'clip-modal':              { format: 'clipboard',      scope: 'modal' },
  'txt-page':                { format: 'txt',            scope: 'page' },
  'txt-selection':           { format: 'txt',            scope: 'selection' },
  'pdf-typewriter-page':     { format: 'pdf-typewriter', scope: 'page' },
  'pdf-typewriter-selection':{ format: 'pdf-typewriter', scope: 'selection' },
  'txt-modal':               { format: 'txt',            scope: 'modal' },
  'pdf-typewriter-modal':    { format: 'pdf-typewriter', scope: 'modal' },
  'md-modal':                { format: 'md',             scope: 'modal' },
  'pdf-modal':               { format: 'pdf',            scope: 'modal' },
  'pdf-page':                { format: 'pdf',            scope: 'page' },
  'pdf-selection':           { format: 'pdf',            scope: 'selection' },
  'md-page':                 { format: 'md',             scope: 'page' },
  'md-selection':            { format: 'md',             scope: 'selection' },
};

for (const [id, config] of Object.entries(buttons)) {
  var btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', () => {
      injectAndRun(config.format, config.scope);
    });
  }
}

function showStatus(msg, type) {
  var el = document.getElementById('status-msg');
  if (!el) return;
  el.className = 'status-' + type;
  el.textContent = (type === 'loading' ? '\u23F3 ' : '\u2705 ') + msg;
  el.style.display = 'block';
}

function setButtonsDisabled(disabled) {
  var btns = document.querySelectorAll('button');
  for (var i = 0; i < btns.length; i++) {
    btns[i].disabled = disabled;
  }
}

function injectAndRun(format, scope) {
  // Show loading state immediately
  showStatus('Processing...', 'loading');
  setButtonsDisabled(true);

  // Hide any previous errors and preview
  var errEl = document.getElementById('error-msg');
  if (errEl) errEl.style.display = 'none';
  resetPreview();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      showError('No active tab found.');
      return;
    }
    const tab = tabs[0];
    const tabId = tab.id;
    const url = tab.url || '';

    // Block injection into browser-internal pages (Brave, Chrome, Edge)
    if (url.startsWith('brave://') || url.startsWith('chrome://') ||
        url.startsWith('edge://') || url.startsWith('about:') ||
        url.startsWith('chrome-extension://') || url.startsWith('devtools://') ||
        url.startsWith('view-source:') || url.startsWith('data:') ||
        url.startsWith('blob:')) {
      showError('Cannot extract from browser internal pages. Navigate to a website first.');
      return;
    }

    // Block injection into web store pages (restricted by browser)
    if (url.includes('chrome.google.com/webstore') ||
        url.includes('addons.mozilla.org') ||
        url.includes('microsoftedge.microsoft.com/addons')) {
      showError('Cannot extract from browser extension stores (restricted by the browser).');
      return;
    }

    // Only inject libraries actually needed for this format
    const files = [];

    if (format === 'pdf' || format === 'pdf-typewriter') {
      files.push('lib/jspdf.umd.min.js');
    }
    if (format === 'pdf') {
      files.push('lib/html2canvas.min.js');
    }
    if (format === 'md') {
      files.push('lib/turndown.js');
    }

    // text-extract.js is always loaded for the extraction engine
    files.push('text-extract.js');
    files.push('content.js');

    chrome.scripting.executeScript({
      target: { tabId },
      files: files
    }, () => {
      if (chrome.runtime.lastError) {
        var errMsg = chrome.runtime.lastError.message || '';
        console.error(errMsg);
        handleInjectionError(errMsg, url);
        return;
      }
      var responded = false;
      var safetyTimer = setTimeout(function () {
        if (!responded) {
          responded = true;
          showError('Operation timed out. The page may have blocked the extension. Try again.');
        }
      }, 8000);

      chrome.tabs.sendMessage(tabId, {
        action: 'convert',
        format: format,
        scope: scope
      }, function (response) {
        if (responded) return;
        responded = true;
        clearTimeout(safetyTimer);
        if (chrome.runtime.lastError) {
          showError('Could not communicate with page: ' + (chrome.runtime.lastError.message || ''));
          return;
        }
        if (response && response.success === false) {
          showError(response.error || 'Conversion failed.');
          return;
        }
        // Preview flow: show preview before downloading
        if (response && response.action === 'preview') {
          showPreview(response, tabId);
          return;
        }
        var successLabel = format === 'clipboard' ? 'Copied!' : 'Downloaded!';
        showStatus(successLabel, 'success');
        setTimeout(function () { window.close(); }, 900);
      });
    });
  });
}

function handleInjectionError(errMsg, url) {
  setButtonsDisabled(false);

  // Brave Shields blocking script injection
  if (errMsg.includes('Cannot access') || errMsg.includes('cannot be scripted')) {
    if (url && (url.includes('chrome.google.com/webstore') || url.includes('addons.mozilla.org') || url.includes('microsoftedge.microsoft.com/addons'))) {
      showError('Browser extension stores block all extensions from running scripts. Try a regular website.');
    } else {
      showError(
        'This page blocked script injection. In Brave, click the lion icon ' +
        'in the address bar and lower Shields for this site, then try again.'
      );
    }
    return;
  }

  // Content Security Policy blocks
  if (errMsg.includes('Content Security Policy') || errMsg.includes('CSP')) {
    showError(
      'This page has a strict Content Security Policy. In Brave, try lowering ' +
      'Shields (lion icon in address bar) and reload the page.'
    );
    return;
  }

  // Frame/sandbox restrictions
  if (errMsg.includes('frame') || errMsg.includes('sandbox')) {
    showError(
      'This page uses frame restrictions that block extraction. ' +
      'Try opening the content directly in a new tab.'
    );
    return;
  }

  // Generic fallback with Brave-specific advice
  showError(
    'Extraction failed: ' + errMsg + '. If using Brave, try lowering ' +
    'Shields for this site (lion icon in address bar).'
  );
}

function showError(msg) {
  // Reset loading state
  var statusEl = document.getElementById('status-msg');
  if (statusEl) statusEl.style.display = 'none';
  setButtonsDisabled(false);

  var el = document.getElementById('error-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

// --- PREVIEW FLOW ---
// Shows a preview of extracted content before downloading.
// Lets the user verify the extraction worked before committing to a download.

function showPreview(data, tabId) {
  // Hide loading status
  var statusEl = document.getElementById('status-msg');
  if (statusEl) statusEl.style.display = 'none';

  var container = document.getElementById('preview-container');
  var textEl = document.getElementById('preview-text');
  var statsEl = document.getElementById('preview-stats');
  if (!container || !textEl || !statsEl) return;

  // Show preview text
  var previewStr = (data.preview || '').trim();
  if (previewStr.length > 0) {
    textEl.textContent = previewStr + (data.totalChars > 300 ? '...' : '');
    textEl.classList.remove('empty-preview');
  } else if (data.isScreenshot) {
    textEl.textContent = 'Visual screenshot captured.';
    textEl.classList.remove('empty-preview');
  } else {
    textEl.textContent = '(No text content extracted)';
    textEl.classList.add('empty-preview');
  }

  // Show stats
  var stats = '';
  if (data.totalChars > 0) {
    stats = data.totalChars.toLocaleString() + ' chars';
  }
  if (data.filename) {
    stats += (stats ? '  \u00B7  ' : '') + data.filename;
  }
  statsEl.textContent = stats;

  // Show preview container, hide button groups
  container.style.display = 'block';
  var groups = document.querySelectorAll('.button-group');
  for (var i = 0; i < groups.length; i++) {
    groups[i].style.display = 'none';
  }
  var hint = document.querySelector('.shortcuts-hint');
  if (hint) hint.style.display = 'none';

  setButtonsDisabled(false);

  // Wire up Download button
  var dlBtn = document.getElementById('preview-download');
  var cancelBtn = document.getElementById('preview-cancel');

  if (dlBtn) {
    dlBtn.onclick = function () {
      dlBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      showStatus('Downloading...', 'loading');

      chrome.tabs.sendMessage(tabId, { action: 'download' }, function (resp) {
        if (chrome.runtime.lastError) {
          showError('Download failed: ' + (chrome.runtime.lastError.message || 'Lost connection to page.'));
          resetPreview();
          return;
        }
        if (resp && resp.success === false) {
          showError(resp.error || 'Download failed.');
          resetPreview();
          return;
        }
        showStatus('Downloaded!', 'success');
        setTimeout(function () { window.close(); }, 900);
      });
    };
  }

  // Wire up Cancel button
  if (cancelBtn) {
    cancelBtn.onclick = function () {
      chrome.tabs.sendMessage(tabId, { action: 'cancel' }, function () {
        // Ignore errors on cancel - just reset UI
      });
      resetPreview();
    };
  }
}

function resetPreview() {
  var container = document.getElementById('preview-container');
  if (container) container.style.display = 'none';

  // Restore button groups
  var groups = document.querySelectorAll('.button-group');
  for (var i = 0; i < groups.length; i++) {
    groups[i].style.display = '';
  }
  var hint = document.querySelector('.shortcuts-hint');
  if (hint) hint.style.display = '';

  setButtonsDisabled(false);

  var statusEl = document.getElementById('status-msg');
  if (statusEl) statusEl.style.display = 'none';

  var errEl = document.getElementById('error-msg');
  if (errEl) errEl.style.display = 'none';
}
