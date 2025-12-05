import React, { useState } from 'react';
import { compareTelemetry } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function TelemetryPage() {
  const [year, setYear] = useState(2024);
  const [grandPrix, setGrandPrix] = useState('');
  const [sessionName, setSessionName] = useState('Race');
  const [driver1, setDriver1] = useState('');
  const [driver2, setDriver2] = useState('');
  const [telemetryData, setTelemetryData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLoadTelemetry = async () => {
    if (!grandPrix || !driver1 || !driver2) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const data = await compareTelemetry(year, grandPrix, sessionName, driver1, driver2);
      setTelemetryData(data);
    } catch (error) {
      console.error('Error loading telemetry:', error);
      alert('Error loading telemetry data. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (!telemetryData) return { speed: [], throttle: [], brake: [] };
    
    const tel1 = telemetryData.driver1?.telemetry || [];
    const tel2 = telemetryData.driver2?.telemetry || [];
    
    const speedData = tel1.map((point, idx) => ({
      distance: point.Distance || point.distance,
      [driver1]: point.Speed || point.speed,
      [driver2]: tel2[idx]?.Speed || tel2[idx]?.speed
    }));
    
    const throttleData = tel1.map((point, idx) => ({
      distance: point.Distance || point.distance,
      [driver1]: point.Throttle || point.throttle,
      [driver2]: tel2[idx]?.Throttle || tel2[idx]?.throttle
    }));
    
    const brakeData = tel1.map((point, idx) => ({
      distance: point.Distance || point.distance,
      [driver1]: point.Brake || point.brake,
      [driver2]: tel2[idx]?.Brake || tel2[idx]?.brake
    }));
    
    return { speed: speedData, throttle: throttleData, brake: brakeData };
  };

  const chartData = prepareChartData();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-f1-red">Telemetry Comparison</h1>
      
      {/* Controls */}
      <div className="bg-f1-gray rounded-lg p-6 mb-6">
        <div className="grid md:grid-cols-3 gap-4 mb-4">
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
            </select>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-2">Driver 1</label>
            <input
              type="text"
              value={driver1}
              onChange={(e) => setDriver1(e.target.value)}
              placeholder="e.g., VER"
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2">Driver 2</label>
            <input
              type="text"
              value={driver2}
              onChange={(e) => setDriver2(e.target.value)}
              placeholder="e.g., HAM"
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            />
          </div>
        </div>
        
        <button
          onClick={handleLoadTelemetry}
          disabled={loading}
          className="bg-f1-red text-white px-6 py-2 rounded hover:bg-red-700 disabled:bg-gray-600 transition"
        >
          {loading ? 'Loading...' : 'Compare Telemetry'}
        </button>
      </div>

      {/* Delta Analysis */}
      {telemetryData?.delta_analysis && (
        <div className="bg-f1-gray rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Delta Analysis</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-f1-dark rounded p-4">
              <div className="text-sm text-gray-400">Max Speed Difference</div>
              <div className="text-2xl font-bold">
                {telemetryData.delta_analysis.max_speed_diff?.toFixed(1) || '--'} km/h
              </div>
            </div>
            <div className="bg-f1-dark rounded p-4">
              <div className="text-sm text-gray-400">Avg Speed Difference</div>
              <div className="text-2xl font-bold">
                {telemetryData.delta_analysis.avg_speed_diff?.toFixed(1) || '--'} km/h
              </div>
            </div>
            <div className="bg-f1-dark rounded p-4">
              <div className="text-sm text-gray-400">Throttle Usage Diff</div>
              <div className="text-2xl font-bold">
                {telemetryData.delta_analysis.throttle_usage_diff?.toFixed(1) || '--'}%
              </div>
            </div>
            <div className="bg-f1-dark rounded p-4">
              <div className="text-sm text-gray-400">Brake Usage Diff</div>
              <div className="text-2xl font-bold">
                {telemetryData.delta_analysis.brake_usage_diff?.toFixed(1) || '--'}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Speed Chart */}
      {chartData.speed.length > 0 && (
        <div className="bg-f1-gray rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Speed Comparison</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.speed}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="distance" stroke="#fff" label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }} />
              <YAxis stroke="#fff" label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: '#38383F', border: 'none' }} />
              <Legend />
              <Line type="monotone" dataKey={driver1} stroke="#E10600" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey={driver2} stroke="#00A000" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Throttle Chart */}
      {chartData.throttle.length > 0 && (
        <div className="bg-f1-gray rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Throttle Application</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.throttle}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="distance" stroke="#fff" label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }} />
              <YAxis stroke="#fff" label={{ value: 'Throttle (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: '#38383F', border: 'none' }} />
              <Legend />
              <Line type="monotone" dataKey={driver1} stroke="#E10600" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey={driver2} stroke="#00A000" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Brake Chart */}
      {chartData.brake.length > 0 && (
        <div className="bg-f1-gray rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Brake Application</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.brake}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="distance" stroke="#fff" label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }} />
              <YAxis stroke="#fff" label={{ value: 'Brake', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: '#38383F', border: 'none' }} />
              <Legend />
              <Line type="monotone" dataKey={driver1} stroke="#E10600" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey={driver2} stroke="#00A000" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default TelemetryPage;
