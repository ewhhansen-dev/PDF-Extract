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
  let typeTimer = null;
  let fadeTimer = null;

  function typeStatus(text, className) {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    status.textContent = '';
    status.className = className || '';
    let i = 0;
    status.classList.add('typing');
    typeTimer = setInterval(() => {
      if (i < text.length) {
        status.textContent += text[i];
        i++;
      } else {
        clearInterval(typeTimer);
        typeTimer = null;
        setTimeout(() => status.classList.remove('typing'), 400);
        status.classList.add('typed');
        if (className === 'status-success' || className === 'status-error') {
          fadeTimer = setTimeout(() => status.classList.add('status-fade'), 3000);
        }
      }
    }, 40);
  }

  function setAllButtons(disabled) {
    document.querySelectorAll('button').forEach(b => b.disabled = disabled);
  }

  for (const [id, action] of Object.entries(buttons)) {
    const btn = document.getElementById(id);

    btn.addEventListener('pointerdown', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--ripple-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
      e.currentTarget.style.setProperty('--ripple-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });

    btn.addEventListener('click', async () => {
      typeStatus('Processing...', 'status-processing');
      btn.classList.add('is-active');
      setAllButtons(true);
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
        typeStatus('Done!', 'status-success');
      } catch (err) {
        typeStatus('Error: ' + err.message, 'status-error');
        console.error(err);
      } finally {
        btn.classList.remove('is-active');
        setAllButtons(false);
      }
    });
  }
});
