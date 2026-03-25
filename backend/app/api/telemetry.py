"""Telemetry endpoints"""
from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any
from app.services.fastf1_service import f1_service
from app.utils.telemetry_optimizer import (
    optimize_telemetry_data,
    align_telemetry_by_distance,
    calculate_telemetry_delta
)

router = APIRouter()


# IMPORTANT: More specific routes must come BEFORE generic ones
# /compare must be defined before /{driver} to avoid route conflicts
@router.get("/{year}/{grand_prix}/{session_name}/compare")
def compare_telemetry(
    year: int,
    grand_prix: str,
    session_name: str,
    driver1: str,
    driver2: str,
    lap_number: Optional[int] = None,
    downsample: int = 10,
    align_by_distance: bool = True
) -> Dict[str, Any]:
    """
    Compare telemetry between two drivers with distance-aligned data.
    
    This endpoint ensures both drivers' telemetry is aligned by track distance
    (not time), allowing accurate geographical comparison of cornering speeds,
    throttle application, etc. at the same track positions.
    
    Args:
        align_by_distance: If True, aligns telemetry by distance for accurate comparison
        downsample: Downsample factor after alignment
    """
    try:
        # Get raw telemetry (blocking operation - runs in thread pool)
        tel1 = f1_service.get_telemetry_sync(year, grand_prix, session_name, driver1, lap_number)
        tel2 = f1_service.get_telemetry_sync(year, grand_prix, session_name, driver2, lap_number)
        
        # Align by distance for geographical accuracy
        if align_by_distance:
            tel1_aligned, tel2_aligned = align_telemetry_by_distance(
                tel1, tel2, distance_step=10.0
            )
        else:
            tel1_aligned, tel2_aligned = tel1, tel2
        
        # Optimize both datasets
        data1 = optimize_telemetry_data(tel1_aligned, downsample_factor=downsample)
        data2 = optimize_telemetry_data(tel2_aligned, downsample_factor=downsample)
        
        # Calculate delta analysis using aligned data
        delta_analysis = calculate_telemetry_delta(tel1, tel2, align=True)
        
        return {
            'driver1': {
                'driver': driver1,
                'telemetry': data1
            },
            'driver2': {
                'driver': driver2,
                'telemetry': data2
            },
            'delta_analysis': delta_analysis,
            'aligned_by_distance': align_by_distance,
            'data_points_per_driver': len(data1)
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=f"Data not found: {str(e)}")
    except Exception as e:
        import traceback
        error_detail = f"Error comparing telemetry: {str(e)}"
        print(f"{error_detail}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_detail)


@router.get("/{year}/{grand_prix}/{session_name}/{driver}")
def get_driver_telemetry(
    year: int,
    grand_prix: str,
    session_name: str,
    driver: str,
    lap_number: Optional[int] = None,
    downsample: int = 10
) -> Dict[str, Any]:
    """
    Get optimized telemetry data for a specific driver's lap.
    
    NOTE: This endpoint uses standard 'def' instead of 'async def' because FastF1
    operations are blocking/CPU-intensive. FastAPI automatically runs these in a
    thread pool to prevent blocking the event loop.
    
    Args:
        downsample: Downsample factor (keep every Nth point). Default: 10
                   Higher = smaller payload, Lower = more detail
    """
    try:
        # FastF1 operations are blocking - FastAPI will run this in thread pool
        telemetry = f1_service.get_telemetry_sync(year, grand_prix, session_name, driver, lap_number)
        
        # Use optimized telemetry function (80-90% size reduction)
        data = optimize_telemetry_data(
            telemetry,
            downsample_factor=downsample,
            decimal_places=2,
            align_by_distance=True
        )
        
        return {
            'driver': driver,
            'telemetry': data,
            'data_points': len(data),
            'original_points': len(telemetry)
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=f"Data not found: {str(e)}")
    except Exception as e:
        import traceback
        error_detail = f"Error loading telemetry: {str(e)}"
        print(f"{error_detail}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_detail)


# Removed: Using calculate_telemetry_delta from telemetry_optimizer module instead
