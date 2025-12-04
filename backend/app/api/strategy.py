"""Strategy analysis endpoints"""
from fastapi import APIRouter, HTTPException
from app.services import f1_service
import pandas as pd
import numpy as np

router = APIRouter()


@router.get("/{year}/{grand_prix}/pitstops")
async def get_pit_stops(year: int, grand_prix: str):
    """Get pit stop analysis for a race"""
    try:
        pit_stops = await f1_service.get_pit_stops(year, grand_prix)
        return {'pit_stops': pit_stops}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/strategy")
async def get_race_strategy(year: int, grand_prix: str):
    """Get comprehensive strategy analysis for a race"""
    try:
        session = await f1_service.get_session(year, grand_prix, 'Race')
        laps = session.laps
        
        strategies = []
        
        for driver in laps['Driver'].unique():
            driver_laps = laps[laps['Driver'] == driver].copy()
            
            # Analyze stints
            stints = _analyze_driver_stints(driver_laps)
            
            # Get pit stop info
            pit_stops = []
            for i, stint in enumerate(stints[1:], 1):  # Skip first stint
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
async def get_tire_degradation(year: int, grand_prix: str, driver: str):
    """Analyze tire degradation for a specific driver"""
    try:
        laps = await f1_service.get_laps(year, grand_prix, 'Race', driver)
        
        degradation_data = []
        current_compound = None
        stint_data = []
        
        for _, lap in laps.iterrows():
            compound = lap.get('Compound')
            tire_life = lap.get('TyreLife')
            lap_time = lap.get('LapTime')
            
            if pd.notna(lap_time):
                if compound != current_compound and stint_data:
                    # Process previous stint
                    deg = _calculate_degradation(stint_data)
                    if deg:
                        degradation_data.append(deg)
                    stint_data = []
                    current_compound = compound
                
                if compound is None:
                    continue
                    
                stint_data.append({
                    'tire_life': int(tire_life) if pd.notna(tire_life) else 0,
                    'lap_time': lap_time.total_seconds(),
                    'compound': compound
                })
        
        # Process final stint
        if stint_data:
            deg = _calculate_degradation(stint_data)
            if deg:
                degradation_data.append(deg)
        
        return {'driver': driver, 'degradation': degradation_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _analyze_driver_stints(driver_laps):
    """Analyze tire stints for a driver"""
    stints = []
    current_compound = None
    stint_laps = []
    
    for _, lap in driver_laps.iterrows():
        compound = lap.get('Compound')
        
        if compound != current_compound and current_compound is not None:
            # Save previous stint
            if stint_laps:
                valid_times = [l['LapTime'].total_seconds() for l in stint_laps 
                              if pd.notna(l.get('LapTime'))]
                
                if valid_times:
                    stints.append({
                        'compound': current_compound,
                        'start_lap': stint_laps[0]['LapNumber'],
                        'end_lap': stint_laps[-1]['LapNumber'],
                        'num_laps': len(stint_laps),
                        'fastest_lap': float(min(valid_times)),
                        'average_lap': float(np.mean(valid_times)),
                        'degradation_rate': _calculate_stint_degradation(stint_laps)
                    })
            stint_laps = []
        
        current_compound = compound
        stint_laps.append(lap)
    
    # Add final stint
    if stint_laps:
        valid_times = [l['LapTime'].total_seconds() for l in stint_laps 
                      if pd.notna(l.get('LapTime'))]
        if valid_times:
            stints.append({
                'compound': current_compound,
                'start_lap': stint_laps[0]['LapNumber'],
                'end_lap': stint_laps[-1]['LapNumber'],
                'num_laps': len(stint_laps),
                'fastest_lap': float(min(valid_times)),
                'average_lap': float(np.mean(valid_times)),
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
