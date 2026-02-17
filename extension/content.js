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

    // Use deep extraction engine for selections too
    if (typeof extractPureText === 'function') {
      textContent = extractPureText(container);
    } else {
      textContent = container.innerText || container.textContent || '';
    }

  } else {
    element = document.body;
    htmlContent = document.body.innerHTML;

    // Use the deep extraction engine
    if (typeof extractPureText === 'function') {
      textContent = extractPureText(document.body);
    } else {
      // Fallback if text-extract.js did not load
      var clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(function (n) { n.remove(); });
      textContent = clone.innerText || '';
    }
  }

  // Build filename from page title
  var title = document.title
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60)
    || 'extract';
  var timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');

  try {
    if (format === 'txt') {
      var txtFilename = title + '_' + timestamp + '.txt';
      downloadFile(txtFilename, textContent, 'text/plain;charset=utf-8');

    } else if (format === 'pdf-typewriter') {
      var twFilename = title + '_typewriter_' + timestamp + '.pdf';
      var jsPDFConstructor = window.jspdf.jsPDF;
      var doc = new jsPDFConstructor({ orientation: 'p', unit: 'mm', format: 'a4' });

      doc.setFont('Courier', 'normal');
      doc.setFontSize(11);

      var margin = { top: 25, bottom: 25, left: 20, right: 20 };
      var contentWidth = 210 - margin.left - margin.right;
      var lineHeight = 5.5;
      var lines = doc.splitTextToSize(textContent, contentWidth);
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
      var pdfFilename = title + '_screenshot_' + timestamp + '.pdf';
      var canvas = await html2canvas(element, {
        useCORS: true,
        logging: false
      });

      var imgData = canvas.toDataURL('image/png');
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
      var mdFilename = title + '_' + timestamp + '.md';
      var turndownService = new TurndownService();
      var markdown = turndownService.turndown(htmlContent);
      downloadFile(mdFilename, markdown, 'text/markdown;charset=utf-8');

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
