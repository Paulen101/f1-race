"""Prediction endpoints"""
from fastapi import APIRouter, HTTPException, Query
from app.services import f1_service
from app.ml import race_predictor, championship_predictor
from app.models import PredictionRequest, PredictionResponse
import pandas as pd
import fastf1
import random
import zlib
from datetime import datetime
from typing import Optional, List, Dict, Any

router = APIRouter()


@router.get("/years")
async def get_available_years() -> Dict[str, List[int]]:
    """Get list of available years for predictions"""
    current_year = datetime.now().year
    # F1 data typically available from 2018 onwards with FastF1
    years = list(range(2018, current_year + 1))
    return {"years": years}


@router.get("/tracks/{year}")
def get_available_tracks(year: int) -> Dict[str, Any]:
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
def get_available_drivers(year: int) -> Dict[str, Any]:
    """Get list of drivers for a specific year efficiently"""
    try:
        schedule = fastf1.get_event_schedule(year)
        drivers_set = set()
        
        # Get the most recent completed race to get a representative driver list
        # Filter for completed races (EventDate < now) and sort by date descending
        completed_races = schedule[schedule['EventDate'] < pd.Timestamp.now()].sort_values('EventDate', ascending=False)
        
        if completed_races.empty:
            # If no races completed yet, try to get drivers from the first race of the year
            # (which might be the upcoming one)
            completed_races = schedule.iloc[:1]

        for _, event in completed_races.iterrows():
            try:
                # Only load the first successful session we find
                session = fastf1.get_session(year, event['EventName'], 'Race')
                session.load(laps=False, telemetry=False, weather=False, messages=False)
                
                if hasattr(session, 'results') and session.results is not None:
                    for _, driver in session.results.iterrows():
                        abbr = driver.get('Abbreviation', '')
                        full_name = driver.get('FullName', '') or driver.get('Driver', '')
                        if abbr:
                            drivers_set.add((abbr, full_name))
                    
                    if drivers_set:
                        break # Successfully got drivers, no need to check more races
            except Exception as e:
                print(f"Warning: Could not load session for {event['EventName']}: {e}")
                continue
        
        drivers = [{"code": code, "name": name} for code, name in sorted(drivers_set, key=lambda x: x[1])]
        return {"year": year, "drivers": drivers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/next-race/{year}")
def get_next_race(year: int) -> Dict[str, Any]:
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
def predict_race_outcome(request: PredictionRequest) -> Dict[str, Any]:
    """Predict race outcome based on past season data and qualifying results.

    Declared with plain ``def`` so FastAPI runs it in a worker thread: FastF1
    loading is blocking and would otherwise freeze every other request.
    """
    try:
        print(f"Predicting race for {request.year} {request.grand_prix}")

        if request.quick_mode:
            return _quick_prediction(request.year, request.grand_prix)

        # Only use races held before the target event, so predicting a past race
        # doesn't peek at results from later in the season.
        target_date = _get_event_date(request.year, request.grand_prix)
        historical_data = _get_season_data(
            request.year, before=target_date, exclude_race=request.grand_prix, limit_races=10
        )

        quali_results = _load_session_results(request.year, request.grand_prix, 'Qualifying')
        has_quali = quali_results is not None
        if has_quali:
            print("Using qualifying data for predictions")
        else:
            print("Qualifying data not available, using historical performance only")

        # Use only the last 2 previous years for the most relevant data
        current_year = request.year
        multi_season_data = _get_multi_season_data(max(2018, current_year - 2), current_year - 1, limit_races=20)

        all_historical = pd.concat([multi_season_data, historical_data], ignore_index=True)

        if all_historical.empty:
            # Fallback to quick prediction if no data available
            return _quick_prediction(request.year, request.grand_prix)

        # Chronological order, so "recent form" really means the latest races
        all_historical = all_historical.sort_values(['Year', 'RoundNumber'], kind='stable')

        if has_quali:
            prediction = _predict_with_quali(all_historical, quali_results, request.grand_prix)
            prediction['status'] = 'Prediction completed using qualifying and 2-year historical data'
        else:
            prediction = _predict_from_history(all_historical, request.year, request.grand_prix)
            prediction['status'] = 'Prediction completed using 2-year historical data'

        prediction['data_info'] = {
            'historical_races': _count_races(all_historical),
            'has_qualifying': has_quali,
            'season_races_analyzed': _count_races(historical_data),
        }

        return prediction
    except Exception as e:
        print(f"Error in predict_race_outcome: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/race/quick")
def predict_race_quick(request: PredictionRequest) -> Dict[str, Any]:
    """Quick prediction without loading historical data - instant results"""
    try:
        return _quick_prediction(request.year, request.grand_prix)
    except Exception as e:
        print(f"Error in quick prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/championship/{year}")
async def predict_championship(year: int, remaining_races: int = 5) -> Dict[str, Any]:
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
def predict_podium(year: int, grand_prix: str) -> Dict[str, Any]:
    """Predict podium finishers for a specific race"""
    try:
        request = PredictionRequest(year=year, grand_prix=grand_prix)
        prediction = predict_race_outcome(request)

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


def _get_event_date(year: int, grand_prix: str) -> Optional[pd.Timestamp]:
    """Return the race date of an event, or None if it can't be resolved."""
    try:
        event = fastf1.get_event(year, grand_prix)
        return event['EventDate'] if pd.notna(event['EventDate']) else None
    except Exception as e:
        print(f"Could not resolve event date for {year} {grand_prix}: {e}")
        return None


def _load_session_results(year: int, event_name: str, session_name: str) -> Optional[pd.DataFrame]:
    """Load only the classification of a session (no laps/telemetry), or None."""
    try:
        session = fastf1.get_session(year, event_name, session_name)
        session.load(laps=False, telemetry=False, weather=False, messages=False)
        results = session.results
        if results is None or results.empty or results['Position'].isna().all():
            return None
        return results
    except Exception as e:
        print(f"Error loading {year} {event_name} {session_name}: {str(e)}")
        return None


def _count_races(data: pd.DataFrame) -> int:
    """Number of distinct races in a results frame."""
    if data.empty:
        return 0
    return int(data[['Year', 'RoundNumber']].drop_duplicates().shape[0])


def _get_season_data(year: int, before: Optional[pd.Timestamp] = None,
                     exclude_race: Optional[str] = None, limit_races: Optional[int] = None) -> pd.DataFrame:
    """Get race results for a season, most recent races first.

    Only races held before ``before`` (default: now) are used, and
    ``limit_races`` keeps the most recent ones rather than the first ones.
    """
    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        cutoff = pd.Timestamp.now()
        if before is not None:
            cutoff = min(cutoff, before)

        completed = schedule[schedule['EventDate'] < cutoff]
        if exclude_race:
            completed = completed[completed['EventName'] != exclude_race]
        completed = completed.sort_values('EventDate', ascending=False)

        all_data = []
        for _, event in completed.iterrows():
            if limit_races and len(all_data) >= limit_races:
                break

            results = _load_session_results(year, event['EventName'], 'Race')
            if results is None:
                continue

            results = results.copy()
            results['Year'] = year
            results['RoundNumber'] = event.get('RoundNumber', 0)
            results['GrandPrix'] = event['EventName']
            results['Driver'] = results['Abbreviation']
            all_data.append(results)

        if all_data:
            return pd.concat(all_data, ignore_index=True)
        return pd.DataFrame()

    except Exception as e:
        print(f"Error in _get_season_data: {str(e)}")
        return pd.DataFrame()


def _get_multi_season_data(start_year: int, end_year: int, limit_races: Optional[int] = None) -> pd.DataFrame:
    """Get race data across multiple seasons, filling the limit from the newest season back."""
    all_seasons = []
    total_races = 0

    for year in range(end_year, start_year - 1, -1):
        remaining_limit = limit_races - total_races if limit_races else None
        if limit_races and remaining_limit <= 0:
            break

        season_data = _get_season_data(year, limit_races=remaining_limit)
        if not season_data.empty:
            all_seasons.append(season_data)
            total_races += _count_races(season_data)

    if all_seasons:
        return pd.concat(all_seasons, ignore_index=True)
    return pd.DataFrame()


def _normalize(probs: Dict[str, float], total: float = 1.0, cap: float = 0.99) -> Dict[str, float]:
    """Scale probabilities to sum to ``total`` with no single value above ``cap``.

    Win and fastest-lap odds sum to 1 (one winner); podium odds sum to 3
    (three podium places), each capped so no driver exceeds ``cap``.
    """
    probs = {k: max(0.0, float(v)) for k, v in probs.items() if pd.notna(v)}
    total = min(total, cap * len(probs))
    result: Dict[str, float] = {}
    free = dict(probs)

    while free:
        remaining = total - sum(result.values())
        free_sum = sum(free.values())
        if free_sum <= 0 or remaining <= 0:
            result.update({k: 0.0 for k in free})
            break
        scaled = {k: v * remaining / free_sum for k, v in free.items()}
        over = [k for k, v in scaled.items() if v > cap]
        if not over:
            result.update(scaled)
            break
        for k in over:
            result[k] = cap
            del free[k]

    return dict(sorted(result.items(), key=lambda x: x[1], reverse=True))


def _finalize(predictions: dict) -> dict:
    """Normalize raw scores into probabilities and keep them mutually consistent."""
    predictions['race_winner'] = _normalize(predictions['race_winner'], 1.0)
    predictions['fastest_lap'] = _normalize(predictions['fastest_lap'], 1.0)
    podium = _normalize(predictions['podium'], 3.0)
    # A driver can't be likelier to win than to finish on the podium
    for driver, win_prob in predictions['race_winner'].items():
        podium[driver] = max(podium.get(driver, 0.0), win_prob)
    predictions['podium'] = dict(sorted(podium.items(), key=lambda x: x[1], reverse=True))
    return predictions


def _predict_with_quali(historical_data: pd.DataFrame, quali_results: pd.DataFrame, grand_prix: str) -> dict:
    """Predict race outcome using qualifying results and historical performance"""
    predictions = {
        'race_winner': {},
        'podium': {},
        'fastest_lap': {},
        'confidence': 0.7
    }

    for _, driver in quali_results.iterrows():
        driver_code = driver.get('Abbreviation', '')
        if not driver_code:
            continue
        quali_pos = driver.get('Position')
        if pd.isna(quali_pos):
            quali_pos = 20  # No quali time set: treat as back of the grid

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

        predictions['race_winner'][driver_code] = win_prob
        predictions['podium'][driver_code] = podium_prob
        predictions['fastest_lap'][driver_code] = fastest_prob

    return _finalize(predictions)


def _predict_from_history(historical_data: pd.DataFrame, year: int, grand_prix: str) -> dict:
    """Predict race outcome using only historical data (when quali not available)"""
    predictions = {
        'race_winner': {},
        'podium': {},
        'fastest_lap': {},
        'confidence': 0.5
    }

    # Only drivers who raced in the most recent season we have data for;
    # otherwise retired drivers from two seasons ago get predicted too.
    latest_year = historical_data['Year'].max()
    drivers = historical_data.loc[historical_data['Year'] == latest_year, 'Driver'].dropna().unique()

    for driver_code in drivers:
        driver_history = historical_data[historical_data['Driver'] == driver_code]

        if len(driver_history) > 0:
            avg_finish = driver_history['Position'].mean()
            wins = (driver_history['Position'] == 1).sum()
            podiums = (driver_history['Position'] <= 3).sum()
            total_races = len(driver_history)

            win_rate = wins / total_races
            podium_rate = podiums / total_races

            # Weight recent performance more heavily (data is sorted chronologically)
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

    return _finalize(predictions)


# Static ratings used by quick mode. Drivers on the actual qualifying grid who
# aren't listed here fall back to DEFAULT_DRIVER_RATING.
DRIVER_RATINGS = {
    'VER': 0.95, 'HAM': 0.85, 'LEC': 0.82, 'NOR': 0.88, 'PER': 0.75,
    'SAI': 0.78, 'RUS': 0.82, 'ALO': 0.76, 'PIA': 0.80, 'STR': 0.70,
    'GAS': 0.65, 'ALB': 0.68, 'OCO': 0.62, 'TSU': 0.60, 'HUL': 0.58,
    'RIC': 0.63, 'ZHO': 0.52, 'BOT': 0.55, 'SAR': 0.50, 'MAG': 0.56,
    'BEA': 0.54, 'LAW': 0.51, 'COL': 0.48, 'HAD': 0.45, 'ANT': 0.72,
    'BOR': 0.50,
}
DEFAULT_DRIVER_RATING = 0.5


def _quick_prediction(year: int, grand_prix: str) -> dict:
    """Quick prediction based on driver ratings with optional qualifying boost."""
    # Seed from a stable checksum: Python's hash() of a str changes on every
    # interpreter start, so it gave different "deterministic" results per restart.
    rng = random.Random(zlib.crc32(f"{year}:{grand_prix}".encode()))

    # Lightweight qualifying integration: one session load, then fast fallback.
    quali_positions = {}
    quali_results = _load_session_results(year, grand_prix, 'Qualifying')
    if quali_results is not None:
        for _, row in quali_results.iterrows():
            code = row.get('Abbreviation', '')
            pos = row.get('Position', None)
            if code and pd.notna(pos):
                quali_positions[code] = int(pos)
    has_quali = len(quali_positions) > 0

    # With qualifying, predict for the real grid instead of the static table
    if has_quali:
        drivers = {code: DRIVER_RATINGS.get(code, DEFAULT_DRIVER_RATING) for code in quali_positions}
    else:
        drivers = DRIVER_RATINGS

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

    for driver, base_rating in sorted(drivers.items()):
        # Add track-specific variation
        track_factor = rng.uniform(0.85, 1.15)

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

    _finalize(predictions)

    # Dynamic confidence: increase when qualifying exists and top pick has clear edge.
    winner_probs = list(predictions['race_winner'].values())
    top1 = winner_probs[0] if len(winner_probs) > 0 else 0.0
    top2 = winner_probs[1] if len(winner_probs) > 1 else 0.0
    separation_bonus = min(0.12, max(0.0, (top1 - top2) * 2.0))
    quali_bonus = 0.08 if has_quali else 0.0
    predictions['confidence'] = float(min(0.95, 0.75 + separation_bonus + quali_bonus))

    return predictions
