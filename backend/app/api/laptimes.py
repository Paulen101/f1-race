"""Lap time endpoints"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from app.services.fastf1_service import f1_service
import pandas as pd
import numpy as np

router = APIRouter()


@router.get("/{year}/{grand_prix}/{session_name}")
async def get_lap_times(
    year: int,
    grand_prix: str,
    session_name: str,
    driver: Optional[str] = None
) -> Dict[str, Any]:
    """Get lap times for a session or specific driver using vectorized operations"""
    try:
        laps = await f1_service.get_laps(year, grand_prix, session_name, driver)
        
        if laps.empty:
            return {'laps': []}
            
        # Filter out laps without LapTime
        laps_valid = laps[laps['LapTime'].notna()].copy()
        
        if laps_valid.empty:
            return {'laps': []}
            
        # Vectorized extraction of data
        laps_valid['lap_seconds'] = laps_valid['LapTime'].dt.total_seconds()
        laps_valid['s1_seconds'] = laps_valid['Sector1Time'].dt.total_seconds()
        laps_valid['s2_seconds'] = laps_valid['Sector2Time'].dt.total_seconds()
        laps_valid['s3_seconds'] = laps_valid['Sector3Time'].dt.total_seconds()
        
        # Build optimized response
        lap_data = laps_valid.apply(lambda lap: {
            'lap_number': int(lap['LapNumber']),
            'driver': lap['Driver'],
            'lap_time': float(lap['lap_seconds']),
            'sector1': float(lap['s1_seconds']) if pd.notna(lap['s1_seconds']) else None,
            'sector2': float(lap['s2_seconds']) if pd.notna(lap['s2_seconds']) else None,
            'sector3': float(lap['s3_seconds']) if pd.notna(lap['s3_seconds']) else None,
            'compound': lap.get('Compound'),
            'tire_life': int(lap.get('TyreLife', 0)) if pd.notna(lap.get('TyreLife')) else None,
            'is_personal_best': bool(lap.get('IsPersonalBest', False)),
            'track_status': lap.get('TrackStatus')
        }, axis=1).tolist()
        
        return {'laps': lap_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/{session_name}/fastest")
async def get_fastest_laps(year: int, grand_prix: str, session_name: str) -> Dict[str, Any]:
    """Get fastest lap for each driver in the session using vectorized operations"""
    try:
        laps = await f1_service.get_laps(year, grand_prix, session_name)
        
        if laps.empty:
            return {'fastest_laps': []}
            
        # Filter for valid lap times
        valid_laps = laps[laps['LapTime'].notna()].copy()
        
        if valid_laps.empty:
            return {'fastest_laps': []}
            
        # Group by driver and get index of minimum lap time
        fastest_indices = valid_laps.groupby('Driver')['LapTime'].idxmin()
        fastest_laps_df = valid_laps.loc[fastest_indices]
        
        # Build response
        fastest_laps = fastest_laps_df.apply(lambda lap: {
            'driver': lap['Driver'],
            'lap_number': int(lap['LapNumber']),
            'lap_time': lap['LapTime'].total_seconds(),
            'compound': lap.get('Compound')
        }, axis=1).tolist()
        
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
) -> Dict[str, Any]:
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


def _calculate_pace_trend(laps: pd.DataFrame) -> str:
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


def _analyze_stints(laps: pd.DataFrame) -> List[Dict[str, Any]]:
    """Analyze tire stints using vectorized operations"""
    if laps.empty:
        return []
        
    # Create StintID using vectorized comparison
    laps_copy = laps.copy()
    laps_copy['StintID'] = (laps_copy['Compound'] != laps_copy['Compound'].shift()).cumsum()
    
    # Group by StintID and Compound to aggregate
    stint_groups = laps_copy.groupby(['StintID', 'Compound'])
    
    # Calculate aggregations
    stints_data = stint_groups.agg(
        num_laps=('LapNumber', 'count'),
        average_time=('LapTime', lambda x: x.dt.total_seconds().mean() if not x.isna().all() else np.nan),
        fastest_time=('LapTime', lambda x: x.dt.total_seconds().min() if not x.isna().all() else np.nan)
    ).reset_index()
    
    # Convert to list of dicts
    result = []
    for _, row in stints_data.iterrows():
        result.append({
            'compound': row['Compound'],
            'num_laps': int(row['num_laps']),
            'average_time': float(row['average_time']) if pd.notna(row['average_time']) else None,
            'fastest_time': float(row['fastest_time']) if pd.notna(row['fastest_time']) else None
        })
        
    return result
