"""Strategy analysis endpoints"""
from fastapi import APIRouter, HTTPException
from app.services import f1_service
from app.utils.data_utils import assign_stints, stint_compound
import pandas as pd
import numpy as np

router = APIRouter()


@router.get("/{year}/{grand_prix}/pitstops")
def get_pit_stops(year: int, grand_prix: str):
    """Get pit stop analysis for a race"""
    try:
        pit_stops = f1_service.get_pit_stops(year, grand_prix)
        return {'pit_stops': pit_stops}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/strategy")
def get_race_strategy(year: int, grand_prix: str):
    """Get comprehensive strategy analysis for a race"""
    try:
        session = f1_service.get_session(year, grand_prix, 'Race')
        laps = session.laps
        
        strategies = []
        
        for driver in laps['Driver'].unique():
            driver_laps = laps[laps['Driver'] == driver].copy()
            
            # Analyze stints
            stints = _analyze_driver_stints(driver_laps)
            
            # Every stint after the first began with a pit stop
            pit_stops = []
            for i, stint in enumerate(stints[1:], 1):
                pit_stops.append({
                    'lap': stint['start_lap'],
                    'from_compound': stints[i-1]['compound'],
                    'to_compound': stint['compound']
                })
            
            strategies.append({
                'driver': driver,
                'stints': stints,
                'pit_stops': pit_stops,
                'num_stops': len(pit_stops),
                'compounds_used': list(set(s['compound'] for s in stints if s['compound']))
            })
        
        return {'strategies': strategies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/tire-degradation")
def get_tire_degradation(year: int, grand_prix: str, driver: str):
    """Analyze tire degradation for a specific driver"""
    try:
        laps = f1_service.get_laps(year, grand_prix, 'Race', driver)
        
        degradation_data = []
        if laps.empty:
            return {'driver': driver, 'degradation': degradation_data}
        
        laps = laps.sort_values('LapNumber').copy()
        laps['StintID'] = assign_stints(laps)
        
        for _, stint_laps in laps.groupby('StintID', sort=True):
            compound = stint_compound(stint_laps['Compound'])
            if compound is None:
                continue
            
            timed = stint_laps[stint_laps['LapTime'].notna()]
            stint_data = [{
                'tire_life': int(lap['TyreLife']) if pd.notna(lap.get('TyreLife')) else 0,
                'lap_time': lap['LapTime'].total_seconds(),
                'compound': compound
            } for _, lap in timed.iterrows()]
            
            deg = _calculate_degradation(stint_data)
            if deg:
                degradation_data.append(deg)
        
        return {'driver': driver, 'degradation': degradation_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _analyze_driver_stints(driver_laps):
    """Analyze tire stints for a driver"""
    if driver_laps.empty:
        return []
    
    driver_laps = driver_laps.sort_values('LapNumber').copy()
    driver_laps['StintID'] = assign_stints(driver_laps)
    
    stints = []
    for _, stint in driver_laps.groupby('StintID', sort=True):
        stint_laps = [lap for _, lap in stint.iterrows()]
        valid_times = [l['LapTime'].total_seconds() for l in stint_laps
                       if pd.notna(l.get('LapTime'))]
        
        stints.append({
            'compound': stint_compound(stint['Compound']),
            'start_lap': int(stint['LapNumber'].min()),
            'end_lap': int(stint['LapNumber'].max()),
            'num_laps': len(stint_laps),
            'fastest_lap': float(min(valid_times)) if valid_times else None,
            'average_lap': float(np.mean(valid_times)) if valid_times else None,
            'degradation_rate': _calculate_stint_degradation(stint_laps)
        })
    
    return stints


def _calculate_stint_degradation(stint_laps):
    """Calculate degradation rate for a stint"""
    valid_laps = [l for l in stint_laps if pd.notna(l.get('LapTime'))]
    
    if len(valid_laps) < 3:
        return 0.0
    
    lap_times = [l['LapTime'].total_seconds() for l in valid_laps]
    
    # Simple linear regression to find degradation rate
    x = np.arange(len(lap_times))
    coefficients = np.polyfit(x, lap_times, 1)
    
    return float(coefficients[0])  # Slope represents degradation per lap


def _calculate_degradation(stint_data):
    """Calculate overall degradation for a stint"""
    if len(stint_data) < 3:
        return None
    
    lap_times = [d['lap_time'] for d in stint_data]
    tire_lives = [d['tire_life'] for d in stint_data]
    
    # Calculate degradation rate (seconds per lap of tire life)
    coefficients = np.polyfit(tire_lives, lap_times, 1)
    
    return {
        'compound': stint_data[0]['compound'],
        'degradation_rate': float(coefficients[0]),
        'base_pace': float(coefficients[1]),
        'num_laps': len(stint_data),
        'total_degradation': float(max(lap_times) - min(lap_times))
    }
