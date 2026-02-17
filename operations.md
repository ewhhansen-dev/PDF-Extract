# Pure Text & PDF Extractor - Operations Manual

## Download

### Option A: Clone from GitHub

```bash
git clone https://github.com/ewhhansen-dev/PDF-Extract.git
cd PDF-Extract
```

### Option B: Download ZIP

1. Go to the repository page on GitHub
2. Click the green **Code** button
3. Click **Download ZIP**
4. Extract the ZIP to any folder on your computer

The only folder you need for the extension is `extension/`. Everything else
(node_modules, test files) is for development only.

---

## Install

### Chrome / Chromium / Brave / Edge

1. Open your browser and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder inside the downloaded repository
5. The extension icon appears in your toolbar

No build step. No npm install. No API keys. No accounts.

### Firefox

Firefox support for Manifest V3 extensions is available in Firefox 109+.

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `extension/manifest.json` file

Note: Temporary add-ons in Firefox are removed when the browser closes.

### Verify Installation

- Click the extension icon in the toolbar
- You should see a popup with two groups of buttons:
  - **Pure Text (Typewriter)** - 4 blue buttons
  - **Standard** - 4 gray buttons

### Permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Read content of the tab you are viewing, only when you click the extension |
| `scripting` | Inject the extraction script into the current tab |

No other permissions. No storage. No cookies. No network requests. No
background processes. The extension does nothing until you click it.

---

## Operations

### Export Formats

| Button | Output | Description |
|---|---|---|
| **Page to .txt** | `.txt` file | Typewriter-grade pure text from entire page |
| **Selection to .txt** | `.txt` file | Typewriter-grade pure text from selected content |
| **Page to Typewriter PDF** | `.pdf` file | Pure text in Courier font, A4 pages |
| **Selection to Typewriter PDF** | `.pdf` file | Pure text PDF from selected content |
| **Page to Screenshot PDF** | `.pdf` file | Visual screenshot of the page as PDF |
| **Selection to Screenshot PDF** | `.pdf` file | Visual screenshot of selected area |
| **Page to Markdown** | `.md` file | HTML-to-Markdown conversion of page |
| **Selection to Markdown** | `.md` file | HTML-to-Markdown of selected content |

### How to Use

#### Full Page Export

1. Navigate to any webpage, chat thread, or canvas
2. Click the extension icon
3. Click the desired export button
4. The file downloads immediately to your default download folder

#### Selection Export

1. Highlight text on the page using your mouse (click and drag)
2. Click the extension icon
3. Click a **Selection** button
4. Only the selected content is exported

#### Filenames

Files are named using the page title and a timestamp:

```
PageTitle_2026-02-17T12-30-45.txt
PageTitle_typewriter_2026-02-17T12-30-45.pdf
PageTitle_screenshot_2026-02-17T12-30-45.pdf
PageTitle_2026-02-17T12-30-45.md
```

---

## What the .txt Export Produces

The `.txt` output reads as if someone sat at a typewriter and typed the
content. It contains:

- Letters, numbers, and standard punctuation
- Spaces and line breaks
- Tab characters (for table data)
- Nothing else

The `.txt` output does NOT contain:

- HTML tags or attributes
- CSS styles or class names
- JavaScript code or data attributes
- Zero-width characters or invisible Unicode
- Byte Order Marks (BOM)
- Direction override characters
- Soft hyphens or non-breaking spaces
- Smart quotes (converted to straight quotes)
- Em/en dashes (converted to hyphens)
- Navigation menus, sidebars, or footers
- Cookie banners or consent dialogs
- Button labels ("Copy", "Edit", "Retry")
- Form elements or input fields
- Image alt text, SVG content, or canvas data
- Advertising or tracking elements
- Any encoding that is not human-readable

### Sanitization Layers

Every `.txt` file passes through five layers before reaching your disk:

1. **DOM Surgery** - Removes 16 tag types (script, style, svg, iframe, etc.)
   plus 40+ CSS selector patterns targeting navigation, forms, toolbars,
   cookie banners, chat UI noise, sidebars, and ads.

2. **Hidden Element Removal** - Detects and strips elements with
   display:none, visibility:hidden, opacity:0, offscreen positioning,
   or zero dimensions.

3. **Control Character Strip** - Removes all bytes in ranges 0x00-0x08,
   0x0B, 0x0C, 0x0E-0x1F, 0x7F, and 0x80-0x9F (C0 and C1 control codes).

4. **Invisible Unicode Strip** - Removes 50+ categories of invisible
   Unicode codepoints: zero-width spaces, zero-width joiners, direction
   overrides, BOM markers, soft hyphens, variation selectors, interlinear
   annotations, and tag characters (including astral plane invisibles).

5. **Final Printable Filter** - Character-by-character codepoint scan that
   only passes through tab (0x09), newline (0x0A), printable ASCII
   (0x20-0x7E), and visible Unicode above U+00A0.

---

## Supported Content Types

### Chat Threads

When used on a chat interface (ChatGPT, Claude, Slack, Discord), the
extension automatically:

- Detects the conversation structure
- Labels each message with the speaker role (User, Assistant, System)
- Strips toolbar buttons, avatars, timestamps, and reaction controls
- Preserves code blocks with their formatting

Example .txt output from a chat:

```
User:
How do I reverse a string in Python?

Assistant:
You can reverse a string using slicing:

---
reversed_string = my_string[::-1]
---
```

### Standard Webpages

Extracts the main content while stripping:

- Navigation bars and menus
- Sidebars
- Footers
- Cookie banners and consent dialogs
- Advertisements
- Hidden elements

### Code Blocks

Code blocks are preserved with their whitespace and indentation intact,
delimited by `---` markers in the .txt output.

### Canvas / Rich Editors

Content from rich text editors (Claude canvas, Notion pages, Google Docs in
view mode) is extracted by walking the DOM tree and preserving document
structure as plain text.

---

## Troubleshooting

### "No text selected" error

Make sure you have highlighted text on the page before clicking a Selection
button. The selection must not be collapsed (zero-length).

### Empty or minimal output

Some pages load content dynamically. Wait for the page to fully load before
exporting. Single-page applications that render via JavaScript should work
as long as the content is visible in the DOM when you click export.

### Extension not appearing

Confirm that Developer mode is enabled in chrome://extensions/ and that you
selected the `extension/` folder (not the parent repository folder).

### Conversion failed error

Open the browser developer console (F12) to see the detailed error. Common
causes:

- CORS restrictions on screenshot PDF (cross-origin images)
- Very large pages exceeding memory limits

---

## Architecture

```
extension/
  manifest.json        Chrome MV3 extension manifest
  popup.html           Extension popup UI
  popup.css            Popup styling
  popup.js             Button handlers and script injection
  text-extract.js      Pure text extraction engine (zero dependencies)
  content.js           Format orchestrator (delegates to text-extract.js)
  lib/
    jspdf.umd.min.js   PDF generation library (bundled)
    html2canvas.min.js Screenshot-to-canvas library (bundled)
    turndown.js        HTML-to-Markdown library (bundled)
```

Libraries are only injected when needed:

| Format | Libraries Injected |
|---|---|
| .txt | text-extract.js + content.js only |
| Typewriter PDF | jspdf + text-extract.js + content.js |
| Screenshot PDF | jspdf + html2canvas + text-extract.js + content.js |
| Markdown | turndown + text-extract.js + content.js |

---

## Running Tests

Tests require Node.js (any version 14+). No npm install needed.

```bash
node test-suite.js     # 61 functional tests
node audit-bytes.js    # Byte-level source file audit
```

Both must report zero failures before any release.

---

## Security

- No API calls to any external service
- No data leaves the browser
- No personal data is accessed or stored
- No background scripts or persistent processes
- Only two permissions: activeTab and scripting
- All libraries are bundled locally (no CDN fetches)
- The .txt output is guaranteed free of hidden encodings at the byte level
