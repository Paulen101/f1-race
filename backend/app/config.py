"""Application configuration"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_PREFIX: str = "/api/v1"
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000"]
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    # FastF1 Cache
    FASTF1_CACHE_DIR: str = "./cache"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    CACHE_TTL: int = 3600  # 1 hour
    
    # ML Models
    MODEL_DIR: str = "./app/ml/models"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Ensure cache directory exists
os.makedirs(settings.FASTF1_CACHE_DIR, exist_ok=True)
os.makedirs(settings.MODEL_DIR, exist_ok=True)
