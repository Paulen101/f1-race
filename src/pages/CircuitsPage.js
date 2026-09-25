import React, { useState } from 'react';
import { getCircuitInfo, getCircuitStatistics, getCircuitHistory } from '../services/api';
import { getErrorMessage, formatLapTime, getTireColor } from '../utils/helpers';
import useSeasonSelector from '../hooks/useSeasonSelector';
import SeasonPicker from '../components/SeasonPicker';
import {
  Card, Button, SecondaryButton, ErrorMessage, LoadingNote, EmptyNote, StatTile, DataTable,
} from '../components/ui';

const countOrNA = (value) => (value === null || value === undefined ? 'n/a' : value);

function CircuitsPage() {
  const season = useSeasonSelector();
  const { year, grandPrix } = season;

  const [info, setInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [loaded, setLoaded] = useState(null); // {year, grandPrix} the data belongs to
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const handleLoad = async () => {
    setLoading(true);
    setError('');
    setInfo(null);
    setStats(null);
    setHistory(null);
    setHistoryError('');

    // Load both; show whichever succeeds instead of failing the whole page
    const [infoResult, statsResult] = await Promise.allSettled([
      getCircuitInfo(year, grandPrix),
      getCircuitStatistics(year, grandPrix),
    ]);
    if (infoResult.status === 'fulfilled') setInfo(infoResult.value);
    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    const failed = [infoResult, statsResult].find((r) => r.status === 'rejected');
    if (failed) setError(getErrorMessage(failed.reason, 'Could not load circuit data.'));

    setLoaded({ year, grandPrix });
    setLoading(false);
  };

  const handleLoadHistory = async () => {
    try {
      setLoadingHistory(true);
      setHistoryError('');
      const data = await getCircuitHistory(loaded.grandPrix);
      // Newest first
      setHistory([...(data.history || [])].sort((a, b) => b.year - a.year));
    } catch (err) {
      setHistoryError(getErrorMessage(err, 'Could not load circuit history.'));
    } finally {
      setLoadingHistory(false);
    }
  };

  const historyColumns = [
    { key: 'year', label: 'Year', className: 'font-bold' },
    { key: 'winner', label: 'Winner', render: (row) => row.winner || '--' },
    { key: 'podium', label: 'Podium', render: (row) => (row.podium || []).join(' · ') },
    { key: 'pole_position', label: 'Pole', render: (row) => row.pole_position || '--' },
    {
      key: 'fastest_lap',
      label: 'Fastest lap',
      align: 'right',
      render: (row) =>
        row.fastest_lap ? `${row.fastest_lap.driver} ${formatLapTime(row.fastest_lap.time)}` : '--',
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-f1-red">Circuit Analysis</h1>

      <Card>
        <ErrorMessage message={season.error} />
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <SeasonPicker season={season} />
        </div>
        <Button onClick={handleLoad} disabled={loading || !year || !grandPrix}>
          {loading ? 'Loading…' : 'Load Circuit'}
        </Button>
      </Card>

      <ErrorMessage message={error} />
      {loading && <LoadingNote>Loading race data… the first load of a race can take a minute.</LoadingNote>}

      {info && (
        <Card title={info.name}>
          <p className="text-gray-300 mb-4">
            {[info.location, info.country].filter(Boolean).join(', ')}
            {info.date && ` · ${new Date(info.date).toLocaleDateString()}`}
          </p>
          {info.circuit_name && <p className="text-sm text-gray-400 mb-4">{info.circuit_name}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Race laps" value={info.num_laps} />
            <StatTile
              label="Fastest race lap"
              value={info.session_fastest_lap ? formatLapTime(info.session_fastest_lap.time) : '--'}
              sub={info.session_fastest_lap?.driver}
            />
            {stats && (
              <>
                <StatTile
                  label="Average lap"
                  value={stats.average_lap_time ? formatLapTime(stats.average_lap_time) : '--'}
                  sub={`${stats.total_valid_laps} timed laps`}
                />
                <StatTile label="Pit stops" value={stats.total_pit_stops} />
              </>
            )}
          </div>
        </Card>
      )}

      {stats && (
        <Card title="Race Incidents & Tyres">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatTile label="Safety cars" value={countOrNA(stats.safety_car_periods)} />
            <StatTile label="Virtual safety cars" value={countOrNA(stats.virtual_safety_car_periods)} />
            <StatTile label="Red flags" value={countOrNA(stats.red_flags)} />
            <StatTile
              label="Fastest lap on"
              value={stats.fastest_lap?.lap_number ? `Lap ${stats.fastest_lap.lap_number}` : '--'}
              sub={stats.fastest_lap?.driver}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-400">Compounds used:</span>
            {(stats.compounds_used || []).map((compound) => (
              <span
                key={compound}
                className="px-2 py-1 rounded text-xs font-bold text-black"
                style={{ backgroundColor: getTireColor(compound) }}
              >
                {compound}
              </span>
            ))}
          </div>
        </Card>
      )}

      {loaded && !loading && (info || stats) && (
        <Card
          title={`${loaded.grandPrix} · History`}
          actions={
            !history && (
              <SecondaryButton onClick={handleLoadHistory} disabled={loadingHistory}>
                {loadingHistory ? 'Loading history…' : 'Load results since 2018'}
              </SecondaryButton>
            )
          }
        >
          <ErrorMessage message={historyError} />
          {loadingHistory && <LoadingNote>Loading one race per season… this can take a few minutes the first time.</LoadingNote>}
          {!history && !loadingHistory && !historyError && (
            <EmptyNote>Winners, podiums, poles and fastest laps at this Grand Prix for every season since 2018.</EmptyNote>
          )}
          {history && history.length === 0 && <EmptyNote>No past results found for this Grand Prix.</EmptyNote>}
          {history && history.length > 0 && (
            <DataTable columns={historyColumns} rows={history} rowKey={(row) => row.year} />
          )}
        </Card>
      )}
    </div>
  );
}

export default CircuitsPage;
