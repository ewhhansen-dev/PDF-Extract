if (!window.pdfConverterInjected) {
  window.pdfConverterInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'pdf') {
      generatePDF(request.scope);
    } else if (request.type === 'md') {
      generateMD(request.scope);
    } else if (request.type === 'text') {
      generateText(request.scope);
    }
  });

  async function generatePDF(scope) {
    const { jsPDF } = window.jspdf;

    let element;
    let isTemp = false;

    if (scope === 'selection') {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        element = document.createElement('div');
        // Copy styles might be needed for better accuracy, but complex.
        // We wrap it in a div and append it to body to render it.
        element.style.position = 'absolute';
        element.style.left = '-9999px';
        element.style.top = '0';
        element.style.width = '1000px'; // Force a width for rendering
        element.style.backgroundColor = 'white';
        element.appendChild(range.cloneContents());
        document.body.appendChild(element);
        isTemp = true;
      } else {
        alert('No selection found');
        return;
      }
    } else {
      element = document.body;
    }

    try {
      const canvas = await html2canvas(element, {
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

      const doc = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'p' : 'l',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      doc.save(`document_${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF generation failed');
    } finally {
      if (isTemp && element) {
        document.body.removeChild(element);
      }
    }
  }

  function generateMD(scope) {
    const turndownService = new TurndownService();
    let html = '';

    if (scope === 'selection') {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const div = document.createElement('div');
        div.appendChild(selection.getRangeAt(0).cloneContents());
        html = div.innerHTML;
      } else {
        alert('No selection found');
        return;
      }
    } else {
      html = document.body.innerHTML;
    }

    try {
      const markdown = turndownService.turndown(html);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document_${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Markdown generation failed');
    }
  }

  function generateText(scope) {
    let text = '';

    if (scope === 'selection') {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        text = selection.toString();
      } else {
        alert('No selection found');
        return;
      }
    } else {
      text = document.body.innerText;
    }

    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Text generation failed');
    }
  }
}
