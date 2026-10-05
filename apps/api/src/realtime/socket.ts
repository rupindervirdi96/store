import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { ClientToServerEvents, Role, ServerToClientEvents } from '@store/shared';
import { env } from '../config/env';
import { verifyToken } from '../utils/jwt';

interface SocketData {
  userId: string;
  role: Role;
}

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Room layout:
 *   "admins"        every connected admin (operations board)
 *   "user:<userId>" every device/tab of one customer
 *
 * Rooms are joined server-side from the verified JWT, so clients can never
 * subscribe to another customer's order stream.
 */
export const rooms = {
  admins: 'admins',
  user: (userId: string) => `user:${userId}`,
};

let io: IO | null = null;

export function initSocket(httpServer: HttpServer): IO {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    // Render's proxy supports WebSockets; polling remains as a fallback.
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });

  // Authenticate during the handshake: client passes { auth: { token } }.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    try {
      const { sub, role } = verifyToken(token);
      socket.data.userId = sub;
      socket.data.role = role;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: AppSocket) => {
    const { userId, role } = socket.data;
    socket.join(rooms.user(userId));
    if (role === 'admin') socket.join(rooms.admins);

    if (env.NODE_ENV !== 'production') {
      console.log(`[socket] ${role} ${userId} connected (${socket.id})`);
      socket.on('disconnect', (reason) => console.log(`[socket] ${socket.id} disconnected: ${reason}`));
    }
  });

  return io;
}

export function getIO(): IO {
  if (!io) throw new Error('Socket.io has not been initialised');
  return io;
}

export async function closeSocket(): Promise<void> {
  if (io) await io.close();
  io = null;
}
