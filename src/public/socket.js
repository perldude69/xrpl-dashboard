(function() {
  window.XRPL = window.XRPL || {};

  console.log('Client script loaded');
  const socket = io();
  console.log('Socket created, connected:', socket.connected);
  socket.on('connect', () => console.log('Socket connected event'));
  socket.on('disconnect', () => console.log('Socket disconnected event'));

  window.XRPL.socket = socket;
})();