import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Sessions API
export const getSeasonSchedule = async (year) => {
  const response = await api.get(`/sessions/schedule/${year}`);
  return response.data;
};

export const getSessionInfo = async (year, grandPrix, sessionName) => {
  const response = await api.get(`/sessions/${year}/${grandPrix}/${sessionName}`);
  return response.data;
};

export const getSessionResults = async (year, grandPrix, sessionName) => {
  const response = await api.get(`/sessions/${year}/${grandPrix}/${sessionName}/results`);
  return response.data;
};

// Lap Times API
export const getLapTimes = async (year, grandPrix, sessionName, driver = null) => {
  const url = `/laptimes/${year}/${grandPrix}/${sessionName}`;
  const params = driver ? { driver } : {};
  const response = await api.get(url, { params });
  return response.data;
};

export const getFastestLaps = async (year, grandPrix, sessionName) => {
  const response = await api.get(`/laptimes/${year}/${grandPrix}/${sessionName}/fastest`);
  return response.data;
};

export const getLapTimeAnalysis = async (year, grandPrix, sessionName, drivers = null) => {
  const url = `/laptimes/${year}/${grandPrix}/${sessionName}/analysis`;
  const params = drivers ? { drivers } : {};
  const response = await api.get(url, { params });
  return response.data;
};

// Telemetry API
export const getDriverTelemetry = async (year, grandPrix, sessionName, driver, lapNumber = null) => {
  const url = `/telemetry/${year}/${grandPrix}/${sessionName}/${driver}`;
  const params = lapNumber ? { lap_number: lapNumber } : {};
  const response = await api.get(url, { params });
  return response.data;
};

export const compareTelemetry = async (year, grandPrix, sessionName, driver1, driver2, lapNumber = null) => {
  const url = `/telemetry/${year}/${grandPrix}/${sessionName}/compare`;
  const params = { driver1, driver2 };
  if (lapNumber) params.lap_number = lapNumber;
  const response = await api.get(url, { params });
  return response.data;
};

// Strategy API
export const getPitStops = async (year, grandPrix) => {
  const response = await api.get(`/strategy/${year}/${grandPrix}/pitstops`);
  return response.data;
};

export const getRaceStrategy = async (year, grandPrix) => {
  const response = await api.get(`/strategy/${year}/${grandPrix}/strategy`);
  return response.data;
};

export const getTireDegradation = async (year, grandPrix, driver) => {
  const response = await api.get(`/strategy/${year}/${grandPrix}/tire-degradation`, {
    params: { driver }
  });
  return response.data;
};

// Predictions API
export const predictRace = async (year, grandPrix, includeWeather = false) => {
  const response = await api.post('/predictions/race', {
    year,
    grand_prix: grandPrix,
    include_weather: includeWeather
  });
  return response.data;
};

export const predictChampionship = async (year, remainingRaces = 5) => {
  const response = await api.get(`/predictions/championship/${year}`, {
    params: { remaining_races: remainingRaces }
  });
  return response.data;
};

export const predictPodium = async (year, grandPrix) => {
  const response = await api.get(`/predictions/podium/${year}/${grandPrix}`);
  return response.data;
};

// Drivers API
export const getDriverStandings = async (year) => {
  const response = await api.get(`/drivers/standings/${year}`);
  return response.data;
};

export const getDriverSeasonStats = async (year, driver) => {
  const response = await api.get(`/drivers/${year}/${driver}/stats`);
  return response.data;
};

export const getDriverCareerStats = async (driver, startYear = 2018, endYear = 2024) => {
  const response = await api.get(`/drivers/${driver}/career`, {
    params: { start_year: startYear, end_year: endYear }
  });
  return response.data;
};

// Circuits API
export const getCircuitInfo = async (year, circuit) => {
  const response = await api.get(`/circuits/${year}/${circuit}/info`);
  return response.data;
};

export const getCircuitHistory = async (circuit, startYear = 2018, endYear = 2024) => {
  const response = await api.get(`/circuits/${circuit}/history`, {
    params: { start_year: startYear, end_year: endYear }
  });
  return response.data;
};

export const getCircuitStatistics = async (year, circuit) => {
  const response = await api.get(`/circuits/${year}/${circuit}/statistics`);
  return response.data;
};

// Comparisons API
export const compareDrivers = async (year, grandPrix, sessionName, drivers) => {
  const response = await api.get(`/comparisons/drivers/${year}/${grandPrix}/${sessionName}`, {
    params: { drivers: drivers.join(',') }
  });
  return response.data;
};

export const compareTeammates = async (year, team) => {
  const response = await api.get(`/comparisons/teammates/${year}/${team}`);
  return response.data;
};

export const getHeadToHead = async (year, driver1, driver2) => {
  const response = await api.get(`/comparisons/head-to-head/${year}/${driver1}/${driver2}`);
  return response.data;
};

export default api;
