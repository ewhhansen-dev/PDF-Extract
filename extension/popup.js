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
  document.getElementById(id).addEventListener('click', () => {
    injectAndRun(config.format, config.scope);
  });
}

function injectAndRun(format, scope) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const tabId = tab.id;
    const url = tab.url || '';

    // Block injection into browser-internal pages (Brave, Chrome, Edge)
    if (url.startsWith('brave://') || url.startsWith('chrome://') ||
        url.startsWith('edge://') || url.startsWith('about:') ||
        url.startsWith('chrome-extension://') || url.startsWith('devtools://')) {
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
        // Provide specific guidance for common Brave/Chrome injection failures
        if (errMsg.includes('Cannot access') || errMsg.includes('cannot be scripted')) {
          showError('This page is protected by the browser and cannot be extracted.');
        } else {
          showError('Failed to load: ' + errMsg);
        }
        return;
      }
      chrome.tabs.sendMessage(tabId, {
        action: 'convert',
        format: format,
        scope: scope
      });
      window.close();
    });
  });
}

function showError(msg) {
  var el = document.getElementById('error-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'error-msg';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
}
