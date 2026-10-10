import mongoose from 'mongoose';
import { statuses } from '../../shared/statuses.js';

const applicationSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, required: true, trim: true, maxlength: 150 },
    location: { type: String, trim: true, default: '', maxlength: 100 },
    status: { type: String, enum: statuses, default: 'Wishlist' },
    url: { type: String, default: '', maxlength: 2000 },
    appliedDate: { type: String, default: '' },
    notes: { type: String, default: '', maxlength: 5000 },
  },
  { timestamps: true },
);

applicationSchema.index({ status: 1, createdAt: -1 });
export const Application = mongoose.model('Application', applicationSchema);
