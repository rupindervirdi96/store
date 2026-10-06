import { createServer } from 'node:http';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { createApp } from './app';
import { startPaymentSweeper, stopPaymentSweeper } from './modules/payments/payments.service';
import { closeSocket, initSocket } from './realtime/socket';

async function main() {
  await connectDatabase();

  const app = createApp();
  const httpServer = createServer(app);
  initSocket(httpServer);
  startPaymentSweeper();

  // Bind 0.0.0.0 so Render's router can reach the process.
  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[api] listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  // Render sends SIGTERM on deploys; drain connections before exiting.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[api] ${signal} received, shutting down`);
    const force = setTimeout(() => process.exit(1), 10_000).unref();
    try {
      stopPaymentSweeper();
      await closeSocket(); // also closes the http server
      await disconnectDatabase();
      clearTimeout(force);
      process.exit(0);
    } catch (err) {
      console.error('[api] error during shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => console.error('[api] unhandled rejection', reason));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
