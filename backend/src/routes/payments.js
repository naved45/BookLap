import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { Order, Payment, notify } from '../models/Extra.js';
import { HttpError, validate, requireAuth, limits } from '../middleware/index.js';

export const paymentsEnabled = () => !!(config.razorpay.keyId && config.razorpay.keySecret);
export const verifySignature = (rawBody, signature, secret) => {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const checkoutRouter = Router();
checkoutRouter.post('/checkout', requireAuth, limits.user(), validate(z.object({ orderId: z.string().length(24) }).strict()), async (req, res, next) => {
  try {
    if (!paymentsEnabled()) throw new HttpError(503, 'Online payments are not set up yet. Pay the seller directly at handover.');
    const o = await Order.findById(req.body.orderId);
    if (!o || !o.buyerId.equals(req.user._id)) throw new HttpError(404, 'Order not found.');
    if (o.paymentStatus === 'paid' || ['completed', 'cancelled'].includes(o.status)) throw new HttpError(409, 'This order cannot be paid.');
    const amount = Math.round(o.priceSnapshot.price * 100); // amount always comes from the server-side snapshot
    const resp = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64') },
      body: JSON.stringify({ amount, currency: o.priceSnapshot.currency || 'INR', receipt: String(o._id) }) });
    if (!resp.ok) throw new HttpError(502, 'The payment provider could not start this payment.');
    const g = await resp.json();
    await Payment.create({ orderId: o._id, providerOrderId: g.id, amount, currency: g.currency });
    res.json({ providerOrderId: g.id, amount, currency: g.currency, keyId: config.razorpay.keyId });
  } catch (e) { next(e); }
});

// Mounted with express.raw so the exact bytes are verified. Idempotent per provider event id.
export const webhookHandler = async (req, res, next) => {
  try {
    if (!verifySignature(req.body, req.get('x-razorpay-signature'), config.razorpay.webhookSecret)) return res.status(400).json({ error: 'Invalid signature.' });
    const evt = JSON.parse(req.body.toString('utf8')); const eventId = req.get('x-razorpay-event-id') || evt.id;
    const providerOrderId = evt?.payload?.payment?.entity?.order_id || evt?.payload?.order?.entity?.id;
    const pay = providerOrderId && await Payment.findOne({ providerOrderId });
    if (!pay) return res.json({ ok: true });
    if (eventId && pay.eventIds.includes(eventId)) return res.json({ ok: true, duplicate: true });
    if (['payment.captured', 'order.paid'].includes(evt.event)) {
      pay.status = 'paid'; await Order.updateOne({ _id: pay.orderId }, { paymentStatus: 'paid' });
      const o = await Order.findById(pay.orderId); if (o) notify(o.sellerId, 'order', `Payment received for "${o.priceSnapshot.title}"`, '/orders');
    } else if (evt.event === 'payment.failed') pay.status = 'failed';
    if (eventId) pay.eventIds.push(eventId); await pay.save();
    res.json({ ok: true });
  } catch (e) { next(e); }
};
