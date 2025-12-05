import React, { useState, useEffect } from 'react';
import { 
  predictRaceQuick,
  getAvailableYears, 
  getAvailableTracks,
  getNextRace 
} from '../services/api';

function PredictionsPage() {
  const [years, setYears] = useState([]);
  const [tracks, setTracks] = useState([]);
  
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [nextRace, setNextRace] = useState(null);
  
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Load available years on mount
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const data = await getAvailableYears();
        setYears(data.years || []);
        if (data.years && data.years.length > 0) {
          const currentYear = data.years[data.years.length - 1];
          setSelectedYear(currentYear);
        }
      } catch (error) {
        console.error('Error fetching years:', error);
      }
    };
    fetchYears();
  }, []);

  // Load tracks and next race when year changes
  useEffect(() => {
    const fetchTracksAndNextRace = async () => {
      if (!selectedYear) return;
      
      setLoadingTracks(true);
      try {
        const [tracksData, nextRaceData] = await Promise.all([
          getAvailableTracks(selectedYear),
          getNextRace(selectedYear)
        ]);
        
        setTracks(tracksData.tracks || []);
        
        if (nextRaceData && nextRaceData.grand_prix) {
          setNextRace(nextRaceData);
          setSelectedTrack(nextRaceData.grand_prix);
        } else if (tracksData.tracks && tracksData.tracks.length > 0) {
          setSelectedTrack(tracksData.tracks[0].name);
        }
      } catch (error) {
        console.error('Error fetching tracks:', error);
      } finally {
        setLoadingTracks(false);
      }
    };
    
    fetchTracksAndNextRace();
  }, [selectedYear]);

  const handlePredictRace = async () => {
    if (!selectedTrack) {
      alert('Please select a Grand Prix');
      return;
    }

    try {
      setLoading(true);
      setPredictions(null);
      const data = await predictRaceQuick(selectedYear, selectedTrack);
      setPredictions(data);
    } catch (error) {
      console.error('Error making prediction:', error);
      alert('Error making prediction: ' + (error.response?.data?.detail || error.message));
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-f1-red">AI Race Predictions</h1>
      
      <div className="bg-f1-gray rounded-lg p-6 mb-6">
        <p className="text-gray-300 mb-6">
          AI-powered race predictions based on driver performance ratings and track characteristics.
        </p>

        {nextRace && (
          <div className="bg-f1-dark border border-f1-red rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-f1-red mb-2">🏁 Next Race</h3>
            <p className="text-white font-semibold">{nextRace.grand_prix}</p>
            <p className="text-gray-400 text-sm">{nextRace.location}, {nextRace.country}</p>
            <p className="text-gray-400 text-sm">{formatDate(nextRace.date)}</p>
          </div>
        )}
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-2 font-semibold">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none"
            >
              <option value="">Select Year</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm mb-2 font-semibold">Grand Prix</label>
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
              disabled={loadingTracks || tracks.length === 0}
              className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none disabled:opacity-50"
            >
              <option value="">Select Track</option>
              {tracks.map((track, idx) => (
                <option key={idx} value={track.name}>
                  {track.name} - {track.country} {track.date ? `(${formatDate(track.date)})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handlePredictRace}
          disabled={loading || !selectedYear || !selectedTrack}
          className="bg-f1-red text-white px-6 py-2 rounded hover:bg-red-700 disabled:bg-gray-600 transition"
        >
          {loading ? 'Predicting...' : 'Predict Race'}
        </button>
      </div>

      {predictions && (
        <>
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* Race Winner */}
            <div className="bg-f1-gray rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-f1-red">🏆 Race Winner</h2>
              <div className="space-y-2">
                {getTopPredictions(predictions.race_winner).map(([driver, prob], idx) => (
                  <div key={driver} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-white'}`}>
                        {idx + 1}.
                      </span>
                      <span className="font-semibold">{driver}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-f1-dark rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-f1-red h-full" 
                          style={{ width: `${(prob * 100).toFixed(0)}%` }}
                        />
                      </div>
                      <span className="text-gray-300 font-mono text-sm w-12 text-right">{(prob * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Podium */}
            <div className="bg-f1-gray rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-f1-red">🥇 Podium Finishers</h2>
              <div className="space-y-2">
                {getTopPredictions(predictions.podium).map(([driver, prob], idx) => (
                  <div key={driver} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-white'}`}>
                        {idx + 1}.
                      </span>
                      <span className="font-semibold">{driver}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-f1-dark rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-f1-red h-full" 
                          style={{ width: `${(prob * 100).toFixed(0)}%` }}
                        />
                      </div>
                      <span className="text-gray-300 font-mono text-sm w-12 text-right">{(prob * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fastest Lap */}
            <div className="bg-f1-gray rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-f1-red">⚡ Fastest Lap</h2>
              <div className="space-y-2">
                {getTopPredictions(predictions.fastest_lap).map(([driver, prob], idx) => (
                  <div key={driver} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-white'}`}>
                        {idx + 1}.
                      </span>
                      <span className="font-semibold">{driver}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-f1-dark rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-f1-red h-full" 
                          style={{ width: `${(prob * 100).toFixed(0)}%` }}
                        />
                      </div>
                      <span className="text-gray-300 font-mono text-sm w-12 text-right">{(prob * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-f1-gray rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">📈 Prediction Confidence</h2>
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
              Based on driver performance ratings and statistical analysis.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default PredictionsPage;
