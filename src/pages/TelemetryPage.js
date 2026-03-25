import React, { useState, useEffect } from 'react';
import { compareTelemetry, getAvailableYears, getAvailableTracks, getSessionInfo } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import { exportToCSV } from '../utils/helpers';

function TelemetryPage() {
  const [year, setYear] = useState(2024);
  const [grandPrix, setGrandPrix] = useState('');
  const [sessionName, setSessionName] = useState('Race');
  const [driver1, setDriver1] = useState('');
  const [driver2, setDriver2] = useState('');
  const [telemetryData, setTelemetryData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Dropdown options
  const [availableYears, setAvailableYears] = useState([]);
  const [availableTracks, setAvailableTracks] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  // Load available years on mount
  useEffect(() => {
    const loadYears = async () => {
      try {
        const data = await getAvailableYears();
        const years = data.years || [];
        setAvailableYears(years);
        if (years.length > 0 && !year) {
          setYear(years[0]);
        }
      } catch (error) {
        console.error('Error loading years:', error);
        // Fallback to recent years if API fails
        const fallbackYears = [2024, 2023, 2022, 2021, 2020];
        setAvailableYears(fallbackYears);
      }
    };
    loadYears();
  }, [year]);

  // Load available tracks when year changes
  useEffect(() => {
    const loadTracks = async () => {
      if (!year) return;
      try {
        const data = await getAvailableTracks(year);
        const tracks = (data.tracks || []).map(t => t.name);
        setAvailableTracks(tracks);
        // Auto-select first track if none selected or current selection not in list
        if (tracks.length > 0 && (!grandPrix || !tracks.includes(grandPrix))) {
          setGrandPrix(tracks[0]);
        }
      } catch (error) {
        console.error('Error loading tracks:', error);
        setAvailableTracks([]);
      }
    };
    loadTracks();
  }, [year, grandPrix]);

  // Load available drivers when year/track/session changes
  useEffect(() => {
    const loadDrivers = async () => {
      if (!year || !grandPrix || !sessionName) return;
      try {
        setLoadingDropdowns(true);
        const sessionData = await getSessionInfo(year, grandPrix, sessionName);
        setAvailableDrivers(sessionData.drivers || []);
        setLoadingDropdowns(false);
      } catch (error) {
        console.error('Error loading drivers:', error);
        setAvailableDrivers([]);
        setLoadingDropdowns(false);
      }
    };
    loadDrivers();
  }, [year, grandPrix, sessionName]);

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

  const handleExportCSV = () => {
    if (!telemetryData) return;
    
    const tel1 = telemetryData.driver1.telemetry.map(p => ({ ...p, driver: driver1 }));
    const tel2 = telemetryData.driver2.telemetry.map(p => ({ ...p, driver: driver2 }));
    
    exportToCSV([...tel1, ...tel2], `telemetry_${year}_${grandPrix}_${driver1}_${driver2}`);
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (!telemetryData) return { speed: [], throttle: [], brake: [], track1: [], track2: [] };
    
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

    const track1 = tel1.map(point => ({
      x: point.x,
      y: point.y,
      speed: point.speed,
      driver: driver1
    })).filter(p => p.x !== undefined && p.y !== undefined);

    const track2 = tel2.map(point => ({
      x: point.x,
      y: point.y,
      speed: point.speed,
      driver: driver2
    })).filter(p => p.x !== undefined && p.y !== undefined);
    
    return { speed: speedData, throttle: throttleData, brake: brakeData, track1, track2 };
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
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm mb-2">Grand Prix</label>
            <select
              value={grandPrix}
              onChange={(e) => setGrandPrix(e.target.value)}
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            >
              <option value="">Select a track...</option>
              {availableTracks.map(track => (
                <option key={track} value={track}>{track}</option>
              ))}
            </select>
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
            <select
              value={driver1}
              onChange={(e) => setDriver1(e.target.value)}
              disabled={loadingDropdowns}
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none disabled:opacity-50"
            >
              <option value="">Select driver 1...</option>
              {availableDrivers.map(driver => (
                <option key={driver} value={driver}>{driver}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm mb-2">Driver 2</label>
            <select
              value={driver2}
              onChange={(e) => setDriver2(e.target.value)}
              disabled={loadingDropdowns}
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none disabled:opacity-50"
            >
              <option value="">Select driver 2...</option>
              {availableDrivers.map(driver => (
                <option key={driver} value={driver}>{driver}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button
          onClick={handleLoadTelemetry}
          disabled={loading || loadingDropdowns}
          className="bg-f1-red text-white px-6 py-2 rounded hover:bg-red-700 disabled:bg-gray-600 transition"
        >
          {loading ? 'Loading Telemetry...' : loadingDropdowns ? 'Loading Options...' : 'Compare Telemetry'}
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
                {telemetryData.delta_analysis.speed?.max_diff?.toFixed(1) || '--'} km/h
              </div>
            </div>
            <div className="bg-f1-dark rounded p-4">
              <div className="text-sm text-gray-400">Avg Speed Difference</div>
              <div className="text-2xl font-bold">
                {telemetryData.delta_analysis.speed?.avg_diff?.toFixed(1) || '--'} km/h
              </div>
            </div>
            <div className="bg-f1-dark rounded p-4">
              <div className="text-sm text-gray-400">Throttle Usage Diff</div>
              <div className="text-2xl font-bold">
                {telemetryData.delta_analysis.throttle?.diff?.toFixed(1) || '--'}%
              </div>
            </div>
            <div className="bg-f1-dark rounded p-4">
              <div className="text-sm text-gray-400">Brake Usage Diff</div>
              <div className="text-2xl font-bold">
                {telemetryData.delta_analysis.brake?.diff?.toFixed(1) || '--'}%
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Track Map */}
        {chartData.track1.length > 0 && (
          <div className="bg-f1-gray rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Track Map</h2>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis type="number" dataKey="x" name="X" hide />
                <YAxis type="number" dataKey="y" name="Y" hide />
                <ZAxis type="number" dataKey="speed" range={[20, 20]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-f1-dark p-2 border border-gray-600 rounded">
                          <p className="text-f1-red font-bold">{data.driver}</p>
                          <p>Speed: {data.speed} km/h</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Scatter name={driver1} data={chartData.track1} fill="#E10600" line={{ stroke: '#E10600', strokeWidth: 2 }} shape="circle" />
                <Scatter name={driver2} data={chartData.track2} fill="#00A000" line={{ stroke: '#00A000', strokeWidth: 2 }} shape="circle" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Speed Chart */}
        {chartData.speed.length > 0 && (
          <div className="bg-f1-gray rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Speed Comparison</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData.speed}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="distance" stroke="#fff" label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }} />
                <YAxis stroke="#fff" label={{ value: 'km/h', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: '#38383F', border: 'none' }} />
                <Legend />
                <Line type="monotone" dataKey={driver1} stroke="#E10600" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey={driver2} stroke="#00A000" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Throttle Chart */}
        {chartData.throttle.length > 0 && (
          <div className="bg-f1-gray rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Throttle Application</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.throttle}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="distance" stroke="#fff" label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }} />
                <YAxis stroke="#fff" label={{ value: '%', angle: -90, position: 'insideLeft' }} />
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
    </div>
  );
}

export default TelemetryPage;
