import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    displayName: { type: String, required: true },
    passwordHash: String,
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    avatarUrl: String
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);