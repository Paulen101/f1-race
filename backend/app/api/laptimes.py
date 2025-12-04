"""Lap time endpoints"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.services import f1_service
import pandas as pd
import numpy as np

router = APIRouter()


@router.get("/{year}/{grand_prix}/{session_name}")
async def get_lap_times(
    year: int,
    grand_prix: str,
    session_name: str,
    driver: Optional[str] = None
):
    """Get lap times for a session or specific driver"""
    try:
        laps = await f1_service.get_laps(year, grand_prix, session_name, driver)
        
        lap_data = []
        for _, lap in laps.iterrows():
            if pd.notna(lap.get('LapTime')):
                lap_data.append({
                    'lap_number': int(lap['LapNumber']),
                    'driver': lap['Driver'],
                    'lap_time': lap['LapTime'].total_seconds() if pd.notna(lap['LapTime']) else None,
                    'sector1': lap['Sector1Time'].total_seconds() if pd.notna(lap.get('Sector1Time')) else None,
                    'sector2': lap['Sector2Time'].total_seconds() if pd.notna(lap.get('Sector2Time')) else None,
                    'sector3': lap['Sector3Time'].total_seconds() if pd.notna(lap.get('Sector3Time')) else None,
                    'compound': lap.get('Compound'),
                    'tire_life': int(lap.get('TyreLife', 0)) if pd.notna(lap.get('TyreLife')) else None,
                    'is_personal_best': bool(lap.get('IsPersonalBest', False)),
                    'track_status': lap.get('TrackStatus')
                })
        
        return {'laps': lap_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/{session_name}/fastest")
async def get_fastest_laps(year: int, grand_prix: str, session_name: str):
    """Get fastest lap for each driver in the session"""
    try:
        laps = await f1_service.get_laps(year, grand_prix, session_name)
        
        fastest_laps = []
        for driver in laps['Driver'].unique():
            driver_laps = laps[laps['Driver'] == driver]
            fastest = driver_laps.loc[driver_laps['LapTime'].idxmin()]
            
            if pd.notna(fastest.get('LapTime')):
                fastest_laps.append({
                    'driver': driver,
                    'lap_number': int(fastest['LapNumber']),
                    'lap_time': fastest['LapTime'].total_seconds(),
                    'compound': fastest.get('Compound')
                })
        
        # Sort by lap time
        fastest_laps = sorted(fastest_laps, key=lambda x: x['lap_time'])
        
        return {'fastest_laps': fastest_laps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/{session_name}/analysis")
async def get_lap_time_analysis(
    year: int,
    grand_prix: str,
    session_name: str,
    drivers: Optional[str] = Query(None, description="Comma-separated driver codes")
):
    """Get detailed lap time analysis including pace, consistency, and degradation"""
    try:
        laps = await f1_service.get_laps(year, grand_prix, session_name)
        
        if drivers:
            driver_list = [d.strip() for d in drivers.split(',')]
            laps = laps[laps['Driver'].isin(driver_list)]
        
        analysis = []
        
        for driver in laps['Driver'].unique():
            driver_laps = laps[laps['Driver'] == driver].copy()
            
            # Filter out invalid laps
            valid_laps = driver_laps[pd.notna(driver_laps['LapTime'])]
            
            if len(valid_laps) == 0:
                continue
            
            lap_times = valid_laps['LapTime'].dt.total_seconds()
            
            analysis.append({
                'driver': driver,
                'total_laps': len(valid_laps),
                'fastest_lap': float(lap_times.min()),
                'average_lap': float(lap_times.mean()),
                'median_lap': float(lap_times.median()),
                'std_deviation': float(lap_times.std()),
                'consistency_score': float(1 - (lap_times.std() / lap_times.mean())),  # Higher is better
                'pace_trend': _calculate_pace_trend(valid_laps),
                'stint_analysis': _analyze_stints(valid_laps)
            })
        
        return {'analysis': analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _calculate_pace_trend(laps):
    """Calculate pace trend (improving/degrading)"""
    if len(laps) < 5:
        return 'insufficient_data'
    
    lap_times = laps['LapTime'].dt.total_seconds().values
    lap_numbers = laps['LapNumber'].values
    
    # Simple linear regression
    coefficients = np.polyfit(lap_numbers, lap_times, 1)
    slope = coefficients[0]
    
    if abs(slope) < 0.01:
        return 'stable'
    elif slope > 0:
        return 'degrading'
    else:
        return 'improving'


def _analyze_stints(laps):
    """Analyze tire stints"""
    stints = []
    current_compound = None
    stint_laps = []
    
    for _, lap in laps.iterrows():
        compound = lap.get('Compound')
        
        if compound != current_compound and current_compound is not None:
            # Save previous stint
            if stint_laps:
                stint_lap_times = [l['LapTime'].total_seconds() for l in stint_laps if pd.notna(l['LapTime'])]
                if stint_lap_times:
                    stints.append({
                        'compound': current_compound,
                        'num_laps': len(stint_laps),
                        'average_time': float(np.mean(stint_lap_times)),
                        'fastest_time': float(np.min(stint_lap_times))
                    })
            stint_laps = []
        
        current_compound = compound
        stint_laps.append(lap)
    
    # Add final stint
    if stint_laps:
        stint_lap_times = [l['LapTime'].total_seconds() for l in stint_laps if pd.notna(l['LapTime'])]
        if stint_lap_times:
            stints.append({
                'compound': current_compound,
                'num_laps': len(stint_laps),
                'average_time': float(np.mean(stint_lap_times)),
                'fastest_time': float(np.min(stint_lap_times))
            })
    
    return stints
