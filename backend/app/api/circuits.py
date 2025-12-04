"""Circuit endpoints"""
from fastapi import APIRouter, HTTPException
import fastf1
import pandas as pd

router = APIRouter()


@router.get("/{year}/{circuit}/info")
async def get_circuit_info(year: int, circuit: str):
    """Get circuit information and characteristics"""
    try:
        # Get a race session to extract circuit info
        session = fastf1.get_session(year, circuit, 'Race')
        session.load()
        
        event = session.event
        
        circuit_info = {
            'name': event.get('EventName'),
            'location': event.get('Location'),
            'country': event.get('Country'),
            'circuit_name': event.get('OfficialEventName'),
            'date': event.get('EventDate').isoformat() if pd.notna(event.get('EventDate')) else None,
            'num_laps': len(session.laps['LapNumber'].unique()) if not session.laps.empty else None,
        }
        
        # Get fastest lap as lap record indicator
        if not session.laps.empty:
            fastest_lap = session.laps.loc[session.laps['LapTime'].idxmin()]
            circuit_info['session_fastest_lap'] = {
                'driver': fastest_lap['Driver'],
                'time': fastest_lap['LapTime'].total_seconds() if pd.notna(fastest_lap['LapTime']) else None
            }
        
        return circuit_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{circuit}/history")
async def get_circuit_history(circuit: str, start_year: int = 2018, end_year: int = 2024):
    """Get historical race results for a circuit"""
    try:
        history = []
        
        for year in range(start_year, end_year + 1):
            try:
                session = fastf1.get_session(year, circuit, 'Race')
                session.load()
                
                results = session.results
                if results is not None and not results.empty:
                    # Get podium
                    podium = results.nsmallest(3, 'Position')
                    
                    race_result = {
                        'year': year,
                        'winner': podium.iloc[0]['Abbreviation'] if len(podium) > 0 else None,
                        'podium': podium['Abbreviation'].tolist(),
                        'pole_position': None,  # Will be filled from qualifying
                        'fastest_lap': None
                    }
                    
                    # Get qualifying winner
                    try:
                        quali = fastf1.get_session(year, circuit, 'Qualifying')
                        quali.load()
                        if quali.results is not None and not quali.results.empty:
                            pole = quali.results.loc[quali.results['Position'].idxmin()]
                            race_result['pole_position'] = pole['Abbreviation']
                    except:
                        pass
                    
                    # Get fastest lap
                    laps = session.laps
                    if not laps.empty:
                        fastest = laps.loc[laps['LapTime'].idxmin()]
                        race_result['fastest_lap'] = {
                            'driver': fastest['Driver'],
                            'time': fastest['LapTime'].total_seconds() if pd.notna(fastest['LapTime']) else None
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
async def get_circuit_statistics(year: int, circuit: str):
    """Get detailed circuit statistics for a specific race"""
    try:
        session = fastf1.get_session(year, circuit, 'Race')
        session.load()
        
        laps = session.laps
        
        if laps.empty:
            raise HTTPException(status_code=404, detail="No lap data available")
        
        # Calculate statistics
        valid_laps = laps[pd.notna(laps['LapTime'])]
        
        stats = {
            'total_laps': len(laps),
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
            fastest = valid_laps.loc[valid_laps['LapTime'].idxmin()]
            stats['fastest_lap'] = {
                'driver': fastest['Driver'],
                'time': fastest['LapTime'].total_seconds(),
                'lap_number': int(fastest['LapNumber'])
            }
        
        # Count pit stops (simplified - look for tire changes)
        for driver in laps['Driver'].unique():
            driver_laps = laps[laps['Driver'] == driver]
            compound_changes = (driver_laps['Compound'].shift() != driver_laps['Compound']).sum()
            stats['total_pit_stops'] += max(0, compound_changes - 1)
        
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
