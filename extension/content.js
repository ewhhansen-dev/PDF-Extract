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

  if (scope === 'selection') {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const container = document.createElement('div');
      container.appendChild(selection.getRangeAt(0).cloneContents());

      // Append to body to render (needed for html2canvas) but hide it from view
      // Using fixed positioning and z-index to avoid affecting layout flow significantly
      // but ensuring it's "rendered"
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.top = '0';
      container.style.width = '100%';
      container.style.zIndex = '-9999';
      container.style.backgroundColor = 'white'; // Ensure background is white
      container.style.color = 'black'; // Ensure text is visible

      document.body.appendChild(container);
      element = container;
      htmlContent = container.innerHTML;
      element.isTemp = true;
    } else {
      alert('No selection found.');
      return;
    }
  } else {
    element = document.body;
    htmlContent = document.body.innerHTML;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `capture-${timestamp}.${format}`;

  if (format === 'pdf') {
    try {
        const canvas = await html2canvas(element, {
            useCORS: true, // Attempt to load cross-origin images
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');

        const { jsPDF } = window.jspdf;
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
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

    } catch (e) {
        console.error('PDF conversion failed', e);
        alert('PDF conversion failed: ' + e.message);
    } finally {
        if (element.isTemp) {
            element.remove();
        }
    }
  } else if (format === 'md') {
      try {
        const turndownService = new TurndownService();
        // Customize turndown if needed
        const markdown = turndownService.turndown(htmlContent);

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
          console.error('MD conversion failed', e);
          alert('Markdown conversion failed: ' + e.message);
      } finally {
        if (element.isTemp) {
            element.remove();
        }
      }
  }
}
