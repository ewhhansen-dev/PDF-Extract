document.addEventListener('DOMContentLoaded', () => {
  const buttons = {
    'pdf-page': { type: 'pdf', scope: 'page' },
    'pdf-selection': { type: 'pdf', scope: 'selection' },
    'md-page': { type: 'md', scope: 'page' },
    'md-selection': { type: 'md', scope: 'selection' },
    'text-page': { type: 'text', scope: 'page' },
    'text-selection': { type: 'text', scope: 'selection' }
  };

  const status = document.getElementById('status');

  for (const [id, action] of Object.entries(buttons)) {
    document.getElementById(id).addEventListener('click', async () => {
      status.textContent = 'Processing...';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'lib/jspdf.umd.min.js',
            'lib/html2canvas.min.js',
            'lib/turndown.js',
            'content.js'
          ]
        });

        await chrome.tabs.sendMessage(tab.id, action);
        status.textContent = 'Done!';
      } catch (err) {
        status.textContent = 'Error: ' + err.message;
        console.error(err);
      }
    });
  }
});
