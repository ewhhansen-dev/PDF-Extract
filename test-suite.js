/**
 * test-suite.js
 *
 * Comprehensive test suite for the PDF-Extract extension.
 * Tests: cross-references, JS integrity, text extraction purity,
 * byte-level output verification, and hidden encoding defense.
 *
 * Run: node test-suite.js
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log('  FAIL: ' + name + ' -- ' + e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

const EXT = path.join(__dirname, 'extension');

// ═══════════════════════════════════════════════════════════════
// SECTION 1: FILE EXISTENCE AND CROSS-REFERENCE VERIFICATION
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 1: File existence and cross-references ---');

test('manifest.json exists and is valid JSON', () => {
  const raw = fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8');
  const m = JSON.parse(raw);
  assert(m.manifest_version === 3, 'Must be Manifest V3');
  assert(m.action && m.action.default_popup === 'popup.html', 'Must reference popup.html');
  assert(Array.isArray(m.permissions), 'Must have permissions array');
  assert(m.permissions.includes('activeTab'), 'Must have activeTab permission');
  assert(m.permissions.includes('scripting'), 'Must have scripting permission');
  assert(m.permissions.includes('contextMenus'), 'Must have contextMenus permission');
  assert(m.permissions.length === 3, 'Must have ONLY activeTab, scripting, and contextMenus');
});

test('popup.html exists and references popup.css and popup.js', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  assert(html.includes('popup.css'), 'Must reference popup.css');
  assert(html.includes('popup.js'), 'Must reference popup.js');
});

test('popup.css exists and is non-empty', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.length > 50, 'CSS must have real content');
  assert(css.includes('button'), 'Must style buttons');
});

test('popup.js exists and references all button IDs from popup.html', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');

  // Extract all button IDs from HTML (only <button> elements, not divs)
  const idRegex = /<button[^>]+id="([^"]+)"/g;
  let match;
  const htmlIds = [];
  while ((match = idRegex.exec(html)) !== null) {
    htmlIds.push(match[1]);
  }

  assert(htmlIds.length === 15, 'Must have exactly 15 button IDs, found ' + htmlIds.length);

  for (const id of htmlIds) {
    assert(js.includes("'" + id + "'") || js.includes('"' + id + '"'),
      'popup.js must reference button ID: ' + id);
  }
});

test('popup.js references all library files that exist', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes('lib/jspdf.umd.min.js'), 'Must reference jspdf');
  assert(js.includes('lib/html2canvas.min.js'), 'Must reference html2canvas');
  assert(js.includes('lib/turndown.js'), 'Must reference turndown');
  assert(js.includes('text-extract.js'), 'Must reference text-extract.js');
  assert(js.includes('content.js'), 'Must reference content.js');
});

test('Library files exist', () => {
  assert(fs.existsSync(path.join(EXT, 'lib', 'jspdf.umd.min.js')), 'jspdf must exist');
  assert(fs.existsSync(path.join(EXT, 'lib', 'html2canvas.min.js')), 'html2canvas must exist');
  assert(fs.existsSync(path.join(EXT, 'lib', 'turndown.js')), 'turndown must exist');
});

test('text-extract.js exists and exposes extractPureText', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('window.extractPureText'), 'Must expose extractPureText on window');
});

test('content.js references extractPureText', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('extractPureText'), 'Must call extractPureText');
});

test('.gitignore exists and excludes node_modules', () => {
  const gi = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
  assert(gi.includes('node_modules'), 'Must exclude node_modules');
});

test('No unexpected permissions in manifest', () => {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  // Must NOT have permissions that access personal data
  const banned = [
    'cookies', 'history', 'bookmarks', 'tabs', 'identity',
    'webRequest', 'storage', 'downloads', 'geolocation',
    'clipboardRead', 'clipboardWrite', 'notifications',
    'management', 'topSites', 'browsingData', 'contentSettings'
  ];
  for (const p of banned) {
    assert(!m.permissions.includes(p), 'Must NOT have permission: ' + p);
  }
  // No host_permissions
  assert(!m.host_permissions, 'Must NOT have host_permissions');
  // No content_scripts (injection is done manually)
  assert(!m.content_scripts, 'Must NOT have content_scripts (manual injection only)');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: LIBRARY INJECTION EFFICIENCY
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 2: Library injection efficiency ---');

test('popup.js conditionally injects jspdf only for pdf formats', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  // Should not inject all libs unconditionally
  assert(!js.includes("files: [\n        'lib/jspdf"), 'Must NOT inject all libs in a static array');
  // Should have conditional logic
  assert(js.includes("format === 'pdf'") || js.includes('format === "pdf"'),
    'Must conditionally check for pdf format');
});

console.log('\n--- Section 2b: Brave Browser optimizations ---');

test('popup.js blocks brave:// and chrome:// internal pages', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes("brave://"), 'Must detect brave:// pages');
  assert(js.includes("chrome://"), 'Must detect chrome:// pages');
  assert(js.includes("edge://"), 'Must detect edge:// pages');
});

test('popup.js has error display function', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes('showError'), 'Must have showError function');
  assert(js.includes('error-msg'), 'Must reference error-msg element');
});

test('popup.html has error message container', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  assert(html.includes('error-msg'), 'Must have error-msg element');
});

test('popup.css has dark mode support for Brave', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.includes('prefers-color-scheme: dark'), 'Must support dark mode');
  assert(css.includes('Inter'), 'Must use Inter font (Brave native)');
});

test('popup.css has error message styling', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.includes('#error-msg'), 'Must style error message');
});

test('content.js handles Brave canvas fingerprint protection', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('allowTaint'), 'Must use allowTaint for Brave Shields');
  assert(js.includes('fingerprint') || js.includes('Shields') || js.includes('privacy protection'),
    'Must reference Brave fingerprint/Shields protection');
});

test('content.js falls back gracefully when canvas is blocked', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('canvasErr') || js.includes('catch'),
    'Must catch canvas export errors');
});

console.log('\n--- Section 2c: Right-click context menu ---');

test('background.js exists and registers context menu', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes('contextMenus.create'), 'Must register context menu items');
  assert(js.includes('contextMenus.onClicked'), 'Must handle menu clicks');
  assert(js.includes('onInstalled'), 'Must register on extension install');
});

test('background.js has parent menu with submenu items', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes('pdf-extract-parent'), 'Must have parent menu');
  assert(js.includes('parentId'), 'Must have child items under parent');
});

test('background.js context menu covers txt, typewriter PDF, and markdown', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes("format: 'txt'"), 'Must have txt format in context menu');
  assert(js.includes("format: 'pdf-typewriter'"), 'Must have typewriter PDF in context menu');
  assert(js.includes("format: 'md'"), 'Must have markdown in context menu');
});

test('background.js context menu includes modal scope', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes("scope: 'modal'"), 'Must have modal scope in context menu');
});

test('background.js blocks injection on browser internal pages', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes("brave://"), 'Must block brave:// in context menu handler');
  assert(js.includes("chrome://"), 'Must block chrome:// in context menu handler');
});

test('background.js injects scripts the same way as popup.js', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes('chrome.scripting.executeScript'), 'Must use scripting API');
  assert(js.includes('text-extract.js'), 'Must inject text-extract.js');
  assert(js.includes('content.js'), 'Must inject content.js');
  assert(js.includes("action: 'convert'"), 'Must send convert message');
});

test('manifest.json references background.js as service worker', () => {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert(m.background && m.background.service_worker === 'background.js',
    'Must have background.js as service_worker');
});

console.log('\n--- Section 2d: Modal/Popup extraction ---');

test('content.js handles modal scope', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes("scope === 'modal'"), 'Must handle modal scope');
  assert(js.includes('findActiveModal'), 'Must call findActiveModal');
});

test('content.js has modal detection selectors', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('MODAL_SELECTORS'), 'Must have MODAL_SELECTORS array');
  assert(js.includes('role="dialog"'), 'Must detect dialog role');
  assert(js.includes('dialog[open]'), 'Must detect HTML5 dialog');
  assert(js.includes('modal'), 'Must detect modal classes');
  assert(js.includes('preview') || js.includes('Preview'), 'Must detect preview classes');
  assert(js.includes('lightbox') || js.includes('Lightbox'), 'Must detect lightbox classes');
});

test('content.js findActiveModal filters by visibility and content', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('getBoundingClientRect'), 'Must check element dimensions');
  assert(js.includes('getComputedStyle'), 'Must check computed visibility');
  assert(js.includes('zIndex'), 'Must consider z-index for topmost modal');
});

test('content.js shows notice when no modal found', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('No popup, modal, or preview window detected'),
    'Must notify when no modal found');
});

test('popup.html has modal/popup button group', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  assert(html.includes('modal-group'), 'Must have modal-group class');
  assert(html.includes('Popup / Preview'), 'Must have Popup/Preview heading');
  assert(html.includes('txt-modal'), 'Must have txt-modal button');
  assert(html.includes('pdf-typewriter-modal'), 'Must have pdf-typewriter-modal button');
  assert(html.includes('md-modal'), 'Must have md-modal button');
  assert(html.includes('pdf-modal'), 'Must have pdf-modal button');
});

test('popup.js has modal button entries', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes("'txt-modal'"), 'Must have txt-modal entry');
  assert(js.includes("scope: 'modal'"), 'Must use modal scope');
});

test('popup.css has modal group styling', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.includes('.modal-group'), 'Must style modal-group');
});

test('content.js uses extractPureText for modal extraction', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const matches = js.match(/extractPureText/g);
  assert(matches && matches.length >= 3,
    'Must call extractPureText at least 3 times (page, selection, modal), found ' + (matches ? matches.length : 0));
});

console.log('\n--- Section 2e: Copy to clipboard ---');

test('content.js has clipboard format handler with fallback', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes("format === 'clipboard'"), 'Must handle clipboard format');
  assert(js.includes('navigator.clipboard.writeText'), 'Must use clipboard API');
  assert(js.includes('copyToClipboard'), 'Must have copyToClipboard wrapper');
  assert(js.includes('execCommand'), 'Must have execCommand fallback for SPAs');
});

test('content.js has copy success notification', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('showCopyNotice'), 'Must have showCopyNotice function');
  assert(js.includes('Copied to clipboard'), 'Must show copy confirmation text');
});

test('popup.html has clipboard button group', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  assert(html.includes('clipboard-group'), 'Must have clipboard-group class');
  assert(html.includes('clip-page'), 'Must have clip-page button');
  assert(html.includes('clip-selection'), 'Must have clip-selection button');
  assert(html.includes('clip-modal'), 'Must have clip-modal button');
});

test('popup.js has clipboard button entries', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes("'clip-page'"), 'Must have clip-page entry');
  assert(js.includes("format: 'clipboard'"), 'Must use clipboard format');
});

test('popup.css has clipboard group styling', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.includes('.clipboard-group'), 'Must style clipboard-group');
});

test('background.js has clipboard context menu items', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes('ctx-clip-page'), 'Must have clipboard page menu item');
  assert(js.includes("format: 'clipboard'"), 'Must map clipboard format');
});

console.log('\n--- Section 2f: Smart filenames ---');

test('content.js has buildSmartFilename function', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('buildSmartFilename'), 'Must have buildSmartFilename function');
  assert(js.includes('slice(0, 7)'), 'Must limit to 7 words');
});

test('content.js smart filename falls back to page title', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('document.title'), 'Must fall back to page title');
  assert(js.includes("name.length < 3"), 'Must check for too-short names');
});

console.log('\n--- Section 2g: Info header ---');

test('content.js has buildInfoHeader function', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('buildInfoHeader'), 'Must have buildInfoHeader function');
  assert(js.includes('========'), 'Must have header separator');
});

test('content.js info header includes title, URL, date, scope, format', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes("'Title:"), 'Header must include title field');
  assert(js.includes("'URL:"), 'Header must include URL field');
  assert(js.includes("'Date:"), 'Header must include date field');
  assert(js.includes("'Scope:"), 'Header must include scope field');
  assert(js.includes("'Format:"), 'Header must include format field');
});

test('content.js prepends header to txt and typewriter PDF', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('infoHeader + textContent'), 'Must prepend header to txt output');
  assert(js.includes('infoHeader + textContent'), 'Must prepend header to typewriter output');
});

test('content.js uses markdown comment header for .md files', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('<!--'), 'Markdown header must be an HTML comment');
  assert(js.includes('-->'), 'Markdown header must close comment');
});

test('content.js clipboard does NOT get info header', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  // clipboard handler should write textContent directly, not infoHeader + textContent
  const clipIdx = js.indexOf("format === 'clipboard'");
  const clipBlock = js.substring(clipIdx, clipIdx + 200);
  assert(clipBlock.includes('textContent') && !clipBlock.includes('infoHeader'),
    'Clipboard must copy raw text without info header');
});

console.log('\n--- Section 2h: Same-origin iframe extraction ---');

test('text-extract.js has extractSameOriginIframes function', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('extractSameOriginIframes'), 'Must have extractSameOriginIframes function');
});

test('text-extract.js tries contentDocument on iframes', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('contentDocument'), 'Must access iframe contentDocument');
  assert(js.includes('contentWindow'), 'Must access iframe contentWindow');
});

test('text-extract.js catches cross-origin SecurityError', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  const fnStart = js.indexOf('function extractSameOriginIframes');
  const fnEnd = js.indexOf('\n  // --- PHASE 1:', fnStart);
  const fnBlock = js.substring(fnStart, fnEnd);
  assert(fnBlock.includes('catch'), 'Must catch SecurityError for cross-origin iframes');
});

test('text-extract.js calls extractSameOriginIframes before clone', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  const iframeIdx = js.indexOf('extractSameOriginIframes(rootElement)');
  const cloneIdx = js.indexOf('rootElement.cloneNode(true)');
  assert(iframeIdx > 0 && cloneIdx > 0 && iframeIdx < cloneIdx,
    'Must extract iframe content before cloning (live DOM access needed)');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: TEXT EXTRACTION ENGINE INTEGRITY
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 3: Text extraction engine integrity ---');

test('text-extract.js has IIFE wrapper to prevent global pollution', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('(function ()') || js.includes('(function()'),
    'Must use IIFE wrapper');
  assert(js.includes("'use strict'") || js.includes('"use strict"'),
    'Must use strict mode');
});

test('text-extract.js has double-load protection', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('__textExtractLoaded'), 'Must check for double-load');
});

test('text-extract.js removes script tags', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("'script'"), 'Must strip script tags');
});

test('text-extract.js removes style tags', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("'style'"), 'Must strip style tags');
});

test('text-extract.js removes noscript tags', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("'noscript'"), 'Must strip noscript tags');
});

test('text-extract.js removes SVG elements', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("'svg'"), 'Must strip SVG elements');
});

test('text-extract.js removes iframe elements', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("'iframe'"), 'Must strip iframe elements');
});

test('text-extract.js removes canvas elements', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("'canvas'"), 'Must strip canvas elements');
});

test('text-extract.js removes nav elements', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("'nav'"), 'Must strip nav elements');
});

test('text-extract.js removes hidden elements (aria-hidden)', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('aria-hidden'), 'Must strip aria-hidden elements');
});

test('text-extract.js removes display:none elements', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("display === 'none'") || js.includes('display === "none"'),
    'Must detect display:none');
});

test('text-extract.js removes visibility:hidden elements', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("visibility === 'hidden'") || js.includes('visibility === "hidden"'),
    'Must detect visibility:hidden');
});

test('text-extract.js has chat thread detection', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('CHAT_CONTAINER_SELECTORS'), 'Must have chat container detection');
  assert(js.includes('MESSAGE_SELECTORS'), 'Must have message detection');
  assert(js.includes('tryExtractChat'), 'Must have chat extraction function');
  assert(js.includes('detectRole'), 'Must have role detection');
});

test('text-extract.js has code block preservation', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('CODE_BLOCK_SELECTORS'), 'Must detect code blocks');
  assert(js.includes('isCodeBlock'), 'Must have code block detection function');
  assert(js.includes('textContent'), 'Must use textContent for code (preserves whitespace)');
});

test('text-extract.js removes cookie banners', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('cookie'), 'Must target cookie banners');
  assert(js.includes('consent'), 'Must target consent dialogs');
});

test('text-extract.js removes form elements and buttons', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes("'form'"), 'Must strip form elements');
  assert(js.includes("'button'"), 'Must strip button elements');
  assert(js.includes("'input'"), 'Must strip input elements');
});

test('text-extract.js removes chat action buttons (Copy/Edit/Retry)', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('aria-label="Copy"'), 'Must strip Copy buttons');
  assert(js.includes('aria-label="Edit"'), 'Must strip Edit buttons');
  assert(js.includes('aria-label="Retry"'), 'Must strip Retry buttons');
});

test('text-extract.js strips Brave Browser UI noise', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('brave-rewards'), 'Must strip Brave Rewards');
  assert(js.includes('brave-wallet'), 'Must strip Brave Wallet');
  assert(js.includes('brave-news') || js.includes('BraveNews'), 'Must strip Brave News');
});

test('text-extract.js has Brave Speedreader detection', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('speedreader') || js.includes('Speedreader'),
    'Must detect Brave Speedreader');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4: INVISIBLE CHARACTER DEFENSE (THE CORE)
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 4: Invisible character defense ---');

test('text-extract.js strips control characters', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('CONTROL_CHARS'), 'Must have control char regex');
  assert(js.includes('\\x00'), 'Must target null bytes');
  assert(js.includes('\\x7F'), 'Must target DEL character');
});

test('text-extract.js strips zero-width characters', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  // Range \\u200B-\\u200F covers ZWSP(200B), ZWNJ(200C), ZWJ(200D), LRM(200E), RLM(200F)
  assert(js.includes('\\u200B'), 'Must target ZWSP / start of zero-width range');
  assert(js.includes('\\u200B-\\u200F') || (js.includes('\\u200C') && js.includes('\\u200D')),
    'Must target ZWNJ and ZWJ (via range or explicit)');
  assert(js.includes('\\uFEFF'), 'Must target BOM/ZWNBSP');
  assert(js.includes('\\u00AD'), 'Must target soft hyphen');
});

test('text-extract.js strips direction override characters', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('\\u202A') || js.includes('INVISIBLE_CHARS'), 'Must target LRE');
  assert(js.includes('\\u202E') || js.includes('\\u202A-\\u202E'), 'Must target RLO');
});

test('text-extract.js strips surrogate halves', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('SURROGATE_HALVES'), 'Must strip orphaned surrogates');
  assert(js.includes('\\uD800') && js.includes('\\uDFFF'), 'Must target surrogate range');
});

test('text-extract.js strips astral plane invisibles (tags, VS supplement)', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('stripAstralInvisibles'), 'Must have astral invisible stripper');
  assert(js.includes('0xE0001'), 'Must target Tag characters');
  assert(js.includes('0xE01EF'), 'Must target VS Supplement');
});

test('text-extract.js strips variation selectors', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('\\uFE00') || js.includes('\\uFE0F'), 'Must target variation selectors');
});

test('text-extract.js has final printable-only filter', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('filterToPrintable'), 'Must have final printable filter');
});

test('text-extract.js normalizes Unicode typography to ASCII', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('\\u2018') && js.includes('\\u2019'), 'Must normalize smart single quotes');
  assert(js.includes('\\u201C') && js.includes('\\u201D'), 'Must normalize smart double quotes');
  assert(js.includes('\\u2013') && js.includes('\\u2014'), 'Must normalize en/em dashes');
  assert(js.includes('\\u2026'), 'Must normalize ellipsis');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5: BYTE-LEVEL OUTPUT PURITY SIMULATION
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 5: Byte-level output purity simulation ---');

// We simulate the sanitizeOutput function in Node.js to verify
// that output bytes are clean.

// Reproduce the sanitization logic (must match text-extract.js sanitizeOutput exactly)
function sanitizeOutput(text) {
  // Step 1: Control chars except \t \n \r
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g, '');
  // Step 2: Invisible Unicode
  text = text.replace(/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFE00-\uFE0F\uFEFF\uFFF0-\uFFF8\uFFF9-\uFFFB]/g, '');
  // Step 3: Surrogate halves
  text = text.replace(/[\uD800-\uDFFF]/g, '');
  // Step 4: Astral plane invisibles (Tags, VS Supplement, Shorthand Format Controls)
  text = stripAstralInvisibles(text);
  // Step 5: Unicode typography to ASCII
  text = text.replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'");
  text = text.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');
  text = text.replace(/[\u2013\u2014\u2015\u2212]/g, '-');
  text = text.replace(/\u2026/g, '...');
  text = text.replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB]/g, '-');
  text = text.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  text = text.replace(/\u2044/g, '/');
  text = text.replace(/[\u2010\u2011\u2012\uFE58\uFE63\uFF0D]/g, '-');
  // Step 6: Normalize line endings
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  // Step 7-10: Collapse spaces and blank lines
  text = text.replace(/[^\S\n]+/g, ' ');
  text = text.replace(/ +$/gm, '');
  text = text.replace(/^ +/gm, '');
  text = text.replace(/\n{4,}/g, '\n\n\n');
  // Step 11-12: Trim and trailing newline
  text = text.trim() + '\n';
  // Step 13: Final printable filter
  text = filterToPrintable(text);
  return text;
}

function stripAstralInvisibles(text) {
  var result = '';
  var i = 0;
  while (i < text.length) {
    var cp = text.codePointAt(i);
    if ((cp >= 0xE0001 && cp <= 0xE007F) ||
        (cp >= 0xE0100 && cp <= 0xE01EF) ||
        (cp >= 0x1BCA0 && cp <= 0x1BCA3)) {
      i += 2;
      continue;
    }
    if (cp > 0xFFFF) {
      result += text.charAt(i) + text.charAt(i + 1);
      i += 2;
    } else {
      result += text.charAt(i);
      i += 1;
    }
  }
  return result;
}

function filterToPrintable(text) {
  var result = '';
  var i = 0;
  while (i < text.length) {
    var cp = text.codePointAt(i);
    if (cp === 0x09 || cp === 0x0A) {
      result += text.charAt(i); i += 1;
    } else if (cp >= 0x20 && cp <= 0x7E) {
      result += text.charAt(i); i += 1;
    } else if (cp >= 0x00A0 && cp <= 0xD7FF) {
      result += text.charAt(i); i += 1;
    } else if (cp >= 0xE000 && cp <= 0xFFFD) {
      result += text.charAt(i); i += 1;
    } else if (cp >= 0x10000 && cp <= 0x10FFFF) {
      result += text.charAt(i) + text.charAt(i + 1); i += 2;
    } else {
      i += (cp > 0xFFFF) ? 2 : 1;
    }
  }
  return result;
}

function isCleanByte(code) {
  // Allowed: \t(9), \n(10), printable ASCII (32-126)
  if (code === 9 || code === 10) return true;
  if (code >= 32 && code <= 126) return true;
  return false;
}

function isCleanForTypewriter(text) {
  // Strict: only bytes that a typewriter can produce
  const buf = Buffer.from(text, 'utf8');
  for (let i = 0; i < buf.length; i++) {
    if (!isCleanByte(buf[i])) return false;
  }
  return true;
}

test('Clean English text passes through unchanged', () => {
  const input = 'Hello, world!\nThis is a test.\nLine three.';
  const output = sanitizeOutput(input);
  assert(output === 'Hello, world!\nThis is a test.\nLine three.\n', 'Clean text should pass through');
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Smart quotes are normalized to straight quotes', () => {
  const input = '\u201CHello\u201D said \u2018World\u2019';
  const output = sanitizeOutput(input);
  assert(output.includes('"Hello"'), 'Double smart quotes must become straight: got ' + output);
  assert(output.includes("'World'"), 'Single smart quotes must become straight');
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Em dashes and en dashes become hyphens', () => {
  const input = 'word\u2014word\u2013word';
  const output = sanitizeOutput(input);
  assert(output === 'word-word-word\n', 'Dashes must become hyphens: got ' + JSON.stringify(output));
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Ellipsis becomes three dots', () => {
  const input = 'wait\u2026';
  const output = sanitizeOutput(input);
  assert(output === 'wait...\n', 'Ellipsis must become dots: got ' + JSON.stringify(output));
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Zero-width characters are completely removed', () => {
  const input = 'He\u200Bllo\u200CWo\u200Drld\uFEFF!';
  const output = sanitizeOutput(input);
  assert(output === 'HelloWorld!\n', 'Zero-width chars must be stripped: got ' + JSON.stringify(output));
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Non-breaking spaces become regular spaces', () => {
  const input = 'hello\u00A0world';
  const output = sanitizeOutput(input);
  assert(output === 'hello world\n', 'NBSP must become space: got ' + JSON.stringify(output));
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Control characters are stripped', () => {
  const input = 'Hello\x00\x01\x02\x03\x04\x05\x06\x07\x08World';
  const output = sanitizeOutput(input);
  assert(output === 'HelloWorld\n', 'Control chars must be stripped: got ' + JSON.stringify(output));
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('BOM (Byte Order Mark) is stripped', () => {
  const input = '\uFEFFHello World';
  const output = sanitizeOutput(input);
  assert(output === 'Hello World\n', 'BOM must be stripped: got ' + JSON.stringify(output));
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Direction override characters are stripped', () => {
  const input = '\u202AHello\u202B \u202CWorld\u202D!\u202E';
  const output = sanitizeOutput(input);
  assert(output === 'Hello World!\n', 'Direction overrides must be stripped: got ' + JSON.stringify(output));
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Soft hyphens are stripped', () => {
  const input = 'in\u00ADter\u00ADna\u00ADtion\u00ADal';
  const output = sanitizeOutput(input);
  assert(output === 'international\n', 'Soft hyphens must be stripped: got ' + JSON.stringify(output));
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Bullets become hyphens', () => {
  const input = '\u2022 Item one\n\u2022 Item two';
  const output = sanitizeOutput(input);
  assert(output.includes('- Item one'), 'Bullets must become hyphens: got ' + JSON.stringify(output));
  assert(isCleanForTypewriter(output), 'Output must be typewriter-clean bytes');
});

test('Multiple blank lines are collapsed', () => {
  const input = 'Line one\n\n\n\n\n\nLine two';
  const output = sanitizeOutput(input);
  assert(output === 'Line one\n\n\nLine two\n', 'Must collapse to max 2 blank lines: got ' + JSON.stringify(output));
});

test('Trailing whitespace is stripped from each line', () => {
  const input = 'Hello   \nWorld   \n';
  const output = sanitizeOutput(input);
  assert(!output.includes('   '), 'Trailing spaces must be stripped');
});

test('Mixed invisible characters in realistic chat output', () => {
  const input = '\uFEFF\u200BUser\u200C:\u00A0Hello\u2019s world\u2026\n\u200DAssistant\u200B: Here\u2019s\u00A0the\u2014answer.';
  const output = sanitizeOutput(input);
  assert(isCleanForTypewriter(output), 'Realistic chat must be typewriter-clean');
  assert(output.includes("User:"), 'Must preserve User role');
  assert(output.includes("Assistant:"), 'Must preserve Assistant role');
  assert(output.includes("Hello's world..."), 'Must normalize typography');
  assert(output.includes("Here's the-answer."), 'Must normalize all typography');
});

test('Carriage returns are normalized to newlines', () => {
  const input = 'Line1\r\nLine2\rLine3';
  const output = sanitizeOutput(input);
  assert(output === 'Line1\nLine2\nLine3\n', 'CR/CRLF must become LF: got ' + JSON.stringify(output));
});

test('Empty input produces minimal output', () => {
  const output = sanitizeOutput('');
  assert(output === '\n', 'Empty input must produce single newline');
});

test('Input of only invisible chars produces minimal output', () => {
  const output = sanitizeOutput('\u200B\u200C\u200D\uFEFF\u00AD');
  assert(output === '\n', 'All-invisible input must produce single newline');
});

// Final stress test: random invisible character injection
test('Stress test: 100 random invisible chars injected into text', () => {
  const invisibles = [
    '\u0000', '\u0001', '\u0002', '\u0003', '\u0004', '\u0005',
    '\u0006', '\u0007', '\u0008', '\u000B', '\u000C', '\u000E',
    '\u000F', '\u007F', '\u0080', '\u0090', '\u009F',
    '\u00AD', '\u034F', '\u061C', '\u200B', '\u200C', '\u200D',
    '\u200E', '\u200F', '\u202A', '\u202B', '\u202C', '\u202D',
    '\u202E', '\u2060', '\u2061', '\u2062', '\u2063', '\u2064',
    '\u2066', '\u2067', '\u2068', '\u2069', '\u206A', '\u206B',
    '\u206C', '\u206D', '\u206E', '\u206F', '\uFE00', '\uFE01',
    '\uFE0F', '\uFEFF', '\uFFF9', '\uFFFA', '\uFFFB'
  ];

  let input = 'The quick brown fox jumps over the lazy dog.';
  // Inject random invisible chars at random positions
  for (let i = 0; i < 100; i++) {
    const pos = Math.floor(Math.random() * input.length);
    const inv = invisibles[Math.floor(Math.random() * invisibles.length)];
    input = input.slice(0, pos) + inv + input.slice(pos);
  }

  const output = sanitizeOutput(input);
  assert(isCleanForTypewriter(output), 'Stress test output must be typewriter-clean');
  assert(output.includes('quick'), 'Original text must survive');
  assert(output.includes('brown'), 'Original text must survive');
  assert(output.includes('fox'), 'Original text must survive');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 6: BLOB DOWNLOAD VERIFICATION
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 6: Download mechanism verification ---');

test('content.js uses text/plain;charset=utf-8 for .txt downloads', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes("text/plain;charset=utf-8"), 'Must specify charset=utf-8 for .txt');
});

test('content.js uses Blob for downloads (no data: URI encoding)', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('new Blob'), 'Must use Blob for file generation');
  assert(js.includes('URL.createObjectURL'), 'Must use object URLs');
  assert(js.includes('URL.revokeObjectURL'), 'Must clean up object URLs');
  // Must NOT use base64 data URIs for text (which add encoding overhead)
  assert(!js.includes('btoa') || js.indexOf('btoa') > js.indexOf('function downloadFile'),
    'Must not use btoa for text content');
});

test('content.js does not add BOM to txt output', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  // BOM may appear in sanitizeHeaderField (which strips it) - check downloadFile doesn't add it
  const dlFn = js.substring(js.indexOf('function downloadFile'));
  assert(!dlFn.includes('\\uFEFF') && !dlFn.includes('\\xEF\\xBB\\xBF'),
    'downloadFile must NOT add BOM to output');
  // Also check the txt format handler doesn't prepend BOM
  const txtIdx = js.indexOf("format === 'txt'");
  const txtBlock = js.substring(txtIdx, txtIdx + 300);
  assert(!txtBlock.includes('\\uFEFF'), 'txt handler must NOT add BOM');
});

test('downloadFile creates and immediately removes anchor element', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('document.body.appendChild(a)'), 'Must append anchor');
  assert(js.includes('dispatchEvent') || js.includes('a.click()'), 'Must trigger click');
  assert(js.includes('document.body.removeChild(a)'), 'Must remove anchor after');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 7: SELECTION MODE PARITY
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 7: Selection mode parity ---');

test('content.js uses extractPureText for page, selection, and modal', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  // Count occurrences of extractPureText
  const matches = js.match(/extractPureText/g);
  assert(matches && matches.length >= 3,
    'Must call extractPureText at least 3 times (page, selection, modal), found ' + (matches ? matches.length : 0));
});

test('content.js captures all selection ranges (not just first)', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('selection.rangeCount') && js.includes('getRangeAt(i)'),
    'Must iterate over all selection ranges');
});

test('content.js checks for collapsed/empty selection', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('isCollapsed'), 'Must check for collapsed selection');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 8: KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 8: Keyboard shortcuts ---');

test('manifest.json defines keyboard shortcut commands', () => {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert(m.commands, 'Must have commands section');
  assert(m.commands['copy-page-text'], 'Must have copy-page-text command');
  assert(m.commands['page-to-txt'], 'Must have page-to-txt command');
  assert(m.commands['page-to-pdf'], 'Must have page-to-pdf command');
});

test('manifest.json commands have suggested keys', () => {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  for (const cmd of ['copy-page-text', 'page-to-txt', 'page-to-pdf']) {
    assert(m.commands[cmd].suggested_key, cmd + ' must have suggested_key');
    assert(m.commands[cmd].suggested_key.default, cmd + ' must have default key');
    assert(m.commands[cmd].description, cmd + ' must have description');
  }
});

test('background.js handles keyboard commands', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes('COMMAND_MAP'), 'Must have COMMAND_MAP');
  assert(js.includes('commands.onCommand'), 'Must listen for keyboard commands');
  assert(js.includes("'copy-page-text'"), 'Must map copy-page-text command');
  assert(js.includes("'page-to-txt'"), 'Must map page-to-txt command');
  assert(js.includes("'page-to-pdf'"), 'Must map page-to-pdf command');
});

test('background.js shares injection logic between menu and keyboard', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes('injectAndMessage'), 'Must have shared injectAndMessage function');
  // Both keyboard and context menu handlers must use it
  const matches = js.match(/injectAndMessage/g);
  assert(matches && matches.length >= 3,
    'injectAndMessage must be called from both handlers plus defined, found ' + (matches ? matches.length : 0));
});

// ═══════════════════════════════════════════════════════════════
// SECTION 9: LOADING FEEDBACK AND BETTER ERRORS
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 9: Loading feedback and better errors ---');

test('popup.html has status message element', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  assert(html.includes('status-msg'), 'Must have status-msg element');
});

test('popup.js has showStatus function for loading/success feedback', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes('showStatus'), 'Must have showStatus function');
  assert(js.includes('status-msg'), 'Must reference status-msg element');
  assert(js.includes("'loading'") || js.includes('"loading"'), 'Must have loading state');
  assert(js.includes("'success'") || js.includes('"success"'), 'Must have success state');
});

test('popup.js shows loading state before injection', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  // showStatus must be called before chrome.tabs.query
  const loadingIdx = js.indexOf("showStatus('Processing...'");
  const queryIdx = js.indexOf('chrome.tabs.query');
  assert(loadingIdx > 0 && queryIdx > 0 && loadingIdx < queryIdx,
    'Must show loading before starting injection');
});

test('popup.js shows success toast before closing', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes("'Downloaded!'") || js.includes('"Downloaded!"'), 'Must show Downloaded! for file exports');
  assert(js.includes("'Copied!'") || js.includes('"Copied!"'), 'Must show Copied! for clipboard');
  assert(js.includes('setTimeout') && js.includes('window.close'), 'Must delay close for user to see feedback');
});

test('popup.js disables buttons during processing', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes('setButtonsDisabled'), 'Must have setButtonsDisabled function');
  assert(js.includes('.disabled'), 'Must set disabled property on buttons');
});

test('popup.css has status message styling', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.includes('#status-msg'), 'Must style status-msg');
  assert(css.includes('.status-loading'), 'Must style loading state');
  assert(css.includes('.status-success'), 'Must style success state');
});

test('popup.css has disabled button styling', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.includes('button:disabled'), 'Must style disabled buttons');
});

test('popup.js has actionable Brave Shields error messages', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes('Shields') || js.includes('shields'), 'Must mention Brave Shields in errors');
  assert(js.includes('lion icon'), 'Must reference the Brave lion icon');
  assert(js.includes('handleInjectionError'), 'Must have handleInjectionError function');
});

test('popup.js handles CSP errors with actionable advice', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes('Content Security Policy') || js.includes('CSP'),
    'Must detect CSP errors');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 10: BUTTON TOOLTIPS AND SHORTCUTS HINT
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 10: Button tooltips and shortcuts hint ---');

test('popup.html buttons have title tooltips', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  // Count buttons with title attributes
  const btnWithTitle = (html.match(/<button[^>]+title="/g) || []).length;
  assert(btnWithTitle >= 15, 'All 15 buttons must have title tooltips, found ' + btnWithTitle);
});

test('popup.html tooltips explain format differences', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  assert(html.includes('Courier'), 'Typewriter tooltip must mention Courier font');
  assert(html.includes('searchable'), 'Typewriter tooltip must mention searchable');
  assert(html.includes('screenshot') || html.includes('snapshot'), 'Screenshot tooltip must describe visual capture');
  assert(html.includes('Markdown') || html.includes('formatting'), 'Markdown tooltip must describe formatting');
});

test('popup.html has keyboard shortcuts hint footer', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  assert(html.includes('shortcuts-hint'), 'Must have shortcuts-hint element');
  assert(html.includes('Ctrl+Shift'), 'Must show keyboard shortcuts');
});

test('popup.css has shortcuts hint styling', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.includes('.shortcuts-hint'), 'Must style shortcuts-hint');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 11: INFO HEADER PURITY SANITIZATION
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 11: Info header purity sanitization ---');

test('content.js has sanitizeHeaderField function', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('sanitizeHeaderField'), 'Must have sanitizeHeaderField function');
});

test('content.js sanitizeHeaderField strips invisible Unicode', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  // Must strip zero-width chars, direction overrides, BOM
  assert(js.includes('\\u200B') || js.includes('200B'), 'Must strip ZWSP');
  assert(js.includes('\\uFEFF') || js.includes('FEFF'), 'Must strip BOM');
});

test('content.js sanitizeHeaderField normalizes typography to ASCII', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const fnStart = js.indexOf('function sanitizeHeaderField');
  const fnEnd = js.indexOf('function buildInfoHeader');
  const fnBlock = js.substring(fnStart, fnEnd);
  assert(fnBlock.includes('\\u2018') || fnBlock.includes('\\u2019'), 'Must normalize smart quotes');
  assert(fnBlock.includes('\\u201C') || fnBlock.includes('\\u201D'), 'Must normalize double quotes');
  assert(fnBlock.includes('\\u2013') || fnBlock.includes('\\u2014'), 'Must normalize dashes');
});

test('content.js sanitizeHeaderField has final printable ASCII filter', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const fnStart = js.indexOf('function sanitizeHeaderField');
  const fnEnd = js.indexOf('function buildInfoHeader');
  const fnBlock = js.substring(fnStart, fnEnd);
  assert(fnBlock.includes('\\x20-\\x7E'), 'Must filter to printable ASCII range');
});

test('content.js buildInfoHeader uses sanitizeHeaderField for all dynamic fields', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const fnStart = js.indexOf('function buildInfoHeader');
  const fnEnd = js.indexOf('// --- VISUAL NOTIFICATIONS');
  const fnBlock = js.substring(fnStart, fnEnd);
  assert(fnBlock.includes('safeTitle'), 'Must sanitize title');
  assert(fnBlock.includes('safeUrl'), 'Must sanitize URL');
  assert(fnBlock.includes('safeDate'), 'Must sanitize date');
  assert(fnBlock.includes('safeTime'), 'Must sanitize time');
  assert(fnBlock.includes('safeScope'), 'Must sanitize scope');
  assert(fnBlock.includes('safeFormat'), 'Must sanitize format');
});

test('content.js markdown header also uses sanitizeHeaderField', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const mdIdx = js.indexOf("format === 'md'");
  const mdBlock = js.substring(mdIdx, mdIdx + 500);
  assert(mdBlock.includes('sanitizeHeaderField'), 'Markdown header must use sanitizeHeaderField');
});

// Simulate sanitizeHeaderField to verify its purity
function sanitizeHeaderField(str) {
  if (!str) return '';
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  str = str.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD\u034F\u061C\u180E\u2060-\u2064\u2066-\u206F]/g, '');
  str = str.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  str = str.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
  str = str.replace(/[\u2013\u2014]/g, '-');
  str = str.replace(/\u2026/g, '...');
  str = str.replace(/[\u00A0]/g, ' ');
  str = str.replace(/[^\x20-\x7E\t\n]/g, '');
  return str.trim();
}

test('sanitizeHeaderField: dirty title produces clean ASCII', () => {
  const dirty = '\uFEFFMy \u201CSmart\u201D Page\u2014Title\u200B';
  const clean = sanitizeHeaderField(dirty);
  assert(clean === 'My "Smart" Page-Title', 'Must sanitize to: My "Smart" Page-Title, got: ' + clean);
  assert(isCleanForTypewriter(clean + '\n'), 'Result must be typewriter-clean bytes');
});

test('sanitizeHeaderField: URL with invisible chars produces clean ASCII', () => {
  const dirty = 'https://example\u200B.com/path\u200D?q=hello\uFEFF';
  const clean = sanitizeHeaderField(dirty);
  assert(clean === 'https://example.com/path?q=hello', 'Must strip invisibles from URL, got: ' + clean);
  assert(isCleanForTypewriter(clean + '\n'), 'URL must be typewriter-clean bytes');
});

test('sanitizeHeaderField: empty and null inputs handled', () => {
  assert(sanitizeHeaderField('') === '', 'Empty string returns empty');
  assert(sanitizeHeaderField(null) === '', 'Null returns empty');
  assert(sanitizeHeaderField(undefined) === '', 'Undefined returns empty');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 12: SPA COMPATIBILITY AND CHATGPT FIXES
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 12: SPA compatibility and ChatGPT fixes ---');

test('content.js uses DOM notifications instead of alert()', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('showNotice'), 'Must have showNotice function');
  // Should NOT use alert() for user-facing messages
  const alertCount = (js.match(/\balert\s*\(/g) || []).length;
  assert(alertCount === 0, 'Must not use alert() (blocked on SPAs), found ' + alertCount + ' occurrences');
});

test('content.js showNotice supports error, warn, and success types', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const fnStart = js.indexOf('function showNotice');
  const fnEnd = js.indexOf('function showCopyNotice');
  const fnBlock = js.substring(fnStart, fnEnd);
  assert(fnBlock.includes("'error'") || fnBlock.includes('"error"'), 'Must handle error type');
  assert(fnBlock.includes("'warn'") || fnBlock.includes('"warn"'), 'Must handle warn type');
  assert(fnBlock.includes('z-index'), 'Must use high z-index for visibility');
});

test('content.js downloadFile uses non-bubbling click for SPA compatibility', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const fnStart = js.indexOf('function downloadFile');
  const fnEnd = js.indexOf('// --- MODAL');
  const fnBlock = js.substring(fnStart, fnEnd);
  assert(fnBlock.includes('dispatchEvent'), 'Must use dispatchEvent instead of .click()');
  assert(fnBlock.includes('bubbles: false') || fnBlock.includes('bubbles:false'),
    'Must use non-bubbling click to bypass React/SPA event delegation');
});

test('content.js has clipboard API fallback via execCommand', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('copyToClipboard'), 'Must have copyToClipboard function');
  assert(js.includes('navigator.clipboard.writeText'), 'Must try modern clipboard API first');
  assert(js.includes("execCommand('copy')"), 'Must fall back to execCommand');
  assert(js.includes('textarea'), 'Must use hidden textarea for execCommand fallback');
});

test('content.js handles empty extraction results', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('textContent.trim().length === 0') || js.includes('textContent.trim().length===0'),
    'Must check for empty extraction result');
  assert(js.includes('No extractable text'), 'Must show message for empty extraction');
});

test('text-extract.js has ChatGPT-specific chat selectors', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('conversation-turn'), 'Must detect ChatGPT conversation turns');
  assert(js.includes('data-message-id'), 'Must detect ChatGPT message IDs');
  assert(js.includes("main [role=\"presentation\"]") || js.includes("main .flex"),
    'Must detect ChatGPT main conversation container');
});

test('text-extract.js chat detection searches messages across containers', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  const fnStart = js.indexOf('function tryExtractChat');
  const fnEnd = js.indexOf('function detectRole');
  const fnBlock = js.substring(fnStart, fnEnd);
  // Must try finding messages directly on root as fallback
  assert(fnBlock.includes('Strategy 2') || fnBlock.includes('root.querySelectorAll'),
    'Must have fallback to search messages on root element');
});

test('text-extract.js detectRole checks descendant data-message-author-role', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  const fnStart = js.indexOf('function detectRole');
  const fnEnd = js.indexOf('// --- PHASE 4:');
  const fnBlock = js.substring(fnStart, fnEnd);
  assert(fnBlock.includes("querySelector('[data-message-author-role]'"),
    'Must search descendants for role attribute (ChatGPT turns)');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 13: PRE-RELEASE AUDIT FIX VERIFICATION
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 13a: Extension icons and manifest ---');

test('manifest.json has icons field with 16, 48, 128 sizes', () => {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert(m.icons, 'Must have icons field');
  assert(m.icons['16'], 'Must have 16px icon');
  assert(m.icons['48'], 'Must have 48px icon');
  assert(m.icons['128'], 'Must have 128px icon');
});

test('manifest.json action has default_icon', () => {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert(m.action.default_icon, 'Must have default_icon in action');
  assert(m.action.default_icon['16'], 'default_icon must have 16px');
  assert(m.action.default_icon['128'], 'default_icon must have 128px');
});

test('icon files exist and are valid PNG', () => {
  for (const size of ['16', '48', '128']) {
    const iconPath = path.join(EXT, 'icons', 'icon' + size + '.png');
    assert(fs.existsSync(iconPath), 'Icon ' + size + 'px must exist');
    const buf = fs.readFileSync(iconPath);
    // PNG magic bytes: 0x89 0x50 0x4E 0x47
    assert(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47,
      'Icon ' + size + ' must be valid PNG (check magic bytes)');
    assert(buf.length > 50, 'Icon ' + size + ' must have real content (' + buf.length + ' bytes)');
  }
});

console.log('\n--- Section 13b: Keyboard shortcuts do not conflict ---');

test('keyboard shortcuts avoid Ctrl+Shift+C and Ctrl+Shift+T', () => {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  for (const cmd of Object.keys(m.commands)) {
    const key = m.commands[cmd].suggested_key;
    if (key && key.default) {
      assert(!key.default.includes('Ctrl+Shift+C'),
        cmd + ' must NOT use Ctrl+Shift+C (browser Inspect Element)');
      assert(!key.default.includes('Ctrl+Shift+T'),
        cmd + ' must NOT use Ctrl+Shift+T (browser Reopen Tab)');
      assert(!key.default.includes('Ctrl+Shift+I'),
        cmd + ' must NOT use Ctrl+Shift+I (browser DevTools)');
      assert(!key.default.includes('Ctrl+Shift+J'),
        cmd + ' must NOT use Ctrl+Shift+J (browser Console)');
      assert(!key.default.includes('Ctrl+Shift+N'),
        cmd + ' must NOT use Ctrl+Shift+N (browser Incognito)');
    }
  }
});

test('popup.html shortcuts hint matches manifest keys', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  // Extract the actual shortcut letters from manifest
  const copyKey = m.commands['copy-page-text'].suggested_key.default;
  const txtKey = m.commands['page-to-txt'].suggested_key.default;
  const pdfKey = m.commands['page-to-pdf'].suggested_key.default;
  // Shortcuts hint should contain the actual keys
  assert(html.includes(copyKey), 'Shortcuts hint must show copy key: ' + copyKey);
  assert(html.includes(txtKey), 'Shortcuts hint must show txt key: ' + txtKey);
  assert(html.includes(pdfKey), 'Shortcuts hint must show pdf key: ' + pdfKey);
});

test('popup.html button tooltips match manifest shortcut keys', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const copyKey = m.commands['copy-page-text'].suggested_key.default;
  const txtKey = m.commands['page-to-txt'].suggested_key.default;
  // Buttons that show shortcuts in their title must match manifest
  const clipPageBtn = html.match(/id="clip-page"[^>]*title="([^"]*)"/);
  if (clipPageBtn) {
    assert(clipPageBtn[1].includes(copyKey),
      'clip-page tooltip must include ' + copyKey + ', got: ' + clipPageBtn[1]);
  }
  const txtPageBtn = html.match(/id="txt-page"[^>]*title="([^"]*)"/);
  if (txtPageBtn) {
    assert(txtPageBtn[1].includes(txtKey),
      'txt-page tooltip must include ' + txtKey + ', got: ' + txtPageBtn[1]);
  }
});

console.log('\n--- Section 13c: background.js injection parity with popup.js ---');

test('background.js injects html2canvas for pdf format', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes('html2canvas.min.js'), 'Must inject html2canvas');
  assert(js.includes("format === 'pdf'"), 'Must check for pdf format');
});

test('background.js injects jspdf for both pdf and pdf-typewriter', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  // Should check for pdf OR pdf-typewriter
  assert(js.includes("format === 'pdf' || format === 'pdf-typewriter'") ||
    js.includes("format === 'pdf-typewriter' || format === 'pdf'"),
    'Must inject jspdf for both pdf formats');
});

test('background.js and popup.js inject identical library sets per format', () => {
  const bg = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  const popup = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  // Both must reference the same library files
  assert(bg.includes('lib/jspdf.umd.min.js'), 'background.js must have jspdf');
  assert(bg.includes('lib/html2canvas.min.js'), 'background.js must have html2canvas');
  assert(bg.includes('lib/turndown.js'), 'background.js must have turndown');
  assert(popup.includes('lib/jspdf.umd.min.js'), 'popup.js must have jspdf');
  assert(popup.includes('lib/html2canvas.min.js'), 'popup.js must have html2canvas');
  assert(popup.includes('lib/turndown.js'), 'popup.js must have turndown');
});

console.log('\n--- Section 13d: Popup waits for content script response ---');

test('popup.js uses sendMessage callback to wait for response', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  // Must have a callback in sendMessage
  assert(js.includes('sendMessage(tabId,') || js.includes('sendMessage(tabId ,'),
    'Must call sendMessage with tabId');
  assert(js.includes('function (response)') || js.includes('function(response)'),
    'Must have response callback in sendMessage');
});

test('popup.js shows error when content script reports failure', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes('response.success === false') || js.includes('response && response.success'),
    'Must check response.success for failure');
  assert(js.includes('response.error'), 'Must display error from response');
});

test('popup.js shows success only after receiving response', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  // Downloaded!/Copied! must appear INSIDE the response callback, not before
  const callbackIdx = js.indexOf('function (response)') !== -1
    ? js.indexOf('function (response)')
    : js.indexOf('function(response)');
  const successIdx = js.indexOf("'Downloaded!'");
  assert(callbackIdx > 0, 'Must have response callback');
  assert(successIdx > callbackIdx,
    'Success message must appear after response callback start');
});

test('content.js returns structured response from handleConversion', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('return { success: true'), 'Must return success objects');
  assert(js.includes('return { success: false'), 'Must return failure objects');
  assert(js.includes('return true; // keep message channel open'),
    'Must return true from onMessage to keep channel open for async');
});

test('content.js sendResponse is called on both success and failure paths', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('sendResponse(result'), 'Must call sendResponse with result');
  assert(js.includes('sendResponse({ success: false'), 'Must call sendResponse on catch');
});

console.log('\n--- Section 13e: URL.revokeObjectURL timeout ---');

test('content.js revokeObjectURL uses >= 30s timeout', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const match = js.match(/revokeObjectURL.*?(\d+)\s*\)/);
  assert(match, 'Must have revokeObjectURL with timeout');
  const ms = parseInt(match[1], 10);
  assert(ms >= 30000, 'revokeObjectURL timeout must be >= 30s, got ' + ms + 'ms');
});

console.log('\n--- Section 13f: document.body null check ---');

test('content.js checks document.body before accessing it for page scope', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('!document.body'), 'Must check for null document.body');
  assert(js.includes('No page content found') || js.includes('not an HTML document'),
    'Must show error message for missing body');
});

console.log('\n--- Section 13g: popup.js null safety ---');

test('popup.js checks getElementById result before addEventListener', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  // Must have a null check pattern: getElementById -> check -> addEventListener
  assert(js.includes('if (btn)') || js.includes('if(btn)'),
    'Must check element exists before adding listener');
});

test('popup.js checks tabs array before accessing tabs[0]', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes('!tabs || !tabs[0]') || js.includes('!tabs[0]'),
    'Must check tabs[0] exists');
});

console.log('\n--- Section 13h: Markdown body sanitization ---');

test('content.js has sanitizeMarkdownBody function', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('sanitizeMarkdownBody'), 'Must have sanitizeMarkdownBody function');
});

test('content.js calls sanitizeMarkdownBody on markdown output', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const mdIdx = js.indexOf("format === 'md'");
  const mdBlock = js.substring(mdIdx, mdIdx + 500);
  assert(mdBlock.includes('sanitizeMarkdownBody(markdown)'),
    'Must call sanitizeMarkdownBody on turndown output');
});

test('sanitizeMarkdownBody strips invisible chars but preserves Unicode text', () => {
  // Reproduce sanitizeMarkdownBody to test
  function sanitizeMarkdownBody(text) {
    if (!text) return '';
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g, '');
    text = text.replace(/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFE00-\uFE0F\uFEFF\uFFF0-\uFFF8\uFFF9-\uFFFB]/g, '');
    text = text.replace(/[\uD800-\uDFFF]/g, '');
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    return text;
  }
  // Should strip invisibles
  const dirty = '# Hello\u200B World\uFEFF\n\nCaf\u00E9 \u00FCber \u2014 dash';
  const clean = sanitizeMarkdownBody(dirty);
  assert(clean === '# Hello World\n\nCaf\u00E9 \u00FCber \u2014 dash',
    'Must strip invisibles but keep Unicode: got ' + JSON.stringify(clean));
  // Should preserve accented characters
  assert(clean.includes('\u00E9'), 'Must preserve accented e');
  assert(clean.includes('\u00FC'), 'Must preserve umlaut u');
  // Should preserve em dash (markdown allows it)
  assert(clean.includes('\u2014'), 'Must preserve em dash in markdown');
  // Should strip control chars
  assert(sanitizeMarkdownBody('a\x00b\x01c') === 'abc', 'Must strip control chars');
  // Should normalize line endings
  assert(sanitizeMarkdownBody('a\r\nb\rc') === 'a\nb\nc', 'Must normalize CRLF');
});

console.log('\n--- Section 13i: Background.js error feedback ---');

test('background.js has flashBadge function for error feedback', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes('flashBadge'), 'Must have flashBadge function');
  assert(js.includes('setBadgeText'), 'Must use chrome.action.setBadgeText');
  assert(js.includes('setBadgeBackgroundColor'), 'Must set badge color');
});

test('background.js flashes badge on injection failure', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  // After lastError check, must flash badge
  const errorIdx = js.indexOf('PDF Extract injection failed');
  assert(errorIdx > 0, 'Must log injection failure');
  const afterError = js.substring(errorIdx, errorIdx + 200);
  assert(afterError.includes('flashBadge'), 'Must flash badge on injection failure');
});

test('background.js flashes badge on blocked URL', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  // URL blocklist section must flash badge
  const blockIdx = js.indexOf("url.startsWith('brave://')");
  const blockEnd = js.indexOf('var files', blockIdx);
  const blockSection = js.substring(blockIdx, blockEnd);
  assert(blockSection.includes('flashBadge'), 'Must flash badge when URL is blocked');
});

test('background.js blocks additional URL schemes (view-source, data, blob)', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes("view-source:"), 'Must block view-source: URLs');
  assert(js.includes("'data:'") || js.includes("data:"), 'Must block data: URLs');
  assert(js.includes("'blob:'") || js.includes("blob:"), 'Must block blob: URLs');
});

console.log('\n--- Section 13j: popup.html accessibility ---');

test('popup.html has lang attribute on html element', () => {
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8');
  assert(html.includes('lang="en"') || html.includes("lang='en'"),
    'Must have lang="en" on html element for accessibility');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 14: REGRESSION FIX VERIFICATION
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 14a: Brave fallback returns recursive result ---');

test('content.js Brave canvas fallbacks use return (not fire-and-forget)', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  // Both Brave fallback paths must return the recursive handleConversion call
  // so the promise chain propagates the result back to sendResponse
  assert(js.includes('return handleConversion(format, scope);'),
    'Brave fallback must return the recursive handleConversion call');
  // Must NOT have fire-and-forget pattern (handleConversion followed by bare return)
  assert(!js.includes('handleConversion(format, scope);\n        return;'),
    'Must NOT have fire-and-forget handleConversion followed by bare return');
});

console.log('\n--- Section 14b: showNotice guards document.body ---');

test('content.js showNotice guards against null document.body', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const fnStart = js.indexOf('function showNotice');
  const fnBlock = js.substring(fnStart, fnStart + 200);
  assert(fnBlock.includes('!document.body'),
    'showNotice must check document.body before appendChild');
});

console.log('\n--- Section 14c: Popup sendMessage timeout safety ---');

test('popup.js has timeout safety net for sendMessage', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes('safetyTimer') || js.includes('timeout') || js.includes('timed out'),
    'Must have a timeout safety net for sendMessage callback');
  assert(js.includes('clearTimeout'), 'Must clear timeout on successful response');
});

test('popup.js URL blocklist includes view-source, data, blob', () => {
  const js = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  assert(js.includes("view-source:"), 'popup.js must block view-source: URLs');
  assert(js.includes("data:"), 'popup.js must block data: URLs');
  assert(js.includes("blob:"), 'popup.js must block blob: URLs');
});

test('popup.js and background.js URL blocklists are in sync', () => {
  const popup = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  const bg = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  const schemes = ['brave://', 'chrome://', 'edge://', 'about:',
    'chrome-extension://', 'devtools://', 'view-source:', 'data:', 'blob:'];
  for (const scheme of schemes) {
    assert(popup.includes(scheme), 'popup.js missing blocklist scheme: ' + scheme);
    assert(bg.includes(scheme), 'background.js missing blocklist scheme: ' + scheme);
  }
});

console.log('\n--- Section 14d: Background.js response check and tab guard ---');

test('background.js checks response.success in sendMessage callback', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  assert(js.includes('response.success === false') || js.includes('response && response.success'),
    'background.js must check response.success for content-level failures');
});

test('background.js validates tab in context menu handler', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  const menuHandler = js.substring(js.indexOf('contextMenus.onClicked'));
  assert(menuHandler.includes('!tab') || menuHandler.includes('!tab.id'),
    'Context menu handler must validate tab parameter');
});

test('background.js clears stale badges at start of injectAndMessage', () => {
  const js = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  const fnStart = js.indexOf('function injectAndMessage');
  const fnBlock = js.substring(fnStart, fnStart + 400);
  assert(fnBlock.includes("setBadgeText({ text: ''"),
    'injectAndMessage must clear stale badge at start');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 15: PERFORMANCE AND ROBUSTNESS IMPROVEMENTS
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 15a: isBlockElement hoisted lookup ---');

test('text-extract.js has BLOCK_ELEMENTS at module scope', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('var BLOCK_ELEMENTS = {'),
    'Must have BLOCK_ELEMENTS as a module-scope variable');
  // isBlockElement should reference the hoisted object, not create a new one
  const fnStart = js.indexOf('function isBlockElement');
  const fnEnd = js.indexOf('}', fnStart) + 1;
  const fnBody = js.substring(fnStart, fnEnd);
  assert(fnBody.includes('BLOCK_ELEMENTS'), 'isBlockElement must use hoisted BLOCK_ELEMENTS');
  assert(!fnBody.includes('var blocks'), 'isBlockElement must NOT create local blocks object');
});

console.log('\n--- Section 15b: Batched REMOVE_SELECTORS ---');

test('text-extract.js batches REMOVE_SELECTORS with comma-join', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('BATCH_SIZE') || js.includes('batch.join'),
    'Must batch selectors for performance');
  assert(js.includes("REMOVE_TAGS.join(',')") || js.includes("REMOVE_TAGS.join(','"),
    'Must join REMOVE_TAGS into single querySelectorAll');
});

test('text-extract.js batched selectors have fallback for invalid selectors', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  const batchIdx = js.indexOf('BATCH_SIZE');
  if (batchIdx > 0) {
    const batchBlock = js.substring(batchIdx, batchIdx + 500);
    assert(batchBlock.includes('catch'),
      'Batched selectors must have try/catch fallback');
  }
});

console.log('\n--- Section 15c: Debounce guard ---');

test('content.js has conversion-in-progress guard', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('__conversionInProgress'),
    'Must have conversionInProgress guard');
  // Must set to true at start and false in finally
  assert(js.includes('__conversionInProgress = true'),
    'Must lock at start of handleConversion');
  assert(js.includes('__conversionInProgress = false'),
    'Must unlock in finally block');
});

test('content.js debounce unlock is in finally block', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const finallyIdx = js.indexOf('} finally {');
  const unlockIdx = js.indexOf('__conversionInProgress = false');
  assert(finallyIdx > 0 && unlockIdx > finallyIdx,
    'Debounce unlock must be inside the finally block');
});

console.log('\n--- Section 15d: Windows reserved filenames ---');

test('content.js buildSmartFilename guards Windows reserved names', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('CON') && js.includes('PRN') && js.includes('NUL'),
    'Must check for Windows reserved filenames');
  assert(js.includes('COM') && js.includes('LPT'),
    'Must check COM and LPT device names');
});

console.log('\n--- Section 15e: CSS framework hidden class detection ---');

test('text-extract.js removes elements hidden by common CSS classes', () => {
  const js = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  assert(js.includes('.hidden'), 'Must remove .hidden class');
  assert(js.includes('.d-none'), 'Must remove Bootstrap .d-none');
  assert(js.includes('.invisible'), 'Must remove .invisible class');
  assert(js.includes('display: none') || js.includes('display:none'),
    'Must remove style*="display:none" via attribute selector');
});

console.log('\n--- Section 15f: Test sanitizeOutput matches real implementation ---');

test('test-suite sanitizeOutput includes stripAstralInvisibles step', () => {
  // Read our own source to verify the test function has the step
  const src = fs.readFileSync(__filename, 'utf8');
  const fnStart = src.indexOf('function sanitizeOutput(text)');
  const fnEnd = src.indexOf('\n}\n', fnStart);
  const fnBody = src.substring(fnStart, fnEnd);
  assert(fnBody.includes('stripAstralInvisibles'),
    'Test sanitizeOutput must call stripAstralInvisibles');
  assert(fnBody.includes('filterToPrintable'),
    'Test sanitizeOutput must call filterToPrintable');
});

test('test-suite sanitizeOutput regex patterns match text-extract.js', () => {
  const real = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');
  const testSrc = fs.readFileSync(__filename, 'utf8');
  // Extract CONTROL_CHARS regex from real code
  const realControlMatch = real.match(/var CONTROL_CHARS = (\/[^/]+\/g);/);
  assert(realControlMatch, 'Must find CONTROL_CHARS in text-extract.js');
  // Verify test has the same pattern (allowing for minor format differences)
  const testControlMatch = testSrc.match(/\/\[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F\\x80-\\x9F\]\/g/);
  assert(testControlMatch, 'Test must have identical CONTROL_CHARS regex');
  // Verify INVISIBLE_CHARS regex present in both
  const realInvisMatch = real.match(/var INVISIBLE_CHARS = (\/[^/]+\/g);/);
  const testInvisPattern = testSrc.includes('\\u00AD\\u034F\\u061C');
  assert(realInvisMatch && testInvisPattern,
    'INVISIBLE_CHARS regex must be present in both files');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 16: ROUND 5 IMPROVEMENTS — UI, AUDIT, PAPER SIZE, CLIPBOARD
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 16a: popup.css box-sizing ---');

test('popup.css has universal box-sizing: border-box', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.includes('box-sizing: border-box'), 'Must have box-sizing: border-box');
  assert(css.includes('*, *::before, *::after'), 'Must apply to all elements via universal selector');
});

console.log('\n--- Section 16b: popup.css focus-visible styles ---');

test('popup.css has :focus-visible styles for keyboard accessibility', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  assert(css.includes('button:focus-visible'), 'Must have button:focus-visible rule');
  assert(css.includes('outline:') || css.includes('outline-color:') || css.includes('outline: 2px'),
    'Must define an outline for focus-visible');
  assert(css.includes('outline-offset'), 'Must have outline-offset for visual separation');
});

test('popup.css has dark-mode focus-visible override', () => {
  const css = fs.readFileSync(path.join(EXT, 'popup.css'), 'utf8');
  const darkSection = css.substring(css.indexOf('prefers-color-scheme: dark'));
  assert(darkSection.includes('focus-visible'), 'Dark mode must override focus-visible outline color');
});

console.log('\n--- Section 16c: audit-bytes.js includes background.js ---');

test('audit-bytes.js FILES array includes background.js', () => {
  const src = fs.readFileSync(path.join(__dirname, 'audit-bytes.js'), 'utf8');
  assert(src.includes("'background.js'") || src.includes('"background.js"'),
    'FILES array must include background.js');
});

console.log('\n--- Section 16d: context menu title matches manifest name ---');

test('background.js context menu parent title matches manifest name', () => {
  const bgSrc = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  // Extract the title from the parent context menu creation
  const titleMatch = bgSrc.match(/id:\s*['"]pdf-extract-parent['"][^}]*title:\s*['"]([^'"]+)['"]/);
  assert(titleMatch, 'Must find parent context menu title');
  assert(titleMatch[1] === manifest.name,
    'Context menu title "' + titleMatch[1] + '" must match manifest name "' + manifest.name + '"');
});

console.log('\n--- Section 16e: paper size locale detection ---');

test('content.js has detectPaperSize function', () => {
  const src = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(src.includes('function detectPaperSize'), 'Must define detectPaperSize function');
  assert(src.includes('LETTER_REGIONS'), 'Must have LETTER_REGIONS array');
});

test('content.js LETTER_REGIONS includes major letter-size countries', () => {
  const src = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const regionsMatch = src.match(/var LETTER_REGIONS = \[([^\]]+)\]/);
  assert(regionsMatch, 'Must define LETTER_REGIONS as array');
  const regions = regionsMatch[1];
  assert(regions.includes("'US'"), 'Must include US');
  assert(regions.includes("'CA'"), 'Must include CA (Canada)');
  assert(regions.includes("'MX'"), 'Must include MX (Mexico)');
});

test('content.js detectPaperSize returns letter format for US regions', () => {
  const src = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(src.includes("format: 'letter'"), 'Must return letter format');
  assert(src.includes('215.9'), 'Must use 215.9mm width for letter');
  assert(src.includes('279.4'), 'Must use 279.4mm height for letter');
});

test('content.js detectPaperSize returns a4 format as default', () => {
  const src = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(src.includes("format: 'a4'"), 'Must return a4 format as default');
});

test('content.js typewriter PDF uses detectPaperSize instead of hardcoded a4', () => {
  const src = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  // The typewriter section should use detectPaperSize, not hardcoded 'a4'
  const twStart = src.indexOf("format === 'pdf-typewriter'");
  // Find the next "else if" after the typewriter section
  const twEnd = src.indexOf('} else if', twStart + 1);
  const twSection = src.substring(twStart, twEnd);
  assert(twSection.includes('detectPaperSize()'), 'Typewriter PDF must call detectPaperSize()');
  assert(twSection.includes('paperSize.format'), 'Typewriter PDF must use paperSize.format');
  assert(twSection.includes('paperSize.width'), 'Typewriter PDF must use paperSize.width');
  assert(twSection.includes('paperSize.height'), 'Typewriter PDF must use paperSize.height');
});

test('content.js screenshot PDF uses detectPaperSize instead of hardcoded a4', () => {
  const src = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const pdfSection = src.substring(src.indexOf("format === 'pdf'"), src.indexOf("format === 'md'"));
  assert(pdfSection.includes('detectPaperSize()') || pdfSection.includes('screenshotPaper'),
    'Screenshot PDF must use detected paper size');
});

console.log('\n--- Section 16f: clipboard reliability improvements ---');

test('content.js has execCommandCopy helper function', () => {
  const src = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(src.includes('function execCommandCopy'), 'Must define execCommandCopy helper');
});

test('content.js copyToClipboard has retry mechanism', () => {
  const src = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const fnStart = src.indexOf('async function copyToClipboard');
  const fnEnd = src.indexOf('\n}', fnStart);
  const fnBody = src.substring(fnStart, fnEnd);
  // Should have multiple attempts
  const attempts = (fnBody.match(/execCommandCopy/g) || []).length;
  assert(attempts >= 2, 'Must have at least 2 execCommandCopy attempts (got ' + attempts + ')');
  // Should have a delay between retries
  assert(fnBody.includes('setTimeout'), 'Must have a delay between retry attempts');
});

test('content.js execCommandCopy returns boolean success status', () => {
  const src = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  const fnStart = src.indexOf('function execCommandCopy');
  const fnEnd = src.indexOf('\n}', fnStart);
  const fnBody = src.substring(fnStart, fnEnd);
  assert(fnBody.includes('return ok'), 'execCommandCopy must return ok boolean');
  assert(fnBody.includes("execCommand('copy')"), 'Must call execCommand copy');
});

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════');
console.log('RESULTS: ' + passed + ' passed, ' + failed + ' failed');
console.log('═══════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) {
    console.log('  - ' + f.name + ': ' + f.error);
  }
}

process.exit(failed > 0 ? 1 : 0);
