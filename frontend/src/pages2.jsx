import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { Spinner, ErrorBox, Empty, BookCard } from './components.jsx';
import { useData, leaveReview, FieldErrors } from './pages.jsx';
import { CATEGORIES } from './api.js';

export function Orders() {
  const { user } = useAuth(); const { data, error, loading, reload } = useData(() => api('/orders'), []); const [err, setErr] = useState(null);
  const act = async (id, a) => { setErr(null); try { await api(`/orders/${id}/${a}`, { method: 'POST' }); } catch (e) { setErr(e); } reload(); };
  if (loading) return <Spinner />; if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <section className="wrap"><h1>Orders</h1>
      {err && <p className="err" role="alert">{err.message}</p>}
      {!data.items.length ? <Empty title="No orders yet">Buy a book from <Link to="/explore">Explore</Link>.</Empty> : data.items.map((o) => {
        const buyer = o.buyerId._id === user.id;
        return (
          <article className="card swap" key={o._id}>
            <div className="row between"><strong>{o.priceSnapshot.title}</strong><span className={`tag st-${o.status}`}>{o.status}</span></div>
            <p className="muted">₹{o.priceSnapshot.price} · {buyer ? `from ${o.sellerId.name}` : `to ${o.buyerId.name}`} · paid directly at handover</p>
            <div className="row wrap">
              {!buyer && o.status === 'requested' && <button className="btn accent" onClick={() => act(o._id, 'ready')}>Mark ready for handover</button>}
              {buyer && o.status === 'ready' && <button className="btn accent" onClick={() => act(o._id, 'complete')}>Confirm received</button>}
              {['requested', 'ready'].includes(o.status) && <button className="btn ghost" onClick={() => act(o._id, 'cancel')}>Cancel</button>}
              {o.status === 'completed' && <button className="btn ghost" onClick={() => leaveReview('order', o._id, setErr)}>Leave review</button>}
            </div>
          </article>);
      })}
    </section>
  );
}

export function Messages() {
  const { user } = useAuth(); const [sp, setSp] = useSearchParams(); const cid = sp.get('c');
  const list = useData(() => api('/conversations'), []);
  const [msgs, setMsgs] = useState([]); const [body, setBody] = useState(''); const [err, setErr] = useState(null); const end = useRef(null);
  useEffect(() => { if (!cid) return; let on = true; const load = () => api(`/conversations/${cid}/messages`).then((d) => on && setMsgs(d.items)).catch((e) => on && setErr(e)); load(); const t = setInterval(load, 5000); return () => { on = false; clearInterval(t); }; }, [cid]);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [msgs.length]);
  const send = async (e) => { e.preventDefault(); if (!body.trim()) return; try { const { message } = await api(`/conversations/${cid}/messages`, { method: 'POST', body: { body } }); setMsgs([...msgs, message]); setBody(''); setErr(null); } catch (x) { setErr(x); } };
  if (cid) return (
    <section className="wrap chat">
      <button className="btn ghost small" onClick={() => setSp({})}>← All chats</button>
      <div className="msgs" aria-live="polite">{msgs.map((m) => <p key={m._id} className={m.senderId === user.id ? 'me' : 'them'}>{m.body}</p>)}<div ref={end} /></div>
      {err && <p className="err" role="alert">{err.message}</p>}
      <form onSubmit={send} className="row"><label className="sr" htmlFor="mb">Message</label><input id="mb" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Write a message" /><button className="btn accent">Send</button></form>
      <p className="muted small">Messages refresh every few seconds. Never share passwords or card details.</p>
    </section>);
  return (
    <section className="wrap"><h1>Messages</h1>
      {list.loading ? <Spinner /> : list.error ? <ErrorBox error={list.error} retry={list.reload} /> : !list.data.items.length ? <Empty title="No conversations">Open a book and tap “Message owner”.</Empty> :
        list.data.items.map((c) => { const other = c.participantIds.find((p) => p._id !== user.id); return (
          <button key={c._id} className="card swap rowbtn" onClick={() => setSp({ c: c._id })}><strong>{other?.name}</strong><span className="muted">{c.listingId?.title || 'Direct message'}</span>{c.unread > 0 && <span className="tag alt">{c.unread} new</span>}</button>); })}
    </section>
  );
}

export function Notifications() {
  const { data, error, loading, reload } = useData(() => api('/notifications'), []);
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }); reload(); };
  if (loading) return <Spinner />; if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <section className="wrap"><div className="row between"><h1>Alerts</h1>{data.unread > 0 && <button className="btn ghost" onClick={readAll}>Mark all read</button>}</div>
      {!data.items.length ? <Empty title="Nothing yet">Swap, order and message updates show up here.</Empty> : data.items.map((n) => <Link key={n._id} to={n.link || '/'} className={`card swap ${n.readAt ? '' : 'unread'}`}>{n.text}<span className="muted small">{new Date(n.createdAt).toLocaleString()}</span></Link>)}
    </section>
  );
}

export function Communities() {
  const { user } = useAuth(); const { data, error, loading, reload } = useData(() => api('/communities'), []);
  const [f, setF] = useState({ name: '', description: '' }); const [err, setErr] = useState(null);
  const create = async (e) => { e.preventDefault(); setErr(null); try { await api('/communities', { method: 'POST', body: f.description ? f : { name: f.name } }); setF({ name: '', description: '' }); reload(); } catch (x) { setErr(x); } };
  return (
    <section className="wrap"><h1>Reader community</h1>
      {loading ? <Spinner /> : error ? <ErrorBox error={error} retry={reload} /> : !data.items.length ? <Empty title="No groups yet">Start the first book club below.</Empty> :
        data.items.map((c) => <Link key={c.id} className="card swap" to={`/community/${c.id}`}><strong>{c.name}</strong><span className="muted">{c.description}</span><span className="tag">{c.members} members</span></Link>)}
      {user ? <form onSubmit={create} className="form"><h2>Start a group</h2>
        <label>Name<input required minLength={3} maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Description<input maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        {err && <p className="err" role="alert">{err.message}</p>}<button className="btn accent">Create group</button></form> : <p><Link to="/login">Log in</Link> to join or start a group.</p>}
    </section>
  );
}

export function CommunityDetail() {
  const { id } = useParams(); const { user } = useAuth(); const { data, error, loading, reload } = useData(() => api(`/communities/${id}`), [id]);
  const [body, setBody] = useState(''); const [err, setErr] = useState(null);
  const call = async (fn) => { setErr(null); try { await fn(); reload(); } catch (x) { setErr(x); } };
  const report = (pid) => { const reason = prompt('Why are you reporting this post?'); if (reason && reason.trim().length >= 5) call(() => api('/reports', { method: 'POST', body: { targetType: 'post', targetId: pid, reason } })); };
  if (loading) return <Spinner />; if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <section className="wrap narrow"><h1>{data.community.name}</h1><p className="muted">{data.community.description} · {data.community.members} members</p>
      {user && <div className="row"><button className="btn" onClick={() => call(() => api(`/communities/${id}/join`, { method: 'POST' }))}>Join</button><button className="btn ghost" onClick={() => call(() => api(`/communities/${id}/leave`, { method: 'POST' }))}>Leave</button></div>}
      {err && <p className="err" role="alert">{err.message}</p>}
      {user && <form className="form" onSubmit={(e) => { e.preventDefault(); call(async () => { await api(`/communities/${id}/posts`, { method: 'POST', body: { body } }); setBody(''); }); }}><label>Share a recommendation<textarea rows={3} required maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} /></label><button className="btn accent">Post</button></form>}
      {!data.posts.length ? <Empty title="No posts yet">Members can share what they are reading.</Empty> : data.posts.map((p) => <article key={p._id} className="card swap"><strong>{p.authorId?.name}</strong><p>{p.body}</p>{user && <button className="btn ghost small" onClick={() => report(p._id)}>Report</button>}</article>)}
    </section>
  );
}

export function Profile() {
  const { id } = useParams(); const { user } = useAuth(); const { data, error, loading, reload } = useData(() => api(`/users/${id}`), [id]);
  if (loading) return <Spinner />; if (error) return <ErrorBox error={error} retry={reload} />;
  return (
    <section className="wrap"><h1>{data.user.name}</h1><p className="muted">{data.user.area} {data.user.bio}</p>
      {user && user.id !== id && <div className="row wrap"><button className="btn ghost small" onClick={async () => { if (confirm('Block this reader? They will not be able to message you or send swap requests.')) { await api(`/auth/block/${id}`, { method: 'POST' }); alert('Blocked.'); } }}>Block</button><button className="btn ghost small" onClick={async () => { const reason = prompt('Why are you reporting this reader?'); if (reason && reason.trim().length >= 5) { try { await api('/reports', { method: 'POST', body: { targetType: 'user', targetId: id, reason } }); alert('Thanks. Our team will review it.'); } catch (e) { alert(e.message); } } }}>Report</button></div>}
      <p>{data.avgRating ? `★ ${data.avgRating.toFixed(1)} from ${data.reviews.length} review(s)` : 'No reviews yet'}</p>
      <h2>Bookshelf</h2>{data.listings.length ? <div className="grid">{data.listings.map((b) => <BookCard key={b.id} b={b} />)}</div> : <Empty title="No active books" />}
      <h2>Reviews</h2>{data.reviews.map((r) => <p key={r._id}><b>{'★'.repeat(r.rating)}</b> {r.comment} <span className="muted">— {r.authorId?.name}</span></p>)}
    </section>
  );
}

export function Admin() {
  const { user } = useAuth(); const [tab, setTab] = useState('overview');
  const d = useData(() => (user.role === 'admin' ? api(`/admin/${tab}`) : Promise.reject(new Error('Admins only.'))), [tab]); const [err, setErr] = useState(null);
  const run = async (fn) => { setErr(null); try { await fn(); } catch (e) { setErr(e); } d.reload(); };
  if (user.role !== 'admin') return <div className="state error" role="alert">You do not have access to this page.</div>;
  return (
    <section className="wrap"><h1>Admin</h1>
      <div className="tabs">{['overview', 'users', 'reports', 'audit'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {err && <p className="err" role="alert">{err.message}</p>}
      {d.loading ? <Spinner /> : d.error ? <ErrorBox error={d.error} retry={d.reload} /> :
        tab === 'overview' ? <div className="grid">{Object.entries(d.data).map(([k, v]) => <div className="card swap" key={k}><span className="muted">{k}</span><strong>{v}</strong></div>)}</div> :
        tab === 'users' ? d.data.items.map((u) => <div className="card swap" key={u._id}><strong>{u.name}</strong><span className="muted">{u.email} · {u.role}</span><div className="row"><span className="tag">{u.status}</span>{u._id !== user.id && <button className="btn ghost small" onClick={() => run(() => api(`/admin/users/${u._id}/status`, { method: 'PATCH', body: { status: u.status === 'active' ? 'suspended' : 'active' } }))}>{u.status === 'active' ? 'Suspend' : 'Reinstate'}</button>}</div></div>) :
        tab === 'reports' ? (d.data.items.length ? d.data.items.map((r) => <div className="card swap" key={r._id}><strong>{r.targetType} · {r.status}</strong><p>{r.reason}</p><span className="muted small">by {r.reporterId?.name}</span>
          {r.status === 'open' && <div className="row wrap"><button className="btn accent small" onClick={() => run(() => api(`/admin/reports/${r._id}`, { method: 'PATCH', body: { status: 'resolved', removeTarget: true } }))}>Remove & resolve</button><button className="btn ghost small" onClick={() => run(() => api(`/admin/reports/${r._id}`, { method: 'PATCH', body: { status: 'dismissed' } }))}>Dismiss</button></div>}</div>) : <Empty title="No reports" />) :
        d.data.items.map((a) => <p key={a._id} className="small">{new Date(a.createdAt).toLocaleString()} · {a.actorId?.name} · {a.action}</p>)}
    </section>
  );
}

const useToken = () => new URLSearchParams(window.location.search).get('token') || '';
export function ForgotPassword() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(null); const [err, setErr] = useState(null);
  const go = async (e) => { e.preventDefault(); setErr(null); try { setDone((await api('/auth/forgot-password', { method: 'POST', body: { email } })).message); } catch (x) { setErr(x); } };
  return <section className="wrap narrow"><h1>Reset your password</h1>{done ? <p role="status">{done}</p> : <form className="form" onSubmit={go}><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>{err && <p className="err" role="alert">{err.message}</p>}<button className="btn accent">Send reset link</button></form>}</section>;
}
export function ResetPassword() {
  const token = useToken(); const nav = useNavigate(); const [password, setPassword] = useState(''); const [err, setErr] = useState(null);
  const go = async (e) => { e.preventDefault(); setErr(null); try { await api('/auth/reset-password', { method: 'POST', body: { token, password } }); alert('Password changed. Please log in.'); nav('/login'); } catch (x) { setErr(x); } };
  return <section className="wrap narrow"><h1>Choose a new password</h1><form className="form" onSubmit={go}><label>New password<input type="password" required minLength={8} maxLength={100} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>{err && <><p className="err" role="alert">{err.message}</p><FieldErrors err={err} /></>}<button className="btn accent">Save password</button></form></section>;
}
export function VerifyEmail() {
  const token = useToken(); const [state, setState] = useState('working');
  useEffect(() => { api('/auth/verify-email', { method: 'POST', body: { token } }).then(() => setState('ok')).catch((e) => setState(e.message)); }, [token]);
  return <section className="wrap narrow"><h1>Email verification</h1>{state === 'working' ? <Spinner /> : state === 'ok' ? <p role="status">Your email is verified. <Link to="/library">Go to your library</Link></p> : <p className="err" role="alert">{state}</p>}</section>;
}
export function Welcome() {
  const { setUser } = useAuth(); const nav = useNavigate(); const [genres, setGenres] = useState([]); const [area, setArea] = useState(''); const [err, setErr] = useState(null);
  const toggle = (g) => setGenres(genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g]);
  const save = async (e) => { e.preventDefault(); try { const { user } = await api('/auth/me', { method: 'PATCH', body: { genres, area, onboarded: true } }); setUser(user); nav('/explore'); } catch (x) { setErr(x); } };
  return <section className="wrap narrow"><h1>Welcome to BookLoop</h1><p className="muted">Tell us what you like to read. You can change this later.</p>
    <form className="form" onSubmit={save}><fieldset className="row wrap" style={{ border: 0, padding: 0 }}><legend>Favourite genres</legend>{CATEGORIES.map((g) => <label key={g} className="chip pick"><input type="checkbox" checked={genres.includes(g)} onChange={() => toggle(g)} /> {g}</label>)}</fieldset>
      <label>Your area (city or campus, optional)<input maxLength={60} value={area} onChange={(e) => setArea(e.target.value)} /></label>
      <p className="muted small">Only this general area is shown, never your address.</p>{err && <p className="err" role="alert">{err.message}</p>}
      <button className="btn accent">Continue</button> <Link to="/explore">Skip for now</Link></form></section>;
}
