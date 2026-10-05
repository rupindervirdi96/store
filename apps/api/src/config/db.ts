import mongoose from 'mongoose';
import { env, isProd } from './env';

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => console.log('[db] connected'));
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('error', (err) => console.error('[db] error', err));

  return mongoose.connect(env.MONGODB_URI, {
    // Indexes are built by `syncIndexes` in the seed script in production;
    // auto-building on every boot is convenient locally but costly at scale.
    autoIndex: !isProd,
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}
