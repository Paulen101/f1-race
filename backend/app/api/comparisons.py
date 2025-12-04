"""Driver and team comparison endpoints"""
from fastapi import APIRouter, HTTPException, Query
from app.services import f1_service
import fastf1
import pandas as pd
import numpy as np

router = APIRouter()


@router.get("/drivers/{year}/{grand_prix}/{session_name}")
async def compare_drivers(
    year: int,
    grand_prix: str,
    session_name: str,
    drivers: str = Query(..., description="Comma-separated driver codes")
):
    """Compare multiple drivers in a specific session"""
    try:
        driver_list = [d.strip() for d in drivers.split(',')]
        
        if len(driver_list) < 2:
            raise HTTPException(status_code=400, detail="At least 2 drivers required")
        
        session = await f1_service.get_session(year, grand_prix, session_name)
        
        comparison = []
        
        for driver in driver_list:
            driver_laps = session.laps.pick_driver(driver)
            
            if driver_laps.empty:
                continue
            
            valid_laps = driver_laps[pd.notna(driver_laps['LapTime'])]
            
            if valid_laps.empty:
                continue
            
            fastest_lap = valid_laps.loc[valid_laps['LapTime'].idxmin()]
            lap_times = valid_laps['LapTime'].dt.total_seconds()
            
            comparison.append({
                'driver': driver,
                'total_laps': len(valid_laps),
                'fastest_lap': float(fastest_lap['LapTime'].total_seconds()),
                'average_lap': float(lap_times.mean()),
                'median_lap': float(lap_times.median()),
                'consistency': float(1 - (lap_times.std() / lap_times.mean())) if lap_times.mean() > 0 else 0,
                'sectors': {
                    'sector1_best': float(valid_laps['Sector1Time'].dt.total_seconds().min()) 
                        if 'Sector1Time' in valid_laps.columns and not valid_laps['Sector1Time'].isna().all() else None,
                    'sector2_best': float(valid_laps['Sector2Time'].dt.total_seconds().min()) 
                        if 'Sector2Time' in valid_laps.columns and not valid_laps['Sector2Time'].isna().all() else None,
                    'sector3_best': float(valid_laps['Sector3Time'].dt.total_seconds().min()) 
                        if 'Sector3Time' in valid_laps.columns and not valid_laps['Sector3Time'].isna().all() else None,
                }
            })
        
        return {'comparison': comparison}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teammates/{year}/{team}")
async def compare_teammates(year: int, team: str):
    """Compare teammates across a season"""
    try:
        schedule = fastf1.get_event_schedule(year)
        completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()]
        
        teammate_stats = {}
        
        for _, event in completed_races.iterrows():
            try:
                race = fastf1.get_session(year, event['EventName'], 'Race')
                race.load()
                
                results = race.results
                if results is None or results.empty:
                    continue
                
                team_results = results[results['TeamName'].str.contains(team, case=False, na=False)]
                
                for _, driver in team_results.iterrows():
                    driver_code = driver['Abbreviation']
                    
                    if driver_code not in teammate_stats:
                        teammate_stats[driver_code] = {
                            'driver': driver_code,
                            'name': driver.get('FullName', driver_code),
                            'races': 0,
                            'wins': 0,
                            'podiums': 0,
                            'points': 0,
                            'average_position': [],
                            'head_to_head_wins': 0
                        }
                    
                    teammate_stats[driver_code]['races'] += 1
                    
                    position = driver.get('Position')
                    if pd.notna(position):
                        position = int(position)
                        teammate_stats[driver_code]['average_position'].append(position)
                        
                        if position == 1:
                            teammate_stats[driver_code]['wins'] += 1
                        if position <= 3:
                            teammate_stats[driver_code]['podiums'] += 1
                    
                    points = driver.get('Points', 0)
                    if pd.notna(points):
                        teammate_stats[driver_code]['points'] += float(points)
                
                # Determine head-to-head winner for this race
                if len(team_results) == 2:
                    positions = team_results['Position'].tolist()
                    if all(pd.notna(p) for p in positions):
                        winner_idx = team_results['Position'].idxmin()
                        winner_code = team_results.loc[winner_idx, 'Abbreviation']
                        teammate_stats[winner_code]['head_to_head_wins'] += 1
            
            except:
                continue
        
        # Calculate averages
        for driver_code in teammate_stats:
            positions = teammate_stats[driver_code]['average_position']
            if positions:
                teammate_stats[driver_code]['average_position'] = sum(positions) / len(positions)
            else:
                teammate_stats[driver_code]['average_position'] = None
        
        return {
            'year': year,
            'team': team,
            'comparison': list(teammate_stats.values())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/head-to-head/{year}/{driver1}/{driver2}")
async def head_to_head_comparison(year: int, driver1: str, driver2: str):
    """Detailed head-to-head comparison between two drivers"""
    try:
        schedule = fastf1.get_event_schedule(year)
        completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()]
        
        comparison = {
            'driver1': driver1,
            'driver2': driver2,
            'year': year,
            'races': [],
            'summary': {
                'driver1_wins': 0,
                'driver2_wins': 0,
                'driver1_avg_position': [],
                'driver2_avg_position': [],
                'driver1_points': 0,
                'driver2_points': 0
            }
        }
        
        for _, event in completed_races.iterrows():
            try:
                race = fastf1.get_session(year, event['EventName'], 'Race')
                race.load()
                
                results = race.results
                if results is None or results.empty:
                    continue
                
                d1_result = results[results['Abbreviation'] == driver1]
                d2_result = results[results['Abbreviation'] == driver2]
                
                if d1_result.empty or d2_result.empty:
                    continue
                
                d1_pos = d1_result.iloc[0].get('Position')
                d2_pos = d2_result.iloc[0].get('Position')
                
                d1_points = d1_result.iloc[0].get('Points', 0)
                d2_points = d2_result.iloc[0].get('Points', 0)
                
                race_comparison = {
                    'grand_prix': event['EventName'],
                    'driver1_position': int(d1_pos) if pd.notna(d1_pos) else None,
                    'driver2_position': int(d2_pos) if pd.notna(d2_pos) else None,
                    'driver1_points': float(d1_points) if pd.notna(d1_points) else 0,
                    'driver2_points': float(d2_points) if pd.notna(d2_points) else 0,
                    'winner': None
                }
                
                if pd.notna(d1_pos) and pd.notna(d2_pos):
                    d1_pos = int(d1_pos)
                    d2_pos = int(d2_pos)
                    
                    comparison['summary']['driver1_avg_position'].append(d1_pos)
                    comparison['summary']['driver2_avg_position'].append(d2_pos)
                    
                    if d1_pos < d2_pos:
                        comparison['summary']['driver1_wins'] += 1
                        race_comparison['winner'] = driver1
                    elif d2_pos < d1_pos:
                        comparison['summary']['driver2_wins'] += 1
                        race_comparison['winner'] = driver2
                
                comparison['summary']['driver1_points'] += float(d1_points) if pd.notna(d1_points) else 0
                comparison['summary']['driver2_points'] += float(d2_points) if pd.notna(d2_points) else 0
                
                comparison['races'].append(race_comparison)
            
            except:
                continue
        
        # Calculate average positions
        if comparison['summary']['driver1_avg_position']:
            comparison['summary']['driver1_avg_position'] = sum(comparison['summary']['driver1_avg_position']) / \
                                                            len(comparison['summary']['driver1_avg_position'])
        else:
            comparison['summary']['driver1_avg_position'] = None
        
        if comparison['summary']['driver2_avg_position']:
            comparison['summary']['driver2_avg_position'] = sum(comparison['summary']['driver2_avg_position']) / \
                                                            len(comparison['summary']['driver2_avg_position'])
        else:
            comparison['summary']['driver2_avg_position'] = None
        
        return comparison
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
