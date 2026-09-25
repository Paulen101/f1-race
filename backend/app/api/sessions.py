"""Session endpoints"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List
import fastf1
import pandas as pd
from app.services import f1_service

router = APIRouter()


@router.get("/schedule/{year}")
def get_season_schedule(year: int) -> Dict[str, Any]:
    """Get the race schedule for a specific year using vectorized operations"""
    try:
        schedule = fastf1.get_event_schedule(year)
        
        if schedule.empty:
            return {"year": year, "events": []}
            
        # Vectorized extraction of events
        events = schedule.apply(lambda event: {
            'round': int(event['RoundNumber']) if 'RoundNumber' in event else None,
            'grand_prix': event['EventName'],
            'country': event['Country'],
            'location': event['Location'],
            'date': event['EventDate'].isoformat() if pd.notna(event['EventDate']) else None,
            'official_name': event.get('OfficialEventName', event['EventName'])
        }, axis=1).tolist()
        
        return {"year": year, "events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/{session_name}")
def get_session_info(year: int, grand_prix: str, session_name: str) -> Dict[str, Any]:
    """
    Get information about a specific session.

    The pages call this to fill their driver dropdowns, so it loads only the
    session results (driver list), not the full lap timing data.
    """
    try:
        session = f1_service.get_session(year, grand_prix, session_name, load_laps=False)
        
        drivers = []
        total_laps = None
        results = getattr(session, 'results', None)
        if results is not None and not results.empty:
            drivers = results['Abbreviation'].dropna().unique().tolist()
            if 'Laps' in results.columns and results['Laps'].notna().any():
                total_laps = int(results['Laps'].max())
        
        # Fallback for sessions without a results table: derive drivers from laps
        if not drivers:
            session = f1_service.get_session(year, grand_prix, session_name, load_laps=True)
            if not session.laps.empty:
                drivers = session.laps['Driver'].dropna().unique().tolist()
                total_laps = int(session.laps['LapNumber'].max())
        
        return {
            'year': year,
            'grand_prix': grand_prix,
            'session_name': session_name,
            'session_date': session.date.isoformat() if getattr(session, 'date', None) is not None and pd.notna(session.date) else None,
            'total_laps': total_laps,
            'drivers': sorted(set(drivers))
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/{session_name}/results")
def get_session_results(year: int, grand_prix: str, session_name: str) -> Dict[str, Any]:
    """Get session results using vectorized operations"""
    try:
        session = f1_service.get_session(year, grand_prix, session_name)
        results = session.results
        
        if results is None or results.empty:
            return {"results": []}
        
        # Vectorized formatting of results
        formatted_results = results.apply(lambda row: {
            'position': int(row['Position']) if pd.notna(row.get('Position')) else None,
            'driver': row.get('Abbreviation', 'Unknown'),
            'driver_name': row.get('FullName', 'Unknown'),
            'team': row.get('TeamName', 'Unknown'),
            'time': str(row.get('Time')) if pd.notna(row.get('Time')) else None,
            'points': float(row.get('Points', 0)) if pd.notna(row.get('Points')) else 0,
            'status': row.get('Status', 'Unknown')
        }, axis=1).tolist()
        
        return {"results": formatted_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
