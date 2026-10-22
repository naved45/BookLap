import mongoose from 'mongoose';
const id = { type: mongoose.Schema.Types.ObjectId, ref: 'User' };
const lid = { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' };
const schema = new mongoose.Schema({
  fromUserId: { ...id, required: true, index: true },
  toUserId: { ...id, required: true, index: true },
  offeredListingId: { ...lid, required: true },
  requestedListingId: { ...lid, required: true },
  cashDifference: { type: Number, default: 0, min: 0, max: 100000 },
  cashPayer: { type: String, enum: ['none', 'from', 'to'], default: 'none' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'], default: 'pending' },
  confirmedBy: [id],
  termsSnapshot: { type: Object },
  history: [{ status: String, by: id, at: { type: Date, default: Date.now } }],
}, { timestamps: true });
export const Swap = mongoose.model('Swap', schema);
