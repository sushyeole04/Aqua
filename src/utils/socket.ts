import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3003';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });
  }
  return socket;
};

export const connectSocket = (roomName?: string) => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
    s.on('connect', () => {
      console.log('[Socket] Connected to server');
      if (roomName) {
        s.emit('join', roomName);
      }
    });
  } else if (roomName) {
    s.emit('join', roomName);
  }
};

export const disconnectSocket = (roomName?: string) => {
  if (socket) {
    if (roomName) {
      socket.emit('leave', roomName);
    }
    socket.disconnect();
    socket = null;
    console.log('[Socket] Disconnected from server');
  }
};
