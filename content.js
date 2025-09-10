// content.js

// Inject inject.js into the page context to access DOM and WebRTC APIs directly
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Inject signLanguageDictionary.js
const dictScript = document.createElement('script');
dictScript.src = chrome.runtime.getURL('signLanguageDictionary.js');
dictScript.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(dictScript);

// Inject injected.css
const styleLink = document.createElement('link');
styleLink.rel = 'stylesheet';
styleLink.type = 'text/css';
styleLink.href = chrome.runtime.getURL('injected.css');
(document.head || document.documentElement).appendChild(styleLink);

// Listen for messages from the injected script or background script
window.addEventListener('message', (event) => {
  if (event.source !== window) {
    return;
  }
  if (event.data.type && (event.data.type === 'FROM_PAGE')) {
    console.log('Content script received message from page:', event.data);
    // Forward message to background script
    chrome.runtime.sendMessage(event.data);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message from background:', message);
  // Forward message to injected script
  window.postMessage({ type: 'FROM_EXTENSION', payload: message }, '*');
});
