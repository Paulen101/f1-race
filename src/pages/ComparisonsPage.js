import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  getAvailableDrivers, getHeadToHead, compareTeammates, compareDrivers, getSessionInfo, getSessionResults,
} from '../services/api';
import { FiBarChart2 } from 'react-icons/fi';
import { getErrorMessage, formatLapTime, formatPoints } from '../utils/helpers';
import { DRIVER_COLORS, axisProps, gridProps, legendProps, tooltipProps } from '../utils/chartTheme';
import useSeasonSelector from '../hooks/useSeasonSelector';
import SeasonPicker from '../components/SeasonPicker';
import PageHeader from '../components/PageHeader';
import {
  Card, Button, Field, Select, ErrorMessage, LoadingNote, EmptyNote, StatTile, DataTable, Tabs, Chip,
} from '../components/ui';
const MAX_SESSION_DRIVERS = 5;

const TABS = [
  { id: 'h2h', label: 'Head-to-Head' },
  { id: 'teammates', label: 'Teammates' },
  { id: 'session', label: 'Session Pace' },
];

// Short race label for chart axes: "Italian Grand Prix" -> "Italian"
const shortRaceName = (name) => (name || '').replace(/ Grand Prix$/, '');

function HeadToHead({ year, drivers }) {
  const [driver1, setDriver1] = useState('');
  const [driver2, setDriver2] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Default to the first two drivers; drop picks that aren't in this season
  useEffect(() => {
    const codes = drivers.map((d) => d.code);
    setDriver1((d) => (codes.includes(d) ? d : codes[0] || ''));
    setDriver2((d) => (codes.includes(d) ? d : codes[1] || ''));
    setResult(null);
  }, [drivers]);

  const handleCompare = async () => {
    try {
      setLoading(true);
      setError('');
      setResult(null);
      setResult(await getHeadToHead(year, driver1, driver2));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load head-to-head.'));
    } finally {
      setLoading(false);
    }
  };

  const chartData = (result?.races || []).map((race) => ({
    race: shortRaceName(race.grand_prix),
    [result.driver1]: race.driver1_position,
    [result.driver2]: race.driver2_position,
  }));

  const columns = result
    ? [
        { key: 'grand_prix', label: 'Grand Prix' },
        { key: 'd1', label: result.driver1, align: 'right', render: (r) => (r.driver1_position ? `P${r.driver1_position}` : '--') },
        { key: 'd2', label: result.driver2, align: 'right', render: (r) => (r.driver2_position ? `P${r.driver2_position}` : '--') },
        { key: 'winner', label: 'Ahead', className: 'font-bold', render: (r) => r.winner || '--' },
      ]
    : [];

  const summary = result?.summary;
  const formatAvg = (v) => (v ? v.toFixed(1) : '--');

  return (
    <>
      <Card>
        <div className="grid gap-4 md:grid-cols-3 mb-5">
          <Field label="Driver 1">
            <Select value={driver1} onChange={setDriver1} disabled={drivers.length === 0}>
              {drivers.map((d) => (
                <option key={d.code} value={d.code}>{d.code} · {d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Driver 2">
            <Select value={driver2} onChange={setDriver2} disabled={drivers.length === 0}>
              {drivers.map((d) => (
                <option key={d.code} value={d.code}>{d.code} · {d.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        {driver1 && driver1 === driver2 && <p className="text-sm text-yellow-300 mb-3">Pick two different drivers.</p>}
        <Button onClick={handleCompare} disabled={loading || !driver1 || !driver2 || driver1 === driver2}>
          {loading ? 'Comparing…' : 'Compare Season'}
        </Button>
      </Card>

      <ErrorMessage message={error} />
      {loading && <LoadingNote>Loading every race of the season…</LoadingNote>}

      {result && (
        <Card title={`${result.driver1} vs ${result.driver2}`} eyebrow={`${result.year} season`}>
          {result.races.length === 0 ? (
            <EmptyNote>These drivers didn't race each other this season.</EmptyNote>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatTile label={`${result.driver1} ahead`} value={summary.driver1_wins} sub={`of ${result.races.length} races`} accent={summary.driver1_wins > summary.driver2_wins} />
                <StatTile label={`${result.driver2} ahead`} value={summary.driver2_wins} sub={`of ${result.races.length} races`} accent={summary.driver2_wins > summary.driver1_wins} />
                <StatTile
                  label="Race points"
                  value={`${formatPoints(summary.driver1_points)} – ${formatPoints(summary.driver2_points)}`}
                  sub="Grand Prix only, no sprints"
                />
                <StatTile
                  label="Average finish"
                  value={`${formatAvg(summary.driver1_avg_position)} – ${formatAvg(summary.driver2_avg_position)}`}
                />
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="eyebrow mb-3">Finishing position by race</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="race" {...axisProps} interval={0} angle={-40} textAnchor="end" height={70} />
                      <YAxis {...axisProps} reversed domain={[1, 20]} allowDecimals={false} width={30} />
                      <Tooltip {...tooltipProps} formatter={(v) => `P${v}`} />
                      <Legend {...legendProps} />
                      <Line type="monotone" dataKey={result.driver1} stroke={DRIVER_COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey={result.driver2} stroke={DRIVER_COLORS[1]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="max-h-[340px] overflow-y-auto rounded-xl">
                  <DataTable columns={columns} rows={result.races} rowKey={(r) => r.grand_prix} />
                </div>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}

function Teammates({ year, latestRace }) {
  const [teams, setTeams] = useState([]);
  const [team, setTeam] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Team list from the season's most recent race
  useEffect(() => {
    if (!year || !latestRace) {
      setTeams([]);
      return undefined;
    }
    let cancelled = false;
    setLoadingTeams(true);
    setResult(null);
    getSessionResults(year, latestRace, 'Race')
      .then((data) => {
        if (cancelled) return;
        const names = [...new Set((data.results || []).map((r) => r.team).filter((t) => t && t !== 'Unknown'))].sort();
        setTeams(names);
        setTeam((t) => (names.includes(t) ? t : names[0] || ''));
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load teams.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingTeams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, latestRace]);

  const handleCompare = async () => {
    try {
      setLoading(true);
      setError('');
      setResult(null);
      setResult(await compareTeammates(year, team));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load teammate comparison.'));
    } finally {
      setLoading(false);
    }
  };

  const rows = [...(result?.comparison || [])].sort((a, b) => b.points - a.points);
  const columns = [
    { key: 'driver', label: 'Driver', render: (r) => (<span><span className="font-mono font-bold">{r.driver}</span> <span className="text-gray-400">{r.name}</span></span>) },
    { key: 'races', label: 'Races', align: 'right' },
    { key: 'head_to_head_wins', label: 'Ahead of teammate', align: 'right' },
    { key: 'points', label: 'Race points', align: 'right', render: (r) => formatPoints(r.points) },
    { key: 'wins', label: 'Wins', align: 'right' },
    { key: 'podiums', label: 'Podiums', align: 'right' },
    { key: 'average_position', label: 'Avg finish', align: 'right', render: (r) => (r.average_position ? r.average_position.toFixed(1) : '--') },
  ];

  return (
    <>
      <Card>
        <div className="grid gap-4 md:grid-cols-3 mb-5">
          <Field label="Team">
            <Select value={team} onChange={setTeam} disabled={loadingTeams || teams.length === 0}>
              {loadingTeams && <option value="">Loading teams...</option>}
              {!loadingTeams && teams.length === 0 && <option value="">No teams found</option>}
              {!loadingTeams && teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
        <Button onClick={handleCompare} disabled={loading || !team}>
          {loading ? 'Comparing…' : 'Compare Teammates'}
        </Button>
      </Card>

      <ErrorMessage message={error} />
      {loading && <LoadingNote>Loading every race of the season…</LoadingNote>}
      {result && (
        <Card title={result.team} eyebrow={`${result.year} season`}>
          {rows.length === 0 ? (
            <EmptyNote>No results for this team.</EmptyNote>
          ) : (
            <>
              <DataTable columns={columns} rows={rows} rowKey={(r) => r.driver} />
              <p className="text-xs text-gray-500 mt-3">
                Includes every driver who raced for the team this season, so mid-season replacements appear too.
              </p>
            </>
          )}
        </Card>
      )}
    </>
  );
}

function SessionPace({ season }) {
  const { year, grandPrix } = season;
  const [sessionName, setSessionName] = useState('Race');
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!year || !grandPrix) return undefined;
    let cancelled = false;
    setLoadingDrivers(true);
    setError('');
    setResult(null);
    getSessionInfo(year, grandPrix, sessionName)
      .then((data) => {
        if (cancelled) return;
        const list = data.drivers || [];
        setAvailable(list);
        // Keep only picks that exist in the new session
        setSelected((prev) => prev.filter((d) => list.includes(d)));
      })
      .catch((err) => {
        if (cancelled) return;
        setAvailable([]);
        setSelected([]);
        setError(getErrorMessage(err, 'Could not load drivers for this session.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingDrivers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, grandPrix, sessionName]);

  const toggleDriver = (code) => {
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((d) => d !== code);
      if (prev.length >= MAX_SESSION_DRIVERS) return prev;
      return [...prev, code];
    });
  };

  const handleCompare = async () => {
    try {
      setLoading(true);
      setError('');
      setResult(null);
      const data = await compareDrivers(year, grandPrix, sessionName, selected);
      setResult({ ...data, sessionName, grandPrix, year });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not compare drivers.'));
    } finally {
      setLoading(false);
    }
  };

  const rows = [...(result?.comparison || [])].sort((a, b) => a.fastest_lap - b.fastest_lap);
  const best = (key) => {
    const values = rows.map((r) => r.sectors?.[key]).filter((v) => v != null);
    return values.length ? Math.min(...values) : null;
  };
  const sectorCell = (key) => (r) => {
    const value = r.sectors?.[key];
    if (value == null) return '--';
    return <span className={value === best(key) ? 'text-f1-purple font-bold' : ''}>{value.toFixed(3)}</span>;
  };
  const columns = [
    { key: 'driver', label: 'Driver', className: 'font-mono font-bold' },
    { key: 'fastest_lap', label: 'Fastest', align: 'right', render: (r) => <span className={rows.length && r === rows[0] ? 'font-bold text-f1-purple' : ''}>{formatLapTime(r.fastest_lap)}</span> },
    { key: 'gap', label: 'Gap', align: 'right', render: (r) => (rows.length && r !== rows[0] ? `+${(r.fastest_lap - rows[0].fastest_lap).toFixed(3)}` : '--') },
    { key: 'median_lap', label: 'Median lap', align: 'right', render: (r) => formatLapTime(r.median_lap) },
    { key: 's1', label: 'Best S1', align: 'right', render: sectorCell('sector1_best') },
    { key: 's2', label: 'Best S2', align: 'right', render: sectorCell('sector2_best') },
    { key: 's3', label: 'Best S3', align: 'right', render: sectorCell('sector3_best') },
    { key: 'consistency', label: 'Consistency', align: 'right', render: (r) => (r.consistency != null ? `${(r.consistency * 100).toFixed(1)}%` : '--') },
    { key: 'total_laps', label: 'Laps', align: 'right' },
  ];

  return (
    <>
      <Card>
        <ErrorMessage message={season.error} />
        <div className="grid gap-4 md:grid-cols-3 mb-5">
          <SeasonPicker season={season} />
          <Field label="Session">
            <Select value={sessionName} onChange={setSessionName}>
              <option value="Race">Race</option>
              <option value="Qualifying">Qualifying</option>
              <option value="Sprint">Sprint</option>
            </Select>
          </Field>
        </div>

        <div className="mb-5">
          <div className="eyebrow mb-2">
            Drivers <span className="normal-case tracking-normal text-gray-500">(pick 2–{MAX_SESSION_DRIVERS}, {selected.length} selected)</span>
          </div>
          {loadingDrivers && <LoadingNote>Loading drivers…</LoadingNote>}
          {!loadingDrivers && available.length === 0 && <EmptyNote>No drivers found for this session.</EmptyNote>}
          <div className="flex flex-wrap gap-2">
            {!loadingDrivers &&
              available.map((code) => {
                const idx = selected.indexOf(code);
                return (
                  <Chip key={code} active={idx !== -1} onClick={() => toggleDriver(code)}>
                    {code}
                  </Chip>
                );
              })}
          </div>
        </div>

        <Button onClick={handleCompare} disabled={loading || selected.length < 2}>
          {loading ? 'Comparing…' : 'Compare Pace'}
        </Button>
      </Card>

      <ErrorMessage message={error} />
      {loading && <LoadingNote>Loading lap data… the first load of a session can take a minute.</LoadingNote>}
      {result && (
        <Card title="Session Pace" eyebrow={`${result.grandPrix} ${result.year} · ${result.sessionName}`}>
          {rows.length === 0 ? (
            <EmptyNote>No timed laps for these drivers.</EmptyNote>
          ) : (
            <>
              <DataTable columns={columns} rows={rows} rowKey={(r) => r.driver} />
              <p className="text-xs text-gray-500 mt-3">
                Purple = best sector among the selected drivers. Consistency = 1 − (spread of lap times ÷ average lap);
                in races it includes pit and safety-car laps.
              </p>
            </>
          )}
        </Card>
      )}
    </>
  );
}

function ComparisonsPage() {
  const [tab, setTab] = useState('h2h');
  const season = useSeasonSelector();
  const { year, tracks } = season;

  const [drivers, setDrivers] = useState([]);
  const [driversError, setDriversError] = useState('');
  const latestRace = useMemo(() => (tracks.length ? tracks[tracks.length - 1].name : ''), [tracks]);

  // Driver list for the season (used by head-to-head)
  useEffect(() => {
    if (!year) return undefined;
    let cancelled = false;
    setDriversError('');
    getAvailableDrivers(year)
      .then((data) => {
        if (!cancelled) setDrivers(data.drivers || []);
      })
      .catch((err) => {
        if (!cancelled) setDriversError(getErrorMessage(err, 'Could not load drivers.'));
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  return (
    <div>
      <PageHeader
        icon={FiBarChart2}
        eyebrow="Head to head"
        title="Driver Comparisons"
        description="Settle the arguments: season head-to-heads, teammate battles and raw pace in a single session."
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} id="comparisons" />

      {tab !== 'session' && (
        <Card>
          <ErrorMessage message={season.error || driversError} />
          <div className="grid gap-4 md:grid-cols-3">
            <SeasonPicker season={season} showGrandPrix={false} />
          </div>
        </Card>
      )}

      {tab === 'h2h' && <HeadToHead year={year} drivers={drivers} />}
      {tab === 'teammates' && <Teammates year={year} latestRace={latestRace} />}
      {tab === 'session' && <SessionPace season={season} />}
    </div>
  );
}

export default ComparisonsPage;
