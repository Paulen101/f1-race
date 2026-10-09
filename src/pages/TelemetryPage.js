import React, { useState, useEffect } from 'react';
import { compareTelemetry, getSessionInfo } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import { FiActivity, FiDownload } from 'react-icons/fi';
import { exportToCSV, getErrorMessage } from '../utils/helpers';
import { DRIVER_COLORS, axisLabel, axisProps, gridProps, legendProps, tooltipProps } from '../utils/chartTheme';
import useSeasonSelector from '../hooks/useSeasonSelector';
import SeasonPicker from '../components/SeasonPicker';
import PageHeader from '../components/PageHeader';
import {
  Card, Button, SecondaryButton, Field, Select, ErrorMessage, LoadingNote, StatTile,
} from '../components/ui';

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

  const delta = telemetryData?.delta_analysis;
  const fixed = (v) => (v == null || Number.isNaN(v) ? null : v.toFixed(1));
  const [color1, color2] = DRIVER_COLORS;

  const lineChart = (data, unit, height = 300) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 15, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="distance" {...axisProps} type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v) => `${Math.round(v)}`} label={axisLabel('Distance (m)')} />
        <YAxis {...axisProps} width={45} label={axisLabel(unit, 'y')} />
        <Tooltip {...tooltipProps} labelFormatter={(v) => `${Math.round(v)} m`} />
        <Legend {...legendProps} />
        <Line type="monotone" dataKey={loadedDriver1} stroke={color1} dot={false} strokeWidth={2} isAnimationActive={false} />
        <Line type="monotone" dataKey={loadedDriver2} stroke={color2} dot={false} strokeWidth={2} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div>
      <PageHeader
        icon={FiActivity}
        eyebrow="Telemetry"
        title="Telemetry Comparison"
        description="Overlay two drivers' fastest laps: speed, throttle and braking through every metre of the lap."
      />

      <Card>
        <ErrorMessage message={season.error} />
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <SeasonPicker season={season} />
          <Field label="Session">
            <Select value={sessionName} onChange={setSessionName}>
              <option value="Race">Race</option>
              <option value="Qualifying">Qualifying</option>
              <option value="Sprint">Sprint</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end mb-5">
          <Field label="Driver 1">
            <Select value={driver1} onChange={setDriver1} disabled={loadingDropdowns}>
              <option value="">Select driver 1…</option>
              {availableDrivers.map((driver) => (
                <option key={driver} value={driver}>{driver}</option>
              ))}
            </Select>
          </Field>
          <div className="hidden pb-2.5 text-center font-black italic text-gray-500 md:block" aria-hidden="true">VS</div>
          <Field label="Driver 2">
            <Select value={driver2} onChange={setDriver2} disabled={loadingDropdowns}>
              <option value="">Select driver 2…</option>
              {availableDrivers.map((driver) => (
                <option key={driver} value={driver}>{driver}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleLoadTelemetry} disabled={loading || loadingDropdowns || !driver1 || !driver2}>
            {loading ? 'Loading telemetry…' : loadingDropdowns ? 'Loading options…' : 'Compare Telemetry'}
          </Button>
          {telemetryData && (
            <SecondaryButton onClick={handleExportCSV}>
              <FiDownload aria-hidden="true" /> Export CSV
            </SecondaryButton>
          )}
        </div>
      </Card>

      <ErrorMessage message={error} />
      {loading && <LoadingNote>Loading telemetry… the first load of a session can take a minute.</LoadingNote>}

      {telemetryData && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm animate-fade-up">
          <span className="flex items-center gap-2 font-mono font-bold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color1 }} />{loadedDriver1}
          </span>
          <span className="text-gray-500">vs</span>
          <span className="flex items-center gap-2 font-mono font-bold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color2 }} />{loadedDriver2}
          </span>
          <span className="text-gray-400">
            · {telemetryData.grandPrix} {telemetryData.year} {telemetryData.sessionName} · fastest laps
          </span>
        </div>
      )}

      {delta && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6 animate-fade-up">
          <StatTile label="Max speed difference" value={fixed(delta.speed?.max_diff)} unit="km/h" accent />
          <StatTile label="Avg speed difference" value={fixed(delta.speed?.avg_diff)} unit="km/h" />
          <StatTile label="Throttle usage diff" value={fixed(delta.throttle?.diff)} unit="%" />
          <StatTile label="Brake usage diff" value={fixed(delta.brake?.diff)} unit="%" />
        </div>
      )}

      <div className="grid gap-x-6 lg:grid-cols-2">
        {chartData.track1.length > 0 && (
          <Card title="Track Map" eyebrow="Racing line">
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <XAxis type="number" dataKey="x" name="X" hide domain={['dataMin', 'dataMax']} />
                <YAxis type="number" dataKey="y" name="Y" hide domain={['dataMin', 'dataMax']} />
                <ZAxis type="number" dataKey="speed" range={[10, 10]} />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={tooltipProps.contentStyle} className="px-3 py-2">
                          <p className="font-mono font-bold">{data.driver}</p>
                          <p className="text-gray-300">{data.speed} km/h</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend {...legendProps} />
                <Scatter name={loadedDriver1} data={chartData.track1} fill={color1} line={{ stroke: color1, strokeWidth: 3 }} shape="circle" isAnimationActive={false} />
                <Scatter name={loadedDriver2} data={chartData.track2} fill={color2} line={{ stroke: color2, strokeWidth: 1.5, strokeDasharray: '4 3' }} shape="circle" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        )}

        {chartData.speed.length > 0 && (
          <Card title="Speed" eyebrow="km/h over the lap">
            {lineChart(chartData.speed, 'km/h', 400)}
          </Card>
        )}

        {chartData.throttle.length > 0 && (
          <Card title="Throttle Application" eyebrow="Pedal %">
            {lineChart(chartData.throttle, '%')}
          </Card>
        )}

        {chartData.brake.length > 0 && (
          <Card title="Brake Application" eyebrow="On / off">
            {lineChart(chartData.brake, 'Brake')}
          </Card>
        )}
      </div>
    </div>
  );
}

export default TelemetryPage;
