"""Pydantic models for API requests and responses"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class SessionInfo(BaseModel):
    """Session information"""
    year: int
    grand_prix: str
    session_name: str
    session_date: Optional[datetime] = None


class LapTimeData(BaseModel):
    """Lap time data"""
    driver: str
    lap_number: int
    lap_time: float
    sector1: Optional[float] = None
    sector2: Optional[float] = None
    sector3: Optional[float] = None
    compound: Optional[str] = None
    tire_life: Optional[int] = None
    track_status: Optional[str] = None


class TelemetryData(BaseModel):
    """Telemetry data point"""
    distance: float
    speed: float
    throttle: float
    brake: float
    gear: int
    rpm: Optional[float] = None
    drs: Optional[int] = None


class DriverComparison(BaseModel):
    """Driver comparison request"""
    year: int
    grand_prix: str
    session_name: str
    driver1: str
    driver2: str
    lap_number: Optional[int] = None


class StrategyAnalysis(BaseModel):
    """Strategy analysis data"""
    driver: str
    stints: List[Dict[str, Any]]
    pit_stops: List[Dict[str, Any]]
    total_pit_time: float


class PredictionRequest(BaseModel):
    """Race prediction request"""
    year: int
    grand_prix: str
    include_weather: bool = False


class PredictionResponse(BaseModel):
    """Race prediction response"""
    race_winner: Dict[str, float]  # driver: probability
    podium: Dict[str, float]
    fastest_lap: Dict[str, float]
    confidence: float


class DriverStats(BaseModel):
    """Driver statistics"""
    driver_code: str
    driver_name: str
    team: str
    points: Optional[int] = None
    wins: Optional[int] = None
    podiums: Optional[int] = None
    poles: Optional[int] = None
    fastest_laps: Optional[int] = None


class CircuitInfo(BaseModel):
    """Circuit information"""
    circuit_name: str
    location: str
    country: str
    circuit_length: Optional[float] = None
    lap_record: Optional[Dict[str, Any]] = None
    num_laps: Optional[int] = None


class ErrorResponse(BaseModel):
    """Error response"""
    detail: str
    error_type: Optional[str] = None
