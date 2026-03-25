from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
import fastf1
import pandas as pd

router = APIRouter()


@router.get("/{year}/{circuit}/info")
async def get_circuit_info(year: int, circuit: str) -> Dict[str, Any]:
    """Get circuit information and characteristics efficiently"""
    try:
        # Get a race session to extract circuit info
        session = fastf1.get_session(year, circuit, 'Race')
        # Optimized load: skip telemetry, weather, messages
        session.load(telemetry=False, weather=False, messages=False)
        
        event = session.event
        
        circuit_info = {
            'name': event.get('EventName'),
            'location': event.get('Location'),
            'country': event.get('Country'),
            'circuit_name': event.get('OfficialEventName'),
            'date': event.get('EventDate').isoformat() if pd.notna(event.get('EventDate')) else None,
            'num_laps': int(session.laps['LapNumber'].max()) if not session.laps.empty else None,
        }
        
        # Get fastest lap as lap record indicator
        if not session.laps.empty:
            valid_laps = session.laps[session.laps['LapTime'].notna()]
            if not valid_laps.empty:
                fastest_lap = valid_laps.loc[valid_laps['LapTime'].idxmin()]
                circuit_info['session_fastest_lap'] = {
                    'driver': fastest_lap['Driver'],
                    'time': fastest_lap['LapTime'].total_seconds()
                }
        
        return circuit_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{circuit}/history")
async def get_circuit_history(circuit: str, start_year: int = 2018, end_year: int = 2024) -> Dict[str, Any]:
    """Get historical race results for a circuit with optimized loading"""
    try:
        history = []
        
        for year in range(start_year, end_year + 1):
            try:
                session = fastf1.get_session(year, circuit, 'Race')
                # ONLY load necessary data for summary
                session.load(telemetry=False, weather=False, messages=False)
                
                results = session.results
                if results is not None and not results.empty:
                    # Get podium
                    podium = results.nsmallest(3, 'Position')
                    
                    race_result = {
                        'year': year,
                        'winner': podium.iloc[0]['Abbreviation'] if len(podium) > 0 else None,
                        'podium': podium['Abbreviation'].tolist(),
                        'pole_position': None,
                        'fastest_lap': None
                    }
                    
                    # Get qualifying winner (pole)
                    try:
                        quali = fastf1.get_session(year, circuit, 'Qualifying')
                        quali.load(laps=False, telemetry=False, weather=False, messages=False)
                        if quali.results is not None and not quali.results.empty:
                            pole_idx = quali.results['Position'].idxmin()
                            race_result['pole_position'] = quali.results.loc[pole_idx, 'Abbreviation']
                    except:
                        pass
                    
                    # Get fastest lap using vectorized min on laps
                    if not session.laps.empty:
                        valid_laps = session.laps[session.laps['LapTime'].notna()]
                        if not valid_laps.empty:
                            fastest_idx = valid_laps['LapTime'].idxmin()
                            fastest = valid_laps.loc[fastest_idx]
                            race_result['fastest_lap'] = {
                                'driver': fastest['Driver'],
                                'time': fastest['LapTime'].total_seconds()
                            }
                    
                    history.append(race_result)
            except:
                continue
        
        return {
            'circuit': circuit,
            'history': history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{circuit}/statistics")
async def get_circuit_statistics(year: int, circuit: str) -> Dict[str, Any]:
    """Get detailed circuit statistics using vectorized operations"""
    try:
        session = fastf1.get_session(year, circuit, 'Race')
        # Optimized load
        session.load(telemetry=False, weather=False, messages=False)
        
        laps = session.laps
        
        if laps.empty:
            raise HTTPException(status_code=404, detail="No lap data available")
        
        # Calculate statistics
        valid_laps = laps[pd.notna(laps['LapTime'])].copy()
        
        stats = {
            'total_laps': int(laps['LapNumber'].max()) if not laps.empty else 0,
            'total_valid_laps': len(valid_laps),
            'fastest_lap': {
                'driver': None,
                'time': None,
                'lap_number': None
            },
            'average_lap_time': float(valid_laps['LapTime'].dt.total_seconds().mean()) if not valid_laps.empty else None,
            'compounds_used': laps['Compound'].dropna().unique().tolist(),
            'total_pit_stops': 0,
            'safety_car_periods': 0
        }
        
        # Fastest lap
        if not valid_laps.empty:
            fastest_idx = valid_laps['LapTime'].idxmin()
            fastest = valid_laps.loc[fastest_idx]
            stats['fastest_lap'] = {
                'driver': fastest['Driver'],
                'time': float(fastest['LapTime'].total_seconds()),
                'lap_number': int(fastest['LapNumber'])
            }
        
        # Vectorized pit stop calculation
        if not laps.empty:
            # Shift within each driver group
            laps_sorted = laps.sort_values(['Driver', 'LapNumber'])
            laps_sorted['PrevCompound'] = laps_sorted.groupby('Driver')['Compound'].shift(1)
            
            # Count where Compound != PrevCompound (excluding the very first lap of each driver)
            is_pit_stop = (laps_sorted['Compound'] != laps_sorted['PrevCompound']) & laps_sorted['PrevCompound'].notna()
            stats['total_pit_stops'] = int(is_pit_stop.sum())
        
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
