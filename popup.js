document.addEventListener('DOMContentLoaded', () => {
  const startCallButton = document.getElementById('startCallButton');
  const joinCallButton = document.getElementById('joinCallButton');
  const roomNameInput = document.getElementById('roomNameInput');

  startCallButton.addEventListener('click', () => {
    const roomName = roomNameInput.value;
    if (roomName) {
      chrome.runtime.sendMessage({ action: 'startCall', room: roomName });
      console.log(`Starting call in room: ${roomName}`);
    } else {
      alert('Please enter a room name to start a call.');
    }
  });

  joinCallButton.addEventListener('click', () => {
    const roomName = roomNameInput.value;
    if (roomName) {
      chrome.runtime.sendMessage({ action: 'joinCall', room: roomName });
      console.log(`Joining call in room: ${roomName}`);
    } else {
      alert('Please enter a room name to join a call.');
    }
  });
});
