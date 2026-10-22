import express, { Router } from 'express';
import { saveImage, MAX_BYTES } from './uploads.js';
import { z } from 'zod';
import { Listing, CONDITIONS, MODES } from '../models/Listing.js';
import { User, publicUser } from '../models/User.js';
import { HttpError, validate, validObjectId, requireAuth, limits } from '../middleware/index.js';

const r = Router();
const base = z.object({
  title: z.string().trim().min(1).max(140),
  author: z.string().trim().min(1).max(100),
  isbn: z.string().trim().max(20).optional(),
  category: z.string().trim().min(1).max(40),
  language: z.string().trim().max(30).optional(),
  condition: z.enum(CONDITIONS),
  description: z.string().trim().max(1000).optional(),
  price: z.number().min(0).max(100000).optional(),
  tradeMode: z.enum(MODES),
  coverUrl: z.string().trim().url().max(500).regex(/^https:\/\//, 'Use an https image link').optional().or(z.literal('')),
}).strict();
const createSchema = base.refine((d) => d.tradeMode === 'swap' || (d.price ?? 0) > 0, { message: 'Set a price for sale listings', path: ['price'] });
const updateSchema = base.partial();
const searchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(40).optional(),
  condition: z.enum(CONDITIONS).optional(),
  tradeMode: z.enum(MODES).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['new', 'price_asc', 'price_desc']).default('new'),
  mine: z.enum(['1']).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
}).strict();

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const present = (l, owner) => ({ ...l.toObject(), id: l._id, owner: owner ? publicUser(owner) : undefined });

r.get('/', limits.public(), validate(searchSchema, 'query'), async (req, res, next) => {
  try {
    const { q, category, condition, tradeMode, minPrice, maxPrice, sort, page, limit } = req.query;
    const f = { status: 'active' };
    if (q) { const rx = new RegExp(esc(q), 'i'); f.$or = [{ title: rx }, { author: rx }]; }
    if (category) f.category = category;
    if (condition) f.condition = condition;
    if (tradeMode) f.tradeMode = tradeMode === 'swap' ? { $in: ['swap', 'both'] } : tradeMode === 'sale' ? { $in: ['sale', 'both'] } : 'both';
    if (minPrice != null || maxPrice != null) f.price = { ...(minPrice != null && { $gte: minPrice }), ...(maxPrice != null && { $lte: maxPrice }) };
    const order = sort === 'price_asc' ? { price: 1 } : sort === 'price_desc' ? { price: -1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
      Listing.find(f).sort(order).skip((page - 1) * limit).limit(limit).populate('ownerId', 'name area'),
      Listing.countDocuments(f),
    ]);
    res.json({ items: items.map((l) => present(l, l.ownerId)), total, page, pages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

r.get('/mine', requireAuth, async (req, res, next) => {
  try { const items = await Listing.find({ ownerId: req.user._id, status: { $ne: 'removed' } }).sort({ createdAt: -1 }); res.json({ items: items.map((l) => present(l)) }); } catch (e) { next(e); }
});

r.get('/:id', limits.public(), validObjectId('id'), async (req, res, next) => {
  try {
    const l = await Listing.findOne({ _id: req.params.id, status: { $ne: 'removed' } });
    if (!l) throw new HttpError(404, 'Listing not found.');
    const owner = await User.findById(l.ownerId);
    res.json({ listing: present(l, owner) });
  } catch (e) { next(e); }
});

r.post('/', requireAuth, limits.user(), validate(createSchema), async (req, res, next) => {
  try { const l = await Listing.create({ ...req.body, ownerId: req.user._id }); res.status(201).json({ listing: present(l) }); } catch (e) { next(e); }
});

r.patch('/:id', requireAuth, validObjectId('id'), validate(updateSchema), async (req, res, next) => {
  try {
    const l = await Listing.findById(req.params.id);
    if (!l || l.status === 'removed') throw new HttpError(404, 'Listing not found.');
    if (!l.ownerId.equals(req.user._id)) throw new HttpError(403, 'Not allowed.');
    if (l.status === 'reserved') throw new HttpError(409, 'This book is part of an active swap and cannot be edited.');
    Object.assign(l, req.body); await l.save(); res.json({ listing: present(l) });
  } catch (e) { next(e); }
});

r.post('/:id/photo', requireAuth, limits.user(), validObjectId('id'), express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_BYTES }), async (req, res, next) => {
  try {
    const l = await Listing.findById(req.params.id);
    if (!l || l.status === 'removed') throw new HttpError(404, 'Listing not found.');
    if (!l.ownerId.equals(req.user._id)) throw new HttpError(403, 'Not allowed.');
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Send a JPEG, PNG or WebP image up to 2 MB.');
    const name = saveImage(req.body); if (!name) throw new HttpError(400, 'That file is not a valid JPEG, PNG or WebP image.');
    l.coverUrl = `/api/v1/uploads/${name}`; await l.save(); res.json({ listing: present(l) });
  } catch (e) { next(e); }
});

r.delete('/:id', requireAuth, validObjectId('id'), async (req, res, next) => {
  try {
    const l = await Listing.findById(req.params.id);
    if (!l || l.status === 'removed') throw new HttpError(404, 'Listing not found.');
    if (!l.ownerId.equals(req.user._id)) throw new HttpError(403, 'Not allowed.');
    if (l.status === 'reserved') throw new HttpError(409, 'This book is part of an active swap.');
    l.status = 'removed'; await l.save(); res.json({ ok: true });
  } catch (e) { next(e); }
});

// Wishlist
r.get('/wishlist/all', requireAuth, async (req, res, next) => {
  try { const items = await Listing.find({ _id: { $in: req.user.wishlist }, status: { $ne: 'removed' } }); res.json({ items: items.map((l) => present(l)) }); } catch (e) { next(e); }
});
r.post('/:id/wishlist', requireAuth, validObjectId('id'), async (req, res, next) => {
  try { await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: req.params.id } }); res.json({ ok: true }); } catch (e) { next(e); }
});
r.delete('/:id/wishlist', requireAuth, validObjectId('id'), async (req, res, next) => {
  try { await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.id } }); res.json({ ok: true }); } catch (e) { next(e); }
});
export default r;
