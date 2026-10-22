import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';

let mongod, app;
const mk = async (name) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/register').send({ name, email: `${name}@t.io`, password: 'password123' });
  return { agent, user: res.body.user };
};
const book = (o = {}) => ({ title: 'Dune', author: 'Frank Herbert', category: 'Fiction', condition: 'good', tradeMode: 'swap', ...o });

beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); app = createApp(); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });

describe('validation & auth', () => {
  it('rejects unknown fields (no mass assignment)', async () => {
    const r = await request(app).post('/api/v1/auth/register').send({ name: 'Eve', email: 'eve@t.io', password: 'password123', role: 'admin' });
    expect(r.status).toBe(400);
  });
  it('requires login to create a listing', async () => {
    expect((await request(app).post('/api/v1/listings').send(book())).status).toBe(401);
  });
  it('never returns stack traces on bad ids', async () => {
    const r = await request(app).get('/api/v1/listings/not-an-id');
    expect(r.status).toBe(400); expect(JSON.stringify(r.body)).not.toMatch(/stack|node_modules/);
  });
  it('rejects NoSQL operator injection in query', async () => {
    const r = await request(app).get('/api/v1/listings?category[$ne]=x');
    expect(r.status).toBe(400);
  });
});

describe('listings permissions', () => {
  it('only the owner can edit', async () => {
    const a = await mk('alice'); const b = await mk('bob');
    const { body } = await a.agent.post('/api/v1/listings').send(book());
    expect((await b.agent.patch(`/api/v1/listings/${body.listing.id}`).send({ title: 'Hacked' })).status).toBe(403);
    expect((await a.agent.patch(`/api/v1/listings/${body.listing.id}`).send({ title: 'Dune II' })).status).toBe(200);
  });
});

describe('swap state machine', () => {
  it('pending -> accepted -> completed after both confirm; blocks double-booking', async () => {
    const a = await mk('carl'); const b = await mk('dina'); const c = await mk('erin');
    const la = (await a.agent.post('/api/v1/listings').send(book({ title: 'A' }))).body.listing;
    const lb = (await b.agent.post('/api/v1/listings').send(book({ title: 'B' }))).body.listing;
    const lc = (await c.agent.post('/api/v1/listings').send(book({ title: 'C' }))).body.listing;
    const s1 = (await a.agent.post('/api/v1/swaps').send({ offeredListingId: la.id, requestedListingId: lb.id })).body.swap;
    const s2 = (await c.agent.post('/api/v1/swaps').send({ offeredListingId: lc.id, requestedListingId: lb.id })).body.swap;
    expect((await a.agent.post(`/api/v1/swaps/${s1._id}/accept`)).status).toBe(403); // requester cannot accept
    expect((await b.agent.post(`/api/v1/swaps/${s1._id}/accept`)).status).toBe(200);
    expect((await b.agent.post(`/api/v1/swaps/${s2._id}/accept`)).status).toBe(409); // B's book already reserved
    expect((await a.agent.post(`/api/v1/swaps/${s1._id}/complete`)).body.swap.status).toBe('accepted');
    expect((await b.agent.post(`/api/v1/swaps/${s1._id}/complete`)).body.swap.status).toBe('completed');
    expect((await a.agent.get(`/api/v1/swaps/${s1._id}`)).status).toBe(200);
  });
  it('hides swaps from outsiders', async () => {
    const a = await mk('fay'); const b = await mk('gus'); const x = await mk('hal');
    const la = (await a.agent.post('/api/v1/listings').send(book())).body.listing;
    const lb = (await b.agent.post('/api/v1/listings').send(book())).body.listing;
    const s = (await a.agent.post('/api/v1/swaps').send({ offeredListingId: la.id, requestedListingId: lb.id })).body.swap;
    expect((await x.agent.get(`/api/v1/swaps/${s._id}`)).status).toBe(404);
  });
});

describe('orders, reviews, admin', () => {
  it('purchase flow reserves, completes, and allows one review', async () => {
    const s = await mk('ivy'); const b = await mk('jon');
    const l = (await s.agent.post('/api/v1/listings').send(book({ tradeMode: 'sale', price: 100 }))).body.listing;
    const o = (await b.agent.post('/api/v1/orders').send({ listingId: l.id })).body.order;
    expect(o.priceSnapshot.price).toBe(100);
    expect((await (await mk('kim')).agent.post('/api/v1/orders').send({ listingId: l.id })).status).toBe(409); // already reserved
    expect((await b.agent.post(`/api/v1/orders/${o._id}/complete`)).status).toBe(409); // seller not ready
    expect((await s.agent.post(`/api/v1/orders/${o._id}/ready`)).status).toBe(200);
    expect((await b.agent.post(`/api/v1/orders/${o._id}/complete`)).body.order.status).toBe('completed');
    const rv = { transactionType: 'order', transactionId: o._id, rating: 5 };
    expect((await b.agent.post('/api/v1/reviews').send(rv)).status).toBe(201);
    expect((await b.agent.post('/api/v1/reviews').send(rv)).status).toBe(409);
  });
  it('blocks reviews on incomplete transactions and non-admins from admin routes', async () => {
    const a = await mk('lee'); const b = await mk('max');
    const l = (await a.agent.post('/api/v1/listings').send(book({ tradeMode: 'sale', price: 50 }))).body.listing;
    const o = (await b.agent.post('/api/v1/orders').send({ listingId: l.id })).body.order;
    expect((await b.agent.post('/api/v1/reviews').send({ transactionType: 'order', transactionId: o._id, rating: 4 })).status).toBe(403);
    expect((await a.agent.get('/api/v1/admin/overview')).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/overview')).status).toBe(401);
  });
  it('counteroffer closes the old swap and opens a new one', async () => {
    const a = await mk('ned'); const b = await mk('ona');
    const la = (await a.agent.post('/api/v1/listings').send(book())).body.listing;
    const lb = (await b.agent.post('/api/v1/listings').send(book())).body.listing;
    const s = (await a.agent.post('/api/v1/swaps').send({ offeredListingId: la.id, requestedListingId: lb.id })).body.swap;
    const c = await b.agent.post(`/api/v1/swaps/${s._id}/counter`).send({ cashDifference: 40, cashPayer: 'to' });
    expect(c.status).toBe(201); expect(c.body.swap.fromUserId).toBe(b.user.id);
  });
});

import crypto from 'crypto';
import { outbox } from '../src/mailer.js';
import { verifySignature } from '../src/routes/payments.js';
import { sniffImage } from '../src/routes/uploads.js';

describe('reset, verify, uploads, payments, blocking', () => {
  const tokenFrom = (to) => [...outbox].reverse().find((m) => m.to === to).text.split('token=')[1];
  it('password reset is single-use and answers the same for unknown emails', async () => {
    await mk('pat');
    const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@t.io' });
    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'pat@t.io' });
    expect(unknown.body.message).toBe(known.body.message);
    const t = tokenFrom('pat@t.io');
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: t, password: 'newpassword1' })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: t, password: 'another-pass1' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'pat@t.io', password: 'newpassword1' })).status).toBe(200);
  });
  it('email verification works once', async () => {
    await mk('quin'); const t = tokenFrom('quin@t.io');
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token: t })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token: t })).status).toBe(400);
  });
  it('image sniffing checks content, not extension', async () => {
    expect(sniffImage(Buffer.from('<?php echo 1; ?> padding padding'))).toBe(null);
    expect(sniffImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]))).toBe('jpg');
    const a = await mk('ria');
    const l = (await a.agent.post('/api/v1/listings').send(book())).body.listing;
    const bad = await a.agent.post(`/api/v1/listings/${l.id}/photo`).set('Content-Type', 'image/png').send(Buffer.from('not an image at all, just text'));
    expect(bad.status).toBe(400);
  });
  it('webhook signature is verified', () => {
    const body = Buffer.from('{"event":"payment.captured"}'); const secret = 'whsec';
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifySignature(body, sig, secret)).toBe(true);
    expect(verifySignature(body, 'bad', secret)).toBe(false);
    expect(verifySignature(body, sig, '')).toBe(false);
  });
  it('rejects webhook with bad signature and blocks messages from blocked users', async () => {
    expect((await request(app).post('/api/v1/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'x').send('{}')).status).toBe(400);
    const a = await mk('sol'); const b = await mk('tia');
    await b.agent.post(`/api/v1/auth/block/${a.user.id}`);
    expect((await a.agent.post('/api/v1/conversations').send({ userId: b.user.id })).status).toBe(403);
  });
});
