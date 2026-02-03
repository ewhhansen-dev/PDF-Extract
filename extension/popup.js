document.addEventListener('DOMContentLoaded', () => {
  const buttons = {
    'extract-page': 'extract-page',
    'extract-selection': 'extract-selection',
    'print-pdf': 'print-pdf'
  };

  const status = document.getElementById('status');

  for (const [id, action] of Object.entries(buttons)) {
    const btn = document.getElementById(id);
    if (!btn) continue;

    btn.addEventListener('click', async () => {
      status.textContent = 'Processing...';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            status.textContent = 'Error: No active tab.';
            return;
        }

        // Inject content script
        // content.js checks window.privacyTextExtractorInjected to avoid re-execution logic
        // but we need to ensure it's loaded.
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        // Send message
        const response = await chrome.tabs.sendMessage(tab.id, { action });

        if (response && response.status === 'error') {
            status.textContent = 'Error: ' + response.message;
        } else {
            status.textContent = 'Done!';
            setTimeout(() => status.textContent = '', 3000);
        }
      } catch (err) {
        status.textContent = 'Error: ' + err.message;
        console.error(err);
      }
    });
  }
});
