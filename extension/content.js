(function() {
  if (window.privacyTextExtractorInjected) return;
  window.privacyTextExtractorInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Make async
    (async () => {
      try {
        if (request.action === 'extract-page') {
          const text = extractText('page');
          downloadTXT(text);
          sendResponse({ status: 'success' });
        } else if (request.action === 'extract-selection') {
          const text = extractText('selection');
          downloadTXT(text);
          sendResponse({ status: 'success' });
        } else if (request.action === 'print-pdf') {
          const text = extractText('page'); // Default to page for PDF print
          printText(text);
          sendResponse({ status: 'success' });
        }
      } catch (err) {
        console.error('Extraction Error:', err);
        alert('Error: ' + err.message);
        sendResponse({ status: 'error', message: err.message });
      }
    })();
    return true; // Keep channel open
  });

  function extractText(scope) {
    let root;
    if (scope === 'selection') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
        throw new Error('No selection found.');
      }
      const container = document.createElement('div');
      for (let i = 0; i < selection.rangeCount; i++) {
        container.appendChild(selection.getRangeAt(i).cloneContents());
      }
      root = container;
    } else {
      // Heuristic: Prefer <article> if available and substantial
      const articles = document.querySelectorAll('article');
      let bestCandidate = document.body;
      let maxLen = 0;

      if (articles.length > 0) {
          articles.forEach(art => {
              if (art.innerText.length > maxLen) {
                  maxLen = art.innerText.length;
                  bestCandidate = art;
              }
          });
      }
      root = bestCandidate.cloneNode(true);
    }

    cleanDOM(root);
    let text = serializeDOM(root);
    return normalizeWhitespace(text);
  }

  function cleanDOM(node) {
    // Remove noise
    const noiseSelector = [
        'script', 'style', 'nav', 'footer', 'aside', 'noscript',
        '.ad', '.ads', '.advertisement', '.social-share',
        '[hidden]', '[aria-hidden="true"]', 'svg'
    ].join(',');

    const garbage = node.querySelectorAll(noiseSelector);
    garbage.forEach(el => el.remove());
  }

  function serializeDOM(node) {
    let text = '';

    node.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
            text += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName.toLowerCase();

            // Handle Placeholders
            if (tag === 'canvas') {
                text += `\n[Canvas content: ${child.width || '?'}x${child.height || '?'}]\n`;
                return;
            }
            if (tag === 'iframe') {
                text += `\n[Embedded content: iframe]\n`;
                return;
            }
            if (tag === 'img') {
                const alt = child.getAttribute('alt');
                if (alt) text += ` [Image: ${alt}] `;
                return;
            }

            // Structure handling
            const isBlock = ['div', 'p', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br'].includes(tag);

            let prefix = '';
            let suffix = '';

            if (/^h[1-6]$/.test(tag)) {
                prefix = '\n\n';
                suffix = '\n';
            } else if (tag === 'p') {
                prefix = '\n';
                suffix = '\n';
            } else if (tag === 'li') {
                prefix = '\n - ';
            } else if (tag === 'br') {
                text += '\n';
                return;
            } else if (isBlock) {
                // Generic block
                prefix = '\n';
            }

            text += prefix + serializeDOM(child) + suffix;
        }
    });
    return text;
  }

  function normalizeWhitespace(text) {
    return text
      .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace
      .replace(/\n\s+/g, '\n') // Trim start of lines
      .replace(/\s+\n/g, '\n') // Trim end of lines
      .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
      .trim();
  }

  function downloadTXT(text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `text_export_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function printText(text) {
      // Create a new window
      const win = window.open('', '_blank');
      if (!win) {
          alert('Popup blocked. Please allow popups to print.');
          return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Extracted Text</title>
          <style>
            body { font-family: monospace; white-space: pre-wrap; padding: 2em; max-width: 800px; margin: 0 auto; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${escapeHtml(text)}</body>
        <script>
            window.onload = () => {
                window.print();
            };
        </script>
        </html>
      `;

      win.document.write(html);
      win.document.close();
  }

  function escapeHtml(text) {
      const map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

})();
