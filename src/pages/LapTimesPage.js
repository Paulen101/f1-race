import React, { useState } from 'react';
import { getLapTimes, getFastestLaps, getLapTimeAnalysis } from '../services/api';
import { formatLapTime, getTireColor } from '../utils/helpers';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function LapTimesPage() {
  const [year, setYear] = useState(2024);
  const [grandPrix, setGrandPrix] = useState('');
  const [sessionName, setSessionName] = useState('Race');
  const [selectedDrivers, setSelectedDrivers] = useState('');
  const [lapData, setLapData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLoadData = async () => {
    if (!grandPrix) {
      alert('Please enter a Grand Prix name');
      return;
    }

    try {
      setLoading(true);
      
      const drivers = selectedDrivers ? selectedDrivers.split(',').map(d => d.trim()).join(',') : null;
      
      const [laps, analysisData] = await Promise.all([
        getLapTimes(year, grandPrix, sessionName),
        getLapTimeAnalysis(year, grandPrix, sessionName, drivers)
      ]);
      
      setLapData(laps.laps || []);
      setAnalysis(analysisData.analysis || []);
    } catch (error) {
      console.error('Error loading lap data:', error);
      alert('Error loading data. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (!lapData || lapData.length === 0) return [];
    
    const driverFilter = selectedDrivers 
      ? selectedDrivers.split(',').map(d => d.trim().toUpperCase())
      : [];
    
    const filteredLaps = driverFilter.length > 0
      ? lapData.filter(lap => driverFilter.includes(lap.driver?.toUpperCase()))
      : lapData;
    
    // Group by lap number
    const grouped = {};
    filteredLaps.forEach(lap => {
      if (!grouped[lap.lap_number]) {
        grouped[lap.lap_number] = { lap: lap.lap_number };
      }
      if (lap.lap_time) {
        grouped[lap.lap_number][lap.driver] = lap.lap_time;
      }
    });
    
    return Object.values(grouped).sort((a, b) => a.lap - b.lap);
  };

  const chartData = prepareChartData();
  const drivers = lapData ? [...new Set(lapData.map(l => l.driver))] : [];
  const colors = ['#E10600', '#00A000', '#0000FF', '#FFF200', '#FF6B00', '#800080'];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-f1-red">Lap Time Analysis</h1>
      
      {/* Controls */}
      <div className="bg-f1-gray rounded-lg p-6 mb-6">
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-2">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2">Grand Prix</label>
            <input
              type="text"
              value={grandPrix}
              onChange={(e) => setGrandPrix(e.target.value)}
              placeholder="e.g., Monaco"
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2">Session</label>
            <select
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            >
              <option>Race</option>
              <option>Qualifying</option>
              <option>Sprint</option>
              <option>FP1</option>
              <option>FP2</option>
              <option>FP3</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm mb-2">Drivers (comma-separated)</label>
            <input
              type="text"
              value={selectedDrivers}
              onChange={(e) => setSelectedDrivers(e.target.value)}
              placeholder="e.g., VER, HAM, LEC"
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            />
          </div>
        </div>
        
        <button
          onClick={handleLoadData}
          disabled={loading}
          className="bg-f1-red text-white px-6 py-2 rounded hover:bg-red-700 disabled:bg-gray-600 transition"
        >
          {loading ? 'Loading...' : 'Load Data'}
        </button>
      </div>

      {/* Lap Time Chart */}
      {chartData.length > 0 && (
        <div className="bg-f1-gray rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Lap Time Progression</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="lap" stroke="#fff" label={{ value: 'Lap Number', position: 'insideBottom', offset: -5 }} />
              <YAxis stroke="#fff" label={{ value: 'Lap Time (s)', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: '#38383F', border: 'none' }} />
              <Legend />
              {drivers.slice(0, 6).map((driver, idx) => (
                <Line
                  key={driver}
                  type="monotone"
                  dataKey={driver}
                  stroke={colors[idx]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Analysis Table */}
      {analysis && analysis.length > 0 && (
        <div className="bg-f1-gray rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Driver Analysis</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-2">Driver</th>
                  <th className="text-right py-2">Laps</th>
                  <th className="text-right py-2">Fastest</th>
                  <th className="text-right py-2">Average</th>
                  <th className="text-right py-2">Consistency</th>
                  <th className="text-right py-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {analysis.map((driver, idx) => (
                  <tr key={idx} className="border-b border-gray-700">
                    <td className="py-2 font-bold">{driver.driver}</td>
                    <td className="py-2 text-right">{driver.total_laps}</td>
                    <td className="py-2 text-right">{formatLapTime(driver.fastest_lap)}</td>
                    <td className="py-2 text-right">{formatLapTime(driver.average_lap)}</td>
                    <td className="py-2 text-right">{(driver.consistency_score * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right">
                      <span className={
                        driver.pace_trend === 'improving' ? 'text-green-500' :
                        driver.pace_trend === 'degrading' ? 'text-red-500' : 'text-yellow-500'
                      }>
                        {driver.pace_trend}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default LapTimesPage;
