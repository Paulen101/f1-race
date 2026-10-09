import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, useLocation } from 'react-router-dom';
import { motion, MotionConfig } from 'motion/react';
import { FiActivity, FiBarChart2, FiClock, FiCpu, FiLayers, FiMap, FiUsers } from 'react-icons/fi';

// Pages
import Home from './pages/Home';
import LapTimesPage from './pages/LapTimesPage';
import TelemetryPage from './pages/TelemetryPage';
import StrategyPage from './pages/StrategyPage';
import PredictionsPage from './pages/PredictionsPage';
import DriversPage from './pages/DriversPage';
import CircuitsPage from './pages/CircuitsPage';
import ComparisonsPage from './pages/ComparisonsPage';

export const NAV_LINKS = [
  { to: '/laptimes', label: 'Lap Times', icon: FiClock },
  { to: '/telemetry', label: 'Telemetry', icon: FiActivity },
  { to: '/strategy', label: 'Strategy', icon: FiLayers },
  { to: '/predictions', label: 'Predictions', icon: FiCpu },
  { to: '/drivers', label: 'Drivers', icon: FiUsers },
  { to: '/circuits', label: 'Circuits', icon: FiMap },
  { to: '/comparisons', label: 'Comparisons', icon: FiBarChart2 },
];

function Logo() {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="F1 Analytics home">
      <span className="flex items-center gap-[3px]" aria-hidden="true">
        <span className="h-5 w-1.5 -skew-x-[25deg] rounded-sm bg-f1-red transition-transform group-hover:-translate-x-0.5" />
        <span className="h-5 w-1.5 -skew-x-[25deg] rounded-sm bg-f1-red/70" />
        <span className="h-5 w-1.5 -skew-x-[25deg] rounded-sm bg-f1-red/40 transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="text-lg font-black italic leading-none tracking-tight">
        F1<span className="ml-1.5 font-semibold not-italic tracking-[0.2em] text-gray-300 text-xs align-middle">ANALYTICS</span>
      </span>
    </Link>
  );
}

function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-f1-dark/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:py-0">
        <Logo />
        {/* Scrolls sideways on narrow screens instead of widening the page */}
        <nav className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0" aria-label="Main">
          <ul className="flex w-max gap-1">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                      isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-full border border-f1-red/40 bg-f1-red/15"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Icon className={`relative ${isActive ? 'text-f1-red-bright' : ''}`} aria-hidden="true" />
                      <span className="relative">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-gray-500 sm:flex-row sm:px-6">
        <Logo />
        <p>&copy; {new Date().getFullYear()} F1 Analytics Platform · Powered by FastF1 &amp; FastAPI</p>
      </div>
    </footer>
  );
}

const navIndex = (pathname) => NAV_LINKS.findIndex((link) => link.to === pathname);

/**
 * Each route starts at the top and slides in from the side of the nav it
 * came from: moving right along the nav enters from the right, and back.
 */
function AnimatedRoutes() {
  const location = useLocation();
  const previous = useRef(location.pathname);
  const index = navIndex(location.pathname);
  const fromIndex = navIndex(previous.current);
  const direction = previous.current === location.pathname ? 0 : index > fromIndex ? 1 : -1;

  useEffect(() => {
    window.scrollTo(0, 0);
    previous.current = location.pathname;
  }, [location.pathname]);

  const page = (element) => <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12">{element}</div>;

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, x: direction * 40, y: direction === 0 ? 12 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/laptimes" element={page(<LapTimesPage />)} />
        <Route path="/telemetry" element={page(<TelemetryPage />)} />
        <Route path="/strategy" element={page(<StrategyPage />)} />
        <Route path="/predictions" element={page(<PredictionsPage />)} />
        <Route path="/drivers" element={page(<DriversPage />)} />
        <Route path="/circuits" element={page(<CircuitsPage />)} />
        <Route path="/comparisons" element={page(<ComparisonsPage />)} />
      </Routes>
    </motion.div>
  );
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Router>
        <div className="flex min-h-screen flex-col text-white">
          <NavBar />
          {/* clip, not hidden: page slides must not add a scrollbar or break sticky headers */}
          <main className="flex-1 overflow-x-clip">
            <AnimatedRoutes />
          </main>
          <Footer />
        </div>
      </Router>
    </MotionConfig>
  );
}

export default App;
