# Webpage to PDF/MD Converter

A browser extension to convert webpage content or selected text into PDF or Markdown files.

## Features
- Convert full page or selected text to PDF.
- Convert full page or selected text to Markdown.
- Convert full page or selected text to Plain Text (.txt).
- User-controlled: No external API calls, everything runs locally in the browser.

## Installation

### From Source
1. Clone this repository.
2. Open Chrome/Edge/Brave and navigate to `chrome://extensions/`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked".
5. Select the `extension/` directory from this project.

## Usage
1. Click the extension icon in the toolbar.
2. Choose "Save Page" or "Save Selection" under PDF or Markdown.
3. The file will download automatically.

## Development
- Dependencies are managed via `npm`.
- Libraries used:
  - [jsPDF](https://github.com/parallax/jsPDF)
  - [html2canvas](https://html2canvas.hertzen.com/)
  - [Turndown](https://github.com/mixmark-io/turndown)

To update dependencies:
```bash
npm install
# Then copy the dist files to extension/lib/ as needed
```
