import mongoose from 'mongoose';

const goalNoteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    kind: { type: String, enum: ['works', 'doesnt'], required: true },
    body: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export const GoalNote = mongoose.model('GoalNote', goalNoteSchema);