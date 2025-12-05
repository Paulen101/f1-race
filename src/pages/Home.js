import React, { useState, useEffect } from 'react';
import { getSeasonSchedule, getDriverStandings } from '../services/api';

function Home() {
  const [currentYear] = useState(2024);
  const [schedule, setSchedule] = useState([]);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scheduleData, standingsData] = await Promise.all([
        getSeasonSchedule(currentYear),
        getDriverStandings(currentYear)
      ]);
      
      setSchedule(scheduleData.events || []);
      setStandings(standingsData.standings || []);
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
            Driver Standings {currentYear}
          </h2>
          <div className="overflow-auto max-h-96">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-2">Pos</th>
                  <th className="text-left py-2">Driver</th>
                  <th className="text-right py-2">Points</th>
                </tr>
              </thead>
              <tbody>
                {standings.slice(0, 10).map((driver, index) => (
                  <tr key={index} className="border-b border-gray-700">
                    <td className="py-2 font-bold">{index + 1}</td>
                    <td className="py-2">{driver.driver || driver.full_name}</td>
                    <td className="py-2 text-right">{driver.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <div className="text-sm text-gray-400">Round {race.round}</div>
              <div className="font-bold text-lg">{race.grand_prix}</div>
              <div className="text-gray-300">{race.location}, {race.country}</div>
              <div className="text-sm text-gray-400 mt-2">
                {race.date ? new Date(race.date).toLocaleDateString() : 'TBD'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
