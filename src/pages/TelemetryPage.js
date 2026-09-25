import React, { useState, useEffect } from 'react';
import { compareTelemetry, getSessionInfo } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import { exportToCSV, getErrorMessage } from '../utils/helpers';
import useSeasonSelector from '../hooks/useSeasonSelector';
import SeasonPicker from '../components/SeasonPicker';
import { ErrorMessage } from '../components/ui';

function TelemetryPage() {
  const season = useSeasonSelector();
  const { year, grandPrix } = season;
  const [sessionName, setSessionName] = useState('Race');
  const [driver1, setDriver1] = useState('');
  const [driver2, setDriver2] = useState('');
  const [telemetryData, setTelemetryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Dropdown options
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Load available drivers when year/track/session changes
  useEffect(() => {
    if (!year || !grandPrix || !sessionName) return undefined;
    let cancelled = false;
    setLoadingDropdowns(true);
    setError('');

    getSessionInfo(year, grandPrix, sessionName)
      .then((sessionData) => {
        if (cancelled) return;
        const drivers = sessionData.drivers || [];
        setAvailableDrivers(drivers);
        // Drop picks that didn't take part in the newly selected session
        setDriver1((d) => (drivers.includes(d) ? d : ''));
        setDriver2((d) => (drivers.includes(d) ? d : ''));
      })
      .catch((err) => {
        if (cancelled) return;
        setAvailableDrivers([]);
        setDriver1('');
        setDriver2('');
        setError(getErrorMessage(err, 'Could not load drivers for this session.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingDropdowns(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year, grandPrix, sessionName]);

  const handleLoadTelemetry = async () => {
    if (!grandPrix || !driver1 || !driver2) {
      setError('Pick a Grand Prix and two drivers.');
      return;
    }
    if (driver1 === driver2) {
      setError('Pick two different drivers.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setTelemetryData(null);
      const data = await compareTelemetry(year, grandPrix, sessionName, driver1, driver2);
      setTelemetryData({ ...data, year, grandPrix, sessionName });
    } catch (err) {
      setError(getErrorMessage(err, 'Error loading telemetry data.'));
    } finally {
      setLoading(false);
    }
  };

  // Names of the drivers the loaded data belongs to (the dropdowns may have changed since)
  const loadedDriver1 = telemetryData?.driver1?.driver;
  const loadedDriver2 = telemetryData?.driver2?.driver;

  const handleExportCSV = () => {
    if (!telemetryData) return;
    
    const tel1 = telemetryData.driver1.telemetry.map(p => ({ ...p, driver: loadedDriver1 }));
    const tel2 = telemetryData.driver2.telemetry.map(p => ({ ...p, driver: loadedDriver2 }));
    
    exportToCSV(
      [...tel1, ...tel2],
      `telemetry_${telemetryData.year}_${telemetryData.grandPrix}_${telemetryData.sessionName}_${loadedDriver1}_${loadedDriver2}`
    );
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (!telemetryData) return { speed: [], throttle: [], brake: [], track1: [], track2: [] };
    
    const tel1 = telemetryData.driver1?.telemetry || [];
    const tel2 = telemetryData.driver2?.telemetry || [];
    
    const speedData = tel1.map((point, idx) => ({
      distance: point.Distance || point.distance,
      [loadedDriver1]: point.Speed || point.speed,
      [loadedDriver2]: tel2[idx]?.Speed || tel2[idx]?.speed
    }));
    
    const throttleData = tel1.map((point, idx) => ({
      distance: point.Distance || point.distance,
      [loadedDriver1]: point.Throttle || point.throttle,
      [loadedDriver2]: tel2[idx]?.Throttle || tel2[idx]?.throttle
    }));
    
    const brakeData = tel1.map((point, idx) => ({
      distance: point.Distance || point.distance,
      [loadedDriver1]: point.Brake || point.brake,
      [loadedDriver2]: tel2[idx]?.Brake || tel2[idx]?.brake
    }));

    const track1 = tel1.map(point => ({
      x: point.x,
      y: point.y,
      speed: point.speed,
      driver: loadedDriver1
    })).filter(p => p.x !== undefined && p.y !== undefined);

    const track2 = tel2.map(point => ({
      x: point.x,
      y: point.y,
      speed: point.speed,
      driver: loadedDriver2
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
          <SeasonPicker season={season} />
          
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
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleLoadTelemetry}
            disabled={loading || loadingDropdowns || !driver1 || !driver2}
            className="bg-f1-red text-white px-6 py-2 rounded hover:bg-red-700 disabled:bg-gray-600 transition"
          >
            {loading ? 'Loading Telemetry...' : loadingDropdowns ? 'Loading Options...' : 'Compare Telemetry'}
          </button>
          {telemetryData && (
            <button
              onClick={handleExportCSV}
              className="border border-gray-500 text-white px-4 py-2 rounded hover:border-f1-red transition"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      <ErrorMessage message={season.error || error} />
      {telemetryData && (
        <p className="text-sm text-gray-400 mb-4">
          Showing {loadedDriver1} vs {loadedDriver2} · {telemetryData.grandPrix} {telemetryData.year} {telemetryData.sessionName} · fastest laps
        </p>
      )}

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
                <Scatter name={loadedDriver1} data={chartData.track1} fill="#E10600" line={{ stroke: '#E10600', strokeWidth: 2 }} shape="circle" />
                <Scatter name={loadedDriver2} data={chartData.track2} fill="#00A000" line={{ stroke: '#00A000', strokeWidth: 2 }} shape="circle" />
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
                <Line type="monotone" dataKey={loadedDriver1} stroke="#E10600" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey={loadedDriver2} stroke="#00A000" dot={false} strokeWidth={2} />
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
                <Line type="monotone" dataKey={loadedDriver1} stroke="#E10600" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey={loadedDriver2} stroke="#00A000" dot={false} strokeWidth={2} />
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
                <Line type="monotone" dataKey={loadedDriver1} stroke="#E10600" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey={loadedDriver2} stroke="#00A000" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default TelemetryPage;
