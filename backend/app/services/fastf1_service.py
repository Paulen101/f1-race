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
    
    async def get_session(self, year: int, grand_prix: str, session_name: str, load_laps: bool = True, load_telemetry: bool = False) -> fastf1.core.Session:
        """Get a specific session - optimized to only load what's needed"""
        try:
            print(f"Loading session: {year} {grand_prix} {session_name}")
            session = fastf1.get_session(year, grand_prix, session_name)
            # Only load what we need - MUCH faster!
            session.load(laps=load_laps, telemetry=load_telemetry, weather=False, messages=False)
            print(f"Session loaded successfully")
            return session
        except Exception as e:
            print(f"Error loading session: {type(e).__name__}: {str(e)}")
            raise HTTPException(
                status_code=404,
                detail=f"Session not found for {year} {grand_prix} {session_name}: {str(e)}"
            )
    
    async def get_laps(self, year: int, grand_prix: str, session_name: str, driver: Optional[str] = None) -> fastf1.core.Laps:
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
                           driver: str, lap_number: Optional[int] = None) -> pd.DataFrame:
        """Get telemetry data for a driver"""
        try:
            # For telemetry we NEED to load it
            session = await self.get_session(year, grand_prix, session_name, load_laps=True, load_telemetry=True)
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
    
    def get_telemetry_sync(self, year: int, grand_prix: str, session_name: str, 
                          driver: str, lap_number: Optional[int] = None) -> pd.DataFrame:
        """
        Synchronous version of get_telemetry for FastAPI thread pool execution.
        
        FastF1 operations are blocking/CPU-intensive. By using standard 'def' instead
        of 'async def', FastAPI automatically runs this in a thread pool, preventing
        the event loop from blocking.
        """
        try:
            print(f"Loading telemetry: {year} {grand_prix} {session_name} - {driver}")
            session = fastf1.get_session(year, grand_prix, session_name)
            # Load telemetry data
            session.load(laps=True, telemetry=True, weather=False, messages=False)
            
            # Try to pick driver - FastF1's pick_driver handles abbreviations automatically
            try:
                driver_laps = session.laps.pick_driver(driver)
                print(f"Found driver {driver} using pick_driver, {len(driver_laps)} laps")
            except Exception as e:
                print(f"pick_driver failed for {driver}: {str(e)}")
                # Fallback: try to map abbreviation to driver number using driver info
                driver_number = None
                
                # Try checking laps dataframe for any lap with matching abbreviation
                if not session.laps.empty and 'Abbreviation' in session.laps.columns:
                    matching_laps = session.laps[session.laps['Abbreviation'] == driver]
                    if not matching_laps.empty:
                        driver_number = matching_laps.iloc[0]['Driver']
                        print(f"Found driver {driver} in laps with number {driver_number} (type: {type(driver_number)})")
                
                # Try using session.get_driver() API
                if driver_number is None and hasattr(session, 'drivers') and session.drivers is not None:
                    for drv in session.drivers:
                        try:
                            drv_info = session.get_driver(drv)
                            if drv_info is not None:
                                # drv_info is a pandas Series, access like a dict
                                if isinstance(drv_info, pd.Series) and 'Abbreviation' in drv_info:
                                    if drv_info['Abbreviation'] == driver:
                                        driver_number = drv
                                        print(f"Found driver {driver} via get_driver with number {driver_number} (type: {type(driver_number)})")
                                        break
                        except Exception as ex:
                            print(f"Error checking driver {drv}: {str(ex)}")
                            continue
                    
                if driver_number is None:
                    available = []
                    if hasattr(session, 'drivers'):
                        available = list(session.drivers)
                    elif 'Driver' in session.laps.columns:
                        available = session.laps['Driver'].unique().tolist()
                    raise ValueError(f"Driver {driver} not found in session. Available: {available}")
                
                # Filter by driver number - ensure type matching
                print(f"Filtering laps for driver_number={driver_number}, Driver column type: {session.laps['Driver'].dtype}")
                driver_laps = session.laps[session.laps['Driver'] == driver_number]
                print(f"After filtering: {len(driver_laps)} laps found")
            
            if driver_laps.empty:
                raise ValueError(f"No laps found for driver {driver}")
            
            print(f"Total laps for {driver}: {len(driver_laps)}")
            
            if lap_number:
                matching_lap = driver_laps[driver_laps['LapNumber'] == lap_number]
                if matching_lap.empty:
                    raise ValueError(f"Lap {lap_number} not found for driver {driver}")
                lap = matching_lap.iloc[0]
            else:
                # Pick fastest lap - filter out invalid laps first
                valid_laps = driver_laps[pd.notna(driver_laps['LapTime'])]
                if valid_laps.empty:
                    raise ValueError(f"No valid timed laps found for driver {driver}")
                print(f"Valid laps for {driver}: {len(valid_laps)}")
                lap = valid_laps.pick_fastest()
            
            print(f"Getting telemetry for {driver} lap {lap['LapNumber']}...")
            telemetry = lap.get_telemetry()
            print(f"Telemetry loaded: {len(telemetry)} data points")
            return telemetry
        except Exception as e:
            import traceback
            print(f"Error loading telemetry: {str(e)}")
            print(traceback.format_exc())
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching telemetry: {str(e)}"
            )
    
    async def get_driver_standings(self, year: int) -> List[Dict[str, Any]]:
        """Get driver standings for a season - optimized version"""
        try:
            # Get all race results for the year
            schedule = fastf1.get_event_schedule(year)
            completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()]
            
            driver_points = {}
            
            for _, event in completed_races.iterrows():
                try:
                    race = fastf1.get_session(year, event['EventName'], 'Race')
                    # OPTIMIZATION: Only load results, skip telemetry/weather/messages
                    race.load(laps=False, telemetry=False, weather=False, messages=False)
                    results = race.results
                    
                    if results is None or results.empty:
                        continue
                    
                    for _, result in results.iterrows():
                        driver = result.get('Abbreviation', '')
                        if not driver:
                            continue
                            
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
                except Exception as e:
                    print(f"Error loading race {event.get('EventName', 'Unknown')}: {str(e)}")
                    continue
            
            # Sort by points
            standings = sorted(driver_points.values(), key=lambda x: x['points'], reverse=True)
            return standings
        
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching standings: {str(e)}"
            )
    
    async def get_weather_data(self, year: int, grand_prix: str, session_name: str) -> pd.DataFrame:
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
                                   lap_number: Optional[int] = None) -> Dict[str, Any]:
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
    
    async def get_pit_stops(self, year: int, grand_prix: str) -> List[Dict[str, Any]]:
        """Get pit stop data for a race using vectorized operations"""
        try:
            session = await self.get_session(year, grand_prix, 'Race')
            laps = session.laps
            
            if laps.empty:
                return []
                
            # Vectorized pit stop detection:
            # 1. Identify where compound changes or tyre life resets (lower than previous)
            # 2. Sort by driver and lap to ensure correct comparison
            laps_sorted = laps.sort_values(['Driver', 'LapNumber'])
            
            # Shift compound and tyre life within each driver group
            laps_sorted['PrevCompound'] = laps_sorted.groupby('Driver')['Compound'].shift(1)
            laps_sorted['PrevTyreLife'] = laps_sorted.groupby('Driver')['TyreLife'].shift(1)
            
            # Detect pit stops: compound changed OR tyre life reset
            pit_stop_mask = (
                (laps_sorted['Compound'] != laps_sorted['PrevCompound']) | 
                (laps_sorted['TyreLife'] < laps_sorted['PrevTyreLife'])
            ) & laps_sorted['PrevCompound'].notna()
            
            pit_laps = laps_sorted[pit_stop_mask].copy()
            
            # Build result list
            pit_stops = []
            for _, lap in pit_laps.iterrows():
                pit_stops.append({
                    'driver': lap['Driver'],
                    'lap': int(lap['LapNumber']),
                    'from_compound': lap['PrevCompound'],
                    'to_compound': lap['Compound'],
                    'tyre_life_before': float(lap['PrevTyreLife']) if pd.notna(lap['PrevTyreLife']) else None
                })
            
            return pit_stops
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching pit stops: {str(e)}"
            )


# Singleton instance
f1_service = FastF1Service()
