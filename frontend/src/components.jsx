// import { useEffect, useState } from 'react';
// import { Link, NavLink, Navigate, useLocation } from 'react-router-dom';
// import { useAuth } from './auth.jsx';
// import { CONDITION_LABEL, MODE_LABEL } from './api.js';

// export const Spinner = ({ label = 'Loading…' }) => <div className="state" role="status" aria-live="polite"><div className="spin" />{label}</div>;
// export const ErrorBox = ({ error, retry }) => (
//   <div className="state error" role="alert">{error?.message || 'Something went wrong.'}{retry && <button className="btn ghost" onClick={retry}>Try again</button>}</div>
// );
// export const Empty = ({ title, children }) => <div className="state"><strong>{title}</strong><span>{children}</span></div>;

// export function Protected({ children }) {
//   const { user, ready } = useAuth(); const loc = useLocation();
//   if (!ready) return <Spinner />;
//   return user ? children : <Navigate to="/login" state={{ from: loc.pathname }} replace />;
// }

// export function BookCard({ b }) {
//   return (
//     <Link to={`/book/${b.id}`} className="card book">
//       <div className="cover" style={b.coverUrl ? { backgroundImage: `url(${b.coverUrl})` } : undefined} aria-hidden={!b.coverUrl}>
//         {!b.coverUrl && <span>{b.title}</span>}
//       </div>
//       <div className="meta">
//         <h3>{b.title}</h3><p>{b.author}</p>
//         <div className="row">
//           <span className="tag">{CONDITION_LABEL[b.condition]}</span>
//           <span className="tag alt">{MODE_LABEL[b.tradeMode]}</span>
//         </div>
//         {b.tradeMode !== 'swap' && <strong className="price">₹{b.price}</strong>}
//       </div>
//     </Link>
//   );
// }

// export function Header() {
//   const { user, logout } = useAuth();
//   return (
//     <header className="top">
//       <Link to="/" className="logo">📚 BookLoop</Link>
//       <nav className="desk" aria-label="Main">
//         <NavLink to="/">Home</NavLink><NavLink to="/explore">Explore</NavLink>
//         {user && <NavLink to="/swaps">Swap</NavLink>}<NavLink to="/community">Community</NavLink>{user && <NavLink to="/messages">Messages</NavLink>}{user && <NavLink to="/notifications">Alerts</NavLink>}
//         {user && <NavLink to="/library">My Library</NavLink>}
//       </nav>
//       <div className="row">
//         <Link className="btn desk-only" to="/list">List a book</Link>
//         {user ? <button className="btn ghost" onClick={logout}>Log out</button> : <Link className="btn ghost" to="/login">Log in</Link>}
//       </div>
//     </header>
//   );
// }

// export function BottomNav() {
//   return (
//     <nav className="bottom" aria-label="Mobile">
//       <NavLink to="/" end>🏠<span>Home</span></NavLink>
//       <NavLink to="/explore">🔎<span>Explore</span></NavLink>
//       <NavLink to="/list" className="plus">➕<span>List</span></NavLink>
//       <NavLink to="/swaps">🔁<span>Activity</span></NavLink>
//       <NavLink to="/library">📖<span>Library</span></NavLink>
//     </nav>
//   );
// }
// export const Footer = () => (
//   <footer className="foot"><Link to="/how-it-works">How it works</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><span>BookLoop is a new community project. Not yet processing payments.</span></footer>
// );

// // "Install app" prompt: Android/Chrome uses the native prompt; iPhone shows Add to Home Screen steps.
// export function InstallBanner() {
//   const [evt, setEvt] = useState(null); const [hide, setHide] = useState(() => { try { return localStorage.getItem('bl_install_hide') === '1'; } catch { return false; } });
//   useEffect(() => { const h = (e) => { e.preventDefault(); setEvt(e); }; window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h); }, []);
//   const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
//   const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
//   if (standalone || hide || (!evt && !ios)) return null;
//   const dismiss = () => { setHide(true); try { localStorage.setItem('bl_install_hide', '1'); } catch {} };
//   return (
//     <div className="install" role="region" aria-label="Install BookLoop">
//       <span>{evt ? 'Install BookLoop for a full-screen app experience.' : 'To install: tap Share, then “Add to Home Screen”.'}</span>
//       <span className="row">{evt && <button className="btn accent small" onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null); }}>Install</button>}<button className="btn ghost small" onClick={dismiss} aria-label="Dismiss">Not now</button></span>
//     </div>
//   );
// }





import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { CONDITION_LABEL, MODE_LABEL } from './api.js';

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="state" role="status" aria-live="polite">
    <div className="spin" />
    {label}
  </div>
);

export const ErrorBox = ({ error, retry }) => (
  <div className="state error" role="alert">
    {error?.message || 'Something went wrong.'}
    {retry && (
      <button className="btn ghost" onClick={retry} type="button">
        Try again
      </button>
    )}
  </div>
);

export const Empty = ({ title, children }) => (
  <div className="state">
    <strong>{title}</strong>
    <span>{children}</span>
  </div>
);

export function Protected({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <Spinner />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return children;
}

export function BookCard({ b }) {
  return (
    <Link to={`/book/${b.id}`} className="card book">
      <div
        className="cover"
        style={
          b.coverUrl
            ? { backgroundImage: `url(${b.coverUrl})` }
            : undefined
        }
        aria-hidden={!b.coverUrl}
      >
        {!b.coverUrl && <span>{b.title}</span>}
      </div>

      <div className="meta">
        <h3>{b.title}</h3>
        <p>{b.author}</p>

        <div className="row">
          <span className="tag">
            {CONDITION_LABEL[b.condition] ?? b.condition}
          </span>

          <span className="tag alt">
            {MODE_LABEL[b.tradeMode] ?? b.tradeMode}
          </span>
        </div>

        {b.tradeMode !== 'swap' && (
          <strong className="price">₹{b.price}</strong>
        )}
      </div>
    </Link>
  );
}

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="top">
      <Link to="/" className="logo">
        📚 BookLoop
      </Link>

      <nav className="desk" aria-label="Main navigation">
        <NavLink to="/" end>
          Home
        </NavLink>

        <NavLink to="/explore">
          Explore
        </NavLink>

        {user && <NavLink to="/swaps">Swap</NavLink>}

        <NavLink to="/community">
          Community
        </NavLink>

        {user && <NavLink to="/messages">Messages</NavLink>}

        {user && <NavLink to="/notifications">Alerts</NavLink>}

        {user && <NavLink to="/library">My Library</NavLink>}
      </nav>

      <div className="row">
        <Link className="btn desk-only" to="/list">
          List a book
        </Link>

        {user ? (
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              logout().catch((error) => {
                console.error('Logout failed:', error);
              });
            }}
          >
            Log out
          </button>
        ) : (
          <Link className="btn ghost" to="/login">
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="bottom" aria-label="Mobile navigation">
      <NavLink to="/" end>
        🏠<span>Home</span>
      </NavLink>

      <NavLink to="/explore">
        🔎<span>Explore</span>
      </NavLink>

      <NavLink to="/list" className="plus">
        ➕<span>List</span>
      </NavLink>

      <NavLink to="/swaps">
        🔁<span>Activity</span>
      </NavLink>

      <NavLink to="/library">
        📖<span>Library</span>
      </NavLink>
    </nav>
  );
}

export const Footer = () => (
  <footer className="foot">
    <Link to="/how-it-works">How it works</Link>
    <Link to="/privacy">Privacy</Link>
    <Link to="/terms">Terms</Link>

    <span>
      BookLoop is a community project. Payments are not yet processed.
    </span>
  </footer>
);

export function InstallBanner() {
  const [installEvent, setInstallEvent] = useState(null);

  const [hide, setHide] = useState(() => {
    try {
      return localStorage.getItem('bl_install_hide') === '1';
    } catch {
      return false;
    }
  });

  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      setHide(true);

      try {
        localStorage.setItem('bl_install_hide', '1');
      } catch {
        // Storage may be unavailable.
      }
    };

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt
    );

    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );

      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true;

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  const dismiss = () => {
    setHide(true);

    try {
      localStorage.setItem('bl_install_hide', '1');
    } catch {
      // Storage may be unavailable.
    }
  };

  const installApp = async () => {
    if (!installEvent || installing) return;

    const promptEvent = installEvent;

    setInstalling(true);
    setInstallEvent(null);

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (error) {
      console.error('Unable to show install prompt:', error);
    } finally {
      setInstalling(false);
    }
  };

  if (standalone || hide || (!installEvent && !ios)) {
    return null;
  }

  return (
    <div className="install" role="region" aria-label="Install BookLoop">
      <span>
        {installEvent
          ? 'Install BookLoop for a full-screen app experience.'
          : 'To install BookLoop, tap Share, then “Add to Home Screen”.'}
      </span>

      <span className="row">
        {installEvent && (
          <button
            className="btn accent small"
            type="button"
            onClick={installApp}
            disabled={installing}
          >
            {installing ? 'Opening…' : 'Install'}
          </button>
        )}

        <button
          className="btn ghost small"
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install banner"
        >
          Not now
        </button>
      </span>
    </div>
  );
}
