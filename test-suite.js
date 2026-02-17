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
  assert(m.permissions.length === 2, 'Must have ONLY activeTab and scripting (no personal data)');
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

  // Extract all button IDs from HTML
  const idRegex = /id="([^"]+)"/g;
  let match;
  const htmlIds = [];
  while ((match = idRegex.exec(html)) !== null) {
    htmlIds.push(match[1]);
  }

  assert(htmlIds.length === 8, 'Must have exactly 8 button IDs, found ' + htmlIds.length);

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

// Reproduce the sanitization logic
function sanitizeOutput(text) {
  // Control chars except \t \n \r
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g, '');
  // Invisible Unicode
  text = text.replace(/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFE00-\uFE0F\uFEFF\uFFF0-\uFFF8\uFFF9-\uFFFB]/g, '');
  // Surrogate halves
  text = text.replace(/[\uD800-\uDFFF]/g, '');
  // Unicode typography to ASCII
  text = text.replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'");
  text = text.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');
  text = text.replace(/[\u2013\u2014\u2015\u2212]/g, '-');
  text = text.replace(/\u2026/g, '...');
  text = text.replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB]/g, '-');
  text = text.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  text = text.replace(/\u2044/g, '/');
  text = text.replace(/[\u2010\u2011\u2012\uFE58\uFE63\uFF0D]/g, '-');
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  // Collapse spaces
  text = text.replace(/[^\S\n]+/g, ' ');
  text = text.replace(/ +$/gm, '');
  text = text.replace(/^ +/gm, '');
  text = text.replace(/\n{4,}/g, '\n\n\n');
  text = text.trim() + '\n';
  return text;
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
  assert(!js.includes('\\uFEFF') && !js.includes('\\xEF\\xBB\\xBF'),
    'Must NOT add BOM to txt output');
});

test('downloadFile creates and immediately removes anchor element', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  assert(js.includes('document.body.appendChild(a)'), 'Must append anchor');
  assert(js.includes('a.click()'), 'Must trigger click');
  assert(js.includes('document.body.removeChild(a)'), 'Must remove anchor after');
});

// ═══════════════════════════════════════════════════════════════
// SECTION 7: SELECTION MODE PARITY
// ═══════════════════════════════════════════════════════════════

console.log('\n--- Section 7: Selection mode parity ---');

test('content.js uses extractPureText for both page and selection', () => {
  const js = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');
  // Count occurrences of extractPureText
  const matches = js.match(/extractPureText/g);
  assert(matches && matches.length >= 2,
    'Must call extractPureText at least twice (page and selection), found ' + (matches ? matches.length : 0));
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
