import React, { Component, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import {
  FiActivity, FiArrowRight, FiBarChart2, FiCheck, FiClock, FiCpu, FiLayers, FiMap, FiMapPin, FiUsers,
} from 'react-icons/fi';
import { getSeasonSchedule } from '../services/api';
import { getErrorMessage } from '../utils/helpers';
import BlurText from '../components/reactbits/BlurText';
import RotatingText from '../components/reactbits/RotatingText';
import ShinyText from '../components/reactbits/ShinyText';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import StarBorder from '../components/reactbits/StarBorder';
import { Card, ErrorMessage, LoadingNote, EmptyNote, AnimatedValue } from '../components/ui';

// three.js is heavy, so only the home page pulls it in
const Hyperspeed = lazy(() => import('../components/reactbits/Hyperspeed'));

// Red car lights racing away, white headlights coming towards you
const HYPERSPEED_OPTIONS = {
  distortion: 'LongRaceDistortion',
  length: 400,
  roadWidth: 10,
  islandWidth: 5,
  lanesPerRoad: 3,
  fov: 90,
  fovSpeedUp: 140,
  speedUp: 2.4,
  carLightsFade: 0.4,
  totalSideLightSticks: 50,
  lightPairsPerRoadWay: 50,
  shoulderLinesWidthPercentage: 0.05,
  brokenLinesWidthPercentage: 0.1,
  brokenLinesLengthPercentage: 0.5,
  lightStickWidth: [0.12, 0.5],
  lightStickHeight: [1.3, 1.7],
  movingAwaySpeed: [60, 80],
  movingCloserSpeed: [-120, -160],
  carLightsLength: [400 * 0.05, 400 * 0.15],
  carLightsRadius: [0.05, 0.14],
  carWidthPercentage: [0.3, 0.5],
  carShiftX: [-0.2, 0.2],
  carFloorSeparation: [0.05, 1],
  colors: {
    roadColor: 0x080808,
    islandColor: 0x0a0a0a,
    background: 0x000000,
    shoulderLines: 0x131318,
    brokenLines: 0x131318,
    leftCars: [0xe10600, 0xff3b30, 0x9b0400],
    rightCars: [0xffffff, 0xd4d4d8, 0x8f9bb3],
    sticks: 0xe10600,
  },
};

const MODULES = [
  {
    to: '/predictions',
    title: 'AI Race Predictions',
    text: 'Win, podium and fastest-lap probabilities from two seasons of results, qualifying pace and track history.',
    icon: FiCpu,
    featured: true,
  },
  { to: '/telemetry', title: 'Telemetry', text: 'Overlay speed, throttle and braking on two drivers’ fastest laps.', icon: FiActivity },
  { to: '/laptimes', title: 'Lap Times', text: 'Every lap with sectors, tyres and personal bests.', icon: FiClock },
  { to: '/strategy', title: 'Tyre Strategy', text: 'Stint timelines, pit stops and degradation per compound.', icon: FiLayers },
  { to: '/drivers', title: 'Drivers', text: 'Standings, season form and career stats since 2018.', icon: FiUsers },
  { to: '/circuits', title: 'Circuits', text: 'Track stats, safety cars and past winners.', icon: FiMap },
  { to: '/comparisons', title: 'Comparisons', text: 'Head-to-head, teammate battles and session pace.', icon: FiBarChart2 },
];

/** Renders nothing if WebGL isn't available instead of breaking the page. */
class SilentBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const formatDay = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function Hero({ year }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative isolate -mt-px h-[82vh] min-h-[560px] max-h-[900px] overflow-hidden border-b border-white/[0.06] bg-black">
      {!reduceMotion && (
        <div className="absolute inset-0 -z-10">
          <SilentBoundary>
            <Suspense fallback={null}>
              <Hyperspeed effectOptions={HYPERSPEED_OPTIONS} />
            </Suspense>
          </SilentBoundary>
        </div>
      )}
      {/* Keep the copy readable over the light trails */}
      <div
        className="pointer-events-none absolute inset-0 -z-[5] bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(11,11,16,0.75)_75%)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-[5] h-48 bg-gradient-to-t from-f1-dark to-transparent" aria-hidden="true" />

      <div className="pointer-events-none mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-6">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-f1-red" aria-hidden="true" />
          <ShinyText
            text={`${year} season · Powered by FastF1`}
            className="text-[11px] font-semibold uppercase tracking-[0.25em]"
            color="#a1a1aa"
            shineColor="#ffffff"
            speed={2.5}
          />
        </div>

        <BlurText
          as="h1"
          text="Every lap. Every sector. Decoded."
          animateBy="words"
          delay={120}
          className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
        />

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold text-gray-300 sm:text-2xl">
          <span>Built for</span>
          <RotatingText
            texts={['lap-time analysis', 'telemetry overlays', 'tyre strategy', 'race predictions']}
            mainClassName="overflow-hidden rounded-lg bg-f1-red px-2.5 py-0.5 text-white sm:px-3 sm:py-1"
            staggerFrom="last"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-120%' }}
            staggerDuration={0.02}
            splitLevelClassName="overflow-hidden pb-0.5"
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            rotationInterval={2600}
          />
        </div>

        <div className="pointer-events-auto mt-10 flex flex-wrap items-center gap-4">
          <StarBorder
            as={Link}
            to="/predictions"
            color="#ff3b30"
            speed="5s"
            backgroundColor="#E10600"
            borderColor="rgba(255,255,255,0.15)"
            className="!rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
            innerClassName="!rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-wider"
          >
            <span className="flex items-center gap-2">
              Predict the next race <FiArrowRight aria-hidden="true" />
            </span>
          </StarBorder>
          <Link
            to="/telemetry"
            className="rounded-xl border border-white/15 bg-black/40 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white backdrop-blur-md transition hover:border-white/40"
          >
            Compare telemetry
          </Link>
        </div>

        {!reduceMotion && (
          <p className="mt-6 text-xs text-gray-500">Tip: click and hold on the track to open DRS.</p>
        )}
      </div>
    </section>
  );
}

function NextRace({ events, nextIndex }) {
  const race = events[nextIndex];
  const completed = nextIndex === -1 ? events.length : nextIndex;
  const progress = events.length ? (completed / events.length) * 100 : 0;

  if (!race) {
    return (
      <Card eyebrow="Season" title="Season complete" className="h-full !mb-0">
        <p className="text-gray-400">All {events.length} rounds have been run. Dig into the data below.</p>
      </Card>
    );
  }

  const days = Math.max(0, Math.ceil((race.dateObj - new Date()) / 86400000));

  return (
    <Card eyebrow={`Next race · Round ${race.round}`} title={race.grand_prix} className="h-full !mb-0">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-gray-300">
            <FiMapPin className="text-f1-red" aria-hidden="true" />
            {[race.location, race.country].filter(Boolean).join(', ')}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {race.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-5xl font-bold leading-none tabular-nums text-white">
            <AnimatedValue value={days} />
          </div>
          <div className="eyebrow mt-1">{days === 1 ? 'day to go' : 'days to go'}</div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs text-gray-400">
          <span>Season progress</span>
          <span className="font-mono">
            {completed} / {events.length} rounds
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-f1-red to-f1-red-bright transition-[width] duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <Link
        to="/predictions"
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-f1-red-bright transition hover:gap-3"
      >
        See the prediction <FiArrowRight aria-hidden="true" />
      </Link>
    </Card>
  );
}

function ModuleGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {MODULES.map(({ to, title, text, icon: Icon, featured }, idx) => (
        <Link
          key={to}
          to={to}
          className={`group block animate-fade-up rounded-2xl ${featured ? 'sm:col-span-2' : ''}`}
          style={{ animationDelay: `${idx * 60}ms` }}
        >
          <SpotlightCard
            className="flex h-full flex-col rounded-2xl border border-white/[0.06] p-5 transition-colors group-hover:border-f1-red/40"
            style={{ '--spotlight-card-surface': featured ? 'rgba(225, 6, 0, 0.08)' : 'rgba(20, 20, 27, 0.78)' }}
            spotlightColor="#ff3b30"
            intensity={0.12}
            borderGlow={0.7}
          >
            <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/40 text-lg text-f1-red-bright transition group-hover:scale-110 group-hover:border-f1-red/50">
              <Icon aria-hidden="true" />
            </span>
            <h3 className={`font-bold tracking-tight ${featured ? 'text-2xl' : 'text-lg'}`}>{title}</h3>
            <p className="mt-1.5 flex-1 text-sm text-gray-400">{text}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-all group-hover:gap-2.5 group-hover:text-white">
              Open <FiArrowRight aria-hidden="true" />
            </span>
          </SpotlightCard>
        </Link>
      ))}
    </div>
  );
}

function Calendar({ events, nextIndex }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {events.map((race, idx) => {
        const done = nextIndex === -1 || idx < nextIndex;
        const isNext = idx === nextIndex;
        return (
          <div
            key={race.round}
            className={`relative overflow-hidden rounded-xl border p-3 sm:p-4 transition ${
              isNext
                ? 'border-f1-red/60 bg-f1-red/[0.08] shadow-[0_0_30px_-12px_rgba(225,6,0,0.8)]'
                : done
                  ? 'border-white/[0.04] bg-black/20 opacity-60 hover:opacity-100'
                  : 'border-white/[0.06] bg-black/30 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-gray-500">R{String(race.round).padStart(2, '0')}</span>
              {isNext && (
                <span className="rounded-full bg-f1-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Next</span>
              )}
              {done && <FiCheck className="text-gray-500" aria-label="Completed" />}
            </div>
            <div className="mt-2 truncate font-bold" title={race.grand_prix}>
              {race.grand_prix.replace(/ Grand Prix$/, '')}
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-sm text-gray-400">
              <span className="hidden truncate sm:inline">{race.location}</span>
              <span className="shrink-0 font-mono text-xs">{race.dateObj ? formatDay(race.dateObj) : 'TBC'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div className="mb-5">
      <div className="eyebrow mb-1">{eyebrow}</div>
      <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
        <span className="h-6 w-1.5 -skew-x-12 rounded-sm bg-f1-red" aria-hidden="true" />
        {title}
      </h2>
    </div>
  );
}

function Home() {
  const [year] = useState(new Date().getFullYear());
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getSeasonSchedule(year)
      .then((data) => {
        if (!cancelled) setSchedule(data.events || []);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the race calendar.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  // Round 0 is pre-season testing, which isn't a race
  const events = useMemo(
    () =>
      schedule
        .filter((e) => e.round > 0)
        .map((e) => ({ ...e, dateObj: e.date ? new Date(e.date) : null })),
    [schedule]
  );
  const nextIndex = useMemo(() => {
    // Treat a race as upcoming until the end of race day
    const now = Date.now() - 86400000;
    return events.findIndex((e) => e.dateObj && e.dateObj.getTime() >= now);
  }, [events]);

  return (
    <div>
      <Hero year={year} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <section className="relative z-10 -mt-16 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {loading && (
              <Card eyebrow="Next race" title="Loading calendar…" className="h-full !mb-0">
                <LoadingNote>Fetching the {year} schedule…</LoadingNote>
              </Card>
            )}
            {!loading && error && (
              <Card eyebrow="Next race" title="Calendar unavailable" className="h-full !mb-0">
                <ErrorMessage message={error} />
              </Card>
            )}
            {!loading && !error && events.length > 0 && <NextRace events={events} nextIndex={nextIndex} />}
            {!loading && !error && events.length === 0 && (
              <Card eyebrow="Next race" title={`${year} calendar`} className="h-full !mb-0">
                <EmptyNote>No races published for {year} yet.</EmptyNote>
              </Card>
            )}
          </div>
          <Card eyebrow="What's inside" title="Pit wall for the armchair strategist" className="lg:col-span-3 !mb-0">
            <p className="text-gray-400">
              Load any session since 2018 and break it down: who was quick in which sector, when the undercut worked,
              how fast the tyres fell away, and who the model fancies for the next Grand Prix.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                ['Seasons', '2018+'],
                ['Modules', MODULES.length],
                ['Data source', 'FastF1'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-black/30 p-3 sm:p-4">
                  <div className="eyebrow truncate">{label}</div>
                  <div className="mt-1 truncate font-mono text-lg font-bold sm:text-2xl">
                    <AnimatedValue value={value} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-16">
          <SectionTitle eyebrow="Explore" title="Analysis modules" />
          <ModuleGrid />
        </section>

        {events.length > 0 && (
          <section className="mt-16">
            <SectionTitle eyebrow={`${events.length} rounds`} title={`${year} race calendar`} />
            <Calendar events={events} nextIndex={nextIndex} />
          </section>
        )}
      </div>
    </div>
  );
}

export default Home;
