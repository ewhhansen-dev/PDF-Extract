document.getElementById('pdf-typewriter-page').addEventListener('click', () => {
  injectAndRun('pdf-typewriter', 'page');
});

document.getElementById('txt-page').addEventListener('click', () => {
  injectAndRun('txt', 'page');
});

document.getElementById('pdf-typewriter-selection').addEventListener('click', () => {
  injectAndRun('pdf-typewriter', 'selection');
});

document.getElementById('txt-selection').addEventListener('click', () => {
  injectAndRun('txt', 'selection');
});

document.getElementById('pdf-page').addEventListener('click', () => {
  injectAndRun('pdf', 'page');
});

document.getElementById('pdf-selection').addEventListener('click', () => {
  injectAndRun('pdf', 'selection');
});

document.getElementById('md-page').addEventListener('click', () => {
  injectAndRun('md', 'page');
});

document.getElementById('md-selection').addEventListener('click', () => {
  injectAndRun('md', 'selection');
});

function injectAndRun(format, scope) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [
        'lib/jspdf.umd.min.js',
        'lib/html2canvas.min.js',
        'lib/turndown.js',
        'content.js'
      ]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
      }
      chrome.tabs.sendMessage(tabId, { action: 'convert', format: format, scope: scope });
      window.close();
    });
  });
}
