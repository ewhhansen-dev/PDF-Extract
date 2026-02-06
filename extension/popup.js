document.addEventListener('DOMContentLoaded', () => {
  const buttons = {
    'extract-page': { action: 'extract', scope: 'page' },
    'extract-selection': { action: 'extract', scope: 'selection' },
    'print-text': { action: 'print', scope: 'page' }
    'pdf-page': { type: 'pdf', scope: 'page' },
    'pdf-selection': { type: 'pdf', scope: 'selection' },
    'md-page': { type: 'md', scope: 'page' },
    'md-selection': { type: 'md', scope: 'selection' },
    'text-page': { type: 'text', scope: 'page' },
    'text-selection': { type: 'text', scope: 'selection' }
  };

  const status = document.getElementById('status');

  for (const [id, config] of Object.entries(buttons)) {
    const btn = document.getElementById(id);
    if (!btn) continue;

    btn.addEventListener('click', async () => {
      status.textContent = 'Processing...';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
          status.textContent = 'No active tab found.';
          return;
        }

        // Inject scripts
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'lib/extractor.js',
            'content.js'
          ]
        });

        // Send message
        await chrome.tabs.sendMessage(tab.id, config);
        status.textContent = 'Done!';
      } catch (err) {
        status.textContent = 'Error: ' + (err.message || err);
        console.error(err);
      }
    });
  }
});
