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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  var config = MENU_MAP[info.menuItemId];
  if (!config) return;

  var tabId = tab.id;
  var url = tab.url || '';

  // Block browser-internal pages
  if (url.startsWith('brave://') || url.startsWith('chrome://') ||
      url.startsWith('edge://') || url.startsWith('about:') ||
      url.startsWith('chrome-extension://') || url.startsWith('devtools://')) {
    return;
  }

  // Build file list based on format
  var files = [];

  if (config.format === 'pdf-typewriter') {
    files.push('lib/jspdf.umd.min.js');
  }
  if (config.format === 'md') {
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
      return;
    }
    chrome.tabs.sendMessage(tabId, {
      action: 'convert',
      format: config.format,
      scope: config.scope
    });
  });
});
