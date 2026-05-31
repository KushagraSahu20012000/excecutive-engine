import mongoose from 'mongoose';

const goalActionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    title: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export const GoalAction = mongoose.model('GoalAction', goalActionSchema);