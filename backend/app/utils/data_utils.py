"""Utility functions for data processing"""
import pandas as pd
import numpy as np
from typing import List, Dict, Any


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
    
    # Identify stint changes (where compound changes)
    # We create a stint ID by checking where the compound is different from the previous row
    # and taking the cumulative sum.
    laps = laps_df.copy()
    laps['StintID'] = (laps['Compound'] != laps['Compound'].shift()).cumsum()
    
    # Group by StintID and Compound to aggregate
    stint_groups = laps.groupby(['StintID', 'Compound'])
    
    # Calculate aggregations
    stints_data = stint_groups.agg(
        num_laps=('LapNumber', 'count'),
        average_time=('LapTime', lambda x: x.mean() if not x.isna().all() else np.nan)
    ).reset_index()
    
    # Convert to list of dicts
    result = []
    for _, row in stints_data.iterrows():
        result.append({
            'compound': row['Compound'],
            'num_laps': int(row['num_laps']),
            'average_time': float(row['average_time']) if pd.notna(row['average_time']) else None
        })
        
    return result
