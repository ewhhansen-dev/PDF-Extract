/**
 * text-extract.js
 *
 * Typewriter-grade pure text extraction engine.
 * Produces .txt output as clean as if typed on a typewriter.
 * Zero dependencies. No API calls. Runs entirely in the browser tab.
 *
 * Handles: chat threads, canvases, rich editors, code blocks,
 * pop-ups, modals, navigation, forms, SVG, and all web noise.
 */

(function () {
  'use strict';

  // Prevent double-load
  if (window.__textExtractLoaded) return;
  window.__textExtractLoaded = true;

  // --- SELECTORS FOR ELEMENTS TO REMOVE ---

  // Elements that are never readable content
  var REMOVE_TAGS = [
    'script', 'style', 'noscript', 'link', 'meta',
    'svg', 'canvas', 'video', 'audio', 'iframe', 'embed', 'object',
    'map', 'area', 'picture', 'source', 'track',
    'template', 'slot'
  ];

  // Interactive/UI elements that produce noise in text output
  var REMOVE_SELECTORS = [
    // Navigation and layout chrome
    'nav', 'header:not(article header)', 'footer:not(article footer)',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]',

    // Toolbars, menus, buttons (not inside content)
    '[role="toolbar"]', '[role="menubar"]', '[role="menu"]',
    '[role="tooltip"]', '[role="status"]',

    // Forms and interactive controls
    'form', 'input', 'textarea', 'select', 'button',
    '[role="button"]', '[role="search"]',
    '[contenteditable="true"]',

    // Hidden or decorative
    '[aria-hidden="true"]', '[hidden]',
    '.sr-only', '.visually-hidden', '.screen-reader-text',

    // Cookie banners, popups, overlays
    '[class*="cookie"]', '[id*="cookie"]',
    '[class*="consent"]', '[id*="consent"]',
    '[class*="overlay"]',
    '[class*="toast"]', '[class*="snackbar"]',
    '[class*="banner"]:not(main [class*="banner"])',

    // Chat UI noise
    '[class*="avatar"]', '[class*="Avatar"]',
    '[class*="timestamp"]', '[class*="Timestamp"]',
    '[class*="reaction"]', '[class*="Reaction"]',
    '[class*="toolbar"]', '[class*="Toolbar"]',
    '[class*="action-bar"]', '[class*="ActionBar"]',
    '[class*="copy-btn"]', '[class*="CopyButton"]',
    '[class*="copy-code"]',
    'button[aria-label="Copy"]',
    'button[aria-label="Edit"]',
    'button[aria-label="Retry"]',
    'button[aria-label="Good response"]',
    'button[aria-label="Bad response"]',

    // Sidebar and aside
    'aside',
    '[class*="sidebar"]', '[class*="Sidebar"]',
    '[class*="side-panel"]',

    // Ads (Brave Shields strips most, but catch remnants)
    '[class*="ad-"]', '[class*="advert"]',
    '[id*="ad-"]', '[id*="advert"]',
    'ins.adsbygoogle',

    // Brave Browser UI noise (Rewards, Wallet, News widgets)
    '[class*="brave-rewards"]', '[class*="brave-wallet"]',
    '[class*="BraveRewards"]', '[class*="BraveWallet"]',
    '[id*="brave-rewards"]', '[id*="brave-wallet"]',
    '[class*="brave-news"]', '[class*="BraveNews"]',
    '[class*="brave-shields"]',
    '[class*="rewards-panel"]', '[class*="RewardsPanel"]'
  ];

  // --- CHAT THREAD DETECTION ---

  var CHAT_CONTAINER_SELECTORS = [
    // ChatGPT (modern: Tailwind classes, data-testid on turns, main wrapper)
    'main [role="presentation"]',
    '[class*="conversation"]', '[class*="Conversation"]',
    'main [class*="thread"]', '[class*="Thread"]',

    // Claude
    '[class*="chat-messages"]', '[class*="ChatMessages"]',
    '[class*="message-list"]', '[class*="MessageList"]',

    // Generic chat patterns
    '[class*="messages-container"]',
    '[class*="chat-log"]', '[class*="ChatLog"]',
    '[role="log"]',
    '[class*="chat-history"]',

    // Slack-like
    '[class*="message_pane"]',
    '[class*="msg-list"]',

    // Discord-like
    '[class*="chatContent"]',
    '[class*="messagesWrapper"]'
  ];

  var MESSAGE_SELECTORS = [
    // ChatGPT (modern: data-testid on turns, data-message-author-role on messages)
    '[data-testid*="conversation-turn"]',
    '[data-message-author-role]',
    '[data-message-id]',
    '[class*="message "]', '[class*="Message"]',
    '[class*="ConversationItem"]',

    // Claude
    '[class*="message-row"]', '[class*="MessageRow"]',
    '[class*="human-message"]', '[class*="HumanMessage"]',
    '[class*="assistant-message"]', '[class*="AssistantMessage"]',

    // Generic
    '[class*="chat-message"]', '[class*="ChatMessage"]',
    '[class*="msg-container"]',
    '[role="article"]',
    '[class*="message-bubble"]',
    '[class*="comment-body"]'
  ];

  // --- BLOCK ELEMENT LOOKUP (hoisted for performance) ---
  // Used by processNode on every element during tree walk.
  // Hoisting avoids re-creating this object on each call.
  var BLOCK_ELEMENTS = {
    'div':1, 'p':1, 'section':1, 'article':1, 'main':1,
    'blockquote':1, 'figure':1, 'figcaption':1, 'details':1, 'summary':1,
    'ul':1, 'ol':1, 'li':1, 'dl':1, 'dt':1, 'dd':1,
    'table':1, 'thead':1, 'tbody':1, 'tfoot':1, 'tr':1,
    'h1':1, 'h2':1, 'h3':1, 'h4':1, 'h5':1, 'h6':1,
    'address':1, 'fieldset':1
  };

  // --- CODE BLOCK DETECTION ---

  var CODE_BLOCK_SELECTORS = [
    '[class*="code-block"]', '[class*="CodeBlock"]',
    '[class*="codeBlock"]',
    '.hljs', '.prism-code', '.shiki',
    '[class*="syntax-highlight"]'
  ];

  // --- INVISIBLE/NON-PRINTABLE CHARACTER RANGES ---
  // Every Unicode codepoint that is invisible, a control char,
  // or an encoding artifact. This is the core anti-embedding defense.

  // Control characters (C0 and C1) except \t \n \r which are legit
  // U+0000-U+0008, U+000B, U+000C, U+000E-U+001F, U+007F, U+0080-U+009F
  var CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g;

  // Zero-width and invisible formatting characters
  // Includes: soft hyphen, combining grapheme joiner, Arabic/Syriac format chars,
  // Hangul fillers, Khmer inherent vowels, Mongolian FVS, zero-width chars,
  // bidi controls, invisible operators, Braille blank, variation selectors,
  // BOM, halfwidth Hangul filler, specials, interlinear annotation, object replacement
  var INVISIBLE_CHARS = /[\u00AD\u034F\u061C\u070F\u08E2\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFFC]/g;

  // Surrogate halves (should never appear in valid text)
  var SURROGATE_HALVES = /[\uD800-\uDFFF]/g;

  // Tag characters and variation selectors supplement (astral plane)
  // These are U+E0001-U+E007F (Tags) and U+E0100-U+E01EF (VS Supplement)
  // In JS regex with Unicode flag they need special handling, but
  // String.replace with a function can catch them via codePointAt

  // --- MAIN EXTRACTION FUNCTION ---

  /**
   * Extract typewriter-grade pure text from a DOM element.
   * @param {Element} rootElement - The element to extract from
   * @param {Object} [options] - Extraction options
   * @param {boolean} [options.preserveWhitespace] - If true, preserve indentation
   *   and whitespace structure (for clipboard/code). Still strips invisible chars.
   * @returns {string} Clean plain text, guaranteed free of hidden encodings
   */
  window.extractPureText = function (rootElement, options) {
    options = options || {};
    // Phase -1: Extract text from same-origin iframes before cloning.
    // Iframes are removed during cleanup, so we harvest their content first.
    var iframeTexts = extractSameOriginIframes(rootElement);

    // Work on a deep clone so we never touch the live DOM
    var clone = rootElement.cloneNode(true);

    // Phase 0: Brave Speedreader detection
    var speedreaderContent = clone.querySelector(
      '#article, [class*="speedreader"], [class*="Speedreader"], ' +
      '[data-speedreader], .content-container'
    );
    if (speedreaderContent && speedreaderContent.textContent.trim().length > 100) {
      clone = speedreaderContent;
    }

    // Phase 1: Remove all non-content elements
    removeNonContent(clone);

    // Phase 2: Remove elements hidden by inline styles
    removeHiddenElements(clone);

    // Phase 3: Detect if this is a chat thread and format accordingly
    var chatText = tryExtractChat(clone);
    if (chatText) {
      var result = chatText;
      if (iframeTexts) {
        result += '\n\n' + iframeTexts;
      }
      return sanitizeOutput(result, options.preserveWhitespace);
    }

    // Phase 4: Extract with structure awareness
    var rawText = extractStructured(clone);

    // Append any same-origin iframe content
    if (iframeTexts) {
      rawText += '\n\n' + iframeTexts;
    }

    // Phase 5: Sanitize output
    // preserveWhitespace=true keeps indentation intact (for clipboard/code)
    // preserveWhitespace=false (default) produces typewriter-grade purity
    return sanitizeOutput(rawText, options.preserveWhitespace);
  };

  // --- PHASE -1: SAME-ORIGIN IFRAME EXTRACTION ---
  // Harvests text from same-origin iframes before they get removed.
  // Cross-origin iframes throw a SecurityError on contentDocument access.

  function extractSameOriginIframes(root) {
    var iframes;
    try {
      iframes = root.querySelectorAll('iframe');
    } catch (e) {
      return '';
    }
    if (!iframes || iframes.length === 0) return '';

    var parts = [];
    for (var i = 0; i < iframes.length; i++) {
      try {
        var iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
        if (!iframeDoc || !iframeDoc.body) continue;

        // Clone the iframe body and run structured extraction on it
        var iframeClone = iframeDoc.body.cloneNode(true);
        removeNonContent(iframeClone);
        removeHiddenElements(iframeClone);
        var text = extractStructured(iframeClone);
        if (text && text.trim().length > 20) {
          parts.push(text.trim());
        }
      } catch (e) {
        // Cross-origin iframe - SecurityError expected, skip silently
      }
    }

    return parts.join('\n\n');
  }

  // --- PHASE 1: REMOVE NON-CONTENT ---

  function removeNonContent(root) {
    var i, els;

    // Remove by tag name (single comma-joined selector for all tags)
    els = root.querySelectorAll(REMOVE_TAGS.join(','));
    els.forEach(function (el) { el.remove(); });

    // Remove by selector in batches of BATCH_SIZE to reduce DOM traversals.
    // Individual try/catch per batch: if one selector is invalid, only that
    // batch falls back to individual queries.
    var BATCH_SIZE = 6;
    for (i = 0; i < REMOVE_SELECTORS.length; i += BATCH_SIZE) {
      var batch = REMOVE_SELECTORS.slice(i, i + BATCH_SIZE);
      try {
        els = root.querySelectorAll(batch.join(','));
        els.forEach(function (el) { el.remove(); });
      } catch (e) {
        // A selector in this batch is invalid; fall back to one-by-one
        for (var j = 0; j < batch.length; j++) {
          try {
            els = root.querySelectorAll(batch[j]);
            els.forEach(function (el) { el.remove(); });
          } catch (e2) { /* skip invalid */ }
        }
      }
    }
  }

  // --- PHASE 2: REMOVE HIDDEN ELEMENTS ---

  // Common CSS framework classes that hide content.
  // Since we operate on a cloned (detached) DOM, getComputedStyle won't work,
  // so we catch the most common hide-by-class patterns explicitly.
  var HIDDEN_CLASS_SELECTORS = [
    '.hidden', '.d-none', '.d-hide', '.is-hidden', '.is-invisible',
    '.collapse:not(.show)', '.invisible'
  ];

  function removeHiddenElements(root) {
    var i, els, el, style;

    // First pass: remove elements hidden by common CSS framework classes
    for (i = 0; i < HIDDEN_CLASS_SELECTORS.length; i++) {
      try {
        els = root.querySelectorAll(HIDDEN_CLASS_SELECTORS[i]);
        els.forEach(function (e) { e.remove(); });
      } catch (e) { /* skip invalid */ }
    }

    // Second pass: catch inline style hiding not covered by attribute selectors
    var allElements = root.querySelectorAll('*');
    for (i = 0; i < allElements.length; i++) {
      el = allElements[i];
      if (!el.parentNode) continue;
      style = el.style;
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        (style.position === 'absolute' && style.left &&
          (parseInt(style.left, 10) < -999 || parseInt(style.top, 10) < -999)) ||
        (style.width === '0px' && style.height === '0px') ||
        (style.overflow === 'hidden' && style.maxHeight === '0px') ||
        style.fontSize === '0' || style.fontSize === '0px' ||
        (style.textIndent && parseInt(style.textIndent, 10) < -999)
      ) {
        el.remove();
      }
    }
  }

  // --- PHASE 3: CHAT THREAD EXTRACTION ---

  function tryExtractChat(root) {
    var chatContainer = null;
    var i, j, sel, found;
    var messages = [];

    // Strategy 1: Find a container that has multiple messages inside
    for (i = 0; i < CHAT_CONTAINER_SELECTORS.length; i++) {
      sel = CHAT_CONTAINER_SELECTORS[i];
      try {
        var containers = root.querySelectorAll(sel);
        for (j = 0; j < containers.length; j++) {
          var candidate = containers[j];
          // Check if this container has message-like children
          for (var mi = 0; mi < MESSAGE_SELECTORS.length; mi++) {
            try {
              found = candidate.querySelectorAll(MESSAGE_SELECTORS[mi]);
              if (found.length > 1) {
                chatContainer = candidate;
                messages = Array.from(found);
                break;
              }
            } catch (e) { /* skip */ }
          }
          if (messages.length > 1) break;
        }
      } catch (e) { /* skip invalid selectors */ }
      if (messages.length > 1) break;
    }

    // Strategy 2: If no container found, try finding messages directly on root
    if (messages.length < 2) {
      for (i = 0; i < MESSAGE_SELECTORS.length; i++) {
        sel = MESSAGE_SELECTORS[i];
        try {
          found = root.querySelectorAll(sel);
          if (found.length > 1) {
            messages = Array.from(found);
            chatContainer = root;
            break;
          }
        } catch (e) { /* skip */ }
      }
    }

    if (messages.length < 2) return null;

    var lines = [];
    var msg, role, msgText, cleanText;

    for (i = 0; i < messages.length; i++) {
      msg = messages[i];

      // Clean this message element
      removeNonContent(msg);
      removeHiddenElements(msg);

      // Try to find speaker/role
      role = detectRole(msg);

      // Extract code blocks specially within this message
      msgText = extractStructured(msg);
      cleanText = msgText.trim();

      if (!cleanText) continue;

      if (role) {
        lines.push('');
        lines.push(role + ':');
        lines.push(cleanText);
      } else {
        lines.push('');
        lines.push(cleanText);
      }
    }

    return lines.join('\n');
  }

  function detectRole(messageEl) {
    // ChatGPT: data-message-author-role attribute (may be on element or descendant)
    var authorRole = messageEl.getAttribute('data-message-author-role');
    if (authorRole) {
      return authorRole.charAt(0).toUpperCase() + authorRole.slice(1);
    }

    // ChatGPT turns: look for data-message-author-role on a descendant
    var roleChild;
    try {
      roleChild = messageEl.querySelector('[data-message-author-role]');
    } catch (e) { roleChild = null; }
    if (roleChild) {
      var childRole = roleChild.getAttribute('data-message-author-role');
      if (childRole) return childRole.charAt(0).toUpperCase() + childRole.slice(1);
    }

    // Look for role in class names
    var cls = (messageEl.className || '').toLowerCase();
    if (cls.includes('human') || cls.includes('user')) return 'User';
    if (cls.includes('assistant') || cls.includes('bot') || cls.includes('ai')) return 'Assistant';
    if (cls.includes('system')) return 'System';

    // Look for a name/role element inside
    var nameEl;
    try {
      nameEl = messageEl.querySelector(
        '[class*="author"], [class*="Author"], [class*="sender"], [class*="Sender"], ' +
        '[class*="name"], [class*="role"], [class*="Role"]'
      );
    } catch (e) {
      nameEl = null;
    }

    if (nameEl) {
      var name = nameEl.innerText || nameEl.textContent;
      if (name && name.trim().length > 0 && name.trim().length < 40) {
        nameEl.remove();
        return name.trim();
      }
    }

    return null;
  }

  // --- PHASE 4: STRUCTURED EXTRACTION ---

  function extractStructured(root) {
    var parts = [];
    processNode(root, parts);
    return parts.join('');
  }

  function processNode(node, parts) {
    if (node.nodeType === 3) { // TEXT_NODE
      var text = node.textContent;
      if (text && text.trim()) {
        parts.push(text);
      }
      return;
    }

    if (node.nodeType !== 1) return; // ELEMENT_NODE only

    var tag = node.tagName.toLowerCase();
    var i;

    // Code blocks: preserve formatting with textContent
    if (isCodeBlock(node)) {
      var codeText = node.textContent || '';
      if (codeText.trim()) {
        parts.push('\n\n---\n');
        parts.push(codeText);
        parts.push('\n---\n\n');
      }
      return;
    }

    var block = isBlockElement(tag);
    if (block) {
      parts.push('\n');
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      parts.push('\n');
      for (i = 0; i < node.childNodes.length; i++) {
        processNode(node.childNodes[i], parts);
      }
      parts.push('\n');
      return;
    }

    // List items
    if (tag === 'li') {
      parts.push('\n- ');
      for (i = 0; i < node.childNodes.length; i++) {
        processNode(node.childNodes[i], parts);
      }
      return;
    }

    // Table rows: tab-separated cells
    if (tag === 'tr') {
      parts.push('\n');
      var cells = node.querySelectorAll('td, th');
      var cellTexts = [];
      for (i = 0; i < cells.length; i++) {
        cellTexts.push((cells[i].innerText || cells[i].textContent || '').trim());
      }
      parts.push(cellTexts.join('\t'));
      return;
    }

    // Line break
    if (tag === 'br') {
      parts.push('\n');
      return;
    }

    // Horizontal rule
    if (tag === 'hr') {
      parts.push('\n\n---\n\n');
      return;
    }

    // Images: skip entirely (no alt text noise in typewriter output)
    if (tag === 'img') return;

    // Recurse into children
    for (i = 0; i < node.childNodes.length; i++) {
      processNode(node.childNodes[i], parts);
    }

    if (block) {
      parts.push('\n');
    }
  }

  function isCodeBlock(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'pre') return true;

    for (var i = 0; i < CODE_BLOCK_SELECTORS.length; i++) {
      try {
        if (el.matches(CODE_BLOCK_SELECTORS[i])) return true;
      } catch (e) { /* skip */ }
    }
    return false;
  }

  function isBlockElement(tag) {
    return BLOCK_ELEMENTS.hasOwnProperty(tag);
  }

  // --- PHASE 5: OUTPUT SANITIZATION ---
  // This is the defense against hidden encodings, embeddings,
  // and anything not typeable on a physical typewriter.

  function sanitizeOutput(text, preserveWhitespace) {
    // Step 1: Strip all control characters except tab, newline, carriage return
    text = text.replace(CONTROL_CHARS, '');

    // Step 2: Strip all invisible Unicode characters
    // (zero-width spaces, joiners, direction marks, BOM, soft hyphens,
    //  variation selectors, interlinear annotations, tag characters)
    text = text.replace(INVISIBLE_CHARS, '');

    // Step 3: Strip orphaned surrogate halves (encoding corruption)
    text = text.replace(SURROGATE_HALVES, '');

    // Step 4: Strip astral-plane invisible characters
    // (Tag characters U+E0001-E007F, Variation Selectors Supplement U+E0100-E01EF)
    text = stripAstralInvisibles(text);

    // Step 5: Normalize Unicode typography to ASCII equivalents
    // Smart quotes -> straight quotes
    text = text.replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'");
    text = text.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');
    // Em/en dashes -> hyphen
    text = text.replace(/[\u2013\u2014\u2015\u2212]/g, '-');
    // Ellipsis -> three dots
    text = text.replace(/\u2026/g, '...');
    // Bullets -> hyphen
    text = text.replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB]/g, '-');
    // Various spaces -> regular space (but NOT tabs -- tabs are real whitespace)
    text = text.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
    // Fraction slash -> regular slash
    text = text.replace(/\u2044/g, '/');
    // Various hyphens -> regular hyphen
    text = text.replace(/[\u2010\u2011\u2012\uFE58\uFE63\uFF0D]/g, '-');

    // Step 6: Normalize carriage returns
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');

    // Steps 7-9: Whitespace normalization
    // When preserveWhitespace is true (clipboard/code), skip these steps
    // to keep indentation, tabs, and multi-space alignment intact.
    // All invisible/encoding chars are already stripped by steps 1-4 above.
    if (!preserveWhitespace) {
      // Step 7: Collapse multiple spaces on same line to single space
      text = text.replace(/[^\S\n]+/g, ' ');

      // Step 8: Trim trailing whitespace on each line
      text = text.replace(/ +$/gm, '');

      // Step 9: Trim leading whitespace on each line
      text = text.replace(/^ +/gm, '');
    }

    // Step 10: Collapse 3+ consecutive blank lines into 2
    text = text.replace(/\n{4,}/g, '\n\n\n');

    // Step 11: Trim the entire document
    text = text.trim();

    // Step 12: Ensure exactly one trailing newline
    text = text + '\n';

    // Step 13: Final byte-level verification pass
    // Only allow: printable ASCII (0x20-0x7E), tab (0x09), newline (0x0A),
    // and common Latin-1/Unicode letters (accented chars etc. above 0x7E
    // that are legitimate printable characters).
    // We keep chars above 0x9F that are printable Unicode.
    text = filterToPrintable(text);

    return text;
  }

  function stripAstralInvisibles(text) {
    // Process string by code point to catch astral plane invisibles
    var result = '';
    var i = 0;
    var cp;
    while (i < text.length) {
      cp = text.codePointAt(i);
      // Skip Tag characters (U+E0001-U+E007F)
      if (cp >= 0xE0001 && cp <= 0xE007F) {
        i += 2; // astral chars are 2 UTF-16 code units
        continue;
      }
      // Skip Variation Selectors Supplement (U+E0100-U+E01EF)
      if (cp >= 0xE0100 && cp <= 0xE01EF) {
        i += 2;
        continue;
      }
      // Skip other known invisible astral chars
      // Shorthand Format Controls (U+1BCA0-U+1BCA3)
      if (cp >= 0x1BCA0 && cp <= 0x1BCA3) {
        i += 2;
        continue;
      }
      // Musical Symbol format controls (U+1D173-U+1D17A)
      if (cp >= 0x1D173 && cp <= 0x1D17A) {
        i += 2;
        continue;
      }
      // Egyptian Hieroglyph format controls (U+13430-U+1343F)
      if (cp >= 0x13430 && cp <= 0x1343F) {
        i += 2;
        continue;
      }
      // Keep everything else
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
    // Final pass: character by character, only keep what a human can see/read.
    // Allow: \t (0x09), \n (0x0A), printable ASCII (0x20-0x7E),
    // and printable characters above U+00A0 (legitimate international text).
    // Block: 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F, 0x80-0x9F
    var result = '';
    var i = 0;
    var cp;
    while (i < text.length) {
      cp = text.codePointAt(i);

      if (cp === 0x09 || cp === 0x0A) {
        // Tab and newline: allowed
        result += text.charAt(i);
        i += 1;
      } else if (cp >= 0x20 && cp <= 0x7E) {
        // Printable ASCII: allowed
        result += text.charAt(i);
        i += 1;
      } else if (cp >= 0x00A0 && cp <= 0xD7FF) {
        // Printable Unicode BMP (above Latin-1 controls, below surrogates): allowed
        result += text.charAt(i);
        i += 1;
      } else if (cp >= 0xE000 && cp <= 0xFFFD) {
        // Private Use Area and remaining BMP printables: allowed
        // (Some fonts use PUA; these are visible characters)
        result += text.charAt(i);
        i += 1;
      } else if (cp >= 0x10000 && cp <= 0x10FFFF) {
        // Supplementary planes (emoji, CJK extensions, etc.): allowed
        // These are visible characters
        result += text.charAt(i) + text.charAt(i + 1);
        i += 2;
      } else {
        // Everything else: skip (control chars, surrogates, etc.)
        if (cp > 0xFFFF) {
          i += 2;
        } else {
          i += 1;
        }
      }
    }
    return result;
  }

})();
