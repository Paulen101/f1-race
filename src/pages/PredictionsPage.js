import React, { useState } from 'react';
import { predictRace, predictChampionship } from '../services/api';

function PredictionsPage() {
  const [year, setYear] = useState(2024);
  const [grandPrix, setGrandPrix] = useState('');
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePredictRace = async () => {
    if (!grandPrix) {
      alert('Please enter a Grand Prix name');
      return;
    }

    try {
      setLoading(true);
      const data = await predictRace(year, grandPrix);
      setPredictions(data);
    } catch (error) {
      console.error('Error making prediction:', error);
      alert('Error making prediction. The race may not have qualifying data yet.');
    } finally {
      setLoading(false);
    }
  };

  const getTopPredictions = (predictionObj, count = 5) => {
    if (!predictionObj) return [];
    return Object.entries(predictionObj)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-f1-red">Race Predictions</h1>
      
      <div className="bg-f1-gray rounded-lg p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-2">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2">Grand Prix</label>
            <input
              type="text"
              value={grandPrix}
              onChange={(e) => setGrandPrix(e.target.value)}
              placeholder="e.g., Monaco"
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            />
          </div>
        </div>
        
        <button
          onClick={handlePredictRace}
          disabled={loading}
          className="bg-f1-red text-white px-6 py-2 rounded hover:bg-red-700 disabled:bg-gray-600 transition"
        >
          {loading ? 'Predicting...' : 'Predict Race'}
        </button>
      </div>

      {predictions && (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Race Winner */}
          <div className="bg-f1-gray rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-f1-red">Race Winner</h2>
            <div className="space-y-2">
              {getTopPredictions(predictions.race_winner).map(([driver, prob], idx) => (
                <div key={driver} className="flex justify-between items-center">
                  <span className="font-bold">{idx + 1}. {driver}</span>
                  <span className="text-gray-300">{(prob * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Podium */}
          <div className="bg-f1-gray rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-f1-red">Podium Finishers</h2>
            <div className="space-y-2">
              {getTopPredictions(predictions.podium).map(([driver, prob], idx) => (
                <div key={driver} className="flex justify-between items-center">
                  <span className="font-bold">{idx + 1}. {driver}</span>
                  <span className="text-gray-300">{(prob * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fastest Lap */}
          <div className="bg-f1-gray rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-f1-red">Fastest Lap</h2>
            <div className="space-y-2">
              {getTopPredictions(predictions.fastest_lap).map(([driver, prob], idx) => (
                <div key={driver} className="flex justify-between items-center">
                  <span className="font-bold">{idx + 1}. {driver}</span>
                  <span className="text-gray-300">{(prob * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {predictions && (
        <div className="bg-f1-gray rounded-lg p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">Prediction Confidence</h2>
          <div className="flex items-center">
            <div className="flex-1 bg-f1-dark rounded-full h-8 overflow-hidden">
              <div
                className="bg-f1-red h-full flex items-center justify-center text-sm font-bold transition-all"
                style={{ width: `${(predictions.confidence * 100).toFixed(0)}%` }}
              >
                {(predictions.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Based on historical performance, qualifying results, and machine learning models.
          </p>
        </div>
      )}
    </div>
  );
}

export default PredictionsPage;
