import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
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

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-f1-dark text-white">
        <nav className="bg-f1-gray shadow-lg">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="text-2xl font-bold text-f1-red">
                F1 Analytics
              </Link>
              
              <div className="flex space-x-6">
                <Link to="/laptimes" className="hover:text-f1-red transition">
                  Lap Times
                </Link>
                <Link to="/telemetry" className="hover:text-f1-red transition">
                  Telemetry
                </Link>
                <Link to="/strategy" className="hover:text-f1-red transition">
                  Strategy
                </Link>
                <Link to="/predictions" className="hover:text-f1-red transition">
                  Predictions
                </Link>
                <Link to="/drivers" className="hover:text-f1-red transition">
                  Drivers
                </Link>
                <Link to="/circuits" className="hover:text-f1-red transition">
                  Circuits
                </Link>
                <Link to="/comparisons" className="hover:text-f1-red transition">
                  Comparisons
                </Link>
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
            <p>&copy; 2024 F1 Analytics Platform. Powered by FastF1 & FastAPI.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
