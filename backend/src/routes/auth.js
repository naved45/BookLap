import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import { config } from '../config.js';
import { Token } from '../models/Extra.js';
import { sendMail } from '../mailer.js';
import { User, selfUser } from '../models/User.js';
import { HttpError, validate, requireAuth, limits } from '../middleware/index.js';

const r = Router();
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
async function issueToken(user, kind, minutes) {
  const raw = crypto.randomBytes(32).toString('hex');
  await Token.create({ userId: user._id, kind, tokenHash: hash(raw), expiresAt: new Date(Date.now() + minutes * 60000) });
  return raw;
}
async function consumeToken(raw, kind) {
  // single-use: atomically mark used only if unused and unexpired
  return Token.findOneAndUpdate({ tokenHash: hash(raw), kind, usedAt: null, expiresAt: { $gt: new Date() } }, { usedAt: new Date() });
}
const tokenSchema = z.object({ token: z.string().length(64).regex(/^[a-f0-9]+$/) }).strict();
const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 7 * 864e5, path: '/' };
const sign = (u) => jwt.sign({ sub: String(u._id) }, config.jwtSecret, { expiresIn: '7d' });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(100),
}).strict();
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(120), password: z.string().min(1).max(100) }).strict();
const profileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  bio: z.string().trim().max(300).optional(),
  area: z.string().trim().max(60).optional(),
  genres: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  onboarded: z.boolean().optional(),
}).strict();

r.post('/register', limits.auth(), validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    try { const t = await issueToken(user, 'verify', 60 * 24); await sendMail({ to: user.email, subject: 'Verify your BookLoop email', text: `${config.clientOrigin}/verify?token=${t}` }); } catch (mailErr) { console.error('[mail] verification email not sent'); }
    res.cookie('bl_token', sign(user), cookieOpts).status(201).json({ user: selfUser(user) });
  } catch (e) {
    if (e?.code === 11000) return next(new HttpError(409, 'An account with that email already exists.'));
    next(e);
  }
});

r.post('/login', limits.auth(), validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash +failedLogins +lockedUntil');
    const generic = new HttpError(401, 'Incorrect email or password.');
    if (!user) { await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi'); throw generic; }
    // per-account exponential backoff instead of a hard lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new HttpError(429, 'Too many attempts. Try again in a little while.');
    if (user.status !== 'active') throw generic;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      user.failedLogins += 1;
      if (user.failedLogins >= 5) user.lockedUntil = new Date(Date.now() + Math.min(2 ** (user.failedLogins - 5), 900) * 1000);
      await user.save();
      throw generic;
    }
    user.failedLogins = 0; user.lockedUntil = undefined; await user.save();
    res.cookie('bl_token', sign(user), cookieOpts).json({ user: selfUser(user) });
  } catch (e) { next(e); }
});

r.post('/verify-email', limits.auth(), validate(tokenSchema), async (req, res, next) => {
  try { const t = await consumeToken(req.body.token, 'verify'); if (!t) throw new HttpError(400, 'This link is invalid or has expired.'); await User.updateOne({ _id: t.userId }, { emailVerified: true }); res.json({ ok: true }); } catch (e) { next(e); }
});
r.post('/forgot-password', limits.auth(), validate(z.object({ email: z.string().trim().toLowerCase().email().max(120) }).strict()), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email, status: 'active' });
    if (user) { try { const t = await issueToken(user, 'reset', 30); await sendMail({ to: user.email, subject: 'Reset your BookLoop password', text: `${config.clientOrigin}/reset-password?token=${t}` }); } catch { console.error('[mail] reset email not sent'); } }
    res.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' }); // same answer either way
  } catch (e) { next(e); }
});
r.post('/reset-password', limits.auth(), validate(tokenSchema.extend({ password: z.string().min(8).max(100) }).strict()), async (req, res, next) => {
  try {
    const t = await consumeToken(req.body.token, 'reset'); if (!t) throw new HttpError(400, 'This link is invalid or has expired.');
    await User.updateOne({ _id: t.userId }, { passwordHash: await bcrypt.hash(req.body.password, 12), failedLogins: 0, lockedUntil: null });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
r.post('/logout', (_req, res) => res.clearCookie('bl_token', { path: '/' }).json({ ok: true }));
r.get('/me', requireAuth, (req, res) => res.json({ user: selfUser(req.user) }));
r.patch('/me', requireAuth, validate(profileSchema), async (req, res, next) => {
  try { Object.assign(req.user, req.body); await req.user.save(); res.json({ user: selfUser(req.user) }); } catch (e) { next(e); }
});
r.post('/block/:id', requireAuth, async (req, res, next) => {
  try { if (!/^[a-f0-9]{24}$/.test(req.params.id) || req.params.id === String(req.user._id)) throw new HttpError(400, 'Invalid user.'); await User.updateOne({ _id: req.user._id }, { $addToSet: { blocked: req.params.id } }); res.json({ ok: true }); } catch (e) { next(e); }
});
r.delete('/block/:id', requireAuth, async (req, res, next) => {
  try { await User.updateOne({ _id: req.user._id }, { $pull: { blocked: req.params.id } }); res.json({ ok: true }); } catch (e) { next(e); }
});
export default r;
