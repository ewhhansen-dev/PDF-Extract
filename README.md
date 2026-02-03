# Privacy-First Text Extractor

A browser extension to extract plain text from webpage content or selected text, with a focus on privacy and clean output.

## Features
- **Extract Text**: Convert full page or selected text to a clean `.txt` file.
- **Privacy First**: 100% user-controlled. No external API calls, no third-party libraries, everything runs locally.
- **Clean Output**: Intelligently removes ads, scripts, and noise. Preserves structure (headings, lists).
- **Print to PDF**: Use the browser's native print functionality to save extracted text as PDF.

## Installation

### From Source
1. Clone this repository.
2. Open Chrome/Edge/Brave and navigate to `chrome://extensions/`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked".
5. Select the `extension/` directory from this project.

## Usage
1. Click the extension icon in the toolbar.
2. Choose:
   - **Extract Page Text**: Downloads the main article content as a text file.
   - **Extract Selection Text**: Downloads the currently selected text.
   - **Print Text as PDF**: Opens a clean view of the text for printing/saving as PDF.

## Development
- **No Dependencies**: Pure JavaScript, HTML, and CSS.
- **Architecture**:
  - `manifest.json`: Manifest V3 configuration.
  - `popup.html/js`: UI and interaction logic.
  - `content.js`: Core extraction engine (DOM cleaning, serialization) and export handling.
