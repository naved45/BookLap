import mongoose from 'mongoose';
export const CONDITIONS = ['like_new', 'good', 'fair', 'worn'];
export const MODES = ['swap', 'sale', 'both'];
const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  author: { type: String, required: true, trim: true, maxlength: 100 },
  isbn: { type: String, trim: true, maxlength: 20 },
  category: { type: String, required: true, maxlength: 40 },
  language: { type: String, default: 'English', maxlength: 30 },
  condition: { type: String, enum: CONDITIONS, required: true },
  description: { type: String, maxlength: 1000, default: '' },
  price: { type: Number, min: 0, max: 100000, default: 0 },
  currency: { type: String, default: 'INR' },
  tradeMode: { type: String, enum: MODES, required: true },
  coverUrl: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['active', 'reserved', 'completed', 'removed'], default: 'active' },
}, { timestamps: true });
schema.index({ status: 1, category: 1, createdAt: -1 });
schema.index({ title: 'text', author: 'text' });
export const Listing = mongoose.model('Listing', schema);
