import React, { useState, useEffect } from 'react';
import { getSeasonSchedule } from '../services/api';

function Home() {
  const [currentYear] = useState(2024);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Only load schedule, skip standings to speed up
      const scheduleData = await getSeasonSchedule(currentYear);
      setSchedule(scheduleData.events || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-f1-red">
          F1 Analytics & Prediction Platform
        </h1>
        <p className="text-gray-300 text-lg">
          Advanced analytics, telemetry comparison, and race predictions powered by FastF1 and machine learning
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Features */}
        <div className="bg-f1-gray rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-red">Features</h2>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-center">
              <span className="text-f1-red mr-2">▸</span>
              Detailed lap time analysis and comparison
            </li>
            <li className="flex items-center">
              <span className="text-f1-red mr-2">▸</span>
              Interactive telemetry visualization
            </li>
            <li className="flex items-center">
              <span className="text-f1-red mr-2">▸</span>
              Pit stop and tire strategy analysis
            </li>
            <li className="flex items-center">
              <span className="text-f1-red mr-2">▸</span>
              ML-powered race predictions
            </li>
            <li className="flex items-center">
              <span className="text-f1-red mr-2">▸</span>
              Driver performance tracking
            </li>
            <li className="flex items-center">
              <span className="text-f1-red mr-2">▸</span>
              Circuit-specific statistics
            </li>
            <li className="flex items-center">
              <span className="text-f1-red mr-2">▸</span>
              Head-to-head comparisons
            </li>
          </ul>
        </div>

        {/* Current Standings */}
        <div className="bg-f1-gray rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-f1-red">
            Quick Links
          </h2>
          <div className="space-y-3">
            <a href="/drivers" className="block bg-f1-dark hover:bg-gray-700 rounded p-4 transition">
              <h3 className="font-bold text-lg mb-1">Driver Analysis</h3>
              <p className="text-sm text-gray-400">Detailed driver performance metrics and comparisons</p>
            </a>
            <a href="/predictions" className="block bg-f1-dark hover:bg-gray-700 rounded p-4 transition">
              <h3 className="font-bold text-lg mb-1">AI Race Predictions</h3>
              <p className="text-sm text-gray-400">ML-powered predictions for upcoming races</p>
            </a>
            <a href="/telemetry" className="block bg-f1-dark hover:bg-gray-700 rounded p-4 transition">
              <h3 className="font-bold text-lg mb-1">Telemetry Comparison</h3>
              <p className="text-sm text-gray-400">Compare driver telemetry data side-by-side</p>
            </a>
            <a href="/laptimes" className="block bg-f1-dark hover:bg-gray-700 rounded p-4 transition">
              <h3 className="font-bold text-lg mb-1">Lap Time Analysis</h3>
              <p className="text-sm text-gray-400">Analyze lap times and session performance</p>
            </a>
          </div>
        </div>
      </div>

      {/* Upcoming Races */}
      <div className="bg-f1-gray rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-f1-red">
          {currentYear} Race Calendar
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {schedule.slice(0, 6).map((race, index) => (
            <div key={index} className="bg-f1-dark rounded p-4">
              <div className="text-sm text-gray-400">Round {race.RoundNumber}</div>
              <div className="font-bold text-lg">{race.EventName}</div>
              <div className="text-gray-300">{race.Location}, {race.Country}</div>
              <div className="text-sm text-gray-400 mt-2">
                {race.EventDate}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
