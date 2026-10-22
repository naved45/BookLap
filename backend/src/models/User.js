import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  bio: { type: String, maxlength: 300, default: '' },
  genres: [{ type: String, maxlength: 30 }],
  area: { type: String, maxlength: 60, default: '' },
  emailVerified: { type: Boolean, default: false },
  blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  onboarded: { type: Boolean, default: false },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
  failedLogins: { type: Number, default: 0, select: false },
  lockedUntil: { type: Date, select: false },
}, { timestamps: true });
export const User = mongoose.model('User', schema);
export const publicUser = (u) => ({ id: u._id, name: u.name, bio: u.bio, genres: u.genres, area: u.area, createdAt: u.createdAt });
export const selfUser = (u) => ({ ...publicUser(u), email: u.email, role: u.role, wishlist: u.wishlist, emailVerified: u.emailVerified, onboarded: u.onboarded, blocked: u.blocked });
