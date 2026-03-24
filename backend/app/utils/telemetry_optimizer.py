"""Telemetry Data Optimization Utilities"""
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional


def optimize_telemetry_data(
    telemetry: pd.DataFrame,
    downsample_factor: int = 10,
    decimal_places: int = 2,
    align_by_distance: bool = True
) -> List[Dict[str, Any]]:
    """
    Optimize telemetry data for frontend consumption by downsampling and rounding.
    
    This function reduces telemetry payload size by 80-90% while maintaining
    the visual integrity of the data curves.
    
    Args:
        telemetry: Raw telemetry DataFrame from FastF1
        downsample_factor: Keep every Nth data point (default: 10)
                          Higher = smaller payload, lower = more detail
        decimal_places: Round float values to N decimal places (default: 2)
        align_by_distance: If True, ensure Distance column exists (default: True)
    
    Returns:
        List of dictionaries ready for JSON serialization
        
    Example:
        >>> session = fastf1.get_session(2024, 'Monaco', 'Race')
        >>> session.load(telemetry=True)
        >>> lap = session.laps.pick_driver('VER').pick_fastest()
        >>> tel = lap.get_telemetry()
        >>> optimized = optimize_telemetry_data(tel, downsample_factor=10)
        >>> print(f"Original: {len(tel)} points, Optimized: {len(optimized)} points")
    """
    if telemetry is None or telemetry.empty:
        return []
    
    # Make a copy to avoid modifying original
    tel = telemetry.copy()
    
    # Add Distance column if missing and requested
    if align_by_distance and 'Distance' not in tel.columns:
        # Calculate distance from Time and Speed
        if 'Time' in tel.columns and 'Speed' in tel.columns:
            try:
                tel['Distance'] = _calculate_distance_from_telemetry(tel)
            except Exception as e:
                print(f"Warning: Could not calculate distance: {e}")
                # Continue without distance
    
    # Downsample: Keep every Nth point
    # Use integer indexing to ensure we get evenly spaced samples
    if len(tel) == 0:
        return []
    
    sample_indices = np.arange(0, len(tel), downsample_factor)
    tel_sampled = tel.iloc[sample_indices].copy()
    
    # Define columns to include and their transformations
    column_mapping = {
        'Distance': 'distance',
        'Time': 'time',
        'Speed': 'speed',
        'Throttle': 'throttle',
        'Brake': 'brake',
        'nGear': 'gear',
        'RPM': 'rpm',
        'DRS': 'drs',
        'X': 'x',
        'Y': 'y',
        'Z': 'z'
    }
    
    # Build optimized data structure
    optimized_data = []
    
    for _, row in tel_sampled.iterrows():
        point = {}
        
        for col_name, json_key in column_mapping.items():
            if col_name not in tel_sampled.columns:
                continue
            
            value = row[col_name]
            
            # Handle NaN values
            if pd.isna(value):
                point[json_key] = None
                continue
            
            # Convert Time to seconds (float)
            if col_name == 'Time':
                try:
                    # Try timedelta conversion first
                    if hasattr(value, 'total_seconds'):
                        point[json_key] = round(value.total_seconds(), decimal_places)
                    else:
                        # Already numeric
                        point[json_key] = round(float(value), decimal_places)
                except (AttributeError, TypeError, ValueError) as e:
                    # If conversion fails, skip this field
                    point[json_key] = None
            # Integer columns (gear, DRS)
            elif col_name in ['nGear', 'DRS']:
                try:
                    point[json_key] = int(value)
                except (ValueError, TypeError):
                    point[json_key] = None
            # Float columns (everything else)
            else:
                try:
                    point[json_key] = round(float(value), decimal_places)
                except (ValueError, TypeError):
                    point[json_key] = None
        
        optimized_data.append(point)
    
    return optimized_data


def align_telemetry_by_distance(
    tel1: pd.DataFrame,
    tel2: pd.DataFrame,
    distance_step: float = 10.0
) -> tuple:
    """
    Align two telemetry datasets by distance for accurate geographical comparison.
    
    This ensures that when comparing two drivers, their data points align at the
    same track positions (distance) rather than time, allowing accurate comparison
    of cornering speeds, throttle application, etc. at specific track locations.
    
    Args:
        tel1: First driver's telemetry DataFrame
        tel2: Second driver's telemetry DataFrame
        distance_step: Distance interval in meters for alignment (default: 10m)
    
    Returns:
        Tuple of (aligned_tel1, aligned_tel2) as DataFrames
        
    Example:
        >>> tel_ver = lap_ver.get_telemetry()
        >>> tel_ham = lap_ham.get_telemetry()
        >>> tel_ver_aligned, tel_ham_aligned = align_telemetry_by_distance(
        ...     tel_ver, tel_ham, distance_step=5.0
        ... )
    """
    if tel1.empty or tel2.empty:
        return tel1, tel2
    
    # Ensure both have Distance column
    if 'Distance' not in tel1.columns:
        tel1 = tel1.copy()
        try:
            tel1['Distance'] = _calculate_distance_from_telemetry(tel1)
        except Exception as e:
            print(f"Warning: Could not calculate distance for tel1: {e}")
            # Return originals if distance calculation fails
            return tel1, tel2
    
    if 'Distance' not in tel2.columns:
        tel2 = tel2.copy()
        try:
            tel2['Distance'] = _calculate_distance_from_telemetry(tel2)
        except Exception as e:
            print(f"Warning: Could not calculate distance for tel2: {e}")
            # Return originals if distance calculation fails
            return tel1, tel2
    
    # Check if we have valid distances
    if tel1['Distance'].isna().all() or tel2['Distance'].isna().all():
        print("Warning: No valid distance data, returning original telemetry")
        return tel1, tel2
    
    # Get the minimum and maximum distance that both datasets cover
    try:
        min_distance = max(tel1['Distance'].min(), tel2['Distance'].min())
        max_distance = min(tel1['Distance'].max(), tel2['Distance'].max())
        
        # Check if we have a valid range
        if min_distance >= max_distance or np.isnan(min_distance) or np.isnan(max_distance):
            print("Warning: Invalid distance range, returning original telemetry")
            return tel1, tel2
        
        # Create common distance points
        common_distances = np.arange(min_distance, max_distance, distance_step)
        
        if len(common_distances) == 0:
            print("Warning: No common distance points, returning original telemetry")
            return tel1, tel2
        
        # Interpolate both telemetry datasets to these common distances
        tel1_aligned = _interpolate_telemetry_to_distance(tel1, common_distances)
        tel2_aligned = _interpolate_telemetry_to_distance(tel2, common_distances)
        
        return tel1_aligned, tel2_aligned
    except Exception as e:
        print(f"Warning: Error during alignment: {e}, returning original telemetry")
        return tel1, tel2


def _calculate_distance_from_telemetry(telemetry: pd.DataFrame) -> pd.Series:
    """
    Calculate distance traveled from speed and time data.
    
    Args:
        telemetry: Telemetry DataFrame with 'Speed' and 'Time' columns
        
    Returns:
        Series containing cumulative distance
    """
    if 'Speed' not in telemetry.columns or 'Time' not in telemetry.columns:
        return pd.Series([0] * len(telemetry))
    
    # Convert time to seconds
    try:
        # Try timedelta conversion first
        if hasattr(telemetry['Time'].iloc[0], 'total_seconds'):
            time_seconds = telemetry['Time'].dt.total_seconds()
        else:
            # Already numeric
            time_seconds = pd.to_numeric(telemetry['Time'], errors='coerce')
    except (AttributeError, TypeError, ValueError):
        try:
            time_seconds = pd.to_numeric(telemetry['Time'], errors='coerce')
        except Exception:
            # Fallback: use index as approximate time
            time_seconds = pd.Series(range(len(telemetry)), dtype=float) * 0.1
    
    # Calculate time delta between consecutive points
    time_delta = time_seconds.diff().fillna(0)
    
    # Speed is in km/h, convert to m/s and calculate distance
    # distance = speed (m/s) * time (s)
    speed_ms = telemetry['Speed'] / 3.6  # km/h to m/s
    distance_delta = speed_ms * time_delta
    
    # Calculate cumulative distance
    cumulative_distance = distance_delta.cumsum()
    
    return cumulative_distance


def _interpolate_telemetry_to_distance(
    telemetry: pd.DataFrame,
    target_distances: np.ndarray
) -> pd.DataFrame:
    """
    Interpolate telemetry data to specific distance points.
    
    Args:
        telemetry: Telemetry DataFrame with 'Distance' column
        target_distances: Array of distance points to interpolate to
        
    Returns:
        DataFrame with telemetry interpolated to target distances
    """
    # Columns to interpolate
    interpolate_cols = ['Speed', 'Throttle', 'Brake', 'RPM', 'nGear', 'DRS', 'X', 'Y', 'Z']
    
    # Filter to columns that exist
    interpolate_cols = [col for col in interpolate_cols if col in telemetry.columns]
    
    # Create result DataFrame
    result = pd.DataFrame({'Distance': target_distances})
    
    # Interpolate each column
    for col in interpolate_cols:
        # Use linear interpolation for continuous values
        if col in ['Speed', 'Throttle', 'Brake', 'RPM', 'X', 'Y', 'Z']:
            result[col] = np.interp(
                target_distances,
                telemetry['Distance'].values,
                telemetry[col].values,
                left=np.nan,
                right=np.nan
            )
        # Use nearest neighbor for discrete values (gear, DRS)
        else:
            # Simple nearest-neighbor interpolation
            indices = np.searchsorted(telemetry['Distance'].values, target_distances)
            indices = np.clip(indices, 0, len(telemetry) - 1)
            result[col] = telemetry[col].iloc[indices].values
    
    return result


def calculate_telemetry_delta(
    tel1: pd.DataFrame,
    tel2: pd.DataFrame,
    align: bool = True
) -> Dict[str, Any]:
    """
    Calculate delta analysis between two telemetry datasets.
    
    Args:
        tel1: First driver's telemetry
        tel2: Second driver's telemetry
        align: Whether to align by distance first (recommended: True)
        
    Returns:
        Dictionary with delta statistics
    """
    if tel1.empty or tel2.empty:
        return {}
    
    try:
        # Align telemetry by distance for accurate comparison
        if align:
            tel1_aligned, tel2_aligned = align_telemetry_by_distance(tel1, tel2)
        else:
            tel1_aligned, tel2_aligned = tel1, tel2
        
        delta = {}
        
        # Speed analysis
        if 'Speed' in tel1_aligned.columns and 'Speed' in tel2_aligned.columns:
            try:
                speed_diff = tel1_aligned['Speed'] - tel2_aligned['Speed']
                delta['speed'] = {
                    'max_diff': round(float(speed_diff.max()), 2),
                    'min_diff': round(float(speed_diff.min()), 2),
                    'avg_diff': round(float(speed_diff.mean()), 2),
                    'driver1_max': round(float(tel1_aligned['Speed'].max()), 2),
                    'driver2_max': round(float(tel2_aligned['Speed'].max()), 2),
                    'driver1_avg': round(float(tel1_aligned['Speed'].mean()), 2),
                    'driver2_avg': round(float(tel2_aligned['Speed'].mean()), 2)
                }
            except Exception as e:
                print(f"Warning: Could not calculate speed delta: {e}")
        
        # Throttle analysis
        if 'Throttle' in tel1_aligned.columns and 'Throttle' in tel2_aligned.columns:
            try:
                delta['throttle'] = {
                    'driver1_avg_usage': round(float(tel1_aligned['Throttle'].mean()), 2),
                    'driver2_avg_usage': round(float(tel2_aligned['Throttle'].mean()), 2),
                    'diff': round(float(tel1_aligned['Throttle'].mean() - tel2_aligned['Throttle'].mean()), 2)
                }
            except Exception as e:
                print(f"Warning: Could not calculate throttle delta: {e}")
        
        # Brake analysis
        if 'Brake' in tel1_aligned.columns and 'Brake' in tel2_aligned.columns:
            try:
                delta['brake'] = {
                    'driver1_avg_usage': round(float(tel1_aligned['Brake'].mean()), 2),
                    'driver2_avg_usage': round(float(tel2_aligned['Brake'].mean()), 2),
                    'diff': round(float(tel1_aligned['Brake'].mean() - tel2_aligned['Brake'].mean()), 2)
                }
            except Exception as e:
                print(f"Warning: Could not calculate brake delta: {e}")
        
        return delta
    except Exception as e:
        print(f"Warning: Error calculating telemetry delta: {e}")
        return {}
