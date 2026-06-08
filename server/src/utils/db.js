import mongoose from 'mongoose';

const connectionStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
let lastConnectionError = null;

function dbNameFromUri(uri) {
  const match = String(uri).match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
  if (!match || !match[1]) return null;
  return decodeURIComponent(match[1]).trim() || null;
}

function resolveDbName(uri) {
  return process.env.MONGODB_DB || dbNameFromUri(uri) || 'executive_engine';
}

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
    dbName: mongoose.connection.name || null,
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

  const dbName = resolveDbName(uri);

  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, dbName });
  } catch (error) {
    lastConnectionError = sanitizeError(error);
    throw error;
  }
  lastConnectionError = null;
  console.log(`MongoDB connected (${dbName})`);
}