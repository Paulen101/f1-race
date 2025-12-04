"""Main FastAPI application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import fastf1
from app.config import settings
from app.api import (
    sessions,
    telemetry,
    laptimes,
    strategy,
    predictions,
    drivers,
    circuits,
    comparisons
)

# Enable FastF1 cache
fastf1.Cache.enable_cache(settings.FASTF1_CACHE_DIR)

app = FastAPI(
    title="F1 Analytics API",
    description="Advanced Formula 1 analytics and prediction platform",
    version="1.0.0",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sessions.router, prefix=f"{settings.API_PREFIX}/sessions", tags=["Sessions"])
app.include_router(telemetry.router, prefix=f"{settings.API_PREFIX}/telemetry", tags=["Telemetry"])
app.include_router(laptimes.router, prefix=f"{settings.API_PREFIX}/laptimes", tags=["Lap Times"])
app.include_router(strategy.router, prefix=f"{settings.API_PREFIX}/strategy", tags=["Strategy"])
app.include_router(predictions.router, prefix=f"{settings.API_PREFIX}/predictions", tags=["Predictions"])
app.include_router(drivers.router, prefix=f"{settings.API_PREFIX}/drivers", tags=["Drivers"])
app.include_router(circuits.router, prefix=f"{settings.API_PREFIX}/circuits", tags=["Circuits"])
app.include_router(comparisons.router, prefix=f"{settings.API_PREFIX}/comparisons", tags=["Comparisons"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "F1 Analytics API",
        "version": "1.0.0",
        "docs": f"{settings.API_PREFIX}/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )
