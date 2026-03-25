from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
import fastf1
import pandas as pd
from app.services import f1_service

router = APIRouter()


@router.get("/standings/{year}")
async def get_driver_standings(year: int) -> Dict[str, Any]:
    """Get driver championship standings efficiently"""
    try:
        standings = await f1_service.get_driver_standings(year)
        return {'year': year, 'standings': standings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{driver}/stats")
async def get_driver_season_stats(year: int, driver: str) -> Dict[str, Any]:
    """Get comprehensive statistics for a driver in a season with optimized loading"""
    try:
        schedule = fastf1.get_event_schedule(year)
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
            'pole_positions': 0,
            'fastest_laps': 0,
            'average_finish': 0.0,
            'best_finish': None,
            'worst_finish': None
        }
        
        positions = []
        
        for _, event in completed_races.iterrows():
            try:
                event_name = event['EventName']
                
                # Optimized Race session load
                race = fastf1.get_session(year, event_name, 'Race')
                # Load only results and laps (laps needed for fastest lap calculation)
                race.load(telemetry=False, weather=False, messages=False)
                
                if race.results is not None and not race.results.empty:
                    # Filter for specific driver
                    # FastF1 results uses abbreviations or numbers, pick_driver handles both
                    try:
                        driver_res = race.results[race.results['Abbreviation'] == driver]
                        if driver_res.empty:
                            # Try matching by FullName or other fields if Abbreviation fails
                            driver_res = race.results[race.results['FullName'].str.contains(driver, case=False, na=False)]
                    except:
                        driver_res = pd.DataFrame()

                    if not driver_res.empty:
                        res = driver_res.iloc[0]
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
                        
                        # DNF detection: check Status
                        status = str(res.get('Status', '')).lower()
                        if any(x in status for x in ['retired', 'collision', 'accident', 'engine', 'power unit']):
                            stats['dnf'] += 1
                            
                        stats['points'] += float(res.get('Points', 0))

                        # Check if driver started on pole
                        if res.get('GridPosition') == 1:
                            stats['pole_positions'] += 1
                        
                        # Check for fastest lap - FastF1 usually has this in results if loaded
                        # If not, use the laps data we loaded
                        if hasattr(res, 'FastestLapTime') and pd.notna(res.FastestLapTime):
                            # Compare with other drivers' fastest laps in the same race
                            if res.FastestLapTime == race.results['FastestLapTime'].min():
                                stats['fastest_laps'] += 1
                        elif not race.laps.empty:
                            valid_laps = race.laps[race.laps['LapTime'].notna()]
                            if not valid_laps.empty:
                                race_fastest_lap = valid_laps.loc[valid_laps['LapTime'].idxmin()]
                                if race_fastest_lap['Driver'] == res.get('Driver'):
                                    stats['fastest_laps'] += 1
            except Exception as e:
                print(f"Warning: Error processing {event_name}: {e}")
                continue
        
        if positions:
            stats['average_finish'] = float(sum(positions) / len(positions))
        
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{driver}/career")
async def get_driver_career_stats(driver: str, start_year: int = 2018, end_year: int = 2024) -> Dict[str, Any]:
    """Get career statistics for a driver across multiple seasons efficiently"""
    try:
        career_stats = []
        
        for year in range(start_year, end_year + 1):
            try:
                # Reuse the optimized season stats function
                year_stats = await get_driver_season_stats(year, driver)
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
            'total_poles': sum(s['pole_positions'] for s in career_stats),
            'total_fastest_laps': sum(s['fastest_laps'] for s in career_stats),
            'career_avg_finish': float(sum(s['average_finish'] * s['races'] for s in career_stats) / total_races) if total_races > 0 else 0.0,
            'by_season': career_stats
        }
        
        return career_totals
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
