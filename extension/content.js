if (!window.pdfConverterInjected) {
  window.pdfConverterInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'pdf') {
      generatePDF(request.scope);
    } else if (request.type === 'txt') {
      generateTXT(request.scope);
    }
  });

  function generatePDF(scope) {
    const text = extractText(scope);
    if (!text) {
      alert('No text found to print');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      alert('Unable to open print window');
      return;
    }

    const escapedText = escapeHtml(text);
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Text Export</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      pre { white-space: pre-wrap; word-break: break-word; font-size: 12pt; }
    </style>
  </head>
  <body>
    <pre>${escapedText}</pre>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function generateTXT(scope) {
    const text = extractText(scope);

    if (!text) {
      alert('No text found');
      return;
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function extractText(scope) {
    const root = getSourceRoot(scope);
    if (!root) {
      return '';
    }
    const workingRoot = root.cloneNode(true);
    sanitizeRoot(workingRoot);
    const text = buildText(workingRoot);
    return normalizeLines(text);
  }

  function getSourceRoot(scope) {
    if (scope === 'selection') {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) {
        alert('No selection found');
        return null;
      }
      const div = document.createElement('div');
      div.appendChild(selection.getRangeAt(0).cloneContents());
      return div;
    }

    const articles = Array.from(document.querySelectorAll('article'));
    if (articles.length > 0) {
      return articles.reduce((best, current) => {
        const bestLen = best.textContent.trim().length;
        const currentLen = current.textContent.trim().length;
        return currentLen > bestLen ? current : best;
      });
    }

    return document.body;
  }

  function sanitizeRoot(root) {
    const removeSelectors = [
      'script',
      'style',
      'nav',
      'footer',
      'aside',
      'noscript',
      'svg',
      'video',
      'audio',
      'form',
      'button',
      'input',
      'textarea',
      'select',
      '[role=\"navigation\"]',
      '[role=\"banner\"]',
      '[role=\"contentinfo\"]',
      '[aria-hidden=\"true\"]'
    ];
    root.querySelectorAll(removeSelectors.join(',')).forEach((node) => node.remove());
    root.querySelectorAll('[hidden]').forEach((node) => node.remove());
    root.querySelectorAll('[style*=\"display:none\"], [style*=\"visibility:hidden\"]').forEach((node) => node.remove());
  }

  function buildText(root) {
    const lines = [];
    let currentLine = '';

    const blockTags = new Set([
      'ADDRESS',
      'ARTICLE',
      'ASIDE',
      'BLOCKQUOTE',
      'DIV',
      'DL',
      'DT',
      'DD',
      'FIGCAPTION',
      'FIGURE',
      'FOOTER',
      'FORM',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'HEADER',
      'HR',
      'LI',
      'MAIN',
      'NAV',
      'OL',
      'P',
      'PRE',
      'SECTION',
      'TABLE',
      'THEAD',
      'TBODY',
      'TFOOT',
      'TR',
      'TD',
      'TH',
      'UL'
    ]);

    const headingTags = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

    const flushLine = () => {
      const trimmed = currentLine.trimEnd();
      if (trimmed.length > 0) {
        lines.push(trimmed);
      }
      currentLine = '';
    };

    const ensureBlankLine = () => {
      flushLine();
      if (lines.length === 0 || lines[lines.length - 1] !== '') {
        lines.push('');
      }
    };

    const addText = (text) => {
      if (!text) return;
      currentLine += text;
    };

    const addLine = (text) => {
      flushLine();
      lines.push(text);
    };

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = normalizeSpaces(node.textContent);
        addText(text);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const tag = node.tagName;

      if (tag === 'BR') {
        flushLine();
        return;
      }

      if (tag === 'CANVAS') {
        ensureBlankLine();
        const width = node.width || node.clientWidth || 0;
        const height = node.height || node.clientHeight || 0;
        const label = getNodeLabel(node);
        addLine(`[Canvas content: ${width}x${height}${label ? ` - ${label}` : ''}]`);
        ensureBlankLine();
        return;
      }

      if (tag === 'IFRAME') {
        ensureBlankLine();
        const label = getNodeLabel(node);
        addLine(`[Embedded content: iframe${label ? ` - ${label}` : ''}]`);
        ensureBlankLine();
        return;
      }

      if (tag === 'IMG') {
        const alt = getNodeLabel(node) || node.getAttribute('alt');
        ensureBlankLine();
        addLine(alt ? `[Image: ${alt}]` : '[Image]');
        ensureBlankLine();
        return;
      }

      if (headingTags.has(tag)) {
        ensureBlankLine();
        node.childNodes.forEach(walk);
        flushLine();
        ensureBlankLine();
        return;
      }

      if (tag === 'LI') {
        flushLine();
        addText('- ');
        node.childNodes.forEach(walk);
        flushLine();
        return;
      }

      if (tag === 'A') {
        node.childNodes.forEach(walk);
        const href = node.getAttribute('href');
        if (href) {
          addText(` (${href})`);
        }
        return;
      }

      if (blockTags.has(tag)) {
        ensureBlankLine();
        node.childNodes.forEach(walk);
        flushLine();
        ensureBlankLine();
        return;
      }

      node.childNodes.forEach(walk);
    };

    walk(root);
    flushLine();
    return lines.join('\n');
  }

  function normalizeSpaces(text) {
    return text.replace(/\s+/g, ' ');
  }

  function normalizeLines(text) {
    return text
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function getNodeLabel(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const label = node.getAttribute('aria-label') || node.getAttribute('title');
    if (label) {
      return label.trim();
    }
    const labelledBy = node.getAttribute('aria-labelledby');
    if (labelledBy) {
      const referenced = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((el) => el.textContent.trim())
        .find((text) => text.length > 0);
      return referenced || '';
    }
    return '';
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '\"': '&quot;',
      '\'': '&#039;'
    };
    return text.replace(/[&<>\"']/g, (char) => map[char]);
  }
}
