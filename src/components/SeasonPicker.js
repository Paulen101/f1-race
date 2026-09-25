import React from 'react';
import { Field, Select } from './ui';

/**
 * Year + Grand Prix dropdowns driven by useSeasonSelector.
 */
function SeasonPicker({ season, showGrandPrix = true }) {
  const { years, year, setYear, tracks, grandPrix, setGrandPrix, loadingTracks } = season;

  return (
    <>
      <Field label="Year">
        <Select value={year} onChange={setYear} disabled={years.length === 0}>
          {years.length === 0 && <option value="">Loading...</option>}
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </Field>

      {showGrandPrix && (
        <Field label="Grand Prix">
          <Select value={grandPrix} onChange={setGrandPrix} disabled={loadingTracks || tracks.length === 0}>
            {loadingTracks && <option value="">Loading races...</option>}
            {!loadingTracks && tracks.length === 0 && <option value="">No completed races</option>}
            {!loadingTracks &&
              tracks.map((track) => (
                <option key={track.name} value={track.name}>
                  {track.round ? `R${track.round} · ` : ''}{track.name}
                </option>
              ))}
          </Select>
        </Field>
      )}
    </>
  );
}

export default SeasonPicker;
