// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log('WebRTC Video Call Extension installed.');
});

const signalingMessages = {}; // Stores signaling messages per room

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in background script:', message);

  if (message.action === 'startCall' || message.action === 'joinCall') {
    console.log(`Call action: ${message.action} for room: ${message.room}`);
    // We'll add more logic here later to manage active calls and peer discovery

    // For now, let's just open a new tab with the room name if starting a call.
    // In a real scenario, this would be more sophisticated to ensure both parties are on a relevant page.
    if (message.action === 'startCall') {
      chrome.tabs.create({ url: `https://example.com/call?room=${message.room}` });
    }

  } else if (message.type === 'signaling') {
    const roomName = message.room;
    const senderTabId = sender.tab.id;

    if (!signalingMessages[roomName]) {
      signalingMessages[roomName] = [];
    }
    signalingMessages[roomName].push({ senderTabId, payload: message.payload });
    console.log(`Stored signaling message for room ${roomName} from tab ${senderTabId}`);

    // Attempt to forward the message to another tab in the same room
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        // Avoid sending back to the sender and ensure it's a content script context
        if (tab.id !== senderTabId && tab.url && tab.url.includes(`room=${roomName}`)) {
          console.log(`Forwarding signaling message to tab ${tab.id} in room ${roomName}`);
          chrome.tabs.sendMessage(tab.id, { type: 'signaling', payload: message.payload, room: roomName });
          // For simplicity, we send to the first other tab found. In a multi-party call, this logic would be more complex.
          break;
        }
      }
    });
  }

  // Acknowledge receipt of the message
  sendResponse({ status: 'Message received by background script' });
  return true; // Indicates that sendResponse will be called asynchronously
});
