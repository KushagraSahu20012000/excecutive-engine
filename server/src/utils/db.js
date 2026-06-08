import mongoose from 'mongoose';

const connectionStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
let lastConnectionError = null;

function sanitizeError(error) {
  if (!error) return null;
  return {
    name: error.name || 'Error',
    code: error.code || error.codeName || undefined,
    message: error.message || 'MongoDB connection failed'
  };
}

export function getDbStatus() {
  return {
    state: connectionStates[mongoose.connection.readyState] || 'unknown',
    error: lastConnectionError
  };
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function connectDb() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const error = new Error('MONGODB_URI is required');
    lastConnectionError = sanitizeError(error);
    throw error;
  }

  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    lastConnectionError = sanitizeError(error);
    throw error;
  }
  lastConnectionError = null;
  console.log('MongoDB connected');
}