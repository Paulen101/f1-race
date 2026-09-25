"""FastF1 data service"""
import fastf1
from fastapi import HTTPException
import pandas as pd
from typing import Optional, List, Dict, Any
from app.config import settings
from app.utils.data_utils import assign_stints


class FastF1Service:
    """Service for fetching F1 data using FastF1"""
    
    def __init__(self):
        """Initialize FastF1 service with cache"""
        fastf1.Cache.enable_cache(settings.FASTF1_CACHE_DIR)
    
    def get_session(self, year: int, grand_prix: str, session_name: str, load_laps: bool = True, load_telemetry: bool = False) -> fastf1.core.Session:
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
    
    def get_laps(self, year: int, grand_prix: str, session_name: str, driver: Optional[str] = None) -> fastf1.core.Laps:
        """Get lap data for a session or specific driver"""
        try:
            session = self.get_session(year, grand_prix, session_name)
            
            if driver:
                laps = session.laps.pick_drivers(driver)
            else:
                laps = session.laps
            
            return laps
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching laps: {str(e)}"
            )
    
    def get_telemetry(self, year: int, grand_prix: str, session_name: str, 
                           driver: str, lap_number: Optional[int] = None) -> pd.DataFrame:
        """Get telemetry data for a driver"""
        try:
            # For telemetry we NEED to load it
            session = self.get_session(year, grand_prix, session_name, load_laps=True, load_telemetry=True)
            driver_laps = session.laps.pick_drivers(driver)
            
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
            session = self._load_telemetry_session(year, grand_prix, session_name)
            return self._driver_lap_telemetry(session, driver, lap_number)
        except (HTTPException, ValueError):
            raise
        except Exception as e:
            import traceback
            print(f"Error loading telemetry: {str(e)}")
            print(traceback.format_exc())
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching telemetry: {str(e)}"
            )
    
    def get_telemetry_pair_sync(self, year: int, grand_prix: str, session_name: str,
                                driver1: str, driver2: str,
                                lap_number: Optional[int] = None):
        """
        Telemetry for two drivers from one session load.

        Loading a session with telemetry is the expensive step, so a comparison
        loads it once instead of once per driver.
        """
        try:
            print(f"Loading telemetry: {year} {grand_prix} {session_name} - {driver1} vs {driver2}")
            session = self._load_telemetry_session(year, grand_prix, session_name)
            return (
                self._driver_lap_telemetry(session, driver1, lap_number),
                self._driver_lap_telemetry(session, driver2, lap_number),
            )
        except (HTTPException, ValueError):
            raise
        except Exception as e:
            import traceback
            print(f"Error loading telemetry: {str(e)}")
            print(traceback.format_exc())
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching telemetry: {str(e)}"
            )
    
    @staticmethod
    def _load_telemetry_session(year: int, grand_prix: str, session_name: str) -> fastf1.core.Session:
        """Load a session including laps and car telemetry."""
        session = fastf1.get_session(year, grand_prix, session_name)
        session.load(laps=True, telemetry=True, weather=False, messages=False)
        return session
    
    @staticmethod
    def _driver_lap_telemetry(session: fastf1.core.Session, driver: str,
                              lap_number: Optional[int] = None) -> pd.DataFrame:
        """
        Telemetry of one driver's lap (default: their fastest) from a loaded session.

        Raises ValueError if the driver or lap can't be found.
        """
        # Try to pick driver - FastF1's pick_driver handles abbreviations automatically
        try:
            driver_laps = session.laps.pick_drivers(driver)
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
    
    def get_driver_standings(self, year: int) -> List[Dict[str, Any]]:
        """Get driver standings for a season, including sprint points.

        Each entry carries ``races_completed`` (Grand Prix starts), which the
        championship predictor needs to compute points per race.
        """
        try:
            schedule = fastf1.get_event_schedule(year, include_testing=False)
            completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()]
            
            driver_points = {}
            
            def add_results(results: pd.DataFrame, is_race: bool) -> None:
                for _, result in results.iterrows():
                    driver = result.get('Abbreviation', '')
                    if not driver:
                        continue
                    
                    if driver not in driver_points:
                        driver_points[driver] = {
                            'driver': driver,
                            'full_name': result.get('FullName', driver),
                            'team': result.get('TeamName', 'Unknown'),
                            'points': 0.0,
                            'wins': 0,
                            'podiums': 0,
                            'races_completed': 0
                        }
                    
                    points = result.get('Points', 0)
                    if pd.notna(points):
                        driver_points[driver]['points'] += float(points)
                    
                    if not is_race:
                        continue
                    
                    driver_points[driver]['races_completed'] += 1
                    # Keep the team current if the driver switched mid-season
                    driver_points[driver]['team'] = result.get('TeamName', driver_points[driver]['team'])
                    position = result.get('Position')
                    if pd.notna(position):
                        if position == 1:
                            driver_points[driver]['wins'] += 1
                        if position <= 3:
                            driver_points[driver]['podiums'] += 1
            
            for _, event in completed_races.iterrows():
                # Sprint weekends award points in the Sprint session too
                session_names = ['Race']
                if 'sprint' in str(event.get('EventFormat', '')).lower():
                    session_names.insert(0, 'Sprint')
                
                for session_name in session_names:
                    try:
                        session = fastf1.get_session(year, event['EventName'], session_name)
                        # OPTIMIZATION: Only load results, skip laps/telemetry/weather/messages
                        session.load(laps=False, telemetry=False, weather=False, messages=False)
                        results = session.results
                        
                        if results is None or results.empty:
                            continue
                        
                        add_results(results, is_race=(session_name == 'Race'))
                    except Exception as e:
                        print(f"Error loading {session_name} {event.get('EventName', 'Unknown')}: {str(e)}")
                        continue
            
            # Sort by points
            standings = sorted(driver_points.values(), key=lambda x: x['points'], reverse=True)
            return standings
        
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching standings: {str(e)}"
            )
    
    def get_weather_data(self, year: int, grand_prix: str, session_name: str) -> pd.DataFrame:
        """Get weather data for a session"""
        try:
            session = self.get_session(year, grand_prix, session_name)
            weather = session.weather_data
            return weather
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching weather data: {str(e)}"
            )
    
    def compare_lap_telemetry(self, year: int, grand_prix: str, 
                                   session_name: str, driver1: str, driver2: str,
                                   lap_number: Optional[int] = None) -> Dict[str, Any]:
        """Compare telemetry between two drivers"""
        try:
            tel1 = self.get_telemetry(year, grand_prix, session_name, driver1, lap_number)
            tel2 = self.get_telemetry(year, grand_prix, session_name, driver2, lap_number)
            
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
    
    def get_pit_stops(self, year: int, grand_prix: str) -> List[Dict[str, Any]]:
        """Get pit stop data for a race using vectorized operations"""
        try:
            session = self.get_session(year, grand_prix, 'Race')
            laps = session.laps
            
            if laps.empty:
                return []
                
            # A pit stop is a change of stint. FastF1's Stint column catches
            # same-compound stops that a compound comparison would miss.
            laps_sorted = laps.sort_values(['Driver', 'LapNumber']).copy()
            laps_sorted['StintID'] = assign_stints(laps_sorted)
            by_driver = laps_sorted.groupby('Driver')
            laps_sorted['PrevStint'] = by_driver['StintID'].shift(1)
            laps_sorted['PrevCompound'] = by_driver['Compound'].transform(lambda s: s.ffill().shift(1))
            laps_sorted['PrevTyreLife'] = by_driver['TyreLife'].shift(1)
            
            pit_stop_mask = (
                laps_sorted['PrevStint'].notna() &
                (laps_sorted['StintID'] != laps_sorted['PrevStint'])
            )
            pit_laps = laps_sorted[pit_stop_mask]
            
            # Build result list
            pit_stops = []
            for _, lap in pit_laps.iterrows():
                pit_stops.append({
                    'driver': lap['Driver'],
                    'lap': int(lap['LapNumber']),
                    'from_compound': lap['PrevCompound'] if pd.notna(lap['PrevCompound']) else None,
                    'to_compound': lap['Compound'] if pd.notna(lap['Compound']) else None,
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
