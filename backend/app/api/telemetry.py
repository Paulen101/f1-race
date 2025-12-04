"""Telemetry endpoints"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from app.services import f1_service
import pandas as pd

router = APIRouter()


@router.get("/{year}/{grand_prix}/{session_name}/{driver}")
async def get_driver_telemetry(
    year: int,
    grand_prix: str,
    session_name: str,
    driver: str,
    lap_number: Optional[int] = None
):
    """Get telemetry data for a specific driver's lap"""
    try:
        telemetry = await f1_service.get_telemetry(year, grand_prix, session_name, driver, lap_number)
        
        # Sample telemetry data (every 10th point to reduce payload)
        sampled = telemetry.iloc[::10]
        
        data = []
        for _, point in sampled.iterrows():
            data.append({
                'distance': float(point['Distance']) if pd.notna(point.get('Distance')) else None,
                'time': float(point['Time'].total_seconds()) if pd.notna(point.get('Time')) else None,
                'speed': float(point['Speed']) if pd.notna(point.get('Speed')) else None,
                'throttle': float(point['Throttle']) if pd.notna(point.get('Throttle')) else None,
                'brake': float(point['Brake']) if pd.notna(point.get('Brake')) else None,
                'gear': int(point['nGear']) if pd.notna(point.get('nGear')) else None,
                'rpm': float(point['RPM']) if pd.notna(point.get('RPM')) else None,
                'drs': int(point['DRS']) if pd.notna(point.get('DRS')) else None
            })
        
        return {'driver': driver, 'telemetry': data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{year}/{grand_prix}/{session_name}/compare")
async def compare_telemetry(
    year: int,
    grand_prix: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: Optional[int] = None
):
    """Compare telemetry between two drivers"""
    try:
        comparison = await f1_service.compare_lap_telemetry(
            year, grand_prix, session_name, driver1, driver2, lap_number
        )
        
        # Sample both telemetry datasets
        tel1 = pd.DataFrame(comparison['driver1']['telemetry'])
        tel2 = pd.DataFrame(comparison['driver2']['telemetry'])
        
        sampled1 = tel1.iloc[::10].to_dict('records') if len(tel1) > 0 else []
        sampled2 = tel2.iloc[::10].to_dict('records') if len(tel2) > 0 else []
        
        # Calculate delta analysis
        delta_analysis = _calculate_telemetry_delta(tel1, tel2)
        
        return {
            'driver1': {
                'driver': driver1,
                'telemetry': sampled1
            },
            'driver2': {
                'driver': driver2,
                'telemetry': sampled2
            },
            'delta_analysis': delta_analysis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _calculate_telemetry_delta(tel1, tel2):
    """Calculate key differences between two telemetry datasets"""
    if len(tel1) == 0 or len(tel2) == 0:
        return {}
    
    return {
        'max_speed_diff': float(tel1['Speed'].max() - tel2['Speed'].max()) if 'Speed' in tel1.columns else None,
        'avg_speed_diff': float(tel1['Speed'].mean() - tel2['Speed'].mean()) if 'Speed' in tel1.columns else None,
        'throttle_usage_diff': float(tel1['Throttle'].mean() - tel2['Throttle'].mean()) if 'Throttle' in tel1.columns else None,
        'brake_usage_diff': float(tel1['Brake'].mean() - tel2['Brake'].mean()) if 'Brake' in tel1.columns else None
    }
