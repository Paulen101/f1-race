"""Session endpoints"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List
import fastf1
import pandas as pd
from app.services import f1_service

router = APIRouter()


@router.get("/schedule/{year}")
async def get_season_schedule(year: int) -> Dict[str, Any]:
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
async def get_session_info(year: int, grand_prix: str, session_name: str) -> Dict[str, Any]:
    """Get information about a specific session with efficient driver identification"""
    try:
        session = await f1_service.get_session(year, grand_prix, session_name)
        
        # Get driver abbreviations - try multiple sources
        drivers = []
        
        # First try: results (most reliable when available)
        if hasattr(session, 'results') and session.results is not None and not session.results.empty:
            drivers = session.results['Abbreviation'].dropna().unique().tolist()
        
        # Second try: laps dataframe (check if it has Abbreviation column)
        if not drivers and not session.laps.empty:
            if 'Abbreviation' in session.laps.columns:
                drivers = session.laps['Abbreviation'].dropna().unique().tolist()
            else:
                # Third try: Use session.get_driver() to map numbers to abbreviations
                driver_numbers = session.laps['Driver'].unique()
                for drv_num in driver_numbers:
                    try:
                        drv_info = session.get_driver(drv_num)
                        if drv_info is not None and 'Abbreviation' in drv_info:
                            drivers.append(drv_info['Abbreviation'])
                    except:
                        drivers.append(str(drv_num))
        
        return {
            'year': year,
            'grand_prix': grand_prix,
            'session_name': session_name,
            'session_date': session.date.isoformat() if hasattr(session, 'date') and session.date else None,
            'total_laps': len(session.laps),
            'drivers': sorted(list(set(drivers))) if drivers else []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/{session_name}/results")
async def get_session_results(year: int, grand_prix: str, session_name: str) -> Dict[str, Any]:
    """Get session results using vectorized operations"""
    try:
        session = await f1_service.get_session(year, grand_prix, session_name)
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
