import { Router } from 'express';
import { z } from 'zod';
import { Report, AuditLog, Order, Post } from '../models/Extra.js';
import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import { Swap } from '../models/Swap.js';
import { HttpError, validate, validObjectId, requireAuth, requireAdmin } from '../middleware/index.js';
const r = Router(); r.use(requireAuth, requireAdmin); // server-side admin authorization for everything here
const audit = (req, action, targetType, targetId, meta) => AuditLog.create({ actorId: req.user._id, action, targetType, targetId, meta });
r.get('/overview', async (_req, res, next) => { try { const [users, listings, swaps, orders, openReports] = await Promise.all([User.countDocuments(), Listing.countDocuments({ status: 'active' }), Swap.countDocuments({ status: 'completed' }), Order.countDocuments({ status: 'completed' }), Report.countDocuments({ status: 'open' })]); res.json({ users, activeListings: listings, completedSwaps: swaps, completedOrders: orders, openReports }); } catch (e) { next(e); } });
r.get('/users', async (_req, res, next) => { try { res.json({ items: await User.find().sort({ createdAt: -1 }).limit(100).select('name email role status createdAt') }); } catch (e) { next(e); } });
r.patch('/users/:id/status', validObjectId('id'), validate(z.object({ status: z.enum(['active', 'suspended']) }).strict()), async (req, res, next) => {
  try { if (String(req.user._id) === req.params.id) throw new HttpError(400, 'You cannot change your own status.'); const u = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }); if (!u) throw new HttpError(404, 'User not found.'); await audit(req, `user.${req.body.status}`, 'user', u._id); res.json({ ok: true }); } catch (e) { next(e); }
});
r.get('/reports', async (_req, res, next) => { try { res.json({ items: await Report.find().sort({ status: 1, createdAt: -1 }).limit(100).populate('reporterId', 'name') }); } catch (e) { next(e); } });
r.patch('/reports/:id', validObjectId('id'), validate(z.object({ status: z.enum(['resolved', 'dismissed']), resolution: z.string().trim().max(300).optional(), removeTarget: z.boolean().optional() }).strict()), async (req, res, next) => {
  try {
    const rep = await Report.findById(req.params.id); if (!rep) throw new HttpError(404, 'Report not found.');
    if (req.body.removeTarget) {
      if (rep.targetType === 'listing') await Listing.updateOne({ _id: rep.targetId }, { status: 'removed' });
      else if (rep.targetType === 'post') await Post.updateOne({ _id: rep.targetId }, { status: 'removed' });
      else if (rep.targetType === 'user') await User.updateOne({ _id: rep.targetId }, { status: 'suspended' });
    }
    rep.status = req.body.status; rep.resolution = req.body.resolution; await rep.save();
    await audit(req, `report.${req.body.status}`, 'report', rep._id, { removed: !!req.body.removeTarget }); res.json({ ok: true });
  } catch (e) { next(e); }
});
r.get('/audit', async (_req, res, next) => { try { res.json({ items: await AuditLog.find().sort({ createdAt: -1 }).limit(100).populate('actorId', 'name') }); } catch (e) { next(e); } });
export default r;
