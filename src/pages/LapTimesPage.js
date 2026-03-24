import React, { useState, useEffect } from 'react';
import { getLapTimes, getAvailableYears, getAvailableTracks, getSessionInfo } from '../services/api';
import { formatLapTime } from '../utils/helpers';

function LapTimesPage() {
  const [years, setYears] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [year, setYear] = useState('');
  const [grandPrix, setGrandPrix] = useState('');
  const [sessionName, setSessionName] = useState('Race');
  const [selectedDriver, setSelectedDriver] = useState(''); // Empty = all drivers
  const [lapData, setLapData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const data = await getAvailableYears();
        setYears(data.years || []);
        if (data.years && data.years.length > 0) {
          setYear(data.years[data.years.length - 1]);
        }
      } catch (error) {
        console.error('Error fetching years:', error);
      }
    };
    fetchYears();
  }, []);

  useEffect(() => {
    const fetchTracks = async () => {
      if (!year) return;
      try {
        const data = await getAvailableTracks(year);
        setTracks(data.tracks || []);
        if (data.tracks && data.tracks.length > 0) {
          setGrandPrix(data.tracks[0].name);
        }
      } catch (error) {
        console.error('Error fetching tracks:', error);
      }
    };
    fetchTracks();
  }, [year]);

  // Load drivers when grand prix and session change
  useEffect(() => {
    const fetchDrivers = async () => {
      if (!year || !grandPrix || !sessionName) return;
      try {
        const data = await getSessionInfo(year, grandPrix, sessionName);
        setDrivers(data.drivers || []);
        setSelectedDriver(''); // Reset driver selection
      } catch (error) {
        console.error('Error fetching drivers:', error);
        setDrivers([]);
      }
    };
    fetchDrivers();
  }, [year, grandPrix, sessionName]);

  const handleLoadData = async () => {
    if (!grandPrix) {
      alert('Please select a Grand Prix');
      return;
    }

    try {
      setLoading(true);
      // Pass driver parameter - empty string means all drivers
      const laps = await getLapTimes(year, grandPrix, sessionName, selectedDriver || null);
      setLapData(laps.laps || []);
    } catch (error) {
      console.error('Error loading lap data:', error);
      alert('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-f1-red">Lap Time Analysis</h1>
      
      <div className="bg-f1-gray rounded-lg p-6 mb-6">
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-2 font-semibold">Year</label>
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none">
              <option value="">Select Year</option>
              {years.map(y => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm mb-2 font-semibold">Grand Prix</label>
            <select value={grandPrix} onChange={(e) => setGrandPrix(e.target.value)} disabled={tracks.length === 0} className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none disabled:opacity-50">
              <option value="">Select Track</option>
              {tracks.map((track, idx) => (<option key={idx} value={track.name}>{track.name}</option>))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm mb-2 font-semibold">Session</label>
            <select value={sessionName} onChange={(e) => setSessionName(e.target.value)} className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none">
              <option value="Race">Race</option>
              <option value="Qualifying">Qualifying</option>
            </select>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm mb-2 font-semibold">Driver (optional)</label>
          <select 
            value={selectedDriver} 
            onChange={(e) => setSelectedDriver(e.target.value)} 
            disabled={drivers.length === 0}
            className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none disabled:opacity-50"
          >
            <option value="">All Drivers</option>
            {drivers.map((driver, idx) => (<option key={idx} value={driver}>{driver}</option>))}
          </select>
        </div>
        
        <button onClick={handleLoadData} disabled={loading || !year || !grandPrix} className="bg-f1-red text-white px-6 py-2 rounded hover:bg-red-700 disabled:bg-gray-600 transition">
          {loading ? 'Loading...' : 'Load Lap Times'}
        </button>
      </div>

      {lapData && lapData.length > 0 && (
        <div className="bg-f1-gray rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Lap Times Data ({lapData.length} laps)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left p-2">Lap</th>
                  <th className="text-left p-2">Driver</th>
                  <th className="text-left p-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {lapData.slice(0, 50).map((lap, idx) => (
                  <tr key={idx} className="border-b border-gray-700 hover:bg-f1-dark">
                    <td className="p-2">{lap.lap_number}</td>
                    <td className="p-2 font-bold">{lap.driver}</td>
                    <td className="p-2">{formatLapTime(lap.lap_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default LapTimesPage;
