import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    includeSaturday: { type: Boolean, default: false },
    includeSunday: { type: Boolean, default: false },
    anchorTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    notificationsEnabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Setting = mongoose.model('Setting', settingSchema);