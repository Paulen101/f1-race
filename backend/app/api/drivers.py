"""Driver endpoints"""
from fastapi import APIRouter, HTTPException
from app.services import f1_service
import fastf1
import pandas as pd

router = APIRouter()


@router.get("/standings/{year}")
async def get_driver_standings(year: int):
    """Get driver championship standings"""
    try:
        standings = await f1_service.get_driver_standings(year)
        return {'year': year, 'standings': standings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{driver}/stats")
async def get_driver_season_stats(year: int, driver: str):
    """Get comprehensive statistics for a driver in a season"""
    try:
        schedule = fastf1.get_event_schedule(year)
        completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()]
        
        stats = {
            'driver': driver,
            'year': year,
            'races': 0,
            'wins': 0,
            'podiums': 0,
            'points': 0,
            'dnf': 0,
            'pole_positions': 0,
            'fastest_laps': 0,
            'average_finish': 0,
            'best_finish': None,
            'worst_finish': None
        }
        
        positions = []
        
        for _, event in completed_races.iterrows():
            try:
                # Check qualifying for pole positions
                quali = fastf1.get_session(year, event['EventName'], 'Qualifying')
                quali.load()
                quali_results = quali.results
                
                if quali_results is not None and not quali_results.empty:
                    driver_quali = quali_results[quali_results['Abbreviation'] == driver]
                    if not driver_quali.empty and driver_quali.iloc[0].get('Position') == 1:
                        stats['pole_positions'] += 1
                
                # Check race results
                race = fastf1.get_session(year, event['EventName'], 'Race')
                race.load()
                race_results = race.results
                
                if race_results is not None and not race_results.empty:
                    driver_result = race_results[race_results['Abbreviation'] == driver]
                    
                    if not driver_result.empty:
                        result = driver_result.iloc[0]
                        stats['races'] += 1
                        
                        position = result.get('Position')
                        if pd.notna(position):
                            position = int(position)
                            positions.append(position)
                            
                            if position == 1:
                                stats['wins'] += 1
                            if position <= 3:
                                stats['podiums'] += 1
                            
                            if stats['best_finish'] is None or position < stats['best_finish']:
                                stats['best_finish'] = position
                            if stats['worst_finish'] is None or position > stats['worst_finish']:
                                stats['worst_finish'] = position
                        else:
                            stats['dnf'] += 1
                        
                        points = result.get('Points', 0)
                        if pd.notna(points):
                            stats['points'] += float(points)
                        
                        # Check for fastest lap
                        laps = race.laps
                        if not laps.empty:
                            fastest_driver = laps.loc[laps['LapTime'].idxmin(), 'Driver']
                            if fastest_driver == driver:
                                stats['fastest_laps'] += 1
            except:
                continue
        
        if positions:
            stats['average_finish'] = sum(positions) / len(positions)
        
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{driver}/career")
async def get_driver_career_stats(driver: str, start_year: int = 2018, end_year: int = 2024):
    """Get career statistics for a driver across multiple seasons"""
    try:
        career_stats = []
        
        for year in range(start_year, end_year + 1):
            try:
                year_stats = await get_driver_season_stats(year, driver)
                career_stats.append(year_stats)
            except:
                continue
        
        # Aggregate career totals
        career_totals = {
            'driver': driver,
            'years': len(career_stats),
            'total_races': sum(s['races'] for s in career_stats),
            'total_wins': sum(s['wins'] for s in career_stats),
            'total_podiums': sum(s['podiums'] for s in career_stats),
            'total_points': sum(s['points'] for s in career_stats),
            'total_poles': sum(s['pole_positions'] for s in career_stats),
            'total_fastest_laps': sum(s['fastest_laps'] for s in career_stats),
            'career_avg_finish': sum(s['average_finish'] * s['races'] for s in career_stats if s['races'] > 0) / 
                                sum(s['races'] for s in career_stats) if sum(s['races'] for s in career_stats) > 0 else 0,
            'by_season': career_stats
        }
        
        return career_totals
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
