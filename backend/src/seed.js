// Demo data only. Clearly marked; not real users or transactions.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { User } from './models/User.js';
import { Listing } from './models/Listing.js';
await mongoose.connect(config.mongoUri);
const passwordHash = await bcrypt.hash('demo-password-1', 12);
const a = await User.findOneAndUpdate({ email: 'demo.reader1@example.com' }, { name: 'Demo Reader 1 (demo)', passwordHash }, { upsert: true, new: true });
const b = await User.findOneAndUpdate({ email: 'demo.reader2@example.com' }, { name: 'Demo Reader 2 (demo)', passwordHash }, { upsert: true, new: true });
await User.findOneAndUpdate({ email: 'demo.admin@example.com' }, { name: 'Demo Admin (demo)', passwordHash, role: 'admin' }, { upsert: true, new: true });
await Listing.deleteMany({ ownerId: { $in: [a._id, b._id] } });
const books = [
  ['Atomic Habits', 'James Clear', 'Self Help', 'good', 'both', 250],
  ['Clean Code', 'Robert C. Martin', 'Technology', 'like_new', 'both', 450],
  ['Dune', 'Frank Herbert', 'Fiction', 'fair', 'swap', 0],
  ['Rich Dad Poor Dad', 'Robert T. Kiyosaki', 'Business', 'good', 'sale', 180],
];
await Listing.insertMany(books.map(([title, author, category, condition, tradeMode, price], i) => ({ ownerId: i % 2 ? b._id : a._id, title, author, category, condition, tradeMode, price, description: 'Demo listing for development.' })));
console.log('Seeded demo data. Logins (password demo-password-1): demo.reader1@example.com, demo.reader2@example.com, demo.admin@example.com');
await mongoose.disconnect();
