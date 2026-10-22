import { Router } from 'express';
import { z } from 'zod';
import { Order, notify } from '../models/Extra.js';
import { Listing } from '../models/Listing.js';
import { HttpError, validate, validObjectId, requireAuth, limits } from '../middleware/index.js';
const r = Router(); r.use(requireAuth, limits.user());
const createSchema = z.object({ listingId: z.string().length(24), fulfilment: z.enum(['meetup', 'shipping']).default('meetup') }).strict();
const log = (o, s, by) => { o.status = s; o.history.push({ status: s, by }); };
const load = async (req) => {
  const o = await Order.findById(req.params.id);
  if (!o || ![String(o.buyerId), String(o.sellerId)].includes(String(req.user._id))) throw new HttpError(404, 'Order not found.');
  return o;
};
r.get('/', async (req, res, next) => { try { res.json({ items: await Order.find({ $or: [{ buyerId: req.user._id }, { sellerId: req.user._id }] }).sort({ createdAt: -1 }).limit(100).populate('buyerId', 'name').populate('sellerId', 'name') }); } catch (e) { next(e); } });
r.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const l = await Listing.findById(req.body.listingId);
    if (!l) throw new HttpError(404, 'Book not found.');
    if (l.ownerId.equals(req.user._id)) throw new HttpError(400, 'You cannot buy your own book.');
    if (l.tradeMode === 'swap') throw new HttpError(400, 'This book is swap only.');
    // atomic reservation; price comes from the server, never the client
    const got = await Listing.findOneAndUpdate({ _id: l._id, status: 'active' }, { status: 'reserved' });
    if (!got) throw new HttpError(409, 'This book is no longer available.');
    const o = await Order.create({ buyerId: req.user._id, sellerId: l.ownerId, listingId: l._id, fulfilment: req.body.fulfilment, priceSnapshot: { title: l.title, author: l.author, price: l.price, currency: l.currency }, history: [{ status: 'requested', by: req.user._id }] });
    notify(l.ownerId, 'order', `${req.user.name} wants to buy "${l.title}"`, '/orders');
    res.status(201).json({ order: o });
  } catch (e) { next(e); }
});
r.post('/:id/ready', validObjectId('id'), async (req, res, next) => {
  try { const o = await load(req); if (!o.sellerId.equals(req.user._id)) throw new HttpError(403, 'Only the seller can do this.'); if (o.status !== 'requested') throw new HttpError(409, `Order is already ${o.status}.`); log(o, 'ready', req.user._id); await o.save(); notify(o.buyerId, 'order', `"${o.priceSnapshot.title}" is ready for handover`, '/orders'); res.json({ order: o }); } catch (e) { next(e); }
});
r.post('/:id/complete', validObjectId('id'), async (req, res, next) => {
  try { const o = await load(req); if (!o.buyerId.equals(req.user._id)) throw new HttpError(403, 'Only the buyer confirms receipt.'); if (o.status !== 'ready') throw new HttpError(409, 'The seller has not marked this ready yet.'); await Listing.updateOne({ _id: o.listingId, status: 'reserved' }, { status: 'completed' }); log(o, 'completed', req.user._id); await o.save(); notify(o.sellerId, 'order', `"${o.priceSnapshot.title}" sale completed`, '/orders'); res.json({ order: o }); } catch (e) { next(e); }
});
r.post('/:id/cancel', validObjectId('id'), async (req, res, next) => {
  try { const o = await load(req); if (!['requested', 'ready'].includes(o.status)) throw new HttpError(409, `Order is already ${o.status}.`); await Listing.updateOne({ _id: o.listingId, status: 'reserved' }, { status: 'active' }); log(o, 'cancelled', req.user._id); await o.save(); const other = o.buyerId.equals(req.user._id) ? o.sellerId : o.buyerId; notify(other, 'order', `Order for "${o.priceSnapshot.title}" was cancelled`, '/orders'); res.json({ order: o }); } catch (e) { next(e); }
});
export default r;
