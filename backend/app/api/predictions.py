"""Prediction endpoints"""
from fastapi import APIRouter, HTTPException
from app.services import f1_service
from app.ml import race_predictor, championship_predictor
from app.models import PredictionRequest, PredictionResponse
import pandas as pd

router = APIRouter()


@router.post("/race")
async def predict_race_outcome(request: PredictionRequest):
    """Predict race outcome based on qualifying and historical data"""
    try:
        # Get qualifying results
        quali_session = await f1_service.get_session(request.year, request.grand_prix, 'Qualifying')
        quali_results = quali_session.results
        
        if quali_results is None or quali_results.empty:
            raise HTTPException(status_code=404, detail="Qualifying results not available")
        
        # Get historical driver data (previous races in the season)
        historical_data = await _get_season_data(request.year)
        
        # Load or use existing model
        if not race_predictor.is_trained:
            # Try to load saved model
            if not race_predictor.load():
                # Train on historical data if model doesn't exist
                all_historical = await _get_multi_season_data(request.year - 2, request.year - 1)
                if len(all_historical) > 100:
                    race_predictor.train(all_historical)
                    race_predictor.save()
        
        # Make prediction
        if race_predictor.is_trained:
            prediction = race_predictor.predict_race(historical_data, quali_results)
        else:
            # Fallback to simple qualifying-based prediction
            prediction = _simple_prediction(quali_results)
        
        return prediction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/championship/{year}")
async def predict_championship(year: int, remaining_races: int = 5):
    """Predict final championship standings"""
    try:
        # Get current standings
        standings = await f1_service.get_driver_standings(year)
        
        # Predict final standings
        predictions = championship_predictor.predict_final_standings(standings, remaining_races)
        
        return {
            'year': year,
            'remaining_races': remaining_races,
            'predictions': predictions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/podium/{year}/{grand_prix}")
async def predict_podium(year: int, grand_prix: str):
    """Predict podium finishers for a specific race"""
    try:
        request = PredictionRequest(year=year, grand_prix=grand_prix)
        prediction = await predict_race_outcome(request)
        
        # Get top 3 from podium predictions
        podium_probs = prediction.get('podium', {})
        top_3 = list(podium_probs.items())[:3]
        
        return {
            'grand_prix': grand_prix,
            'predicted_podium': [
                {'position': i+1, 'driver': driver, 'probability': prob}
                for i, (driver, prob) in enumerate(top_3)
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _get_season_data(year: int) -> pd.DataFrame:
    """Get all race data for a season"""
    import fastf1
    
    try:
        schedule = fastf1.get_event_schedule(year)
        all_data = []
        
        for _, event in schedule.iterrows():
            if event['EventDate'] > pd.Timestamp.now():
                continue
            
            try:
                race = fastf1.get_session(year, event['EventName'], 'Race')
                race.load()
                
                results = race.results
                if results is not None and not results.empty:
                    results['Year'] = year
                    results['RoundNumber'] = event.get('RoundNumber', 0)
                    results['Driver'] = results['Abbreviation']
                    all_data.append(results)
            except:
                continue
        
        if all_data:
            return pd.concat(all_data, ignore_index=True)
        return pd.DataFrame()
    
    except Exception:
        return pd.DataFrame()


async def _get_multi_season_data(start_year: int, end_year: int) -> pd.DataFrame:
    """Get race data across multiple seasons"""
    all_seasons = []
    
    for year in range(start_year, end_year + 1):
        season_data = await _get_season_data(year)
        if not season_data.empty:
            all_seasons.append(season_data)
    
    if all_seasons:
        return pd.concat(all_seasons, ignore_index=True)
    return pd.DataFrame()


def _simple_prediction(quali_results: pd.DataFrame) -> dict:
    """Simple prediction based on qualifying positions"""
    predictions = {
        'race_winner': {},
        'podium': {},
        'fastest_lap': {},
        'confidence': 0.5
    }
    
    for _, driver in quali_results.iterrows():
        driver_code = driver.get('Abbreviation', 'Unknown')
        position = driver.get('Position', 20)
        
        # Simple probability based on qualifying position
        if position <= 10:
            win_prob = max(0.01, 0.5 - (position - 1) * 0.05)
            podium_prob = max(0.01, 0.8 - (position - 1) * 0.06)
            fastest_prob = max(0.01, 0.4 - (position - 1) * 0.03)
        else:
            win_prob = 0.01
            podium_prob = 0.05
            fastest_prob = 0.05
        
        predictions['race_winner'][driver_code] = win_prob
        predictions['podium'][driver_code] = podium_prob
        predictions['fastest_lap'][driver_code] = fastest_prob
    
    # Sort by probability
    predictions['race_winner'] = dict(sorted(predictions['race_winner'].items(), key=lambda x: x[1], reverse=True))
    predictions['podium'] = dict(sorted(predictions['podium'].items(), key=lambda x: x[1], reverse=True))
    predictions['fastest_lap'] = dict(sorted(predictions['fastest_lap'].items(), key=lambda x: x[1], reverse=True))
    
    return predictions
