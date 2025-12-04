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
    """Aggregate lap data by tire stint"""
    if laps_df.empty:
        return []
    
    stints = []
    current_compound = None
    stint_laps = []
    
    for _, lap in laps_df.iterrows():
        compound = lap.get('Compound')
        
        if compound != current_compound and current_compound is not None:
            if stint_laps:
                stints.append({
                    'compound': current_compound,
                    'num_laps': len(stint_laps),
                    'average_time': np.mean([l['LapTime'] for l in stint_laps if pd.notna(l['LapTime'])]),
                })
            stint_laps = []
        
        current_compound = compound
        stint_laps.append(lap)
    
    # Add final stint
    if stint_laps:
        stints.append({
            'compound': current_compound,
            'num_laps': len(stint_laps),
            'average_time': np.mean([l['LapTime'] for l in stint_laps if pd.notna(l['LapTime'])]),
        })
    
    return stints
