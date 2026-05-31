import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    deadlineAt: { type: Date, required: true }
  },
  { timestamps: true }
);

export const Goal = mongoose.model('Goal', goalSchema);