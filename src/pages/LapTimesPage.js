import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiClock } from 'react-icons/fi';
import { getLapTimes, getSessionInfo } from '../services/api';
import { formatLapTime, getErrorMessage, getTireColor } from '../utils/helpers';
import { axisLabel, axisProps, gridProps, tooltipProps } from '../utils/chartTheme';
import useSeasonSelector from '../hooks/useSeasonSelector';
import SeasonPicker from '../components/SeasonPicker';
import PageHeader from '../components/PageHeader';
import {
  Card, Button, SecondaryButton, Field, Select, ErrorMessage, LoadingNote, EmptyNote, StatTile, DataTable, CompoundBadge,
} from '../components/ui';

const PAGE_SIZE = 50;

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Timing-tower style ranking of each driver's fastest lap. */
function FastestLapTower({ laps }) {
  const ranking = useMemo(() => {
    const best = new Map();
    laps.forEach((lap) => {
      const current = best.get(lap.driver);
      if (!current || lap.lap_time < current.lap_time) best.set(lap.driver, lap);
    });
    return [...best.values()].sort((a, b) => a.lap_time - b.lap_time);
  }, [laps]);

  if (ranking.length === 0) return null;
  const leader = ranking[0].lap_time;
  const maxGap = Math.max(0.001, ranking[ranking.length - 1].lap_time - leader);

  return (
    <ol className="space-y-1">
      {ranking.map((lap, idx) => {
        const gap = lap.lap_time - leader;
        return (
          <li
            key={lap.driver}
            className="grid grid-cols-[2rem_3.5rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03] animate-fade-up"
            style={{ animationDelay: `${idx * 25}ms` }}
          >
            <span className={`font-mono text-xs font-bold ${idx === 0 ? 'text-f1-purple' : 'text-gray-500'}`}>
              P{idx + 1}
            </span>
            <span className="font-mono font-bold">{lap.driver}</span>
            <span className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${idx === 0 ? 'bg-f1-purple' : 'bg-f1-red/70'}`}
                style={{ width: `${idx === 0 ? 100 : Math.max(4, 100 - (gap / maxGap) * 96)}%` }}
              />
            </span>
            <span className="w-24 text-right font-mono text-xs tabular-nums">
              {idx === 0 ? formatLapTime(lap.lap_time) : <span className="text-gray-400">+{gap.toFixed(3)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Lap time trace for a single driver; dots are coloured by tyre compound. */
function LapTrace({ laps }) {
  const times = laps.map((l) => l.lap_time);
  const fastest = Math.min(...times);
  // Pit and safety-car laps would squash the scale, so clip them
  const ceiling = (median(times) || fastest) * 1.07;

  const CompoundDot = ({ cx, cy, payload }) =>
    cx == null || cy == null ? null : (
      <circle cx={cx} cy={cy} r={3} fill={getTireColor(payload.compound)} stroke="#0B0B10" strokeWidth={1} />
    );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={laps} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="lap_number" {...axisProps} label={axisLabel('Lap')} />
        <YAxis
          {...axisProps}
          domain={[Math.floor(fastest - 0.5), Math.ceil(ceiling)]}
          allowDataOverflow
          tickFormatter={(v) => formatLapTime(v).slice(0, -2)}
          width={60}
        />
        <Tooltip
          {...tooltipProps}
          labelFormatter={(lap) => `Lap ${lap}`}
          formatter={(v, _name, item) => [formatLapTime(v), item.payload.compound || 'Lap time']}
        />
        <Line type="monotone" dataKey="lap_time" stroke="#E10600" strokeWidth={2} dot={<CompoundDot />} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function LapTimesPage() {
  const season = useSeasonSelector();
  const { year, grandPrix } = season;
  const [sessionName, setSessionName] = useState('Race');
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(''); // Empty = all drivers
  const [result, setResult] = useState(null); // {laps, driver, year, grandPrix, sessionName}
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Drivers for the selected session
  useEffect(() => {
    if (!year || !grandPrix || !sessionName) return undefined;
    let cancelled = false;
    getSessionInfo(year, grandPrix, sessionName)
      .then((data) => {
        if (cancelled) return;
        const list = data.drivers || [];
        setDrivers(list);
        setSelectedDriver((d) => (list.includes(d) ? d : ''));
      })
      .catch(() => {
        if (cancelled) return;
        setDrivers([]);
        setSelectedDriver('');
      });
    return () => {
      cancelled = true;
    };
  }, [year, grandPrix, sessionName]);

  const handleLoadData = async () => {
    try {
      setLoading(true);
      setError('');
      setResult(null);
      setVisible(PAGE_SIZE);
      // Empty driver means all drivers
      const data = await getLapTimes(year, grandPrix, sessionName, selectedDriver || null);
      setResult({ laps: data.laps || [], driver: selectedDriver, year, grandPrix, sessionName });
    } catch (err) {
      setError(getErrorMessage(err, 'Error loading lap times.'));
    } finally {
      setLoading(false);
    }
  };

  const laps = useMemo(() => result?.laps || [], [result]);

  const records = useMemo(() => {
    const bestOf = (key) => {
      const values = laps.map((l) => l[key]).filter((v) => v != null);
      return values.length ? Math.min(...values) : null;
    };
    const personalBest = new Map();
    laps.forEach((l) => {
      if (!personalBest.has(l.driver) || l.lap_time < personalBest.get(l.driver)) personalBest.set(l.driver, l.lap_time);
    });
    return {
      lap: bestOf('lap_time'),
      sector1: bestOf('sector1'),
      sector2: bestOf('sector2'),
      sector3: bestOf('sector3'),
      personalBest,
    };
  }, [laps]);

  const fastestLap = laps.find((l) => l.lap_time === records.lap);

  const timeClass = (row) => {
    if (row.lap_time === records.lap) return 'text-f1-purple font-bold';
    if (row.lap_time === records.personalBest.get(row.driver)) return 'text-green-400 font-bold';
    return '';
  };
  const sectorCell = (key) => (row) =>
    row[key] == null ? '--' : (
      <span className={row[key] === records[key] ? 'text-f1-purple font-bold' : 'text-gray-300'}>{row[key].toFixed(3)}</span>
    );

  const columns = [
    { key: 'lap_number', label: 'Lap', align: 'right' },
    { key: 'driver', label: 'Driver', className: 'font-mono font-bold' },
    { key: 'lap_time', label: 'Time', align: 'right', render: (row) => <span className={timeClass(row)}>{formatLapTime(row.lap_time)}</span> },
    { key: 'sector1', label: 'S1', align: 'right', render: sectorCell('sector1') },
    { key: 'sector2', label: 'S2', align: 'right', render: sectorCell('sector2') },
    { key: 'sector3', label: 'S3', align: 'right', render: sectorCell('sector3') },
    {
      key: 'compound',
      label: 'Tyre',
      render: (row) => (
        <span className="flex items-center gap-2">
          <CompoundBadge compound={row.compound} short />
          {row.tire_life != null && <span className="font-mono text-xs text-gray-500">{row.tire_life}L</span>}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        icon={FiClock}
        eyebrow="Timing"
        title="Lap Time Analysis"
        effect="decrypt"
        description="Every timed lap with sectors and tyres. Purple marks the session best, green each driver's personal best."
      />

      <Card>
        <ErrorMessage message={season.error} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-5">
          <SeasonPicker season={season} />
          <Field label="Session">
            <Select value={sessionName} onChange={setSessionName}>
              <option value="Race">Race</option>
              <option value="Qualifying">Qualifying</option>
              <option value="Sprint">Sprint</option>
            </Select>
          </Field>
          <Field label="Driver (optional)">
            <Select value={selectedDriver} onChange={setSelectedDriver} disabled={drivers.length === 0}>
              <option value="">All drivers</option>
              {drivers.map((driver) => (
                <option key={driver} value={driver}>{driver}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Button onClick={handleLoadData} disabled={loading || !year || !grandPrix}>
          {loading ? 'Loading…' : 'Load Lap Times'}
        </Button>
      </Card>

      <ErrorMessage message={error} />
      {loading && <LoadingNote>Loading lap data… the first load of a session can take a minute.</LoadingNote>}

      {result && laps.length === 0 && (
        <Card>
          <EmptyNote>No timed laps for this selection.</EmptyNote>
        </Card>
      )}

      {result && laps.length > 0 && (
        <>
          <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
            <StatTile label="Timed laps" value={laps.length} sub={`${result.grandPrix} ${result.year}`} />
            <StatTile label="Fastest lap" value={formatLapTime(records.lap)} sub={fastestLap && `${fastestLap.driver} · lap ${fastestLap.lap_number}`} accent />
            <StatTile label="Median lap" value={formatLapTime(median(laps.map((l) => l.lap_time)))} sub={result.sessionName} />
            <StatTile
              label="Ideal lap"
              value={records.sector1 && records.sector2 && records.sector3 ? formatLapTime(records.sector1 + records.sector2 + records.sector3) : '--'}
              sub="Best S1 + S2 + S3"
            />
          </div>

          <Card
            title={result.driver ? `${result.driver} · Lap trace` : 'Fastest lap per driver'}
            eyebrow={`${result.grandPrix} ${result.year} · ${result.sessionName}`}
          >
            {result.driver ? <LapTrace laps={laps} /> : <FastestLapTower laps={laps} />}
          </Card>

          <Card title={`All laps (${laps.length})`}>
            <DataTable columns={columns} rows={laps.slice(0, visible)} rowKey={(row) => `${row.driver}-${row.lap_number}`} />
            {visible < laps.length && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <SecondaryButton onClick={() => setVisible((v) => v + PAGE_SIZE)}>Show {PAGE_SIZE} more</SecondaryButton>
                <SecondaryButton onClick={() => setVisible(laps.length)}>Show all {laps.length}</SecondaryButton>
                <span className="text-xs text-gray-500">Showing {visible} of {laps.length}</span>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default LapTimesPage;
