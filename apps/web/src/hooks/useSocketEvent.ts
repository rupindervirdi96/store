'use client';

import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents } from '@store/shared';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/store/auth';

type Payload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

/**
 * Subscribes to a server-pushed Socket.io event for as long as the component
 * is mounted. The handler can change every render without re-subscribing.
 */
export function useSocketEvent<E extends keyof ServerToClientEvents>(
  event: E,
  handler: (payload: Payload<E>) => void,
) {
  const token = useAuth((s) => s.token);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!token) return;
    // Socket.io's typed on/off don't narrow over a generic event key.
    const socket = getSocket(token) as unknown as Socket;
    const listener = (payload: Payload<E>) => handlerRef.current(payload);
    socket.on(event as string, listener);
    return () => {
      socket.off(event as string, listener);
    };
  }, [event, token]);
}

/** Live connection state, for "Live" indicators. Also calls `onReconnect` so callers can refetch missed data. */
export function useSocketStatus(onReconnect?: () => void): boolean {
  const token = useAuth((s) => s.token);
  const [connected, setConnected] = useState(false);
  const cb = useRef(onReconnect);
  useEffect(() => {
    cb.current = onReconnect;
  });

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    let wasConnected = socket.connected;
    setConnected(socket.connected);
    const onConnect = () => {
      setConnected(true);
      // Skip the initial connect; refetch after a genuine reconnect.
      if (wasConnected && !socket.recovered) cb.current?.();
      wasConnected = true;
    };
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [token]);

  return connected;
}
