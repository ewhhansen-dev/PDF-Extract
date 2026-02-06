if (!window.textExtractorInjected) {
  window.textExtractorInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Ensure Extractor is loaded
    if (!window.TextExtractor) {
        console.error("TextExtractor not loaded");
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

    const text = window.TextExtractor.extract(document, request.scope);

    if (request.action === 'extract') {
        downloadText(text);
    } else if (request.action === 'print') {
        printText(text);
    }
  });

  function downloadText(text) {
    if (!text) {
        alert("No text extracted.");
        return;
    }
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_text_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printText(text) {
    if (!text) {
        alert("No text extracted.");
        return;
    }
    // Open a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
            <html>
            <head>
                <title>Print Text</title>
                <style>
                    body { font-family: monospace; white-space: pre-wrap; padding: 20px; }
                </style>
            </head>
            <body>${escapeHtml(text)}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { // Give time for rendering
            printWindow.print();
        }, 500);
    } else {
        alert("Popup blocked. Allow popups to print.");
    }
  }

  function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
