import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FiAward, FiCpu, FiFlag, FiMapPin, FiTrendingUp, FiZap } from 'react-icons/fi';
import {
  predictRace,
  getAvailableYears,
  getAvailableTracks,
  getNextRace,
} from '../services/api';
import { getErrorMessage } from '../utils/helpers';
import PageHeader from '../components/PageHeader';
import { Card, Button, Field, Select, ErrorMessage, StartLights, AnimatedValue } from '../components/ui';

const getTopPredictions = (predictionObj, count = 5) => {
  if (!predictionObj) return [];
  return Object.entries(predictionObj)
    .sort(([, a], [, b]) => b - a)
    .slice(0, count);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const percent = (prob) => (prob * 100).toFixed(1);

const PLACE_COLORS = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];

/** Top three of the win prediction on a P2 / P1 / P3 podium. */
function Podium({ entries }) {
  const order = [1, 0, 2]; // P2, P1, P3
  const heights = ['h-28', 'h-36', 'h-20'];
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4">
      {order.map((rank, col) => {
        const entry = entries[rank];
        if (!entry) return <div key={rank} className="w-24 sm:w-32" />;
        const [driver, prob] = entry;
        return (
          <motion.div
            key={driver}
            className="flex w-24 flex-col items-center sm:w-32"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + col * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className={`font-mono text-2xl font-black sm:text-3xl ${rank === 0 ? 'text-white' : 'text-gray-200'}`}>{driver}</div>
            <div className="mb-2 font-mono text-xs text-gray-400">{percent(prob)}%</div>
            <motion.div
              className={`relative w-full overflow-hidden rounded-t-xl border border-b-0 ${
                rank === 0 ? 'border-f1-red/60 bg-gradient-to-b from-f1-red/50 to-f1-red/5' : 'border-white/10 bg-gradient-to-b from-white/15 to-white/[0.02]'
              } ${heights[col]}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ originY: 1 }}
              transition={{ delay: 0.1 + col * 0.12, duration: 0.6, ease: 'easeOut' }}
            >
              <span className={`absolute inset-x-0 top-2 text-center text-3xl font-black italic ${PLACE_COLORS[rank]}`}>
                {rank + 1}
              </span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ProbabilityList({ title, icon: Icon, entries, delay = 0 }) {
  const max = entries.length ? entries[0][1] : 1;
  return (
    <Card title={title} eyebrow="Top 5" className="!mb-0 h-full" delay={delay}>
      <span className="absolute right-5 top-5 text-2xl text-white/10" aria-hidden="true">
        <Icon />
      </span>
      <ol className="space-y-3">
        {entries.map(([driver, prob], idx) => (
          <li key={driver}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2.5">
                <span className={`w-5 font-mono text-xs font-bold ${PLACE_COLORS[idx] || 'text-gray-500'}`}>{idx + 1}</span>
                <span className="font-mono font-bold">{driver}</span>
              </span>
              <span className="font-mono text-sm tabular-nums text-gray-300">{percent(prob)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <motion.div
                className={`h-full rounded-full ${idx === 0 ? 'bg-gradient-to-r from-f1-red to-f1-red-bright' : 'bg-f1-red/60'}`}
                initial={{ width: 0 }}
                animate={{ width: `${max ? (prob / max) * 100 : 0}%` }}
                transition={{ delay: delay / 1000 + 0.2 + idx * 0.06, duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function PredictionsPage() {
  const [years, setYears] = useState([]);
  const [tracks, setTracks] = useState([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [nextRace, setNextRace] = useState(null);

  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Load available years on mount
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const data = await getAvailableYears();
        setYears(data.years || []);
        if (data.years && data.years.length > 0) {
          const currentYear = data.years[data.years.length - 1];
          setSelectedYear(currentYear);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load seasons.'));
      }
    };
    fetchYears();
  }, []);

  // Load tracks and next race when year changes
  useEffect(() => {
    const fetchTracksAndNextRace = async () => {
      if (!selectedYear) return;

      setLoadingTracks(true);
      setNextRace(null);
      try {
        const [tracksData, nextRaceData] = await Promise.all([
          getAvailableTracks(selectedYear),
          getNextRace(selectedYear),
        ]);

        // Round 0 is pre-season testing, which has no race to predict
        const list = (tracksData.tracks || []).filter((t) => t.round !== 0);
        setTracks(list);

        if (nextRaceData && nextRaceData.grand_prix) {
          setNextRace(nextRaceData);
          setSelectedTrack(nextRaceData.grand_prix);
        } else if (list.length > 0) {
          setSelectedTrack(list[0].name);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load the race calendar.'));
      } finally {
        setLoadingTracks(false);
      }
    };

    fetchTracksAndNextRace();
  }, [selectedYear]);

  const handlePredictRace = async () => {
    let interval;
    try {
      setLoading(true);
      setError('');
      setPredictions(null);
      setProgress(0);
      setStatus('Initializing prediction engine...');

      // Mock progress interval to keep user informed
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 30) {
            setStatus('Fetching 2-year historical data...');
            return prev + 2;
          }
          if (prev < 60) {
            setStatus('Analyzing driver performance and track characteristics...');
            return prev + 1;
          }
          if (prev < 90) {
            setStatus('Calculating probabilities and confidence scores...');
            return prev + 0.5;
          }
          return prev;
        });
      }, 300);

      const data = await predictRace(selectedYear, selectedTrack);

      clearInterval(interval);
      setProgress(100);
      setStatus(data.status || 'Prediction generated successfully!');

      setTimeout(() => {
        setPredictions({ ...data, grandPrix: selectedTrack, year: selectedYear });
        setLoading(false);
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setError(getErrorMessage(err, 'Error making prediction.'));
      setLoading(false);
    }
  };

  const winners = getTopPredictions(predictions?.race_winner);
  const confidence = predictions ? Math.round((predictions.confidence || 0) * 100) : 0;

  return (
    <div>
      <PageHeader
        icon={FiCpu}
        eyebrow="Machine learning"
        title="AI Race Predictions"
        description="Predictions built from the last two seasons of results, qualifying pace and track-specific form."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Pick a race" className="lg:col-span-3">
          <div className="grid gap-4 md:grid-cols-2 mb-5">
            <Field label="Year">
              <Select value={selectedYear} onChange={(v) => setSelectedYear(v ? parseInt(v, 10) : '')}>
                <option value="">Select year</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </Select>
            </Field>

            <Field label="Grand Prix">
              <Select value={selectedTrack} onChange={setSelectedTrack} disabled={loadingTracks || tracks.length === 0}>
                <option value="">Select track</option>
                {tracks.map((track) => (
                  <option key={track.name} value={track.name}>
                    {track.round ? `R${track.round} · ` : ''}{track.name}{track.date ? ` (${formatDate(track.date)})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Button onClick={handlePredictRace} disabled={loading || !selectedYear || !selectedTrack}>
            {loading ? 'Predicting…' : 'Generate Prediction'}
          </Button>

          {loading && (
            <div className="mt-6 animate-fade-up" role="status">
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-3 font-semibold text-gray-200">
                  <StartLights />
                  {status}
                </span>
                <span className="font-mono text-gray-400">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-f1-red to-f1-red-bright transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </Card>

        <Card title={nextRace ? nextRace.grand_prix : 'Next race'} eyebrow="Up next" className="lg:col-span-2">
          {nextRace ? (
            <>
              <p className="flex items-center gap-2 text-gray-300">
                <FiMapPin className="text-f1-red" aria-hidden="true" />
                {[nextRace.location, nextRace.country].filter(Boolean).join(', ')}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                <FiFlag aria-hidden="true" /> {formatDate(nextRace.date)}
              </p>
              {selectedTrack !== nextRace.grand_prix && (
                <button
                  type="button"
                  onClick={() => setSelectedTrack(nextRace.grand_prix)}
                  className="mt-4 text-sm font-semibold text-f1-red-bright hover:underline"
                >
                  Select this race
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">
              {loadingTracks ? 'Checking the calendar…' : 'No upcoming race this season. Pick any round to see how the model would have called it.'}
            </p>
          )}
        </Card>
      </div>

      <ErrorMessage message={error} />

      {predictions && !loading && (
        <>
          <Card
            title={`${predictions.grandPrix} ${predictions.year}`}
            eyebrow="Predicted podium"
            actions={
              <div className="text-right">
                <div className="eyebrow">Model confidence</div>
                <div className="font-mono text-2xl font-bold">
                  <AnimatedValue value={confidence} />%
                </div>
              </div>
            }
          >
            {winners.length > 0 ? <Podium entries={winners} /> : <p className="text-gray-400">No win probabilities returned.</p>}
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-f1-red via-f1-red-bright to-yellow-400"
                initial={{ width: 0 }}
                animate={{ width: `${confidence}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-3 mb-6">
            <ProbabilityList title="Race Winner" icon={FiAward} entries={winners} />
            <ProbabilityList title="Podium Finish" icon={FiTrendingUp} entries={getTopPredictions(predictions.podium)} delay={80} />
            <ProbabilityList title="Fastest Lap" icon={FiZap} entries={getTopPredictions(predictions.fastest_lap)} delay={160} />
          </div>

          <Card title="Prediction Insights">
            <div className="rounded-xl border-l-4 border-f1-red bg-black/30 p-4">
              <p className="text-sm text-white">
                <span className="font-bold text-f1-red-bright">Analysis status:</span> {status}
              </p>
              <div className="mt-3 grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
                <div>• Historical races analyzed: {predictions.data_info?.historical_races ?? '--'}</div>
                <div>• Qualifying data used: {predictions.data_info?.has_qualifying ? 'Yes' : 'No'}</div>
                <div>• Data window: 24 months</div>
                <div>• ML model: Optimized vector engine</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export default PredictionsPage;
