import mongoose from 'mongoose';

const connectionStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export function getDbStatus() {
  return connectionStates[mongoose.connection.readyState] || 'unknown';
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function connectDb() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');
}