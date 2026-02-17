/**
 * background.js
 *
 * Service worker for Manifest V3.
 * Registers right-click context menu items for content extraction.
 * Handles menu clicks by injecting scripts and messaging content.js.
 */

// --- CONTEXT MENU REGISTRATION ---

chrome.runtime.onInstalled.addListener(() => {
  // Parent menu
  chrome.contextMenus.create({
    id: 'pdf-extract-parent',
    title: 'PDF Extract',
    contexts: ['page', 'selection']
  });

  // Copy to clipboard
  chrome.contextMenus.create({
    id: 'ctx-clip-page',
    parentId: 'pdf-extract-parent',
    title: 'Copy Page Text to Clipboard',
    contexts: ['page', 'selection']
  });
  chrome.contextMenus.create({
    id: 'ctx-clip-selection',
    parentId: 'pdf-extract-parent',
    title: 'Copy Selection to Clipboard',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'ctx-clip-modal',
    parentId: 'pdf-extract-parent',
    title: 'Copy Popup Text to Clipboard',
    contexts: ['page', 'selection']
  });

  chrome.contextMenus.create({
    id: 'ctx-sep-0',
    parentId: 'pdf-extract-parent',
    type: 'separator',
    contexts: ['page', 'selection']
  });

  // .txt exports
  chrome.contextMenus.create({
    id: 'ctx-txt-page',
    parentId: 'pdf-extract-parent',
    title: 'Page to .txt',
    contexts: ['page', 'selection']
  });
  chrome.contextMenus.create({
    id: 'ctx-txt-selection',
    parentId: 'pdf-extract-parent',
    title: 'Selection to .txt',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'ctx-txt-modal',
    parentId: 'pdf-extract-parent',
    title: 'Popup/Preview to .txt',
    contexts: ['page', 'selection']
  });

  // Separator via a disabled item
  chrome.contextMenus.create({
    id: 'ctx-sep-1',
    parentId: 'pdf-extract-parent',
    type: 'separator',
    contexts: ['page', 'selection']
  });

  // Typewriter PDF exports
  chrome.contextMenus.create({
    id: 'ctx-tw-page',
    parentId: 'pdf-extract-parent',
    title: 'Page to Typewriter PDF',
    contexts: ['page', 'selection']
  });
  chrome.contextMenus.create({
    id: 'ctx-tw-selection',
    parentId: 'pdf-extract-parent',
    title: 'Selection to Typewriter PDF',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'ctx-tw-modal',
    parentId: 'pdf-extract-parent',
    title: 'Popup/Preview to Typewriter PDF',
    contexts: ['page', 'selection']
  });

  chrome.contextMenus.create({
    id: 'ctx-sep-2',
    parentId: 'pdf-extract-parent',
    type: 'separator',
    contexts: ['page', 'selection']
  });

  // Markdown exports
  chrome.contextMenus.create({
    id: 'ctx-md-page',
    parentId: 'pdf-extract-parent',
    title: 'Page to Markdown',
    contexts: ['page', 'selection']
  });
  chrome.contextMenus.create({
    id: 'ctx-md-selection',
    parentId: 'pdf-extract-parent',
    title: 'Selection to Markdown',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'ctx-md-modal',
    parentId: 'pdf-extract-parent',
    title: 'Popup/Preview to Markdown',
    contexts: ['page', 'selection']
  });
});

// --- MENU CLICK HANDLER ---

var MENU_MAP = {
  'ctx-clip-page':      { format: 'clipboard',      scope: 'page' },
  'ctx-clip-selection':  { format: 'clipboard',      scope: 'selection' },
  'ctx-clip-modal':      { format: 'clipboard',      scope: 'modal' },
  'ctx-txt-page':      { format: 'txt',            scope: 'page' },
  'ctx-txt-selection':  { format: 'txt',            scope: 'selection' },
  'ctx-txt-modal':      { format: 'txt',            scope: 'modal' },
  'ctx-tw-page':        { format: 'pdf-typewriter', scope: 'page' },
  'ctx-tw-selection':   { format: 'pdf-typewriter', scope: 'selection' },
  'ctx-tw-modal':       { format: 'pdf-typewriter', scope: 'modal' },
  'ctx-md-page':        { format: 'md',             scope: 'page' },
  'ctx-md-selection':   { format: 'md',             scope: 'selection' },
  'ctx-md-modal':       { format: 'md',             scope: 'modal' }
};

// --- KEYBOARD SHORTCUT HANDLER ---

var COMMAND_MAP = {
  'copy-page-text': { format: 'clipboard',      scope: 'page' },
  'page-to-txt':    { format: 'txt',            scope: 'page' },
  'page-to-pdf':    { format: 'pdf-typewriter', scope: 'page' }
};

chrome.commands.onCommand.addListener((command) => {
  var config = COMMAND_MAP[command];
  if (!config) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    injectAndMessage(tabs[0], config.format, config.scope);
  });
});

// --- SHARED INJECTION LOGIC ---

function injectAndMessage(tab, format, scope) {
  var tabId = tab.id;
  var url = tab.url || '';

  if (url.startsWith('brave://') || url.startsWith('chrome://') ||
      url.startsWith('edge://') || url.startsWith('about:') ||
      url.startsWith('chrome-extension://') || url.startsWith('devtools://') ||
      url.startsWith('view-source:') || url.startsWith('data:') ||
      url.startsWith('blob:')) {
    flashBadge('ERR', '#991b1b', tabId);
    return;
  }

  var files = [];
  if (format === 'pdf' || format === 'pdf-typewriter') {
    files.push('lib/jspdf.umd.min.js');
  }
  if (format === 'pdf') {
    files.push('lib/html2canvas.min.js');
  }
  if (format === 'md') {
    files.push('lib/turndown.js');
  }
  files.push('text-extract.js');
  files.push('content.js');

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: files
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('PDF Extract injection failed:', chrome.runtime.lastError.message);
      flashBadge('ERR', '#991b1b', tabId);
      return;
    }
    chrome.tabs.sendMessage(tabId, {
      action: 'convert',
      format: format,
      scope: scope
    }, function (response) {
      if (chrome.runtime.lastError) {
        console.error('PDF Extract message failed:', chrome.runtime.lastError.message);
        flashBadge('ERR', '#991b1b', tabId);
      }
    });
  });
}

// Brief badge flash for error/success feedback from context menu and keyboard shortcuts
function flashBadge(text, color, tabId) {
  chrome.action.setBadgeText({ text: text, tabId: tabId });
  chrome.action.setBadgeBackgroundColor({ color: color, tabId: tabId });
  setTimeout(function () {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }, 3000);
}

// --- CONTEXT MENU CLICK HANDLER ---

chrome.contextMenus.onClicked.addListener((info, tab) => {
  var config = MENU_MAP[info.menuItemId];
  if (!config) return;
  injectAndMessage(tab, config.format, config.scope);
});
