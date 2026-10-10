import mongoose from 'mongoose';
import { statuses } from '../../shared/statuses.js';

const interviewRoundSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, maxlength: 100 },
    at: { type: String, required: true },
    status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'], default: 'Scheduled' },
    notes: { type: String, default: '', maxlength: 1000 },
  },
  { _id: false },
);
const activitySchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const applicationSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, required: true, trim: true, maxlength: 150 },
    location: { type: String, trim: true, default: '', maxlength: 100 },
    status: { type: String, enum: statuses, default: 'Wishlist' },
    url: { type: String, default: '', maxlength: 2000 },
    appliedDate: { type: String, default: '' },
    notes: { type: String, default: '', maxlength: 5000 },
    followUpDate: { type: String, default: '' },
    nextStep: { type: String, default: '', maxlength: 200 },
    interviewAt: { type: String, default: '' },
    interviewNotes: { type: String, default: '', maxlength: 1000 },
    interviewRounds: { type: [interviewRoundSchema], default: [] },
    activity: { type: [activitySchema], default: [] },
  },
  { timestamps: true },
);

applicationSchema.index({ status: 1, createdAt: -1 });
export const Application = mongoose.model('Application', applicationSchema);
