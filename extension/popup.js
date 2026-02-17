const buttons = {
  'txt-page':                { format: 'txt',            scope: 'page' },
  'txt-selection':           { format: 'txt',            scope: 'selection' },
  'pdf-typewriter-page':     { format: 'pdf-typewriter', scope: 'page' },
  'pdf-typewriter-selection':{ format: 'pdf-typewriter', scope: 'selection' },
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
    const tabId = tabs[0].id;

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
        console.error(chrome.runtime.lastError.message);
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
