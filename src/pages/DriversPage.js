import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDriverStandings, getDriverSeasonStats, getDriverCareerStats } from '../services/api';
import { FiUsers } from 'react-icons/fi';
import { getErrorMessage, formatPoints } from '../utils/helpers';
import { axisProps, gridProps, tooltipProps } from '../utils/chartTheme';
import useSeasonSelector from '../hooks/useSeasonSelector';
import SeasonPicker from '../components/SeasonPicker';
import PageHeader from '../components/PageHeader';
import {
  Card, SecondaryButton, ErrorMessage, LoadingNote, EmptyNote, StatTile, DataTable,
} from '../components/ui';

const formatFinish = (value) => (value ? `P${value}` : '--');
// null means the backend couldn't fetch that stat, so don't show a fake 0
const formatCount = (value) => (value === null || value === undefined ? 'n/a' : value);

function DriversPage() {
  const season = useSeasonSelector();
  const { year } = season;

  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [standingsError, setStandingsError] = useState('');

  const [selectedDriver, setSelectedDriver] = useState(null);
  const [seasonStats, setSeasonStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');

  const [career, setCareer] = useState(null);
  const [loadingCareer, setLoadingCareer] = useState(false);
  const [careerError, setCareerError] = useState('');

  // Standings for the selected season
  useEffect(() => {
    if (!year) return undefined;
    let cancelled = false;
    setLoadingStandings(true);
    setStandingsError('');
    setStandings([]);
    setSelectedDriver(null);
    setSeasonStats(null);
    setCareer(null);

    getDriverStandings(year)
      .then((data) => {
        if (!cancelled) setStandings(data.standings || []);
      })
      .catch((err) => {
        if (!cancelled) setStandingsError(getErrorMessage(err, 'Could not load standings.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingStandings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  // Season stats for the driver clicked in the standings
  useEffect(() => {
    if (!year || !selectedDriver) return undefined;
    let cancelled = false;
    setLoadingStats(true);
    setStatsError('');
    setSeasonStats(null);
    setCareer(null);
    setCareerError('');

    getDriverSeasonStats(year, selectedDriver.driver)
      .then((data) => {
        if (!cancelled) setSeasonStats(data);
      })
      .catch((err) => {
        if (!cancelled) setStatsError(getErrorMessage(err, 'Could not load driver stats.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingStats(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year, selectedDriver]);

  const handleLoadCareer = async () => {
    if (!selectedDriver) return;
    try {
      setLoadingCareer(true);
      setCareerError('');
      const data = await getDriverCareerStats(selectedDriver.driver);
      if (data.message) {
        setCareer(null);
        setCareerError(data.message);
      } else {
        setCareer(data);
      }
    } catch (err) {
      setCareerError(getErrorMessage(err, 'Could not load career stats.'));
    } finally {
      setLoadingCareer(false);
    }
  };

  const standingsColumns = [
    {
      key: 'pos',
      label: 'Pos',
      render: (row) => {
        const pos = standings.indexOf(row) + 1;
        const medal = ['text-yellow-400', 'text-gray-300', 'text-orange-400'][pos - 1];
        return <span className={`font-mono font-bold ${medal || 'text-gray-500'}`}>{pos}</span>;
      },
    },
    {
      key: 'driver',
      label: 'Driver',
      render: (row) => (
        <span>
          <span className="font-mono font-bold">{row.driver}</span>
          <span className="text-gray-400 ml-2 hidden sm:inline">{row.full_name}</span>
        </span>
      ),
    },
    { key: 'team', label: 'Team', className: 'text-gray-400' },
    { key: 'points', label: 'Points', align: 'right', render: (row) => <span className="font-bold text-white">{formatPoints(row.points)}</span> },
    { key: 'wins', label: 'Wins', align: 'right' },
    { key: 'podiums', label: 'Podiums', align: 'right' },
    { key: 'races_completed', label: 'Races', align: 'right' },
  ];

  const careerColumns = [
    { key: 'year', label: 'Season' },
    { key: 'races', label: 'Races', align: 'right' },
    { key: 'wins', label: 'Wins', align: 'right' },
    { key: 'podiums', label: 'Podiums', align: 'right' },
    { key: 'pole_positions', label: 'Poles', align: 'right', render: (row) => formatCount(row.pole_positions) },
    { key: 'points', label: 'Points', align: 'right', render: (row) => formatPoints(row.points) },
    { key: 'average_finish', label: 'Avg finish', align: 'right', render: (row) => row.average_finish?.toFixed(1) },
  ];

  return (
    <div>
      <PageHeader
        icon={FiUsers}
        eyebrow="Championship"
        title="Driver Analysis"
        effect="decrypt"
        description="The drivers' championship, each driver's season in numbers and their career since 2018."
      />

      <Card>
        <ErrorMessage message={season.error} />
        <div className="grid gap-4 md:grid-cols-3">
          <SeasonPicker season={season} showGrandPrix={false} />
        </div>
      </Card>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card title="Drivers' Standings" eyebrow={year ? `${year} season` : undefined} className="lg:col-span-3">
          <ErrorMessage message={standingsError} />
          {loadingStandings && (
            <LoadingNote>Loading standings… the first load of a season can take a minute.</LoadingNote>
          )}
          {!loadingStandings && !standingsError && standings.length === 0 && (
            <EmptyNote>No races completed in this season yet.</EmptyNote>
          )}
          {standings.length > 0 && (
            <>
              <p className="text-sm text-gray-400 mb-3">Includes sprint points. Click a driver for details.</p>
              <DataTable
                columns={standingsColumns}
                rows={standings}
                rowKey={(row) => row.driver}
                selectedKey={selectedDriver?.driver}
                onRowClick={setSelectedDriver}
              />
            </>
          )}
        </Card>

        <div className="lg:col-span-2 min-w-0">
          <Card
            title={selectedDriver ? selectedDriver.full_name : 'Driver Details'}
            eyebrow={selectedDriver ? `${selectedDriver.team} · ${year}` : undefined}
            className="lg:sticky lg:top-24"
          >
            {!selectedDriver && <EmptyNote>Select a driver from the standings.</EmptyNote>}
            <ErrorMessage message={statsError} />
            {loadingStats && <LoadingNote>Loading season stats…</LoadingNote>}
            {seasonStats && (
              <>
                <div className="stagger grid grid-cols-2 gap-3 mb-4">
                  <StatTile label="Points" value={formatPoints(seasonStats.points)} accent />
                  <StatTile label="Races" value={seasonStats.races} />
                  <StatTile label="Wins" value={seasonStats.wins} />
                  <StatTile label="Podiums" value={seasonStats.podiums} />
                  <StatTile label="Poles" value={formatCount(seasonStats.pole_positions)} />
                  <StatTile label="Fastest laps" value={formatCount(seasonStats.fastest_laps)} />
                  <StatTile
                    label="Average finish"
                    value={seasonStats.average_finish ? seasonStats.average_finish.toFixed(1) : '--'}
                    sub={`Best ${formatFinish(seasonStats.best_finish)} · Worst ${formatFinish(seasonStats.worst_finish)}`}
                  />
                  <StatTile
                    label="DNFs"
                    value={seasonStats.dnf}
                    sub={`DNS ${seasonStats.dns ?? 0} · DSQ ${seasonStats.dsq ?? 0}`}
                  />
                </div>
                <SecondaryButton onClick={handleLoadCareer} disabled={loadingCareer}>
                  {loadingCareer ? 'Loading career…' : 'Load career (2018 onwards)'}
                </SecondaryButton>
              </>
            )}
          </Card>
        </div>
      </div>

      <ErrorMessage message={careerError} />
      {loadingCareer && <LoadingNote>Loading every season since 2018… this can take a few minutes the first time.</LoadingNote>}
      {career && (
        <Card title={selectedDriver?.full_name || career.driver} eyebrow="Career since 2018">
          <div className="stagger grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <StatTile label="Seasons" value={career.years} />
            <StatTile label="Races" value={career.total_races} />
            <StatTile label="Wins" value={career.total_wins} />
            <StatTile label="Podiums" value={career.total_podiums} />
            <StatTile label="Poles" value={formatCount(career.total_poles)} />
            <StatTile label="Points" value={formatPoints(career.total_points)} accent />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h3 className="eyebrow mb-3">Points per season</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={career.by_season}>
                  <defs>
                    <linearGradient id="pointsBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF2A1F" />
                      <stop offset="100%" stopColor="#E10600" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} vertical={false} />
                  <XAxis dataKey="year" {...axisProps} />
                  <YAxis {...axisProps} width={40} />
                  <Tooltip
                    {...tooltipProps}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                    formatter={(value) => [formatPoints(value), 'Points']}
                  />
                  <Bar dataKey="points" fill="url(#pointsBar)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DataTable columns={careerColumns} rows={career.by_season} rowKey={(row) => row.year} />
          </div>
        </Card>
      )}
    </div>
  );
}

export default DriversPage;
