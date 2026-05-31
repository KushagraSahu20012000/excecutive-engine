import mongoose from 'mongoose';

const goalActionCompletionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    actionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GoalAction', required: true, index: true },
    date: { type: String, required: true }
  },
  { timestamps: true }
);

goalActionCompletionSchema.index({ userId: 1, actionId: 1, date: 1 }, { unique: true });

export const GoalActionCompletion = mongoose.model('GoalActionCompletion', goalActionCompletionSchema);