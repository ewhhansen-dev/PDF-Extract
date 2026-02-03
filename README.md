# Webpage Text Converter

A browser extension to convert webpage content or selected text into plain text files, with optional print-to-PDF.

## Features
- Convert full page or selected text to plain TXT.
- Print extracted text using the browser's native PDF printer.
- User-controlled: No external API calls, everything runs locally in the browser.
- Plain-text extraction only (no embedded markup or encodings in TXT).
- Non-text elements (e.g., canvas, images, iframes) are represented as plain-text placeholders.

## Installation

### From Source
1. Clone this repository.
2. Open Chrome/Edge/Brave and navigate to `chrome://extensions/`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked".
5. Select the `extension/` directory from this project.

## Usage
1. Click the extension icon in the toolbar.
2. Choose "Save Page Text" or "Save Selection Text" for TXT export, or "Print Page Text" / "Print Selection Text" for PDF printing.
3. TXT downloads automatically; PDF printing uses the browser's print dialog.

## Development
- No third-party libraries are used.
