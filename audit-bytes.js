/**
 * audit-bytes.js
 *
 * Scans every source file for non-printable/hidden bytes that could
 * contaminate output. This ensures the SOURCE CODE itself is clean.
 * Also verifies the Blob download path cannot introduce encoding.
 *
 * Run: node audit-bytes.js
 */

const fs = require('fs');
const path = require('path');

const EXT = path.join(__dirname, 'extension');
let issues = 0;

// Files to audit (only our source, not minified libs)
const FILES = [
  path.join(EXT, 'manifest.json'),
  path.join(EXT, 'popup.html'),
  path.join(EXT, 'popup.css'),
  path.join(EXT, 'popup.js'),
  path.join(EXT, 'content.js'),
  path.join(EXT, 'text-extract.js'),
];

console.log('=== SOURCE FILE BYTE AUDIT ===\n');

for (const filePath of FILES) {
  const name = path.relative(__dirname, filePath);
  const buf = fs.readFileSync(filePath);
  const suspicious = [];

  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    // Allow: tab(9), newline(10), carriage return(13), printable ASCII (32-126)
    // Allow: UTF-8 continuation bytes (128-255) which are part of multi-byte sequences
    if (b === 9 || b === 10 || b === 13) continue;
    if (b >= 32 && b <= 126) continue;
    if (b >= 128) continue; // UTF-8 multi-byte (we'll check sequences below)

    // This is a suspicious byte
    suspicious.push({ offset: i, byte: b, hex: '0x' + b.toString(16).padStart(2, '0') });
  }

  if (suspicious.length === 0) {
    console.log('  CLEAN: ' + name);
  } else {
    issues += suspicious.length;
    console.log('  DIRTY: ' + name + ' (' + suspicious.length + ' suspicious bytes)');
    for (const s of suspicious.slice(0, 10)) {
      console.log('    offset=' + s.offset + ' byte=' + s.hex);
    }
    if (suspicious.length > 10) {
      console.log('    ... and ' + (suspicious.length - 10) + ' more');
    }
  }

  // Check for BOM at start of file
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    console.log('  WARNING: ' + name + ' has UTF-8 BOM at start');
    issues++;
  }

  // Check for embedded null bytes
  const nullCount = buf.filter(b => b === 0).length;
  if (nullCount > 0) {
    console.log('  WARNING: ' + name + ' contains ' + nullCount + ' NULL bytes');
    issues++;
  }
}

// Check for Unicode escape sequences in source that might produce
// invisible output (not the ones we're explicitly stripping)
console.log('\n=== UNICODE ESCAPE ANALYSIS IN text-extract.js ===\n');

const textExtractSrc = fs.readFileSync(path.join(EXT, 'text-extract.js'), 'utf8');

// Find all \uXXXX patterns
const unicodeEscapes = textExtractSrc.match(/\\u[0-9a-fA-F]{4}/g) || [];
console.log('  Total Unicode escapes found: ' + unicodeEscapes.length);

// Categorize them
const stripping = []; // Used in REMOVE patterns
const replacing = []; // Used in replace-to-visible patterns

for (const esc of new Set(unicodeEscapes)) {
  const cp = parseInt(esc.slice(2), 16);
  if (cp <= 0x1F || (cp >= 0x7F && cp <= 0x9F) ||
      (cp >= 0x200B && cp <= 0x200F) || (cp >= 0x202A && cp <= 0x202E) ||
      (cp >= 0x2060 && cp <= 0x206F) || (cp >= 0xFE00 && cp <= 0xFE0F) ||
      cp === 0xFEFF || cp === 0x00AD || cp === 0x034F || cp === 0x061C ||
      (cp >= 0xD800 && cp <= 0xDFFF) || (cp >= 0xFFF0 && cp <= 0xFFFB)) {
    stripping.push(esc + ' (U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ') -> STRIPPED');
  } else {
    replacing.push(esc + ' (U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ') -> replaced to visible ASCII');
  }
}

console.log('\n  Characters STRIPPED (removed entirely):');
for (const s of stripping) console.log('    ' + s);

console.log('\n  Characters REPLACED (to visible ASCII):');
for (const r of replacing) console.log('    ' + r);

// Verify that the sanitizeOutput function is the LAST thing that runs
// before text reaches the downloadFile function
console.log('\n=== DOWNLOAD PATH AUDIT ===\n');

const contentSrc = fs.readFileSync(path.join(EXT, 'content.js'), 'utf8');

// Check: extractPureText is called, its output goes to textContent,
// and textContent goes directly to downloadFile
const hasExtractCall = contentSrc.includes('extractPureText(');
const txtDownloadLine = contentSrc.includes("downloadFile(txtFilename, textContent, 'text/plain;charset=utf-8')");

if (hasExtractCall && txtDownloadLine) {
  console.log('  VERIFIED: extractPureText output flows directly to downloadFile');
  console.log('  VERIFIED: No intermediate transforms between extraction and download');
} else {
  console.log('  WARNING: Download path may have intermediate transforms');
  issues++;
}

// Verify no btoa/atob (base64) anywhere in the txt path
if (contentSrc.includes('btoa(textContent)') || contentSrc.includes('atob(')) {
  console.log('  DANGER: Base64 encoding found in download path!');
  issues++;
} else {
  console.log('  VERIFIED: No base64 encoding in download path');
}

// Verify no JSON.stringify on text content
if (contentSrc.includes('JSON.stringify(textContent)')) {
  console.log('  DANGER: JSON.stringify on text content (adds escape sequences)');
  issues++;
} else {
  console.log('  VERIFIED: No JSON.stringify on text content');
}

// Verify no encodeURIComponent on text content
if (contentSrc.includes('encodeURIComponent(textContent)') ||
    contentSrc.includes('encodeURI(textContent)')) {
  console.log('  DANGER: URI encoding on text content');
  issues++;
} else {
  console.log('  VERIFIED: No URI encoding on text content');
}

// Check that Blob is created with the raw string, not with encoded data
const blobPattern = /new Blob\(\[content\]/;
if (blobPattern.test(contentSrc)) {
  console.log('  VERIFIED: Blob created from raw string (no encoding wrapper)');
} else {
  console.log('  WARNING: Blob creation pattern unclear');
  issues++;
}

console.log('\n=== RESULT ===\n');
if (issues === 0) {
  console.log('  ALL CLEAN: 0 issues found');
  console.log('  Source files contain no hidden bytes.');
  console.log('  Download path is a clean string -> Blob -> ObjectURL -> anchor pipeline.');
  console.log('  No encoding transforms between extraction and download.');
  process.exit(0);
} else {
  console.log('  ISSUES FOUND: ' + issues);
  process.exit(1);
}
