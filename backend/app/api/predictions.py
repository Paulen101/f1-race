"""Prediction endpoints"""
from fastapi import APIRouter, HTTPException, Query
from app.services import f1_service
from app.ml import race_predictor, championship_predictor
from app.models import PredictionRequest, PredictionResponse
import pandas as pd
import fastf1
from datetime import datetime
from typing import Optional, List

router = APIRouter()


@router.get("/years")
async def get_available_years():
    """Get list of available years for predictions"""
    current_year = datetime.now().year
    # F1 data typically available from 2018 onwards with FastF1
    years = list(range(2018, current_year + 1))
    return {"years": years}


@router.get("/tracks/{year}")
async def get_available_tracks(year: int):
    """Get list of available tracks for a specific year"""
    try:
        schedule = fastf1.get_event_schedule(year)
        tracks = []
        
        for _, event in schedule.iterrows():
            tracks.append({
                "name": event['EventName'],
                "country": event['Country'],
                "location": event['Location'],
                "date": event['EventDate'].isoformat() if pd.notna(event['EventDate']) else None,
                "round": int(event['RoundNumber']) if 'RoundNumber' in event else None
            })
        
        return {"year": year, "tracks": tracks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drivers/{year}")
async def get_available_drivers(year: int):
    """Get list of drivers for a specific year"""
    try:
        schedule = fastf1.get_event_schedule(year)
        drivers_set = set()
        
        # Get drivers from first completed race
        for _, event in schedule.iterrows():
            if event['EventDate'] < pd.Timestamp.now():
                try:
                    session = fastf1.get_session(year, event['EventName'], 'Race')
                    session.load()
                    if hasattr(session, 'results') and session.results is not None:
                        for _, driver in session.results.iterrows():
                            abbr = driver.get('Abbreviation', '')
                            full_name = driver.get('FullName', '') or driver.get('Driver', '')
                            if abbr:
                                drivers_set.add((abbr, full_name))
                        break
                except:
                    continue
        
        drivers = [{"code": code, "name": name} for code, name in sorted(drivers_set, key=lambda x: x[1])]
        return {"year": year, "drivers": drivers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/next-race/{year}")
async def get_next_race(year: int):
    """Get the next upcoming race for predictions"""
    try:
        schedule = fastf1.get_event_schedule(year)
        now = pd.Timestamp.now()
        
        upcoming_races = schedule[schedule['EventDate'] >= now]
        
        if len(upcoming_races) > 0:
            next_race = upcoming_races.iloc[0]
            return {
                "grand_prix": next_race['EventName'],
                "country": next_race['Country'],
                "location": next_race['Location'],
                "date": next_race['EventDate'].isoformat(),
                "round": int(next_race['RoundNumber']) if 'RoundNumber' in next_race else None
            }
        else:
            return {"message": "No upcoming races this year"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/race")
async def predict_race_outcome(request: PredictionRequest):
    """Predict race outcome based on past season data and qualifying results"""
    try:
        print(f"Predicting race for {request.year} {request.grand_prix}")
        
        # Quick prediction mode - skip historical data loading
        if hasattr(request, 'quick_mode') and request.quick_mode:
            return _quick_prediction(request.year, request.grand_prix)
        
        # Get current season data (only completed races, excluding target race)
        historical_data = await _get_season_data(request.year, exclude_race=request.grand_prix, limit_races=10)
        
        # Try to get qualifying results if available (don't wait too long)
        quali_results = None
        has_quali = False
        try:
            quali_session = await f1_service.get_session(request.year, request.grand_prix, 'Qualifying')
            quali_results = quali_session.results
            if quali_results is not None and not quali_results.empty:
                has_quali = True
                print(f"Using qualifying data for predictions")
        except:
            print(f"Qualifying data not available, using historical performance only")
        
        # Only use 2 previous years instead of 3 for faster loading
        multi_season_data = await _get_multi_season_data(max(2018, request.year - 2), request.year - 1, limit_races=15)
        
        # Combine with current season data
        all_historical = pd.concat([multi_season_data, historical_data], ignore_index=True) if not historical_data.empty else multi_season_data
        
        if all_historical.empty:
            # Fallback to quick prediction if no data available
            return _quick_prediction(request.year, request.grand_prix)
        
        # Make prediction based on available data
        if has_quali:
            prediction = _predict_with_quali(all_historical, quali_results, request.grand_prix)
        else:
            prediction = _predict_from_history(all_historical, request.year, request.grand_prix)
        
        prediction['data_info'] = {
            'historical_races': len(all_historical) // 20 if len(all_historical) > 0 else 0,
            'has_qualifying': has_quali,
            'season_races_analyzed': len(historical_data) // 20 if len(historical_data) > 0 else 0
        }
        
        return prediction
    except Exception as e:
        print(f"Error in predict_race_outcome: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/race/quick")
async def predict_race_quick(request: PredictionRequest):
    """Quick prediction without loading historical data - instant results"""
    try:
        return _quick_prediction(request.year, request.grand_prix)
    except Exception as e:
        print(f"Error in quick prediction: {str(e)}")
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


async def _get_season_data(year: int, exclude_race: Optional[str] = None, limit_races: Optional[int] = None) -> pd.DataFrame:
    """Get all race data for a season, optionally excluding a specific race"""
    try:
        schedule = fastf1.get_event_schedule(year)
        all_data = []
        races_loaded = 0
        
        for _, event in schedule.iterrows():
            # Skip future races and optionally the race we're predicting
            if event['EventDate'] > pd.Timestamp.now():
                continue
            if exclude_race and event['EventName'] == exclude_race:
                continue
            
            # Limit number of races to load for faster performance
            if limit_races and races_loaded >= limit_races:
                break
            
            try:
                race = fastf1.get_session(year, event['EventName'], 'Race')
                race.load(telemetry=False, weather=False, messages=False)  # Skip unnecessary data
                
                results = race.results
                if results is not None and not results.empty:
                    results = results.copy()
                    results['Year'] = year
                    results['RoundNumber'] = event.get('RoundNumber', 0)
                    results['GrandPrix'] = event['EventName']
                    results['Driver'] = results.get('Abbreviation', results.get('Driver', ''))
                    all_data.append(results)
                    races_loaded += 1
            except Exception as e:
                print(f"Error loading {event['EventName']}: {str(e)}")
                continue
        
        if all_data:
            return pd.concat(all_data, ignore_index=True)
        return pd.DataFrame()
    
    except Exception as e:
        print(f"Error in _get_season_data: {str(e)}")
        return pd.DataFrame()


async def _get_multi_season_data(start_year: int, end_year: int, limit_races: Optional[int] = None) -> pd.DataFrame:
    """Get race data across multiple seasons"""
    all_seasons = []
    total_races = 0
    
    for year in range(start_year, end_year + 1):
        remaining_limit = limit_races - total_races if limit_races else None
        if limit_races and remaining_limit <= 0:
            break
            
        season_data = await _get_season_data(year, limit_races=remaining_limit)
        if not season_data.empty:
            all_seasons.append(season_data)
            total_races += len(season_data) // 20  # Approximate number of races
    
    if all_seasons:
        return pd.concat(all_seasons, ignore_index=True)
    return pd.DataFrame()


def _predict_with_quali(historical_data: pd.DataFrame, quali_results: pd.DataFrame, grand_prix: str) -> dict:
    """Predict race outcome using qualifying results and historical performance"""
    predictions = {
        'race_winner': {},
        'podium': {},
        'fastest_lap': {},
        'confidence': 0.7
    }
    
    for _, driver in quali_results.iterrows():
        driver_code = driver.get('Abbreviation', 'Unknown')
        quali_pos = driver.get('Position', 20)
        
        # Get driver's historical performance
        driver_history = historical_data[historical_data['Driver'] == driver_code]
        
        if len(driver_history) > 0:
            avg_finish = driver_history['Position'].mean()
            wins = (driver_history['Position'] == 1).sum()
            podiums = (driver_history['Position'] <= 3).sum()
            total_races = len(driver_history)
            
            win_rate = wins / total_races if total_races > 0 else 0
            podium_rate = podiums / total_races if total_races > 0 else 0
        else:
            avg_finish = 15
            win_rate = 0
            podium_rate = 0
        
        # Combine quali position with historical performance
        quali_factor = max(0.01, 0.6 - (quali_pos - 1) * 0.05)
        history_factor = max(0.01, 0.4 * (1 - avg_finish / 20))
        
        win_prob = (quali_factor * 0.6 + history_factor * 0.4) * (1 + win_rate)
        podium_prob = (quali_factor * 0.5 + history_factor * 0.5) * (1 + podium_rate)
        fastest_prob = quali_factor * 0.7 + history_factor * 0.3
        
        predictions['race_winner'][driver_code] = min(0.95, win_prob)
        predictions['podium'][driver_code] = min(0.95, podium_prob)
        predictions['fastest_lap'][driver_code] = min(0.95, fastest_prob)
    
    # Normalize probabilities
    for key in ['race_winner', 'podium', 'fastest_lap']:
        total = sum(predictions[key].values())
        if total > 0:
            predictions[key] = {k: v/total for k, v in predictions[key].items()}
        predictions[key] = dict(sorted(predictions[key].items(), key=lambda x: x[1], reverse=True))
    
    return predictions


def _predict_from_history(historical_data: pd.DataFrame, year: int, grand_prix: str) -> dict:
    """Predict race outcome using only historical data (when quali not available)"""
    predictions = {
        'race_winner': {},
        'podium': {},
        'fastest_lap': {},
        'confidence': 0.5
    }
    
    # Get all unique drivers from historical data
    drivers = historical_data['Driver'].unique()
    
    for driver_code in drivers:
        driver_history = historical_data[historical_data['Driver'] == driver_code]
        
        if len(driver_history) > 0:
            avg_finish = driver_history['Position'].mean()
            wins = (driver_history['Position'] == 1).sum()
            podiums = (driver_history['Position'] <= 3).sum()
            total_races = len(driver_history)
            
            win_rate = wins / total_races
            podium_rate = podiums / total_races
            
            # Weight recent performance more heavily
            recent_races = driver_history.tail(5)
            recent_avg = recent_races['Position'].mean() if len(recent_races) > 0 else avg_finish
            
            # Calculate probabilities based on historical performance
            performance_score = 1 - (recent_avg / 20)
            
            win_prob = (win_rate * 0.6 + performance_score * 0.4)
            podium_prob = (podium_rate * 0.5 + performance_score * 0.5)
            fastest_prob = performance_score * 0.7
            
            predictions['race_winner'][driver_code] = max(0.01, win_prob)
            predictions['podium'][driver_code] = max(0.01, podium_prob)
            predictions['fastest_lap'][driver_code] = max(0.01, fastest_prob)
    
    # Normalize and sort
    for key in ['race_winner', 'podium', 'fastest_lap']:
        total = sum(predictions[key].values())
        if total > 0:
            predictions[key] = {k: v/total for k, v in predictions[key].items()}
        predictions[key] = dict(sorted(predictions[key].items(), key=lambda x: x[1], reverse=True))
    
    return predictions


def _quick_prediction(year: int, grand_prix: str) -> dict:
    """Quick prediction based on driver ratings with optional qualifying boost."""
    # 2024/2025 typical driver performance (can be updated)
    driver_ratings = {
        'VER': 0.95, 'HAM': 0.85, 'LEC': 0.82, 'NOR': 0.88, 'PER': 0.75,
        'SAI': 0.78, 'RUS': 0.82, 'ALO': 0.76, 'PIA': 0.80, 'STR': 0.70,
        'GAS': 0.65, 'ALB': 0.68, 'OCO': 0.62, 'TSU': 0.60, 'HUL': 0.58,
        'RIC': 0.63, 'ZHO': 0.52, 'BOT': 0.55, 'SAR': 0.50, 'MAG': 0.56,
        'BEA': 0.54, 'LAW': 0.51, 'COL': 0.48, 'HAD': 0.45
    }
    
    # Add deterministic track variation for repeatability
    import random
    random.seed(hash(grand_prix))  # Deterministic randomness based on track

    # Lightweight qualifying integration: one session load, then fast fallback.
    quali_positions = {}
    has_quali = False
    try:
        quali_session = fastf1.get_session(year, grand_prix, 'Qualifying')
        quali_session.load(laps=False, telemetry=False, weather=False, messages=False)
        quali_results = getattr(quali_session, 'results', None)

        if quali_results is not None and not quali_results.empty:
            for _, row in quali_results.iterrows():
                code = row.get('Abbreviation', '')
                pos = row.get('Position', None)
                if code and pd.notna(pos):
                    quali_positions[code] = int(pos)

            has_quali = len(quali_positions) > 0
    except Exception:
        # Keep quick mode resilient and fast if quali data is unavailable.
        pass
    
    predictions = {
        'race_winner': {},
        'podium': {},
        'fastest_lap': {},
        'confidence': 0.65,
        'data_info': {
            'historical_races': 0,
            'has_qualifying': has_quali,
            'season_races_analyzed': 0,
            'mode': 'quick_prediction'
        }
    }
    
    for driver, base_rating in driver_ratings.items():
        # Add track-specific variation
        track_factor = random.uniform(0.85, 1.15)

        # Grid position meaningfully impacts race outcomes. Boost front rows,
        # soften deeper grid spots without overwhelming base performance.
        quali_factor = 1.0
        if driver in quali_positions:
            pos = quali_positions[driver]
            quali_factor = max(0.72, 1.18 - (pos - 1) * 0.02)

        adjusted_rating = base_rating * track_factor * quali_factor
        
        # Win probability
        win_prob = max(0.01, adjusted_rating ** 3)
        
        # Podium probability (higher chance)
        podium_prob = max(0.05, adjusted_rating ** 2)
        
        # Fastest lap probability
        fastest_prob = max(0.02, adjusted_rating ** 2.5)
        
        predictions['race_winner'][driver] = win_prob
        predictions['podium'][driver] = podium_prob
        predictions['fastest_lap'][driver] = fastest_prob
    
    # Normalize probabilities
    for key in ['race_winner', 'podium', 'fastest_lap']:
        total = sum(predictions[key].values())
        if total > 0:
            predictions[key] = {k: v/total for k, v in predictions[key].items()}
        predictions[key] = dict(sorted(predictions[key].items(), key=lambda x: x[1], reverse=True))

    # Dynamic confidence: increase when qualifying exists and top pick has clear edge.
    winner_probs = list(predictions['race_winner'].values())
    top1 = winner_probs[0] if len(winner_probs) > 0 else 0.0
    top2 = winner_probs[1] if len(winner_probs) > 1 else 0.0
    separation_bonus = min(0.08, max(0.0, (top1 - top2) * 1.5))
    quali_bonus = 0.05 if has_quali else 0.0
    predictions['confidence'] = float(min(0.82, 0.62 + separation_bonus + quali_bonus))
    
    return predictions
