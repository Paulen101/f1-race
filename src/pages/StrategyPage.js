import React, { useEffect, useState } from 'react';
import { getRaceStrategy, getPitStops, getSessionResults, getTireDegradation } from '../services/api';
import { getErrorMessage, formatLapTime, getTireColor } from '../utils/helpers';
import useSeasonSelector from '../hooks/useSeasonSelector';
import SeasonPicker from '../components/SeasonPicker';
import {
  Card, Button, Field, Select, ErrorMessage, LoadingNote, EmptyNote, DataTable,
} from '../components/ui';

// Dark text on the light compounds, white on the rest
const tyreTextColor = (compound) =>
  ['MEDIUM', 'HARD'].includes((compound || '').toUpperCase()) ? '#000' : '#fff';

const COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];

function StintTimeline({ strategies, totalLaps }) {
  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        {COMPOUNDS.map((compound) => (
          <span key={compound} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: getTireColor(compound) }} />
            {compound}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {strategies.map((strategy) => (
          <div key={strategy.driver} className="flex items-center gap-2">
            <div className="w-12 text-sm font-bold shrink-0">{strategy.driver}</div>
            <div className="flex-1 flex h-6 bg-f1-dark rounded overflow-hidden">
              {strategy.stints.map((stint, idx) => {
                // Position each stint on the race-lap axis so retirements show as a short bar
                const offset = idx === 0 ? (stint.start_lap - 1) / totalLaps : 0;
                const width = (stint.end_lap - stint.start_lap + 1) / totalLaps;
                return (
                  <div
                    key={idx}
                    title={`${stint.compound || 'Unknown'} · laps ${stint.start_lap}–${stint.end_lap}`}
                    className="h-full text-[10px] font-bold flex items-center justify-center border-r border-f1-dark overflow-hidden"
                    style={{
                      marginLeft: `${offset * 100}%`,
                      width: `${width * 100}%`,
                      backgroundColor: getTireColor(stint.compound),
                      color: tyreTextColor(stint.compound),
                    }}
                  >
                    {stint.num_laps >= 4 ? stint.num_laps : ''}
                  </div>
                );
              })}
            </div>
            <div className="w-14 text-xs text-gray-400 text-right shrink-0">
              {strategy.num_stops} {strategy.num_stops === 1 ? 'stop' : 'stops'}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-2 ml-14 mr-16">
        <span>Lap 1</span>
        <span>Lap {totalLaps}</span>
      </div>
    </div>
  );
}

function StrategyPage() {
  const season = useSeasonSelector();
  const { year, grandPrix } = season;

  const [race, setRace] = useState(null); // {year, grandPrix, strategies, pitStops, totalLaps}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [degDriver, setDegDriver] = useState('');
  const [degradation, setDegradation] = useState(null);
  const [loadingDeg, setLoadingDeg] = useState(false);
  const [degError, setDegError] = useState('');

  const handleLoad = async () => {
    try {
      setLoading(true);
      setError('');
      setRace(null);
      setDegradation(null);
      setDegDriver('');

      const [strategyData, pitData, resultsData] = await Promise.all([
        getRaceStrategy(year, grandPrix),
        getPitStops(year, grandPrix),
        // Only used to order drivers by finishing position
        getSessionResults(year, grandPrix, 'Race').catch(() => ({ results: [] })),
      ]);

      const finishOrder = new Map(
        (resultsData.results || []).map((r, idx) => [r.driver, r.position ?? 100 + idx])
      );
      const strategies = [...(strategyData.strategies || [])]
        .filter((s) => s.stints.length > 0)
        .sort((a, b) => (finishOrder.get(a.driver) ?? 999) - (finishOrder.get(b.driver) ?? 999));
      const totalLaps = Math.max(1, ...strategies.flatMap((s) => s.stints.map((stint) => stint.end_lap)));

      setRace({
        year,
        grandPrix,
        strategies,
        totalLaps,
        pitStops: [...(pitData.pit_stops || [])].sort((a, b) => a.lap - b.lap),
      });
      if (strategies.length > 0) setDegDriver(strategies[0].driver);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load race strategy.'));
    } finally {
      setLoading(false);
    }
  };

  // Tyre degradation for the chosen driver
  useEffect(() => {
    if (!race || !degDriver) return undefined;
    let cancelled = false;
    setLoadingDeg(true);
    setDegError('');
    setDegradation(null);

    getTireDegradation(race.year, race.grandPrix, degDriver)
      .then((data) => {
        if (!cancelled) setDegradation(data.degradation || []);
      })
      .catch((err) => {
        if (!cancelled) setDegError(getErrorMessage(err, 'Could not load tyre degradation.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingDeg(false);
      });

    return () => {
      cancelled = true;
    };
  }, [race, degDriver]);

  const compoundBadge = (compound) =>
    compound ? (
      <span
        className="px-2 py-0.5 rounded text-xs font-bold"
        style={{ backgroundColor: getTireColor(compound), color: tyreTextColor(compound) }}
      >
        {compound}
      </span>
    ) : (
      <span className="text-gray-500">?</span>
    );

  const pitColumns = [
    { key: 'lap', label: 'Lap', align: 'right' },
    { key: 'driver', label: 'Driver', className: 'font-bold' },
    {
      key: 'change',
      label: 'Tyres',
      render: (row) => (
        <span className="flex items-center gap-2">
          {compoundBadge(row.from_compound)} → {compoundBadge(row.to_compound)}
        </span>
      ),
    },
    {
      key: 'tyre_life_before',
      label: 'Old tyre age',
      align: 'right',
      render: (row) => (row.tyre_life_before != null ? `${row.tyre_life_before} laps` : '--'),
    },
  ];

  const degColumns = [
    { key: 'compound', label: 'Compound', render: (row) => compoundBadge(row.compound) },
    { key: 'num_laps', label: 'Timed laps', align: 'right' },
    {
      key: 'degradation_rate',
      label: 'Degradation',
      align: 'right',
      render: (row) =>
        row.degradation_rate == null ? '--' : `${row.degradation_rate >= 0 ? '+' : ''}${row.degradation_rate.toFixed(3)} s/lap`,
    },
    { key: 'base_pace', label: 'Base pace', align: 'right', render: (row) => formatLapTime(row.base_pace) },
    { key: 'total_degradation', label: 'Slowest − fastest', align: 'right', render: (row) => (row.total_degradation == null ? '--' : `${row.total_degradation.toFixed(3)} s`) },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-f1-red">Race Strategy</h1>

      <Card>
        <ErrorMessage message={season.error} />
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <SeasonPicker season={season} />
        </div>
        <Button onClick={handleLoad} disabled={loading || !year || !grandPrix}>
          {loading ? 'Loading…' : 'Load Strategy'}
        </Button>
      </Card>

      <ErrorMessage message={error} />
      {loading && <LoadingNote>Loading lap data… the first load of a race can take a minute.</LoadingNote>}

      {race && (
        <>
          <Card title={`Tyre Stints · ${race.grandPrix} ${race.year}`}>
            {race.strategies.length === 0 ? (
              <EmptyNote>No stint data available for this race.</EmptyNote>
            ) : (
              <StintTimeline strategies={race.strategies} totalLaps={race.totalLaps} />
            )}
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card title={`Pit Stops (${race.pitStops.length})`}>
              {race.pitStops.length === 0 ? (
                <EmptyNote>No pit stops recorded.</EmptyNote>
              ) : (
                <div className="max-h-[480px] overflow-y-auto">
                  <DataTable columns={pitColumns} rows={race.pitStops} rowKey={(row) => `${row.driver}-${row.lap}`} />
                </div>
              )}
            </Card>

            <Card title="Tyre Degradation">
              <div className="max-w-xs mb-4">
                <Field label="Driver">
                  <Select value={degDriver} onChange={setDegDriver}>
                    {race.strategies.map((s) => (
                      <option key={s.driver} value={s.driver}>{s.driver}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <ErrorMessage message={degError} />
              {loadingDeg && <LoadingNote>Fitting degradation per stint…</LoadingNote>}
              {degradation && degradation.length === 0 && (
                <EmptyNote>Not enough timed laps in any stint (3 needed).</EmptyNote>
              )}
              {degradation && degradation.length > 0 && (
                <>
                  <DataTable columns={degColumns} rows={degradation} />
                  <p className="text-xs text-gray-500 mt-3">
                    Slope of lap time against tyre age. Includes in/out laps and safety-car laps, so treat it as a rough guide.
                  </p>
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default StrategyPage;
