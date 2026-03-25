from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
import fastf1
import pandas as pd
from app.services import f1_service

router = APIRouter()


@router.get("/drivers/{year}/{grand_prix}/{session_name}")
async def compare_drivers(
    year: int,
    grand_prix: str,
    session_name: str,
    drivers: str = Query(..., description="Comma-separated driver codes")
) -> Dict[str, Any]:
    """Compare multiple drivers in a specific session using vectorized operations"""
    try:
        driver_list = [d.strip() for d in drivers.split(',')]
        
        if len(driver_list) < 2:
            raise HTTPException(status_code=400, detail="At least 2 drivers required")
        
        # Load session with laps and results
        session = await f1_service.get_session(year, grand_prix, session_name, load_laps=True)
        
        comparison = []
        
        for driver in driver_list:
            try:
                driver_laps = session.laps.pick_driver(driver)
                
                if driver_laps.empty:
                    continue
                
                valid_laps = driver_laps[pd.notna(driver_laps['LapTime'])].copy()
                
                if valid_laps.empty:
                    continue
                
                # Vectorized time conversion
                valid_laps['lap_seconds'] = valid_laps['LapTime'].dt.total_seconds()
                
                fastest_lap_idx = valid_laps['LapTime'].idxmin()
                fastest_lap = valid_laps.loc[fastest_lap_idx]
                lap_times = valid_laps['lap_seconds']
                
                # Extract sector times if available
                sectors = {}
                for s in ['Sector1Time', 'Sector2Time', 'Sector3Time']:
                    if s in valid_laps.columns:
                        sec_times = valid_laps[s].dt.total_seconds()
                        if not sec_times.isna().all():
                            sectors[f"{s.lower().replace('time', '')}_best"] = float(sec_times.min())
                        else:
                            sectors[f"{s.lower().replace('time', '')}_best"] = None
                    else:
                        sectors[f"{s.lower().replace('time', '')}_best"] = None

                comparison.append({
                    'driver': driver,
                    'total_laps': len(valid_laps),
                    'fastest_lap': float(fastest_lap['lap_seconds']),
                    'average_lap': float(lap_times.mean()),
                    'median_lap': float(lap_times.median()),
                    'consistency': float(1 - (lap_times.std() / lap_times.mean())) if lap_times.mean() > 0 else 0,
                    'sectors': sectors
                })
            except Exception as e:
                print(f"Warning: Could not compare driver {driver}: {e}")
                continue
        
        return {'comparison': comparison}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teammates/{year}/{team}")
async def compare_teammates(year: int, team: str) -> Dict[str, Any]:
    """Compare teammates across a season with optimized session loading"""
    try:
        schedule = fastf1.get_event_schedule(year)
        completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()]
        
        teammate_stats = {}
        
        for _, event in completed_races.iterrows():
            try:
                race = fastf1.get_session(year, event['EventName'], 'Race')
                # Optimized load: skip laps/telemetry if only results are needed
                race.load(laps=False, telemetry=False, weather=False, messages=False)
                
                results = race.results
                if results is None or results.empty:
                    continue
                
                # Vectorized team filter
                team_results = results[results['TeamName'].str.contains(team, case=False, na=False)].copy()
                
                if team_results.empty:
                    continue

                for _, driver_row in team_results.iterrows():
                    driver_code = driver_row['Abbreviation']
                    
                    if driver_code not in teammate_stats:
                        teammate_stats[driver_code] = {
                            'driver': driver_code,
                            'name': driver_row.get('FullName', driver_code),
                            'races': 0,
                            'wins': 0,
                            'podiums': 0,
                            'points': 0.0,
                            'positions': [],
                            'head_to_head_wins': 0
                        }
                    
                    teammate_stats[driver_code]['races'] += 1
                    
                    pos = driver_row.get('Position')
                    if pd.notna(pos):
                        pos = int(pos)
                        teammate_stats[driver_code]['positions'].append(pos)
                        
                        if pos == 1: teammate_stats[driver_code]['wins'] += 1
                        if pos <= 3: teammate_stats[driver_code]['podiums'] += 1
                    
                    points = driver_row.get('Points', 0)
                    teammate_stats[driver_code]['points'] += float(points) if pd.notna(points) else 0.0
                
                # Vectorized head-to-head winner
                if len(team_results) >= 2:
                    valid_h2h = team_results[team_results['Position'].notna()]
                    if len(valid_h2h) >= 2:
                        winner_code = valid_h2h.loc[valid_h2h['Position'].idxmin(), 'Abbreviation']
                        teammate_stats[winner_code]['head_to_head_wins'] += 1
            
            except Exception as e:
                print(f"Warning: Error processing teammate comparison for {event['EventName']}: {e}")
                continue
        
        # Calculate final averages and cleanup
        comparison_list = []
        for code, stats in teammate_stats.items():
            avg_pos = sum(stats['positions']) / len(stats['positions']) if stats['positions'] else None
            del stats['positions']
            stats['average_position'] = float(avg_pos) if avg_pos is not None else None
            comparison_list.append(stats)
            
        return {
            'year': year,
            'team': team,
            'comparison': comparison_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/head-to-head/{year}/{driver1}/{driver2}")
async def head_to_head_comparison(year: int, driver1: str, driver2: str) -> Dict[str, Any]:
    """Detailed head-to-head comparison between two drivers with optimized loading"""
    try:
        schedule = fastf1.get_event_schedule(year)
        completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()]
        
        races_comparison = []
        summary = {
            'driver1_wins': 0,
            'driver2_wins': 0,
            'driver1_points': 0.0,
            'driver2_points': 0.0,
            'driver1_positions': [],
            'driver2_positions': []
        }
        
        for _, event in completed_races.iterrows():
            try:
                race = fastf1.get_session(year, event['EventName'], 'Race')
                race.load(laps=False, telemetry=False, weather=False, messages=False)
                
                results = race.results
                if results is None or results.empty:
                    continue
                
                d1_res = results[results['Abbreviation'] == driver1]
                d2_res = results[results['Abbreviation'] == driver2]
                
                if d1_res.empty or d2_res.empty:
                    continue
                
                row1 = d1_res.iloc[0]
                row2 = d2_res.iloc[0]
                
                p1, p2 = row1.get('Position'), row2.get('Position')
                pts1, pts2 = float(row1.get('Points', 0)), float(row2.get('Points', 0))
                
                race_comp = {
                    'grand_prix': event['EventName'],
                    'driver1_position': int(p1) if pd.notna(p1) else None,
                    'driver2_position': int(p2) if pd.notna(p2) else None,
                    'driver1_points': pts1,
                    'driver2_points': pts2,
                    'winner': None
                }
                
                if pd.notna(p1) and pd.notna(p2):
                    p1, p2 = int(p1), int(p2)
                    summary['driver1_positions'].append(p1)
                    summary['driver2_positions'].append(p2)
                    
                    if p1 < p2:
                        summary['driver1_wins'] += 1
                        race_comp['winner'] = driver1
                    elif p2 < p1:
                        summary['driver2_wins'] += 1
                        race_comp['winner'] = driver2
                
                summary['driver1_points'] += pts1
                summary['driver2_points'] += pts2
                races_comparison.append(race_comp)
            
            except Exception as e:
                print(f"Warning: Error in h2h for {event['EventName']}: {e}")
                continue
        
        # Final aggregation
        avg1 = sum(summary['driver1_positions']) / len(summary['driver1_positions']) if summary['driver1_positions'] else None
        avg2 = sum(summary['driver2_positions']) / len(summary['driver2_positions']) if summary['driver2_positions'] else None
        
        return {
            'driver1': driver1,
            'driver2': driver2,
            'year': year,
            'races': races_comparison,
            'summary': {
                'driver1_wins': summary['driver1_wins'],
                'driver2_wins': summary['driver2_wins'],
                'driver1_avg_position': float(avg1) if avg1 is not None else None,
                'driver2_avg_position': float(avg2) if avg2 is not None else None,
                'driver1_points': summary['driver1_points'],
                'driver2_points': summary['driver2_points']
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
