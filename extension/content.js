if (!window.textExtractorInjected) {
  window.textExtractorInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Ensure Extractor is loaded
    if (!window.TextExtractor) {
        console.error("TextExtractor not loaded");
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
}
