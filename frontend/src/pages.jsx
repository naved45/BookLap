import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { api, CATEGORIES, CONDITION_LABEL, MODE_LABEL } from './api.js';
import { useAuth } from './auth.jsx';
import { BookCard, Spinner, ErrorBox, Empty } from './components.jsx';

// small data hook with loading/error/retry
export function useData(fn, deps) {
  const [s, set] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => { set((p) => ({ ...p, loading: true, error: null })); fn().then((data) => set({ data, error: null, loading: false })).catch((error) => set({ data: null, error, loading: false })); }, deps); // eslint-disable-line
  useEffect(load, [load]);
  return { ...s, reload: load };
}
export const FieldErrors = ({ err }) => err?.details?.length ? <ul className="ferr">{err.details.map((d, i) => <li key={i}>{d.field}: {d.message}</li>)}</ul> : null;

export function Home() {
  const nav = useNavigate(); const [q, setQ] = useState('');
  const { data, error, loading, reload } = useData(() => api('/listings', { query: { limit: 8 } }), []);
  return (
    <>
      <section className="hero">
        <h1>Read it. Swap it. Sell it. Repeat it.</h1>
        <p>Give your finished books a second life and find your next read from readers near you.</p>
        <form className="search" onSubmit={(e) => { e.preventDefault(); nav(`/explore?q=${encodeURIComponent(q)}`); }} role="search">
          <label htmlFor="hq" className="sr">Search books</label>
          <input id="hq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or author" maxLength={80} />
          <button className="btn accent">Search</button>
        </form>
        <div className="row wrap">{CATEGORIES.slice(0, 5).map((c) => <Link key={c} className="chip" to={`/explore?category=${encodeURIComponent(c)}`}>{c}</Link>)}</div>
      </section>
      <section className="wrap">
        <h2>Fresh on the shelf</h2>
        {loading ? <Spinner /> : error ? <ErrorBox error={error} retry={reload} /> :
          data.items.length ? <div className="grid">{data.items.map((b) => <BookCard key={b.id} b={b} />)}</div> :
          <Empty title="No books listed yet">Be the first — <Link to="/list">list a book</Link>.</Empty>}
      </section>
    </>
  );
}

export function Explore() {
  const [sp, setSp] = useSearchParams();
  const f = Object.fromEntries(sp.entries()); const page = Number(f.page || 1);
  const { data, error, loading, reload } = useData(() => api('/listings', { query: { ...f, page, limit: 12 } }), [sp.toString()]);
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); n.delete('page'); setSp(n); };
  return (
    <section className="wrap">
      <h1>Explore books</h1>
      <div className="filters">
        <label className="sr" htmlFor="eq">Search</label>
        <input id="eq" defaultValue={f.q || ''} placeholder="Title or author" maxLength={80} onKeyDown={(e) => e.key === 'Enter' && set('q', e.target.value.trim())} onBlur={(e) => set('q', e.target.value.trim())} />
        <label className="sr" htmlFor="ec">Category</label>
        <select id="ec" value={f.category || ''} onChange={(e) => set('category', e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <label className="sr" htmlFor="et">Type</label>
        <select id="et" value={f.tradeMode || ''} onChange={(e) => set('tradeMode', e.target.value)}><option value="">Swap or buy</option><option value="swap">Swap</option><option value="sale">Buy</option></select>
        <label className="sr" htmlFor="eo">Condition</label>
        <select id="eo" value={f.condition || ''} onChange={(e) => set('condition', e.target.value)}><option value="">Any condition</option>{Object.entries(CONDITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label className="sr" htmlFor="es">Sort</label>
        <select id="es" value={f.sort || 'new'} onChange={(e) => set('sort', e.target.value)}><option value="new">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
      </div>
      {loading ? <Spinner /> : error ? <ErrorBox error={error} retry={reload} /> :
        !data.items.length ? <Empty title="No books match">Try clearing a filter.</Empty> : <>
          <div className="grid">{data.items.map((b) => <BookCard key={b.id} b={b} />)}</div>
          <div className="pager">
            <button className="btn ghost" disabled={page <= 1} onClick={() => setSp({ ...f, page: page - 1 })}>Previous</button>
            <span>Page {data.page} of {data.pages}</span>
            <button className="btn ghost" disabled={page >= data.pages} onClick={() => setSp({ ...f, page: page + 1 })}>Next</button>
          </div></>}
    </section>
  );
}

export function BookDetail() {
  const { id } = useParams(); const { user } = useAuth(); const nav = useNavigate();
  const { data, error, loading, reload } = useData(() => api(`/listings/${id}`), [id]);
  const mine = useData(() => (user ? api('/listings/mine') : Promise.resolve({ items: [] })), [user?.id]);
  const [offer, setOffer] = useState(''); const [cash, setCash] = useState(0); const [payer, setPayer] = useState('from');
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  if (loading) return <Spinner />; if (error) return <ErrorBox error={error} retry={reload} />;
  const b = data.listing; const isOwner = user && b.ownerId === user.id;
  const eligible = (mine.data?.items || []).filter((x) => x.status === 'active' && x.tradeMode !== 'sale');
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api('/swaps', { method: 'POST', body: { offeredListingId: offer, requestedListingId: b.id, cashDifference: Number(cash) || 0, cashPayer: Number(cash) > 0 ? payer : 'none' } });
      nav('/swaps');
    } catch (err) { setMsg(err); } finally { setBusy(false); }
  };
  const buy = async () => { if (!confirm(`Request to buy "${b.title}" for ₹${b.price}? You settle payment with the seller directly.`)) return; try { await api('/orders', { method: 'POST', body: { listingId: b.id } }); nav('/orders'); } catch (e) { setMsg(e); } };
  const chat = async () => { try { const { conversation } = await api('/conversations', { method: 'POST', body: { userId: b.ownerId, listingId: b.id } }); nav(`/messages?c=${conversation._id}`); } catch (e) { setMsg(e); } };
  const report = async () => { const reason = prompt('What is wrong with this listing?'); if (!reason || reason.trim().length < 5) return; try { await api('/reports', { method: 'POST', body: { targetType: 'listing', targetId: b.id, reason } }); setMsg({ message: 'Thanks. Our team will review it.', ok: true }); } catch (e) { setMsg(e); } };
  const wish = async () => { try { await api(`/listings/${b.id}/wishlist`, { method: 'POST' }); setMsg({ message: 'Saved to your wishlist.', ok: true }); } catch (e) { setMsg(e); } };
  return (
    <section className="wrap detail">
      <div className="cover big" style={b.coverUrl ? { backgroundImage: `url(${b.coverUrl})` } : undefined}>{!b.coverUrl && <span>{b.title}</span>}</div>
      <div>
        <h1>{b.title}</h1><p className="muted">by {b.author} · {b.category}</p>
        <div className="row wrap"><span className="tag">{CONDITION_LABEL[b.condition]}</span><span className="tag alt">{MODE_LABEL[b.tradeMode]}</span>{b.status !== 'active' && <span className="tag warn">Not available</span>}</div>
        {b.tradeMode !== 'swap' && <p className="price big">₹{b.price}</p>}
        {b.description && <p>{b.description}</p>}
        <p className="muted">Listed by {b.owner?.name}{b.owner?.area ? ` · ${b.owner.area}` : ''}</p>
        {msg && <p className={msg.ok ? 'ok' : 'err'} role="alert">{msg.message}</p>}
        {user && !isOwner && <div className="row wrap"><button className="btn ghost" onClick={wish}>Save to wishlist</button><button className="btn ghost" onClick={chat}>Message owner</button><button className="btn ghost" onClick={report}>Report</button></div>}
        {b.tradeMode !== 'swap' && b.status === 'active' && !isOwner && (user ? <button className="btn accent" onClick={buy}>Buy for ₹{b.price}</button> : <Link className="btn accent" to="/login" state={{ from: `/book/${b.id}` }}>Log in to buy</Link>)}
        {b.tradeMode !== 'sale' && b.status === 'active' && !isOwner && (user ? (
          <form onSubmit={send} className="form">
            <h2>Propose a swap</h2>
            <label>Your book to offer
              <select required value={offer} onChange={(e) => setOffer(e.target.value)}><option value="">Choose a book</option>{eligible.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
            </label>
            {!eligible.length && <p className="muted">You need an active swap listing first. <Link to="/list">List a book</Link></p>}
            <label>Cash difference (₹, optional)<input type="number" min="0" max="100000" value={cash} onChange={(e) => setCash(e.target.value)} inputMode="numeric" /></label>
            {Number(cash) > 0 && <label>Who pays it?<select value={payer} onChange={(e) => setPayer(e.target.value)}><option value="from">I pay</option><option value="to">They pay</option></select></label>}
            <p className="muted small">Cash is settled between you directly. BookLoop does not hold payments.</p>
            <button className="btn accent" disabled={busy || !offer}>{busy ? 'Sending…' : 'Send swap request'}</button>
          </form>) : <Link className="btn accent" to="/login" state={{ from: `/book/${b.id}` }}>Log in to swap</Link>)}
        {b.tradeMode !== 'swap' && <p className="muted small">Payment is settled directly with the seller at handover. BookLoop does not process or hold payments.</p>}
        <p className="small"><Link to={`/u/${b.ownerId}`}>View reader profile</Link></p>
      </div>
    </section>
  );
}

export function AuthPage({ mode }) {
  const { login, register } = useAuth(); const nav = useNavigate(); const loc = useLocation();
  const [f, setF] = useState({ name: '', email: '', password: '' }); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { signup ? await register(f) : await login({ email: f.email, password: f.password }); nav(signup ? '/welcome' : loc.state?.from || '/library', { replace: true }); }
    catch (x) { setErr(x); } finally { setBusy(false); }
  };
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <section className="wrap narrow">
      <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
      <form onSubmit={submit} className="form" noValidate={false}>
        {signup && <label>Name<input required minLength={2} maxLength={60} autoComplete="name" value={f.name} onChange={on('name')} /></label>}
        <label>Email<input type="email" required maxLength={120} autoComplete="email" value={f.email} onChange={on('email')} /></label>
        <label>Password<input type="password" required minLength={signup ? 8 : 1} maxLength={100} autoComplete={signup ? 'new-password' : 'current-password'} value={f.password} onChange={on('password')} /></label>
        {signup && <p className="muted small">At least 8 characters.</p>}
        {err && <><p className="err" role="alert">{err.message}</p><FieldErrors err={err} /></>}
        <button className="btn accent" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Sign up' : 'Log in'}</button>
      </form>
      {!signup && <p><Link to="/forgot-password">Forgot your password?</Link></p>}
      <p>{signup ? <>Have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/signup">Create an account</Link></>}</p>
    </section>
  );
}

export function ListBook() {
  const nav = useNavigate();
  const [f, setF] = useState({ title: '', author: '', category: CATEGORIES[0], condition: 'good', tradeMode: 'swap', price: '', description: '', coverUrl: '' });
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false); const [photo, setPhoto] = useState(null);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const body = { ...f, price: f.tradeMode === 'swap' ? 0 : Number(f.price) };
    if (!body.coverUrl) delete body.coverUrl; if (!body.description) delete body.description;
    try { const { listing } = await api('/listings', { method: 'POST', body });
      if (photo) { const up = await fetch(`/api/v1/listings/${listing.id}/photo`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': photo.type }, body: photo }); if (!up.ok) alert('Book listed, but the photo could not be uploaded (JPEG, PNG or WebP up to 2 MB).'); }
      nav(`/book/${listing.id}`); }
    catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <section className="wrap narrow">
      <h1>List a book</h1>
      <form onSubmit={submit} className="form">
        <label>Title<input required maxLength={140} value={f.title} onChange={on('title')} /></label>
        <label>Author<input required maxLength={100} value={f.author} onChange={on('author')} /></label>
        <label>Category<select value={f.category} onChange={on('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Condition<select value={f.condition} onChange={on('condition')}>{Object.entries(CONDITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Available for<select value={f.tradeMode} onChange={on('tradeMode')}><option value="swap">Swap only</option><option value="sale">Sale only</option><option value="both">Swap or sale</option></select></label>
        {f.tradeMode !== 'swap' && <label>Asking price (₹)<input type="number" required min="1" max="100000" inputMode="numeric" value={f.price} onChange={on('price')} /></label>}
        <label>Cover photo (JPEG, PNG or WebP, up to 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const x = e.target.files[0]; if (x && x.size > 2 * 1024 * 1024) { alert('Photo must be 2 MB or smaller.'); e.target.value = ''; setPhoto(null); } else setPhoto(x || null); }} /></label>
        <label>Or cover image link (https, optional)<input type="url" maxLength={500} value={f.coverUrl} onChange={on('coverUrl')} placeholder="https://…" /></label>
        <label>Description (optional)<textarea maxLength={1000} rows={4} value={f.description} onChange={on('description')} /></label>
        {err && <><p className="err" role="alert">{err.message}</p><FieldErrors err={err} /></>}
        <button className="btn accent" disabled={busy}>{busy ? 'Saving…' : 'List book'}</button>
      </form>
    </section>
  );
}

export function Library() {
  const { user } = useAuth(); const [tab, setTab] = useState('mine');
  const mine = useData(() => api('/listings/mine'), []); const wish = useData(() => api('/listings/wishlist/all'), []);
  const cur = tab === 'mine' ? mine : wish;
  const del = async (id) => { if (confirm('Remove this listing?')) { try { await api(`/listings/${id}`, { method: 'DELETE' }); mine.reload(); } catch (e) { alert(e.message); } } };
  return (
    <section className="wrap">
      <h1>{user.name}’s library</h1>
      <div className="row wrap"><Link className="btn ghost" to="/orders">Orders</Link><Link className="btn ghost" to="/messages">Messages</Link><Link className="btn ghost" to="/notifications">Alerts</Link><Link className="btn ghost" to={`/u/${user.id}`}>My profile</Link>{user.role === 'admin' && <Link className="btn ghost" to="/admin">Admin</Link>}</div>
      <div className="tabs" role="tablist">{[['mine', 'My books'], ['wish', 'Wishlist']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {cur.loading ? <Spinner /> : cur.error ? <ErrorBox error={cur.error} retry={cur.reload} /> :
        !cur.data.items.length ? <Empty title={tab === 'mine' ? 'No books yet' : 'Wishlist is empty'}>{tab === 'mine' ? <Link to="/list">List your first book</Link> : <Link to="/explore">Find books to save</Link>}</Empty> :
        <div className="grid">{cur.data.items.map((b) => <div key={b.id}><BookCard b={b} />{tab === 'mine' && b.status === 'active' && <button className="btn ghost small" onClick={() => del(b.id)}>Remove</button>}{b.status !== 'active' && <span className="tag warn">{b.status}</span>}</div>)}</div>}
    </section>
  );
}

export function Swaps() {
  const { user } = useAuth(); const { data, error, loading, reload } = useData(() => api('/swaps'), []);
  const [err, setErr] = useState(null);
  const act = async (id, a) => { setErr(null); try { await api(`/swaps/${id}/${a}`, { method: 'POST' }); reload(); } catch (e) { setErr(e); reload(); } };
  const counter = async (id) => { const v = prompt('Cash difference in ₹ (0 for none):', '0'); if (v === null) return; const n = Number(v); let payer = 'none'; if (n > 0) payer = confirm('Press OK if YOU pay the difference, Cancel if THEY pay.') ? 'from' : 'to'; try { await api(`/swaps/${id}/counter`, { method: 'POST', body: { cashDifference: n, cashPayer: payer } }); reload(); } catch (e) { setErr(e); } };
  const review = (t, id) => leaveReview(t, id, setErr);
  if (loading) return <Spinner />; if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <section className="wrap">
      <h1>Swap center</h1>
      {err && <p className="err" role="alert">{err.message}</p>}
      {!data.items.length ? <Empty title="No swaps yet">Open a book on <Link to="/explore">Explore</Link> and propose a swap.</Empty> :
        data.items.map((s) => {
          const incoming = s.toUserId._id === user.id; const iConfirmed = s.confirmedBy.includes(user.id);
          return (
            <article className="card swap" key={s._id}>
              <div className="row between"><strong>{incoming ? `${s.fromUserId.name} offers` : `You offered to ${s.toUserId.name}`}</strong><span className={`tag st-${s.status}`}>{s.status}</span></div>
              <p><b>{s.offeredListingId?.title}</b> ⇄ <b>{s.requestedListingId?.title}</b></p>
              {s.cashDifference > 0 && <p className="muted">+ ₹{s.cashDifference} paid by {(s.cashPayer === 'from') === !incoming ? 'you' : 'them'} (settled directly)</p>}
              <div className="row wrap">
                {s.status === 'pending' && incoming && <><button className="btn accent" onClick={() => act(s._id, 'accept')}>Accept</button><button className="btn ghost" onClick={() => act(s._id, 'reject')}>Reject</button><button className="btn ghost" onClick={() => counter(s._id)}>Counteroffer</button></>}
                {s.status === 'completed' && <button className="btn ghost" onClick={() => review('swap', s._id)}>Leave review</button>}
                {(s.status === 'pending' && !incoming || s.status === 'accepted') && <button className="btn ghost" onClick={() => act(s._id, 'cancel')}>Cancel</button>}
                {s.status === 'accepted' && !iConfirmed && <button className="btn accent" onClick={() => act(s._id, 'complete')}>Confirm handover</button>}
                {s.status === 'accepted' && iConfirmed && <span className="muted">Waiting for the other reader to confirm.</span>}
              </div>
            </article>);
        })}
    </section>
  );
}

export async function leaveReview(t, id, setErr) {
  const r = Number(prompt('Rating 1 to 5:')); if (!(r >= 1 && r <= 5)) return;
  const comment = prompt('Short comment (optional):') || undefined;
  try { await api('/reviews', { method: 'POST', body: { transactionType: t, transactionId: id, rating: Math.round(r), comment } }); alert('Review saved.'); } catch (e) { setErr ? setErr(e) : alert(e.message); }
}

const INFO = {
  how: ['How it works', ['List the books you have finished.', 'Browse books and propose a swap, with an optional cash difference you settle directly.', 'When the owner accepts, both books are reserved. Meet or ship, then both confirm the handover.']],
  privacy: ['Privacy', ['We store your name, email and the books you list. Passwords are hashed and never stored in plain text.', 'We do not sell your data. Your email is never shown publicly.', 'This is a draft policy for a pilot. Have it reviewed before a public launch.']],
  terms: ['Terms', ['BookLoop connects readers; swaps and cash differences are agreed and settled between users.', 'BookLoop does not hold funds or guarantee items. Be honest about condition.', 'This is a draft for a pilot. Have it reviewed before a public launch.']],
};
export function Info({ kind }) { const [t, ps] = INFO[kind]; return <section className="wrap narrow"><h1>{t}</h1>{ps.map((p, i) => <p key={i}>{p}</p>)}</section>; }
