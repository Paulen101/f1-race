"""FastF1 data service"""
import fastf1
from fastapi import HTTPException
import pandas as pd
from typing import Optional, List, Dict, Any
from app.config import settings


class FastF1Service:
    """Service for fetching F1 data using FastF1"""
    
    def __init__(self):
        """Initialize FastF1 service with cache"""
        fastf1.Cache.enable_cache(settings.FASTF1_CACHE_DIR)
    
    async def get_session(self, year: int, grand_prix: str, session_name: str):
        """Get a specific session"""
        try:
            session = fastf1.get_session(year, grand_prix, session_name)
            session.load()
            return session
        except Exception as e:
            raise HTTPException(
                status_code=404,
                detail=f"Session not found: {str(e)}"
            )
    
    async def get_laps(self, year: int, grand_prix: str, session_name: str, driver: Optional[str] = None):
        """Get lap data for a session or specific driver"""
        try:
            session = await self.get_session(year, grand_prix, session_name)
            
            if driver:
                laps = session.laps.pick_driver(driver)
            else:
                laps = session.laps
            
            return laps
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching laps: {str(e)}"
            )
    
    async def get_telemetry(self, year: int, grand_prix: str, session_name: str, 
                           driver: str, lap_number: Optional[int] = None):
        """Get telemetry data for a driver"""
        try:
            session = await self.get_session(year, grand_prix, session_name)
            driver_laps = session.laps.pick_driver(driver)
            
            if lap_number:
                lap = driver_laps[driver_laps['LapNumber'] == lap_number].iloc[0]
            else:
                lap = driver_laps.pick_fastest()
            
            telemetry = lap.get_telemetry()
            return telemetry
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching telemetry: {str(e)}"
            )
    
    async def get_driver_standings(self, year: int):
        """Get driver standings for a season"""
        try:
            # Get all race results for the year
            schedule = fastf1.get_event_schedule(year)
            completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()]
            
            driver_points = {}
            
            for _, event in completed_races.iterrows():
                try:
                    race = fastf1.get_session(year, event['EventName'], 'Race')
                    race.load()
                    results = race.results
                    
                    for _, result in results.iterrows():
                        driver = result['Abbreviation']
                        points = result.get('Points', 0)
                        
                        if driver not in driver_points:
                            driver_points[driver] = {
                                'driver': driver,
                                'full_name': result.get('FullName', driver),
                                'team': result.get('TeamName', 'Unknown'),
                                'points': 0,
                                'wins': 0,
                                'podiums': 0
                            }
                        
                        driver_points[driver]['points'] += points
                        
                        if result.get('Position') == 1:
                            driver_points[driver]['wins'] += 1
                        if result.get('Position') <= 3:
                            driver_points[driver]['podiums'] += 1
                except:
                    continue
            
            # Sort by points
            standings = sorted(driver_points.values(), key=lambda x: x['points'], reverse=True)
            return standings
        
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching standings: {str(e)}"
            )
    
    async def get_weather_data(self, year: int, grand_prix: str, session_name: str):
        """Get weather data for a session"""
        try:
            session = await self.get_session(year, grand_prix, session_name)
            weather = session.weather_data
            return weather
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching weather data: {str(e)}"
            )
    
    async def compare_lap_telemetry(self, year: int, grand_prix: str, 
                                   session_name: str, driver1: str, driver2: str,
                                   lap_number: Optional[int] = None):
        """Compare telemetry between two drivers"""
        try:
            tel1 = await self.get_telemetry(year, grand_prix, session_name, driver1, lap_number)
            tel2 = await self.get_telemetry(year, grand_prix, session_name, driver2, lap_number)
            
            return {
                'driver1': {
                    'driver': driver1,
                    'telemetry': tel1.to_dict('records')
                },
                'driver2': {
                    'driver': driver2,
                    'telemetry': tel2.to_dict('records')
                }
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error comparing telemetry: {str(e)}"
            )
    
    async def get_pit_stops(self, year: int, grand_prix: str):
        """Get pit stop data for a race"""
        try:
            session = await self.get_session(year, grand_prix, 'Race')
            laps = session.laps
            
            # Identify pit stops
            pit_stops = []
            for driver in laps['Driver'].unique():
                driver_laps = laps[laps['Driver'] == driver]
                for idx in range(1, len(driver_laps)):
                    current = driver_laps.iloc[idx]
                    previous = driver_laps.iloc[idx - 1]
                    
                    if current['Compound'] != previous['Compound'] or current['TyreLife'] < previous['TyreLife']:
                        pit_stops.append({
                            'driver': driver,
                            'lap': int(current['LapNumber']),
                            'stop_duration': float(current['PitInTime'] - previous['PitOutTime']) if pd.notna(current['PitInTime']) else None,
                            'from_compound': previous['Compound'],
                            'to_compound': current['Compound']
                        })
            
            return pit_stops
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching pit stops: {str(e)}"
            )


# Singleton instance
f1_service = FastF1Service()
