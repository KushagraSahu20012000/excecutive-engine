import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    position: { type: Number, default: 0 },
    archivedAt: Date
  },
  { timestamps: true }
);

export const Task = mongoose.model('Task', taskSchema);