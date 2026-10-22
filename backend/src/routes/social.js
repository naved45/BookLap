import { Router } from 'express';
import { z } from 'zod';
import { Conversation, Message, Notification, Review, Report, Community, Post, notify } from '../models/Extra.js';
import { Swap } from '../models/Swap.js';
import { Order } from '../models/Extra.js';
import { Listing } from '../models/Listing.js';
import { User, publicUser } from '../models/User.js';
import { HttpError, validate, validObjectId, requireAuth, limits } from '../middleware/index.js';
const r = Router(); const id24 = z.string().length(24);

// ---- Messages ----
r.post('/conversations', requireAuth, limits.user(), validate(z.object({ userId: id24, listingId: id24.optional() }).strict()), async (req, res, next) => {
  try {
    const { userId, listingId } = req.body;
    if (userId === String(req.user._id)) throw new HttpError(400, 'You cannot message yourself.');
    const other = await User.findOne({ _id: userId, status: 'active' });
    if (!other) throw new HttpError(404, 'User not found.');
    if (other.blocked.some((b) => b.equals(req.user._id)) || req.user.blocked.some((b) => b.equals(other._id))) throw new HttpError(403, 'You cannot message this reader.');
    let c = await Conversation.findOne({ participantIds: { $all: [req.user._id, userId], $size: 2 }, listingId: listingId || null });
    if (!c) c = await Conversation.create({ participantIds: [req.user._id, userId], listingId });
    res.status(201).json({ conversation: c });
  } catch (e) { next(e); }
});
r.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const items = await Conversation.find({ participantIds: req.user._id }).sort({ lastMessageAt: -1 }).limit(50).populate('participantIds', 'name').populate('listingId', 'title');
    const out = await Promise.all(items.map(async (c) => ({ ...c.toObject(), unread: await Message.countDocuments({ conversationId: c._id, senderId: { $ne: req.user._id }, readBy: { $ne: req.user._id } }) })));
    res.json({ items: out });
  } catch (e) { next(e); }
});
const mine = async (req) => { const c = await Conversation.findOne({ _id: req.params.id, participantIds: req.user._id }); if (!c) throw new HttpError(404, 'Conversation not found.'); return c; };
r.get('/conversations/:id/messages', requireAuth, validObjectId('id'), async (req, res, next) => {
  try { const c = await mine(req); await Message.updateMany({ conversationId: c._id, readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } }); res.json({ items: await Message.find({ conversationId: c._id }).sort({ createdAt: 1 }).limit(200) }); } catch (e) { next(e); }
});
r.post('/conversations/:id/messages', requireAuth, limits.user(), validObjectId('id'), validate(z.object({ body: z.string().trim().min(1).max(1000) }).strict()), async (req, res, next) => {
  try {
    const c = await mine(req);
    const otherId = c.participantIds.find((p) => !p.equals(req.user._id)); const otherU = await User.findById(otherId);
    if (!otherU || otherU.blocked.some((b) => b.equals(req.user._id)) || req.user.blocked.some((b) => b.equals(otherId))) throw new HttpError(403, 'You cannot message this reader.');
    const m = await Message.create({ conversationId: c._id, senderId: req.user._id, body: req.body.body, readBy: [req.user._id] });
    c.lastMessageAt = new Date(); await c.save();
    const other = c.participantIds.find((p) => !p.equals(req.user._id)); notify(other, 'message', `New message from ${req.user.name}`, '/messages');
    res.status(201).json({ message: m });
  } catch (e) { next(e); }
});

// ---- Notifications ----
r.get('/notifications', requireAuth, async (req, res, next) => { try { res.json({ items: await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50), unread: await Notification.countDocuments({ userId: req.user._id, readAt: null }) }); } catch (e) { next(e); } });
r.post('/notifications/read-all', requireAuth, async (req, res, next) => { try { await Notification.updateMany({ userId: req.user._id, readAt: null }, { readAt: new Date() }); res.json({ ok: true }); } catch (e) { next(e); } });

// ---- Reviews (completed transactions only, one per author) ----
r.post('/reviews', requireAuth, limits.user(), validate(z.object({ transactionType: z.enum(['swap', 'order']), transactionId: id24, rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).strict()), async (req, res, next) => {
  try {
    const { transactionType: t, transactionId, rating, comment } = req.body; const me = String(req.user._id);
    const tx = t === 'swap' ? await Swap.findById(transactionId) : await Order.findById(transactionId);
    const parties = tx && (t === 'swap' ? [tx.fromUserId, tx.toUserId] : [tx.buyerId, tx.sellerId]).map(String);
    if (!tx || !parties.includes(me) || tx.status !== 'completed') throw new HttpError(403, 'You can only review completed transactions you took part in.');
    const target = parties.find((p) => p !== me);
    try { await Review.create({ authorId: req.user._id, targetUserId: target, transactionType: t, transactionId, rating, comment }); }
    catch (e) { if (e.code === 11000) throw new HttpError(409, 'You already reviewed this.'); throw e; }
    notify(target, 'review', `${req.user.name} left you a review`, `/u/${me}`);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Public profile ----
r.get('/users/:id', limits.public(), validObjectId('id'), async (req, res, next) => {
  try {
    const u = await User.findOne({ _id: req.params.id, status: 'active' }); if (!u) throw new HttpError(404, 'User not found.');
    const [listings, reviews] = await Promise.all([Listing.find({ ownerId: u._id, status: 'active' }).sort({ createdAt: -1 }).limit(24), Review.find({ targetUserId: u._id }).sort({ createdAt: -1 }).limit(20).populate('authorId', 'name')]);
    const avg = reviews.length ? reviews.reduce((a, x) => a + x.rating, 0) / reviews.length : null;
    res.json({ user: publicUser(u), listings: listings.map((l) => ({ ...l.toObject(), id: l._id })), reviews, avgRating: avg });
  } catch (e) { next(e); }
});

// ---- Reports ----
r.post('/reports', requireAuth, limits.user(), validate(z.object({ targetType: z.enum(['listing', 'user', 'post']), targetId: id24, reason: z.string().trim().min(5).max(500) }).strict()), async (req, res, next) => {
  try { await Report.create({ ...req.body, reporterId: req.user._id }); res.status(201).json({ ok: true }); } catch (e) { next(e); }
});

// ---- Community ----
r.get('/communities', limits.public(), async (_req, res, next) => { try { const items = await Community.find().sort({ createdAt: -1 }).limit(50); res.json({ items: items.map((c) => ({ id: c._id, name: c.name, description: c.description, members: c.members.length })) }); } catch (e) { next(e); } });
r.post('/communities', requireAuth, limits.user(), validate(z.object({ name: z.string().trim().min(3).max(60), description: z.string().trim().max(300).optional() }).strict()), async (req, res, next) => {
  try { const c = await Community.create({ ...req.body, ownerId: req.user._id, members: [req.user._id] }); res.status(201).json({ community: c }); } catch (e) { if (e.code === 11000) return next(new HttpError(409, 'A group with that name exists.')); next(e); }
});
r.post('/communities/:id/join', requireAuth, validObjectId('id'), async (req, res, next) => { try { const c = await Community.findByIdAndUpdate(req.params.id, { $addToSet: { members: req.user._id } }); if (!c) throw new HttpError(404, 'Group not found.'); res.json({ ok: true }); } catch (e) { next(e); } });
r.post('/communities/:id/leave', requireAuth, validObjectId('id'), async (req, res, next) => { try { await Community.updateOne({ _id: req.params.id }, { $pull: { members: req.user._id } }); res.json({ ok: true }); } catch (e) { next(e); } });
r.get('/communities/:id', limits.public(), validObjectId('id'), async (req, res, next) => {
  try {
    const c = await Community.findById(req.params.id); if (!c) throw new HttpError(404, 'Group not found.');
    const posts = await Post.find({ communityId: c._id, status: 'active' }).sort({ createdAt: -1 }).limit(50).populate('authorId', 'name');
    res.json({ community: { id: c._id, name: c.name, description: c.description, members: c.members.length }, posts });
  } catch (e) { next(e); }
});
r.post('/communities/:id/posts', requireAuth, limits.user(), validObjectId('id'), validate(z.object({ body: z.string().trim().min(1).max(1000) }).strict()), async (req, res, next) => {
  try {
    const c = await Community.findById(req.params.id); if (!c) throw new HttpError(404, 'Group not found.');
    if (!c.members.some((m) => m.equals(req.user._id))) throw new HttpError(403, 'Join the group to post.');
    res.status(201).json({ post: await Post.create({ authorId: req.user._id, communityId: c._id, body: req.body.body }) });
  } catch (e) { next(e); }
});
export default r;
