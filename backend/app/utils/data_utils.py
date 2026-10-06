"""Utility functions for data processing"""
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional


def format_lap_time(seconds: float) -> str:
    """Format lap time from seconds to MM:SS.mmm"""
    if pd.isna(seconds) or seconds == 0:
        return "--:--.---"
    
    minutes = int(seconds // 60)
    secs = seconds % 60
    
    return f"{minutes}:{secs:06.3f}"


def calculate_delta(time1: float, time2: float) -> float:
    """Calculate time delta between two lap times"""
    return time1 - time2


def calculate_consistency(lap_times: List[float]) -> float:
    """Calculate consistency score (0-1, higher is better)"""
    if not lap_times or len(lap_times) < 2:
        return 0.0
    
    mean_time = np.mean(lap_times)
    std_dev = np.std(lap_times)
    
    if mean_time == 0:
        return 0.0
    
    consistency = 1 - (std_dev / mean_time)
    return max(0.0, min(1.0, consistency))


def detect_outliers(data: List[float], threshold: float = 2.0) -> List[int]:
    """Detect outlier indices using z-score"""
    if not data or len(data) < 3:
        return []
    
    mean = np.mean(data)
    std = np.std(data)
    
    outliers = []
    for i, value in enumerate(data):
        z_score = abs((value - mean) / std) if std > 0 else 0
        if z_score > threshold:
            outliers.append(i)
    
    return outliers


def normalize_data(data: List[float]) -> List[float]:
    """Normalize data to 0-1 range"""
    if not data:
        return []
    
    min_val = min(data)
    max_val = max(data)
    
    if max_val == min_val:
        return [0.5] * len(data)
    
    return [(x - min_val) / (max_val - min_val) for x in data]


def assign_stints(laps_df: pd.DataFrame) -> pd.Series:
    """
    Return the tyre stint number of every lap, aligned to ``laps_df``'s index.

    Uses FastF1's ``Stint`` column. If it is missing, a new stint starts when
    the tyre age drops or the compound changes. Comparing compounds alone is
    wrong: a pit stop onto the same compound (hard -> hard) is missed, and a
    lap with an unknown compound (NaN != NaN) splits a stint in two.
    """
    if laps_df.empty:
        return pd.Series(dtype=float, index=laps_df.index)

    if 'Stint' in laps_df.columns and laps_df['Stint'].notna().any():
        return laps_df.groupby('Driver')['Stint'].transform(lambda s: s.ffill().bfill())

    laps = laps_df.sort_values(['Driver', 'LapNumber'])
    by_driver = laps['Driver']
    compound = laps.groupby('Driver')['Compound'].ffill()
    prev_compound = compound.groupby(by_driver).shift()
    new_stint = compound.notna() & prev_compound.notna() & (compound != prev_compound)

    if 'TyreLife' in laps.columns:
        prev_tyre_life = laps.groupby('Driver')['TyreLife'].shift()
        new_stint |= laps['TyreLife'] < prev_tyre_life

    stints = new_stint.astype(int).groupby(by_driver).cumsum() + 1
    return stints.reindex(laps_df.index)


def stint_compound(compounds: pd.Series) -> Optional[str]:
    """Most common known compound in a stint, or None."""
    known = compounds.dropna()
    known = known[known != 'UNKNOWN']
    if known.empty:
        return None
    return str(known.mode().iloc[0])


def aggregate_by_stint(laps_df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Aggregate lap data by tire stint using vectorized operations.
    
    Args:
        laps_df: DataFrame containing lap data with 'Compound' and 'LapTime' columns
        
    Returns:
        List of dictionaries containing stint information (compound, num_laps, average_time)
    """
    if laps_df.empty:
        return []
    
    laps = laps_df.copy()
    laps['StintID'] = assign_stints(laps)
    
    result = []
    for _, stint in laps.groupby(['Driver', 'StintID'], sort=True):
        average_time = stint['LapTime'].dt.total_seconds().mean()
        result.append({
            'compound': stint_compound(stint['Compound']),
            'num_laps': int(len(stint)),
            'average_time': float(average_time) if pd.notna(average_time) else None
        })
        
    return result
