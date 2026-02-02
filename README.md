# Webpage to PDF/MD Converter

A browser extension to convert webpages or selected content to PDF or Markdown.

## Features
- Convert full page to PDF
- Convert selected text/area to PDF
- Convert full page to Markdown
- Convert selected text/area to Markdown
- Fully user-controlled, runs locally in the browser
- No dangerous permissions required

## Installation

### From Source
1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Copy the library files to the extension directory (already handled if you use the provided scripts/steps, but `npm install` is mainly for dev).
   - Ensure `extension/lib/` contains `jspdf.umd.min.js`, `html2canvas.min.js`, and `turndown.js`.
4. Open your browser's extension management page (e.g., `chrome://extensions`).
5. Enable **Developer mode** (usually a toggle in the top right).
6. Click **Load unpacked**.
7. Select the `extension/` directory from this project.

## Usage
1. Navigate to any webpage.
2. (Optional) Select some text or content on the page if you want to convert only a selection.
3. Click the extension icon in the browser toolbar.
4. Choose one of the options:
   - **Save Page as PDF**
   - **Save Selection as PDF**
   - **Save Page as Markdown**
   - **Save Selection as Markdown**
5. The converted file will be downloaded automatically.
