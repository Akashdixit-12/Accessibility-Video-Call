// inject.js

console.log('inject.js has been injected!');

// Create video elements for local and remote streams
const localVideo = document.createElement('video');
localVideo.id = 'localVideo';
localVideo.autoplay = true;
localVideo.muted = true; // Mute local video to prevent echo
localVideo.style.cssText = 'width: 200px; height: 150px; border: 1px solid black; margin: 10px;';
document.body.appendChild(localVideo);

const remoteVideo = document.createElement('video');
remoteVideo.id = 'remoteVideo';
remoteVideo.autoplay = true;
remoteVideo.style.cssText = 'width: 200px; height: 150px; border: 1px solid black; margin: 10px;';
document.body.appendChild(remoteVideo);

const captionDisplay = document.createElement('div');
captionDisplay.id = 'captionDisplay';
captionDisplay.style.cssText = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background-color: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px; font-size: 1.2em; max-width: 80%; text-align: center; z-index: 1000;';
document.body.appendChild(captionDisplay);

const signLanguageDisplay = document.createElement('div');
signLanguageDisplay.id = 'signLanguageDisplay';
signLanguageDisplay.style.cssText = 'position: absolute; top: 20px; right: 20px; width: 150px; height: 150px; border: 2px solid blue; background-color: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; overflow: hidden; z-index: 1000;';
document.body.appendChild(signLanguageDisplay);

// Web Speech API for real-time captioning
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isRecognizing = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isRecognizing = true;
    console.log('Speech recognition started.');
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    captionDisplay.textContent = finalTranscript || interimTranscript;
    if (finalTranscript) {
      console.log('Final Transcript:', finalTranscript);
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(finalTranscript);
        console.log('Sent caption via data channel:', finalTranscript);
      }
      displaySignLanguage(finalTranscript);
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    isRecognizing = false;
  };

  recognition.onend = () => {
    console.log('Speech recognition ended.');
    isRecognizing = false;
    // If it ended unexpectedly, restart it (e.g., if continuous is true but stops)
    // if (localStream && isRecognizing) {
    //   recognition.start();
    // }
  };
} else {
  console.warn('Web Speech API not supported in this browser.');
  captionDisplay.textContent = 'Speech recognition not supported.';
}

// This script has access to the page's DOM and global window object
// WebRTC logic will go here.

let peerConnection;
let localStream;
let dataChannel; // Added for data channel
const roomName = getRoomNameFromUrl();

function getRoomNameFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room');
}

// STUN servers for NAT traversal
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

async function startWebRTC() {
  if (!roomName) {
    console.error('Room name not found in URL. Cannot start WebRTC.');
    return;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    console.log('Local stream obtained:', localStream);

    // Start speech recognition when local media is obtained
    if (recognition && !isRecognizing) {
      recognition.start();
    }

    peerConnection = new RTCPeerConnection(configuration);

    // Setup Data Channel for captions
    dataChannel = peerConnection.createDataChannel('captions');
    dataChannel.onopen = (event) => {
      console.log('Data channel opened!', event);
    };
    dataChannel.onmessage = (event) => {
      console.log('Received message on data channel:', event.data);
      // Display remote captions (we'll need a separate div for this, or clear the existing one)
      // For now, let's prepend to the existing captionDisplay to differentiate
      captionDisplay.textContent = `Remote: ${event.data}\n${captionDisplay.textContent}`;
      displaySignLanguage(event.data);
    };
    dataChannel.onclose = () => console.log('Data channel closed.');
    dataChannel.onerror = (error) => console.error('Data channel error:', error);

    // Listener for receiving data channels from remote peer
    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      dataChannel.onopen = () => console.log('Remote data channel opened!');
      dataChannel.onmessage = (event) => {
        console.log('Received remote message on data channel:', event.data);
        captionDisplay.textContent = `Remote: ${event.data}\n${captionDisplay.textContent}`;
        displaySignLanguage(event.data);
      };
      dataChannel.onclose = () => console.log('Remote data channel closed.');
      dataChannel.onerror = (error) => console.error('Remote data channel error:', error);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        sendMessageToExtension('signaling', { type: 'iceCandidate', candidate: event.candidate, room: roomName });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Received remote stream track:', event.streams[0]);
      document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    console.log('RTCPeerConnection initialized.');

  } catch (error) {
    console.error('Error starting WebRTC:', error);
  }
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) {
    return;
  }
  if (event.data.type && (event.data.type === 'FROM_EXTENSION')) {
    console.log('Injected script received message from extension:', event.data);
    if (event.data.payload.action === 'startCall') {
      console.log('Initiating WebRTC call...');
      await startWebRTC();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log('Sending SDP offer:', offer);
      sendMessageToExtension('signaling', { type: 'offer', sdp: offer, room: roomName });

    } else if (event.data.payload.action === 'joinCall') {
      console.log('Joining WebRTC call...');
      await startWebRTC();
      // Wait for an offer from the initiator
    } else if (event.data.payload.type === 'signaling') {
      const signalingMessage = event.data.payload;
      if (signalingMessage.room !== roomName) return; // Only process messages for this room

      if (signalingMessage.type === 'offer') {
        console.log('Received SDP offer:', signalingMessage.sdp);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signalingMessage.sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('Sending SDP answer:', answer);
        sendMessageToExtension('signaling', { type: 'answer', sdp: answer, room: roomName });

      } else if (signalingMessage.type === 'answer') {
        console.log('Received SDP answer:', signalingMessage.sdp);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signalingMessage.sdp));

      } else if (signalingMessage.type === 'iceCandidate') {
        console.log('Received ICE candidate:', signalingMessage.candidate);
        await peerConnection.addIceCandidate(new RTCIceCandidate(signalingMessage.candidate));
      }
    }
  }
});

// Helper to send messages to the background script via content script
function sendMessageToExtension(type, payload) {
  window.postMessage({ type: 'FROM_PAGE', messageType: type, payload: payload }, '*');
}

/**
 * Displays sign language images based on the given text.
 * @param {string} text The text to convert to sign language.
 */
function displaySignLanguage(text) {
  signLanguageDisplay.innerHTML = ''; // Clear previous signs
  const words = text.toLowerCase().split(' ');
  words.forEach(word => {
    const imageUrl = signLanguageDictionary[word];
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = chrome.runtime.getURL(imageUrl);
      img.alt = word;
      img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; margin: 2px;';
      signLanguageDisplay.appendChild(img);
    } else {
      console.log(`No sign found for word: ${word}`);
    }
  });
}
