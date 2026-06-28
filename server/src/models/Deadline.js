import mongoose from 'mongoose';

const deadlineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    dueAt: { type: Date, required: true },
    outcome: { type: String, enum: ['pending', 'pass', 'fail'], default: 'pending' },
    passedAt: Date,
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const Deadline = mongoose.model('Deadline', deadlineSchema);