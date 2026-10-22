import { Router } from 'express';
import { z } from 'zod';
import { Swap } from '../models/Swap.js';
import { Listing } from '../models/Listing.js';
import { notify } from '../models/Extra.js';
import { User } from '../models/User.js';
import { HttpError, validate, validObjectId, requireAuth, limits } from '../middleware/index.js';

const r = Router();
r.use(requireAuth, limits.user());

const createSchema = z.object({
  offeredListingId: z.string().length(24),
  requestedListingId: z.string().length(24),
  cashDifference: z.number().min(0).max(100000).default(0),
  cashPayer: z.enum(['none', 'from', 'to']).default('none'),
}).strict().refine((d) => (d.cashDifference > 0) === (d.cashPayer !== 'none'), { message: 'Choose who pays the cash difference', path: ['cashPayer'] });

const load = async (req) => {
  const s = await Swap.findById(req.params.id);
  if (!s) throw new HttpError(404, 'Swap not found.');
  const me = req.user._id;
  if (!s.fromUserId.equals(me) && !s.toUserId.equals(me)) throw new HttpError(404, 'Swap not found.'); // no object-level leak
  return s;
};
const log = (s, status, by) => { s.status = status; s.history.push({ status, by }); };
const release = (s, status) => Listing.updateMany({ _id: { $in: [s.offeredListingId, s.requestedListingId] }, status: 'reserved' }, { status });

r.get('/', async (req, res, next) => {
  try {
    const me = req.user._id;
    const items = await Swap.find({ $or: [{ fromUserId: me }, { toUserId: me }] }).sort({ createdAt: -1 }).limit(100)
      .populate('offeredListingId', 'title author coverUrl').populate('requestedListingId', 'title author coverUrl')
      .populate('fromUserId', 'name').populate('toUserId', 'name');
    res.json({ items });
  } catch (e) { next(e); }
});

r.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const { offeredListingId, requestedListingId, cashDifference, cashPayer } = req.body;
    const [offered, requested] = await Promise.all([Listing.findById(offeredListingId), Listing.findById(requestedListingId)]);
    if (!offered || !requested) throw new HttpError(404, 'Book not found.');
    if (!offered.ownerId.equals(req.user._id)) throw new HttpError(403, 'You can only offer your own books.');
    if (requested.ownerId.equals(req.user._id)) throw new HttpError(400, 'You cannot swap with yourself.');
    if (offered.status !== 'active' || requested.status !== 'active') throw new HttpError(409, 'One of these books is no longer available.');
    const owner = await User.findById(requested.ownerId);
    if (owner?.blocked.some((b) => b.equals(req.user._id))) throw new HttpError(403, 'You cannot send a request to this reader.');
    if (requested.tradeMode === 'sale' || offered.tradeMode === 'sale') throw new HttpError(400, 'Both books must be open to swapping.');
    const s = await Swap.create({
      fromUserId: req.user._id, toUserId: requested.ownerId, offeredListingId, requestedListingId, cashDifference, cashPayer,
      termsSnapshot: { offered: { title: offered.title, author: offered.author, price: offered.price }, requested: { title: requested.title, author: requested.author, price: requested.price }, cashDifference, cashPayer },
      history: [{ status: 'pending', by: req.user._id }],
    });
    notify(requested.ownerId, 'swap', `${req.user.name} proposed a swap for "${requested.title}"`, '/swaps');
    res.status(201).json({ swap: s });
  } catch (e) { next(e); }
});

r.get('/:id', validObjectId('id'), async (req, res, next) => { try { res.json({ swap: await load(req) }); } catch (e) { next(e); } });

r.post('/:id/accept', validObjectId('id'), async (req, res, next) => {
  try {
    const s = await load(req);
    if (!s.toUserId.equals(req.user._id)) throw new HttpError(403, 'Only the book owner can accept.');
    if (s.status !== 'pending') throw new HttpError(409, `This swap is already ${s.status}.`);
    // Atomic reservation: each copy flips active -> reserved only if still active; roll back on failure
    const first = await Listing.findOneAndUpdate({ _id: s.offeredListingId, status: 'active' }, { status: 'reserved' });
    const second = first && await Listing.findOneAndUpdate({ _id: s.requestedListingId, status: 'active' }, { status: 'reserved' });
    if (!first || !second) {
      if (first) await Listing.updateOne({ _id: s.offeredListingId, status: 'reserved' }, { status: 'active' });
      throw new HttpError(409, 'One of these books is no longer available.');
    }
    log(s, 'accepted', req.user._id); await s.save(); notify(s.fromUserId, 'swap', 'Your swap request was accepted', '/swaps'); res.json({ swap: s });
  } catch (e) { next(e); }
});

r.post('/:id/reject', validObjectId('id'), async (req, res, next) => {
  try {
    const s = await load(req);
    if (!s.toUserId.equals(req.user._id)) throw new HttpError(403, 'Only the book owner can reject.');
    if (s.status !== 'pending') throw new HttpError(409, `This swap is already ${s.status}.`);
    log(s, 'rejected', req.user._id); await s.save(); res.json({ swap: s });
  } catch (e) { next(e); }
});

r.post('/:id/cancel', validObjectId('id'), async (req, res, next) => {
  try {
    const s = await load(req);
    if (!['pending', 'accepted'].includes(s.status)) throw new HttpError(409, `This swap is already ${s.status}.`);
    if (s.status === 'pending' && !s.fromUserId.equals(req.user._id)) throw new HttpError(403, 'Only the requester can cancel a pending swap.');
    if (s.status === 'accepted') await release(s, 'active');
    log(s, 'cancelled', req.user._id); await s.save(); res.json({ swap: s });
  } catch (e) { next(e); }
});

// Both people must confirm the handover before the swap completes
r.post('/:id/complete', validObjectId('id'), async (req, res, next) => {
  try {
    const s = await load(req);
    if (s.status !== 'accepted') throw new HttpError(409, 'Only accepted swaps can be completed.');
    if (!s.confirmedBy.some((id) => id.equals(req.user._id))) s.confirmedBy.push(req.user._id);
    if (s.confirmedBy.length === 2) { await release(s, 'completed'); log(s, 'completed', req.user._id); }
    await s.save(); res.json({ swap: s });
  } catch (e) { next(e); }
});
// Counteroffer: closes this request and opens a new one with changed cash terms, owned by the responder
const counterSchema = z.object({ cashDifference: z.number().min(0).max(100000), cashPayer: z.enum(['none', 'from', 'to']) }).strict()
  .refine((d) => (d.cashDifference > 0) === (d.cashPayer !== 'none'), { message: 'Choose who pays the cash difference', path: ['cashPayer'] });
r.post('/:id/counter', validObjectId('id'), validate(counterSchema), async (req, res, next) => {
  try {
    const s = await load(req);
    if (!s.toUserId.equals(req.user._id)) throw new HttpError(403, 'Only the book owner can counter.');
    if (s.status !== 'pending') throw new HttpError(409, `This swap is already ${s.status}.`);
    // new request is from the responder, so cashPayer ('from' = responder pays) keeps its meaning
    const n = await Swap.create({ fromUserId: s.toUserId, toUserId: s.fromUserId, offeredListingId: s.requestedListingId, requestedListingId: s.offeredListingId,
      cashDifference: req.body.cashDifference, cashPayer: req.body.cashPayer,
      termsSnapshot: { counterOf: s._id, cashDifference: req.body.cashDifference }, history: [{ status: 'pending', by: req.user._id }] });
    log(s, 'rejected', req.user._id); s.history.push({ status: 'countered', by: req.user._id }); await s.save();
    notify(s.fromUserId, 'swap', `${req.user.name} sent a counteroffer`, '/swaps');
    res.status(201).json({ swap: n });
  } catch (e) { next(e); }
});
export default r;
