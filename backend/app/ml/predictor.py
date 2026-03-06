"""Race prediction machine learning models"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
import joblib
import os
from typing import Dict, List, Any
from app.config import settings
from app.ml.feature_engineering import (
    calculate_rolling_form,
    calculate_average_pit_stop_duration,
    calculate_track_specific_performance,
    extract_enhanced_features
)


class RacePredictionModel:
    """Machine learning model for race predictions"""
    
    def __init__(self):
        self.winner_model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.podium_model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.fastest_lap_model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.scaler = StandardScaler()
        self.is_trained = False
    
    def _extract_features(self, driver_data: pd.DataFrame, qualifying_results: pd.DataFrame, 
                         session=None, current_round: int = None) -> np.ndarray:
        """
        Extract enhanced features for prediction including:
        - Qualifying position
        - Historical performance metrics
        - Rolling form (last 3 races average)
        - Track-specific performance
        - Average pit stop duration for the track
        """
        features = []
        
        for _, driver in qualifying_results.iterrows():
            driver_code = driver.get('Abbreviation', '')
            
            # Historical performance features
            driver_history = driver_data[driver_data['Driver'] == driver_code]
            
            # Basic features
            quali_position = driver.get('Position', 20)
            races_completed = len(driver_history)
            career_avg = driver_history['Position'].mean() if len(driver_history) > 0 else 15.0
            total_points = driver_history['Points'].sum() if len(driver_history) > 0 else 0.0
            wins = (driver_history['Position'] == 1).sum() if len(driver_history) > 0 else 0
            podiums = (driver_history['Position'] <= 3).sum() if len(driver_history) > 0 else 0
            
            # Enhanced feature: Rolling form (last 3 races)
            rolling_form = 15.0  # Default
            if current_round and len(driver_history) > 0:
                rolling_form = calculate_rolling_form(driver_history, current_round, window=3)
            
            # Enhanced feature: Track-specific performance
            track_avg = 15.0  # Default
            if session:
                track_name = session.event.get('EventName', '')
                year = session.event.get('EventDate').year if 'EventDate' in session.event else 2024
                try:
                    track_perf = calculate_track_specific_performance(
                        driver_code, track_name, years=[year-2, year-1]
                    )
                    track_avg = track_perf['avg_position']
                except Exception:
                    pass
            
            # Enhanced feature: Average pit stop duration for this track
            avg_pit_time = 23.0  # Default
            if session:
                track_name = session.event.get('EventName', '')
                year = session.event.get('EventDate').year if 'EventDate' in session.event else 2024
                try:
                    avg_pit_time = calculate_average_pit_stop_duration(year, track_name)
                except Exception:
                    pass
            
            feature_vector = [
                quali_position,           # Qualifying position
                races_completed,          # Number of races
                career_avg,               # Career avg finish
                total_points,             # Total points
                wins,                     # Wins
                podiums,                  # Podiums
                0,                        # Fastest laps (legacy)
                rolling_form,             # NEW: Last 3 races avg
                track_avg,                # NEW: Track-specific avg
                avg_pit_time,             # NEW: Track pit stop avg
            ]
            
            features.append(feature_vector)
        
        return np.array(features)
    
    def train(self, historical_data: pd.DataFrame):
        """Train the prediction models on historical race data"""
        # Prepare training data
        X_train = []
        y_winner = []
        y_podium = []
        y_fastest = []
        
        # Group by race
        for race_id, race_data in historical_data.groupby(['Year', 'RoundNumber']):
            if len(race_data) < 10:  # Skip races with incomplete data
                continue
            
            # Sort by qualifying position
            race_data = race_data.sort_values('GridPosition')
            
            # Extract features
            features = self._extract_features(race_data, race_data)
            
            if len(features) == 0:
                continue
            
            X_train.extend(features)
            
            # Labels
            for idx, driver in race_data.iterrows():
                y_winner.append(1 if driver.get('Position') == 1 else 0)
                y_podium.append(1 if driver.get('Position', 20) <= 3 else 0)
                y_fastest.append(1 if driver.get('FastestLap', False) else 0)
        
        if len(X_train) == 0:
            raise ValueError("Insufficient training data")
        
        X_train = np.array(X_train)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        
        # Train models
        self.winner_model.fit(X_train_scaled, y_winner)
        self.podium_model.fit(X_train_scaled, y_podium)
        self.fastest_lap_model.fit(X_train_scaled, y_fastest)
        
        self.is_trained = True
    
    def predict_race(self, driver_data: pd.DataFrame, qualifying_results: pd.DataFrame) -> Dict[str, Any]:
        """Predict race outcomes"""
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")
        
        # Extract features
        features = self._extract_features(driver_data, qualifying_results)
        
        if len(features) == 0:
            return {
                'race_winner': {},
                'podium': {},
                'fastest_lap': {},
                'confidence': 0.0
            }
        
        # Scale features
        features_scaled = self.scaler.transform(features)
        
        # Get predictions
        winner_probs = self.winner_model.predict_proba(features_scaled)
        podium_probs = self.podium_model.predict_proba(features_scaled)
        fastest_probs = self.fastest_lap_model.predict_proba(features_scaled)
        
        # Extract driver names
        drivers = qualifying_results['Abbreviation'].tolist()
        
        # Format predictions
        race_winner = {}
        podium = {}
        fastest_lap = {}
        
        for i, driver in enumerate(drivers):
            if winner_probs.shape[1] > 1:
                race_winner[driver] = float(winner_probs[i][1])
            if podium_probs.shape[1] > 1:
                podium[driver] = float(podium_probs[i][1])
            if fastest_probs.shape[1] > 1:
                fastest_lap[driver] = float(fastest_probs[i][1])
        
        # Sort by probability
        race_winner = dict(sorted(race_winner.items(), key=lambda x: x[1], reverse=True))
        podium = dict(sorted(podium.items(), key=lambda x: x[1], reverse=True))
        fastest_lap = dict(sorted(fastest_lap.items(), key=lambda x: x[1], reverse=True))
        
        # Calculate overall confidence
        max_winner_prob = max(race_winner.values()) if race_winner else 0
        confidence = float(max_winner_prob)
        
        return {
            'race_winner': race_winner,
            'podium': podium,
            'fastest_lap': fastest_lap,
            'confidence': confidence
        }
    
    def save(self, filename: str = 'race_prediction_model.pkl'):
        """Save model to disk"""
        model_path = os.path.join(settings.MODEL_DIR, filename)
        joblib.dump({
            'winner_model': self.winner_model,
            'podium_model': self.podium_model,
            'fastest_lap_model': self.fastest_lap_model,
            'scaler': self.scaler,
            'is_trained': self.is_trained
        }, model_path)
    
    def load(self, filename: str = 'race_prediction_model.pkl'):
        """Load model from disk"""
        model_path = os.path.join(settings.MODEL_DIR, filename)
        
        if not os.path.exists(model_path):
            return False
        
        data = joblib.load(model_path)
        self.winner_model = data['winner_model']
        self.podium_model = data['podium_model']
        self.fastest_lap_model = data['fastest_lap_model']
        self.scaler = data['scaler']
        self.is_trained = data['is_trained']
        
        return True


class ChampionshipPredictor:
    """Predict championship outcomes"""
    
    def __init__(self):
        self.model = GradientBoostingRegressor(n_estimators=100, random_state=42)
        self.scaler = StandardScaler()
    
    def predict_final_standings(self, current_standings: List[Dict], remaining_races: int) -> List[Dict]:
        """Predict final championship standings"""
        predictions = []
        
        for driver in current_standings:
            current_points = driver.get('points', 0)
            avg_points_per_race = current_points / max(driver.get('races_completed', 1), 1)
            
            # Simple projection
            predicted_additional_points = avg_points_per_race * remaining_races * 0.8  # Conservative estimate
            predicted_total = current_points + predicted_additional_points
            
            predictions.append({
                'driver': driver.get('driver'),
                'current_points': current_points,
                'predicted_points': float(predicted_total),
                'confidence_interval': [
                    float(predicted_total * 0.9),
                    float(predicted_total * 1.1)
                ]
            })
        
        # Sort by predicted points
        predictions = sorted(predictions, key=lambda x: x['predicted_points'], reverse=True)
        
        return predictions


# Singleton instances
race_predictor = RacePredictionModel()
championship_predictor = ChampionshipPredictor()
