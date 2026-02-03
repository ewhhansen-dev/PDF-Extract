document.addEventListener('DOMContentLoaded', () => {
  const buttons = {
    'txt-page': { type: 'txt', scope: 'page' },
    'txt-selection': { type: 'txt', scope: 'selection' },
    'pdf-page': { type: 'pdf', scope: 'page' },
    'pdf-selection': { type: 'pdf', scope: 'selection' }
  };

  const status = document.getElementById('status');

  for (const [id, action] of Object.entries(buttons)) {
    document.getElementById(id).addEventListener('click', async () => {
      status.textContent = 'Processing...';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
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
