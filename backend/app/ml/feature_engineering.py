"""Advanced Feature Engineering for ML Predictions"""
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
import fastf1


def calculate_tyre_age_at_start(
    session: fastf1.core.Session,
    driver: str,
    lap_number: int
) -> Optional[int]:
    """
    Calculate the tyre age at the start of a specific lap.
    
    Tyre age is crucial for predicting performance degradation and pit strategy.
    
    Args:
        session: FastF1 session object
        driver: Driver abbreviation (e.g., 'VER', 'HAM')
        lap_number: The lap number to calculate tyre age for
        
    Returns:
        Integer representing tyre age in laps, or None if data unavailable
        
    Example:
        >>> session = fastf1.get_session(2024, 'Monaco', 'Race')
        >>> session.load(laps=True)
        >>> tyre_age = calculate_tyre_age_at_start(session, 'VER', 25)
        >>> print(f"Verstappen's tyres were {tyre_age} laps old at lap 25")
    """
    try:
        driver_laps = session.laps.pick_driver(driver)
        
        if driver_laps.empty or lap_number > len(driver_laps):
            return None
        
        # Get the lap
        lap = driver_laps[driver_laps['LapNumber'] == lap_number]
        
        if lap.empty:
            return None
        
        # TyreLife column contains the age of the tyre
        tyre_life = lap.iloc[0].get('TyreLife')
        
        if pd.notna(tyre_life):
            return int(tyre_life)
        
        # Fallback: Calculate manually by tracking compound changes
        return _calculate_tyre_age_manually(driver_laps, lap_number)
        
    except Exception as e:
        print(f"Error calculating tyre age: {e}")
        return None


def _calculate_tyre_age_manually(driver_laps: pd.DataFrame, lap_number: int) -> Optional[int]:
    """
    Manually calculate tyre age by tracking compound changes.
    
    Args:
        driver_laps: DataFrame of driver's laps
        lap_number: Target lap number
        
    Returns:
        Tyre age in laps
    """
    try:
        laps_up_to_target = driver_laps[driver_laps['LapNumber'] <= lap_number]
        
        if laps_up_to_target.empty:
            return None
        
        # Find the last pit stop (compound change) before this lap
        current_compound = laps_up_to_target.iloc[-1].get('Compound')
        
        # Count backwards to find when this compound was fitted
        age = 0
        for idx in range(len(laps_up_to_target) - 1, -1, -1):
            lap = laps_up_to_target.iloc[idx]
            if lap.get('Compound') == current_compound:
                age += 1
            else:
                break
        
        return age if age > 0 else 1
        
    except Exception:
        return None


def calculate_average_pit_stop_duration(
    year: int,
    track: str,
    session_type: str = 'Race'
) -> float:
    """
    Calculate the average pit stop duration for a specific track and year.
    
    This is a critical feature for strategy predictions as pit stop times
    vary significantly by track due to pit lane length and speed limits.
    
    Args:
        year: Season year
        track: Track/Grand Prix name (e.g., 'Monaco', 'Monza')
        session_type: Session type (default: 'Race')
        
    Returns:
        Average pit stop duration in seconds
        
    Example:
        >>> avg_pit = calculate_average_pit_stop_duration(2024, 'Monaco', 'Race')
        >>> print(f"Average pit stop at Monaco: {avg_pit:.2f}s")
    """
    try:
        session = fastf1.get_session(year, track, session_type)
        # Only load laps data for pit stop analysis
        session.load(laps=True, telemetry=False, weather=False, messages=False)
        
        pit_stops = []
        
        # Iterate through all drivers
        for driver in session.laps['Driver'].unique():
            driver_laps = session.laps.pick_driver(driver)
            
            # Find pit laps (laps with PitInTime and PitOutTime)
            for idx in range(len(driver_laps)):
                lap = driver_laps.iloc[idx]
                
                # Check if this lap had a pit stop
                pit_duration = lap.get('PitInTime')
                
                if pd.notna(pit_duration):
                    try:
                        # PitInTime contains the duration in some FastF1 versions
                        if hasattr(pit_duration, 'total_seconds'):
                            duration = pit_duration.total_seconds()
                        else:
                            duration = float(pit_duration)
                        
                        # Sanity check: pit stops typically 2-30 seconds
                        if 2.0 <= duration <= 30.0:
                            pit_stops.append(duration)
                    except (ValueError, TypeError):
                        continue
        
        # Calculate average
        if pit_stops:
            return round(np.mean(pit_stops), 2)
        else:
            # Return track-specific default if no data available
            return _get_default_pit_stop_time(track)
            
    except Exception as e:
        print(f"Error calculating pit stop duration: {e}")
        return _get_default_pit_stop_time(track)


def _get_default_pit_stop_time(track: str) -> float:
    """
    Get default pit stop time based on track characteristics.
    
    Args:
        track: Track name
        
    Returns:
        Estimated pit stop duration in seconds
    """
    # Known slow pit lanes
    slow_pit_lanes = {
        'Monaco': 25.0,
        'Singapore': 24.0,
        'Baku': 23.0
    }
    
    # Known fast pit lanes
    fast_pit_lanes = {
        'Monza': 21.0,
        'Spa': 22.0,
        'Red Bull Ring': 21.5
    }
    
    # Check for matches
    for slow_track, time in slow_pit_lanes.items():
        if slow_track.lower() in track.lower():
            return time
    
    for fast_track, time in fast_pit_lanes.items():
        if fast_track.lower() in track.lower():
            return time
    
    # Default average
    return 23.0


def calculate_rolling_form(
    driver_results: pd.DataFrame,
    current_round: int,
    window: int = 3
) -> float:
    """
    Calculate a driver's rolling form (average finishing position in last N races).
    
    Rolling form is an excellent indicator of current performance momentum
    and helps predict near-term results better than season-long statistics.
    
    Args:
        driver_results: DataFrame with driver's season results including 'Round' and 'Position'
        current_round: The current race round number
        window: Number of previous races to consider (default: 3)
        
    Returns:
        Average finishing position in the last N races (lower is better)
        Returns 15.0 if insufficient data
        
    Example:
        >>> results = get_driver_season_results('VER', 2024)
        >>> form = calculate_rolling_form(results, current_round=10, window=3)
        >>> print(f"Verstappen's last 3 race avg: P{form:.1f}")
    """
    try:
        # Filter to races before current round
        previous_races = driver_results[driver_results['Round'] < current_round]
        
        if previous_races.empty:
            return 15.0  # Default mid-field position
        
        # Sort by round and get last N races
        previous_races = previous_races.sort_values('Round', ascending=False)
        recent_races = previous_races.head(window)
        
        if len(recent_races) == 0:
            return 15.0
        
        # Calculate average position
        # Handle DNF cases (Position might be NaN or > 20)
        positions = []
        for _, race in recent_races.iterrows():
            pos = race.get('Position')
            
            if pd.notna(pos) and pos <= 20:
                positions.append(pos)
            else:
                # DNF - assign penalty position
                positions.append(20)
        
        if not positions:
            return 15.0
        
        avg_position = np.mean(positions)
        return round(avg_position, 2)
        
    except Exception as e:
        print(f"Error calculating rolling form: {e}")
        return 15.0


def calculate_track_specific_performance(
    driver: str,
    track: str,
    years: List[int] = None
) -> Dict[str, float]:
    """
    Calculate a driver's historical performance at a specific track.
    
    Some drivers excel at certain tracks (e.g., Hamilton at Monaco,
    Verstappen at Red Bull Ring). Track-specific history is highly predictive.
    
    Args:
        driver: Driver abbreviation
        track: Track/Grand Prix name
        years: List of years to analyze (default: last 3 years)
        
    Returns:
        Dictionary with track-specific statistics
        
    Example:
        >>> track_perf = calculate_track_specific_performance('HAM', 'Monaco', [2022, 2023, 2024])
        >>> print(f"Hamilton at Monaco - Avg: P{track_perf['avg_position']}")
    """
    if years is None:
        current_year = 2024
        years = [current_year - 2, current_year - 1, current_year]
    
    results = []
    
    for year in years:
        try:
            session = fastf1.get_session(year, track, 'Race')
            session.load(laps=False, telemetry=False, weather=False, messages=False)
            
            driver_result = session.results[session.results['Abbreviation'] == driver]
            
            if not driver_result.empty:
                position = driver_result.iloc[0].get('Position')
                points = driver_result.iloc[0].get('Points', 0)
                
                if pd.notna(position):
                    results.append({
                        'year': year,
                        'position': int(position),
                        'points': float(points)
                    })
        except Exception:
            continue
    
    if not results:
        return {
            'races': 0,
            'avg_position': 15.0,
            'avg_points': 0.0,
            'best_position': 20,
            'worst_position': 20
        }
    
    positions = [r['position'] for r in results]
    points = [r['points'] for r in results]
    
    return {
        'races': len(results),
        'avg_position': round(np.mean(positions), 2),
        'avg_points': round(np.mean(points), 2),
        'best_position': int(min(positions)),
        'worst_position': int(max(positions))
    }


def extract_enhanced_features(
    session: fastf1.core.Session,
    qualifying_results: pd.DataFrame,
    historical_data: pd.DataFrame,
    current_round: int
) -> pd.DataFrame:
    """
    Extract enhanced feature set for machine learning predictions.
    
    This function combines all advanced feature engineering techniques
    to create a comprehensive feature matrix for ML models.
    
    Args:
        session: FastF1 session object (Race session)
        qualifying_results: DataFrame with qualifying results
        historical_data: DataFrame with historical race results
        current_round: Current race round number
        
    Returns:
        DataFrame with enhanced features ready for ML training/prediction
    """
    features = []
    track = session.event['EventName']
    year = session.event['EventDate'].year
    
    for _, driver_quali in qualifying_results.iterrows():
        driver = driver_quali.get('Abbreviation', '')
        
        if not driver:
            continue
        
        # Basic qualifying features
        quali_position = driver_quali.get('Position', 20)
        
        # Historical performance
        driver_history = historical_data[historical_data['Driver'] == driver]
        
        # Calculate rolling form
        rolling_form = calculate_rolling_form(driver_history, current_round, window=3)
        
        # Track-specific performance
        track_perf = calculate_track_specific_performance(
            driver, track, years=[year-2, year-1]
        )
        
        # Average pit stop duration for this track
        avg_pit_time = calculate_average_pit_stop_duration(year, track)
        
        # Build feature vector
        feature_vector = {
            'driver': driver,
            'quali_position': quali_position,
            'races_completed': len(driver_history),
            'career_avg_position': driver_history['Position'].mean() if len(driver_history) > 0 else 15.0,
            'career_total_points': driver_history['Points'].sum() if len(driver_history) > 0 else 0.0,
            'career_wins': (driver_history['Position'] == 1).sum() if len(driver_history) > 0 else 0,
            'career_podiums': (driver_history['Position'] <= 3).sum() if len(driver_history) > 0 else 0,
            'rolling_form_3': rolling_form,
            'track_experience_races': track_perf['races'],
            'track_avg_position': track_perf['avg_position'],
            'track_best_position': track_perf['best_position'],
            'avg_pit_stop_duration': avg_pit_time,
            # Derived features
            'quali_advantage': max(0, 20 - quali_position),  # Higher is better
            'consistency_score': 1.0 - (driver_history['Position'].std() / 20.0) if len(driver_history) > 1 else 0.5,
        }
        
        features.append(feature_vector)
    
    return pd.DataFrame(features)
