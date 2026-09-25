import { useEffect, useRef, useState } from 'react';
import { getAvailableYears, getAvailableTracks } from '../services/api';
import { getErrorMessage } from '../utils/helpers';

/**
 * Year + Grand Prix selection shared by the analysis pages.
 *
 * Defaults to the latest season. With `completedOnly`, only races that have
 * already happened are offered and the most recent one is preselected; if the
 * latest season hasn't started yet, it falls back to the previous season.
 */
function useSeasonSelector({ completedOnly = true } = {}) {
  const [years, setYears] = useState([]);
  const [year, setYearState] = useState('');
  const [tracks, setTracks] = useState([]);
  const [grandPrix, setGrandPrix] = useState('');
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [error, setError] = useState('');
  // True while the year is our default pick rather than the user's choice
  const yearIsDefault = useRef(true);

  useEffect(() => {
    let cancelled = false;
    getAvailableYears()
      .then((data) => {
        if (cancelled) return;
        const list = data.years || [];
        setYears(list);
        if (list.length > 0) setYearState(list[list.length - 1]);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load seasons.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!year) return undefined;
    let cancelled = false;
    setLoadingTracks(true);
    setError('');

    getAvailableTracks(year)
      .then((data) => {
        if (cancelled) return;
        const now = new Date();
        // Round 0 is pre-season testing, which has no race
        let list = (data.tracks || []).filter((t) => t.round !== 0);
        if (completedOnly) {
          list = list.filter((t) => t.date && new Date(t.date) < now);
        }

        if (list.length === 0 && completedOnly && yearIsDefault.current) {
          // Season hasn't started yet: show the previous one instead
          const idx = years.indexOf(year);
          if (idx > 0) {
            setYearState(years[idx - 1]);
            return;
          }
        }

        setTracks(list);
        setGrandPrix(list.length > 0 ? list[list.length - 1].name : '');
      })
      .catch((err) => {
        if (cancelled) return;
        setTracks([]);
        setGrandPrix('');
        setError(getErrorMessage(err, 'Could not load the race calendar.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingTracks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year, years, completedOnly]);

  const setYear = (value) => {
    yearIsDefault.current = false;
    setYearState(value ? parseInt(value, 10) : '');
  };

  return { years, year, setYear, tracks, grandPrix, setGrandPrix, loadingTracks, error };
}

export default useSeasonSelector;
