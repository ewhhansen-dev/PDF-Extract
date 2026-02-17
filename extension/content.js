/**
 * content.js
 *
 * Orchestrates conversion for all formats.
 * Delegates pure text extraction to text-extract.js.
 */

if (!window.__contentConverterLoaded) {
  window.__contentConverterLoaded = true;

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'convert') {
      handleConversion(request.format, request.scope);
    }
  });
}

async function handleConversion(format, scope) {
  var element;
  var htmlContent;
  var textContent;

  if (scope === 'selection') {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      alert('No text selected. Please select some content first.');
      return;
    }

    var container = document.createElement('div');
    for (var i = 0; i < selection.rangeCount; i++) {
      container.appendChild(selection.getRangeAt(i).cloneContents());
    }

    // For screenshot PDF: append to DOM for html2canvas rendering
    if (format === 'pdf') {
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.top = '0';
      container.style.width = '100%';
      container.style.zIndex = '-9999';
      container.style.backgroundColor = 'white';
      container.style.color = 'black';
      document.body.appendChild(container);
      element = container;
      element._isTemp = true;
    }

    htmlContent = container.innerHTML;

    if (typeof extractPureText === 'function') {
      textContent = extractPureText(container);
    } else {
      textContent = container.innerText || container.textContent || '';
    }

  } else if (scope === 'modal') {
    var modalEl = findActiveModal();
    if (!modalEl) {
      alert('No popup, modal, or preview window detected on this page.');
      return;
    }

    element = modalEl;
    htmlContent = modalEl.innerHTML;

    if (typeof extractPureText === 'function') {
      textContent = extractPureText(modalEl);
    } else {
      textContent = modalEl.innerText || modalEl.textContent || '';
    }

  } else {
    element = document.body;
    htmlContent = document.body.innerHTML;

    if (typeof extractPureText === 'function') {
      textContent = extractPureText(document.body);
    } else {
      var clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(function (n) { n.remove(); });
      textContent = clone.innerText || '';
    }
  }

  // --- SMART FILENAME ---
  // Use first line of extracted text (up to 7 words), fall back to page title
  var smartName = buildSmartFilename(textContent);
  var timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');

  // --- INFO HEADER ---
  // Prepended to file exports (not clipboard, not screenshot PDF)
  var scopeLabel = scope === 'selection' ? 'Selection' : scope === 'modal' ? 'Popup/Preview' : 'Full page';
  var infoHeader = buildInfoHeader(document.title, window.location.href, scopeLabel, format);

  try {
    // --- CLIPBOARD ---
    if (format === 'clipboard') {
      await navigator.clipboard.writeText(textContent);
      showCopyNotice();
      return;
    }

    if (format === 'txt') {
      var txtFilename = smartName + '_' + timestamp + '.txt';
      var txtOutput = infoHeader + textContent;
      downloadFile(txtFilename, txtOutput, 'text/plain;charset=utf-8');

    } else if (format === 'pdf-typewriter') {
      var twFilename = smartName + '_typewriter_' + timestamp + '.pdf';
      var twOutput = infoHeader + textContent;
      var jsPDFConstructor = window.jspdf.jsPDF;
      var doc = new jsPDFConstructor({ orientation: 'p', unit: 'mm', format: 'a4' });

      doc.setFont('Courier', 'normal');
      doc.setFontSize(11);

      var margin = { top: 25, bottom: 25, left: 20, right: 20 };
      var contentWidth = 210 - margin.left - margin.right;
      var lineHeight = 5.5;
      var lines = doc.splitTextToSize(twOutput, contentWidth);
      var y = margin.top;

      for (var li = 0; li < lines.length; li++) {
        if (y + lineHeight > 297 - margin.bottom) {
          doc.addPage();
          y = margin.top;
        }
        doc.text(lines[li], margin.left, y);
        y += lineHeight;
      }

      doc.save(twFilename);

    } else if (format === 'pdf') {
      var pdfFilename = smartName + '_screenshot_' + timestamp + '.pdf';

      // Brave Browser: canvas fingerprint protection randomizes toDataURL.
      // allowTaint + useCORS helps Brave Shields pass through local renders.
      var canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        removeContainer: true
      });

      var imgData;
      try {
        imgData = canvas.toDataURL('image/png');
      } catch (canvasErr) {
        alert(
          'Screenshot PDF blocked by browser privacy protection (Brave Shields). ' +
          'Falling back to Typewriter PDF. To use Screenshot PDF, temporarily ' +
          'lower Shields for this site via the lion icon in the address bar.'
        );
        format = 'pdf-typewriter';
        handleConversion(format, scope);
        return;
      }

      // Brave canvas fingerprint protection: detect blank/randomized canvas.
      var ctx = canvas.getContext('2d');
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        var sample = ctx.getImageData(0, 0, Math.min(canvas.width, 100), 1).data;
        var allSame = true;
        for (var si = 4; si < sample.length; si += 4) {
          if (sample[si] !== sample[0] || sample[si+1] !== sample[1] ||
              sample[si+2] !== sample[2]) {
            allSame = false;
            break;
          }
        }
        if (allSame && sample.length > 4) {
          alert(
            'Screenshot appears blank due to Brave Shields fingerprint protection. ' +
            'Falling back to Typewriter PDF. To get a visual screenshot, lower ' +
            'Shields for this site via the lion icon.'
          );
          format = 'pdf-typewriter';
          handleConversion(format, scope);
          return;
        }
      }

      var jsPDFCtor = window.jspdf.jsPDF;
      var imgWidth = 210;
      var pageHeight = 297;
      var imgHeight = canvas.height * imgWidth / canvas.width;
      var heightLeft = imgHeight;

      var pdfDoc = new jsPDFCtor('p', 'mm', 'a4');
      var position = 0;

      pdfDoc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position -= pageHeight;
        pdfDoc.addPage();
        pdfDoc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdfDoc.save(pdfFilename);

    } else if (format === 'md') {
      var mdFilename = smartName + '_' + timestamp + '.md';
      var turndownService = new TurndownService();
      var markdown = turndownService.turndown(htmlContent);
      var mdHeader = '<!--\n' +
        'Title:  ' + document.title + '\n' +
        'URL:    ' + window.location.href + '\n' +
        'Date:   ' + new Date().toLocaleString() + '\n' +
        'Scope:  ' + scopeLabel + '\n' +
        '-->\n\n';
      downloadFile(mdFilename, mdHeader + markdown, 'text/markdown;charset=utf-8');

    } else {
      alert('Unknown format: ' + format);
    }

  } catch (e) {
    console.error('Conversion failed:', e);
    alert('Conversion failed: ' + e.message);
  } finally {
    if (element && element._isTemp) {
      element.remove();
    }
  }
}

// --- SMART FILENAME ---
// First line of content, up to 7 words, sanitized for filesystem

function buildSmartFilename(textContent) {
  var firstLine = (textContent || '').split('\n').filter(function (l) {
    return l.trim().length > 0;
  })[0] || '';

  // Take up to 7 words
  var words = firstLine.trim().split(/\s+/).slice(0, 7);
  var name = words.join(' ');

  // Sanitize: keep only letters, numbers, spaces, hyphens, underscores
  name = name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();

  // Replace spaces with underscores
  name = name.replace(/\s+/g, '_');

  // Limit length
  name = name.substring(0, 60);

  // Fallback to page title if empty or too short
  if (name.length < 3) {
    name = document.title
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 60)
      || 'extract';
  }

  return name;
}

// --- INFO HEADER ---
// Metadata block prepended to .txt and typewriter PDF exports

function buildInfoHeader(title, url, scopeLabel, format) {
  var formatLabels = {
    'txt': 'Plain text (.txt)',
    'pdf-typewriter': 'Typewriter PDF (.pdf)',
    'pdf': 'Screenshot PDF (.pdf)',
    'md': 'Markdown (.md)',
    'clipboard': 'Clipboard'
  };
  var now = new Date();
  var dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  var timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  var header = '========================================\n' +
    'Title:   ' + title + '\n' +
    'URL:     ' + url + '\n' +
    'Date:    ' + dateStr + '\n' +
    'Time:    ' + timeStr + '\n' +
    'Scope:   ' + scopeLabel + '\n' +
    'Format:  ' + (formatLabels[format] || format) + '\n' +
    '========================================\n\n';

  return header;
}

// --- CLIPBOARD FEEDBACK ---

function showCopyNotice() {
  var notice = document.createElement('div');
  notice.textContent = 'Copied to clipboard';
  notice.style.cssText =
    'position:fixed;top:20px;right:20px;z-index:2147483647;' +
    'padding:12px 20px;background:#1a1a2e;color:#fff;' +
    'border-radius:8px;font:600 14px Inter,system-ui,sans-serif;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.3s;' +
    'pointer-events:none;';
  document.body.appendChild(notice);
  setTimeout(function () {
    notice.style.opacity = '0';
    setTimeout(function () { notice.remove(); }, 300);
  }, 1500);
}

// --- DOWNLOAD ---

function downloadFile(filename, content, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- MODAL / POPUP / PREVIEW DETECTION ---

var MODAL_SELECTORS = [
  'dialog[open]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[class*="modal"]:not([class*="modal-backdrop"]):not([class*="modalOverlay"])',
  '[class*="Modal"]:not([class*="ModalBackdrop"]):not([class*="ModalOverlay"])',
  '[class*="dialog"]',
  '[class*="Dialog"]',
  '[class*="preview"]',
  '[class*="Preview"]',
  '[class*="lightbox"]',
  '[class*="Lightbox"]',
  '[class*="file-viewer"]',
  '[class*="FileViewer"]',
  '[class*="file-preview"]',
  '[class*="FilePreview"]',
  '[class*="popup-content"]',
  '[class*="PopupContent"]',
  '[class*="popover-content"]',
  '[class*="PopoverContent"]',
  '[class*="drawer-content"]',
  '[class*="DrawerContent"]',
  '[class*="sheet-content"]',
  '[class*="SheetContent"]',
  '.ReactModal__Content',
  '[data-testid*="modal"]',
  '[data-testid*="dialog"]',
  '[data-testid*="preview"]',
  '[class*="overlay-content"]',
  '[class*="OverlayContent"]'
];

function findActiveModal() {
  var candidates = [];
  var i, j, sel, els, el;

  for (i = 0; i < MODAL_SELECTORS.length; i++) {
    sel = MODAL_SELECTORS[i];
    try {
      els = document.querySelectorAll(sel);
      for (j = 0; j < els.length; j++) {
        candidates.push(els[j]);
      }
    } catch (e) { /* skip invalid selector */ }
  }

  candidates = Array.from(new Set(candidates));

  var visible = [];
  for (i = 0; i < candidates.length; i++) {
    el = candidates[i];
    if (!document.body.contains(el)) continue;

    var rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) continue;

    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;

    var text = (el.innerText || el.textContent || '').trim();
    if (text.length < 20) continue;

    var zIndex = parseInt(cs.zIndex, 10) || 0;
    var area = rect.width * rect.height;

    visible.push({
      el: el,
      zIndex: zIndex,
      textLen: text.length,
      area: area
    });
  }

  if (visible.length === 0) return null;

  visible.sort(function (a, b) {
    if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
    if (b.textLen !== a.textLen) return b.textLen - a.textLen;
    return b.area - a.area;
  });

  return visible[0].el;
}
