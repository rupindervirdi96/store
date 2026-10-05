import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@store/shared';
import { API_URL } from './api';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;
let socketToken: string | null = null;

export function getSocket(token: string): AppSocket {
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  // React Native has no XHR polling quirks to work around; go straight to WS.
  socket = io(API_URL, { auth: { token }, transports: ['websocket'], reconnectionDelayMax: 10_000 });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
