import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import './App.css';

// Pages
import Home from './pages/Home';
import LapTimesPage from './pages/LapTimesPage';
import TelemetryPage from './pages/TelemetryPage';
import StrategyPage from './pages/StrategyPage';
import PredictionsPage from './pages/PredictionsPage';
import DriversPage from './pages/DriversPage';
import CircuitsPage from './pages/CircuitsPage';
import ComparisonsPage from './pages/ComparisonsPage';

const NAV_LINKS = [
  { to: '/laptimes', label: 'Lap Times' },
  { to: '/telemetry', label: 'Telemetry' },
  { to: '/strategy', label: 'Strategy' },
  { to: '/predictions', label: 'Predictions' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/circuits', label: 'Circuits' },
  { to: '/comparisons', label: 'Comparisons' },
];

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-f1-dark text-white">
        <nav className="bg-f1-gray shadow-lg">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-3 md:py-0 md:h-16">
              <Link to="/" className="text-2xl font-bold text-f1-red shrink-0">
                F1 Analytics
              </Link>
              
              {/* Scrolls sideways on narrow screens instead of widening the page */}
              <div className="flex gap-x-6 overflow-x-auto whitespace-nowrap -mx-4 px-4 md:mx-0 md:px-0 pb-1 md:pb-0">
                {NAV_LINKS.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => `transition ${isActive ? 'text-f1-red font-semibold' : 'hover:text-f1-red'}`}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/laptimes" element={<LapTimesPage />} />
            <Route path="/telemetry" element={<TelemetryPage />} />
            <Route path="/strategy" element={<StrategyPage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/drivers" element={<DriversPage />} />
            <Route path="/circuits" element={<CircuitsPage />} />
            <Route path="/comparisons" element={<ComparisonsPage />} />
          </Routes>
        </main>

        <footer className="bg-f1-gray mt-16 py-6">
          <div className="container mx-auto px-4 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} F1 Analytics Platform. Powered by FastF1 & FastAPI.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
