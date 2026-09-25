from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
import fastf1
from fastf1.ergast import Ergast
import pandas as pd
from datetime import datetime
from app.services import f1_service

router = APIRouter()


@router.get("/standings/{year}")
def get_driver_standings(year: int) -> Dict[str, Any]:
    """Get driver championship standings efficiently"""
    try:
        standings = f1_service.get_driver_standings(year)
        return {'year': year, 'standings': standings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ClassifiedPosition codes (see FastF1 SessionResults docs)
DNF_CODES = {'R', 'N'}          # retired, not classified
DSQ_CODES = {'D', 'E'}          # disqualified, excluded
DNS_CODES = {'W'}               # withdrawn / did not start


def _season_award_holders(year: int, award: str) -> Optional[List[str]]:
    """
    Driver codes holding pole position ('pole') or the fastest lap
    ('fastest_lap') at each race of a season, from one small Ergast query.

    Returns None if the data can't be fetched, so callers can report
    "unknown" instead of a wrong zero.
    """
    try:
        ergast = Ergast(result_type='pandas', auto_cast=True, limit=100)
        if award == 'pole':
            response = ergast.get_qualifying_results(season=year, results_position=1)
        else:
            response = ergast.get_race_results(season=year, fastest_rank=1)
        return [str(df['driverCode'].iloc[0]) for df in response.content
                if not df.empty and 'driverCode' in df.columns]
    except Exception as e:
        print(f"Warning: Could not load {award} data for {year}: {e}")
        return None


def _load_results(year: int, event_name: str, session_name: str) -> Optional[pd.DataFrame]:
    """Load only a session's classification (no laps/telemetry)."""
    session = fastf1.get_session(year, event_name, session_name)
    session.load(laps=False, telemetry=False, weather=False, messages=False)
    results = session.results
    if results is None or results.empty:
        return None
    return results


def _find_driver(results: pd.DataFrame, driver: str) -> pd.DataFrame:
    """Match a driver by abbreviation, falling back to a name search."""
    driver_res = results[results['Abbreviation'] == driver]
    if driver_res.empty:
        driver_res = results[results['FullName'].str.contains(driver, case=False, na=False, regex=False)]
    return driver_res


@router.get("/{year}/{driver}/stats")
def get_driver_season_stats(year: int, driver: str) -> Dict[str, Any]:
    """
    Get comprehensive statistics for a driver in a season.

    Only session results are loaded (no lap data). Poles and fastest laps
    come from one season-wide Ergast query each; they are None if unavailable.
    """
    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        # Filter for completed races
        completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()]
        
        stats = {
            'driver': driver,
            'year': year,
            'races': 0,
            'wins': 0,
            'podiums': 0,
            'points': 0.0,
            'dnf': 0,
            'dns': 0,
            'dsq': 0,
            'pole_positions': 0,
            'fastest_laps': 0,
            'average_finish': 0.0,
            'best_finish': None,
            'worst_finish': None
        }
        
        positions = []
        driver_code = driver
        
        for _, event in completed_races.iterrows():
            event_name = event['EventName']
            try:
                results = _load_results(year, event_name, 'Race')
                if results is None:
                    continue
                
                driver_res = _find_driver(results, driver)
                if driver_res.empty:
                    continue
                
                res = driver_res.iloc[0]
                driver_code = res.get('Abbreviation') or driver_code
                stats['races'] += 1
                
                pos = res.get('Position')
                if pd.notna(pos):
                    pos = int(pos)
                    positions.append(pos)
                    
                    if pos == 1: stats['wins'] += 1
                    if pos <= 3: stats['podiums'] += 1
                    
                    if stats['best_finish'] is None or pos < stats['best_finish']:
                        stats['best_finish'] = pos
                    if stats['worst_finish'] is None or pos > stats['worst_finish']:
                        stats['worst_finish'] = pos
                
                # Official classification: a number if classified, else a code
                classified = str(res.get('ClassifiedPosition', '')).strip().upper()
                if classified in DNF_CODES:
                    stats['dnf'] += 1
                elif classified in DSQ_CODES:
                    stats['dsq'] += 1
                elif classified in DNS_CODES:
                    stats['dns'] += 1
                
                points = res.get('Points', 0)
                stats['points'] += float(points) if pd.notna(points) else 0.0
                
                # Sprint points count towards the championship too
                if 'sprint' in str(event.get('EventFormat', '')).lower():
                    try:
                        sprint = _load_results(year, event_name, 'Sprint')
                        if sprint is not None:
                            sprint_res = _find_driver(sprint, driver)
                            if not sprint_res.empty:
                                sprint_points = sprint_res.iloc[0].get('Points', 0)
                                if pd.notna(sprint_points):
                                    stats['points'] += float(sprint_points)
                    except Exception as e:
                        print(f"Warning: Could not load sprint for {event_name}: {e}")
            except Exception as e:
                print(f"Warning: Error processing {event_name}: {e}")
                continue
        
        if positions:
            stats['average_finish'] = float(sum(positions) / len(positions))
        
        if stats['races'] > 0:
            # Pole = fastest in qualifying, not grid slot 1 (grid penalties move people)
            poles = _season_award_holders(year, 'pole')
            fastest = _season_award_holders(year, 'fastest_lap')
            stats['pole_positions'] = poles.count(driver_code) if poles is not None else None
            stats['fastest_laps'] = fastest.count(driver_code) if fastest is not None else None
        
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _sum_known(values) -> Optional[int]:
    """Sum values, or None if any season's value is unknown."""
    values = list(values)
    if any(v is None for v in values):
        return None
    return sum(values)


@router.get("/{driver}/career")
def get_driver_career_stats(driver: str, start_year: int = 2018, end_year: Optional[int] = None) -> Dict[str, Any]:
    """Get career statistics for a driver across multiple seasons efficiently"""
    try:
        if end_year is None:
            end_year = datetime.now().year
        career_stats = []
        
        for year in range(start_year, end_year + 1):
            try:
                # Reuse the optimized season stats function
                year_stats = get_driver_season_stats(year, driver)
                if year_stats.get('races', 0) > 0:
                    career_stats.append(year_stats)
            except:
                continue
        
        if not career_stats:
            return {'message': f"No career data found for {driver}"}

        # Aggregate career totals
        total_races = sum(s['races'] for s in career_stats)
        career_totals = {
            'driver': driver,
            'years': len(career_stats),
            'total_races': total_races,
            'total_wins': sum(s['wins'] for s in career_stats),
            'total_podiums': sum(s['podiums'] for s in career_stats),
            'total_points': float(sum(s['points'] for s in career_stats)),
            'total_poles': _sum_known(s['pole_positions'] for s in career_stats),
            'total_fastest_laps': _sum_known(s['fastest_laps'] for s in career_stats),
            'total_dnfs': sum(s['dnf'] for s in career_stats),
            'career_avg_finish': float(sum(s['average_finish'] * s['races'] for s in career_stats) / total_races) if total_races > 0 else 0.0,
            'by_season': career_stats
        }
        
        return career_totals
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
