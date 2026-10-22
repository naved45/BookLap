// // import { Routes, Route, Link, useLocation } from 'react-router-dom';
// // import { useEffect } from 'react';
// // import { Header, BottomNav, Footer, Protected, InstallBanner } from './components.jsx';
// // import { Orders, Messages, Notifications, Communities, CommunityDetail, Profile, Admin, ForgotPassword, ResetPassword, VerifyEmail, Welcome } from './pages2.jsx';
// // import { Home, Explore, BookDetail, AuthPage, ListBook, Library, Swaps, Info } from './pages.jsx';

// // export default function App() {
// //   const { pathname } = useLocation();
// //   useEffect(() => window.scrollTo(0, 0), [pathname]);
// //   return (
// //     <>
// //       <a href="#main" className="skip">Skip to content</a>
// //       <Header />
// //       <main id="main">
// //         <Routes>
// //           <Route path="/" element={<Home />} />
// //           <Route path="/explore" element={<Explore />} />
// //           <Route path="/book/:id" element={<BookDetail />} />
// //           <Route path="/login" element={<AuthPage mode="login" />} />
// //           <Route path="/signup" element={<AuthPage mode="signup" />} />
// //           <Route path="/forgot-password" element={<ForgotPassword />} />
// //           <Route path="/reset-password" element={<ResetPassword />} />
// //           <Route path="/verify" element={<VerifyEmail />} />
// //           <Route path="/welcome" element={<Protected><Welcome /></Protected>} />
// //           <Route path="/list" element={<Protected><ListBook /></Protected>} />
// //           <Route path="/library" element={<Protected><Library /></Protected>} />
// //           <Route path="/swaps" element={<Protected><Swaps /></Protected>} />
// //           <Route path="/orders" element={<Protected><Orders /></Protected>} />
// //           <Route path="/messages" element={<Protected><Messages /></Protected>} />
// //           <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
// //           <Route path="/community" element={<Communities />} />
// //           <Route path="/community/:id" element={<CommunityDetail />} />
// //           <Route path="/u/:id" element={<Profile />} />
// //           <Route path="/admin" element={<Protected><Admin /></Protected>} />
// //           <Route path="/how-it-works" element={<Info kind="how" />} />
// //           <Route path="/privacy" element={<Info kind="privacy" />} />
// //           <Route path="/terms" element={<Info kind="terms" />} />
// //           <Route path="*" element={<div className="state"><strong>Page not found</strong><Link to="/">Go home</Link></div>} />
// //         </Routes>
// //       </main>
// //       <InstallBanner />
// //       <Footer />
// //       <BottomNav />
// //     </>
// //   );
// // }




// import { Routes, Route, Link, useLocation } from 'react-router-dom';
// import { useEffect } from 'react';
// import { Header, BottomNav, Footer, Protected, InstallBanner } from './components.jsx';
// import { Orders, Messages, Notifications, Communities, CommunityDetail, Profile, Admin, ForgotPassword, ResetPassword, VerifyEmail, Welcome } from './pages2.jsx';
// import { Home, Explore, BookDetail, AuthPage, ListBook, Library, Swaps, Info } from './pages.jsx';

// export default function App() {
//   const { pathname } = useLocation();

//   useEffect(() => {
//     window.scrollTo(0, 0);
//   }, [pathname]);

//   return (
//     <>
//       <a href="#main" className="skip">Skip to content</a>
//       <Header />
//       <main id="main">
//         <Routes>
//           <Route path="/" element={<Home />} />
//           <Route path="/explore" element={<Explore />} />
//           <Route path="/book/:id" element={<BookDetail />} />
//           <Route path="/login" element={<AuthPage mode="login" />} />
//           <Route path="/signup" element={<AuthPage mode="signup" />} />
//           {/* Keep the rest of your existing routes unchanged */}
//         </Routes>
//       </main>
//       <InstallBanner />
//       <Footer />
//       <BottomNav />
//     </>
//   );
// }




import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import {
  Header,
  BottomNav,
  Footer,
  Protected,
  InstallBanner,
} from './components.jsx';

import {
  Orders,
  Messages,
  Notifications,
  Communities,
  CommunityDetail,
  Profile,
  Admin,
  ForgotPassword,
  ResetPassword,
  VerifyEmail,
  Welcome,
} from './pages2.jsx';

import {
  Home,
  Explore,
  BookDetail,
  AuthPage,
  ListBook,
  Library,
  Swaps,
  Info,
} from './pages.jsx';

export default function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>

      <Header />

      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/book/:id" element={<BookDetail />} />

          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify" element={<VerifyEmail />} />

          <Route
            path="/welcome"
            element={<Protected><Welcome /></Protected>}
          />

          <Route
            path="/list"
            element={<Protected><ListBook /></Protected>}
          />

          <Route
            path="/library"
            element={<Protected><Library /></Protected>}
          />

          <Route
            path="/swaps"
            element={<Protected><Swaps /></Protected>}
          />

          <Route
            path="/orders"
            element={<Protected><Orders /></Protected>}
          />

          <Route
            path="/messages"
            element={<Protected><Messages /></Protected>}
          />

          <Route
            path="/notifications"
            element={<Protected><Notifications /></Protected>}
          />

          <Route path="/community" element={<Communities />} />

          <Route
            path="/community/:id"
            element={<CommunityDetail />}
          />

          <Route path="/u/:id" element={<Profile />} />

          <Route
            path="/admin"
            element={<Protected><Admin /></Protected>}
          />

          <Route path="/how-it-works" element={<Info kind="how" />} />
          <Route path="/privacy" element={<Info kind="privacy" />} />
          <Route path="/terms" element={<Info kind="terms" />} />

          <Route
            path="*"
            element={
              <div className="state">
                <strong>Page not found</strong>
                <Link to="/">Go home</Link>
              </div>
            }
          />
        </Routes>
      </main>

      <InstallBanner />
      <Footer />
      <BottomNav />
    </>
  );
}
