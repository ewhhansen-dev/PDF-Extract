if (!window.hasPDFConverterListener) {
  window.hasPDFConverterListener = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'convert') {
      const { format, scope } = request;
      handleConversion(format, scope);
    }
  });
}

async function handleConversion(format, scope) {
  let element;
  let htmlContent;
  let textContent;

  if (scope === 'selection') {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const container = document.createElement('div');
      container.appendChild(selection.getRangeAt(0).cloneContents());

      // For html2canvas
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.top = '0';
      container.style.width = '100%';
      container.style.zIndex = '-9999';
      container.style.backgroundColor = 'white';
      container.style.color = 'black';

      document.body.appendChild(container);
      element = container;
      htmlContent = container.innerHTML;
      textContent = container.innerText; // Extract text for pure text modes
      element.isTemp = true;
    } else {
      alert('No selection found.');
      return;
    }
  } else {
    element = document.body;
    htmlContent = document.body.innerHTML;
    // Clone body to safely manipulate for text extraction without affecting display
    const clone = document.body.cloneNode(true);
    // Remove scripts and styles to ensure pure text
    const scripts = clone.querySelectorAll('script, style, noscript');
    scripts.forEach(node => node.remove());
    textContent = clone.innerText;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  try {
    if (format === 'pdf') { // Screenshot PDF
        const filename = `capture-${timestamp}.pdf`;
        const canvas = await html2canvas(element, {
            useCORS: true,
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;

        const doc = new jsPDF('p', 'mm', 'a4');
        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position -= pageHeight;
          doc.addPage();
          doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        doc.save(filename);

    } else if (format === 'pdf-typewriter') { // Typewriter PDF
        const filename = `typewriter-${timestamp}.pdf`;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        doc.setFont("Courier", "normal");
        doc.setFontSize(12);

        const pageHeight = 297;
        const topMargin = 20;
        const bottomMargin = 20;
        const leftMargin = 20;
        const rightMargin = 20;
        const contentWidth = 210 - leftMargin - rightMargin;
        const lineHeight = 7; // Approx line height for 12pt

        const splitText = doc.splitTextToSize(textContent, contentWidth);

        let cursorY = topMargin;

        for (let i = 0; i < splitText.length; i++) {
            if (cursorY + lineHeight > pageHeight - bottomMargin) {
                doc.addPage();
                cursorY = topMargin;
            }
            doc.text(splitText[i], leftMargin, cursorY);
            cursorY += lineHeight;
        }

        doc.save(filename);

    } else if (format === 'md') {
        const filename = `capture-${timestamp}.md`;
        const turndownService = new TurndownService();
        const markdown = turndownService.turndown(htmlContent);
        downloadFile(filename, markdown, 'text/markdown');

    } else if (format === 'txt') {
        const filename = `capture-${timestamp}.txt`;
        downloadFile(filename, textContent, 'text/plain');
    }

  } catch (e) {
      console.error('Conversion failed', e);
      alert('Conversion failed: ' + e.message);
  } finally {
      if (element && element.isTemp) {
          element.remove();
      }
  }
}

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
