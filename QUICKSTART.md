# F1 Analytics Platform - Quick Reference

## Common Commands

### Development

**Start Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python app/main.py
# Or with uvicorn:
uvicorn app.main:app --reload
```

**Start Frontend:**
```bash
npm start
```

**Run Both:**
```bash
# Terminal 1
cd backend && source venv/bin/activate && python app/main.py

# Terminal 2
npm start
```

### Testing Endpoints

**Test API with curl:**
```bash
# Get 2024 schedule
curl http://localhost:8000/api/v1/sessions/schedule/2024

# Get lap times
curl "http://localhost:8000/api/v1/laptimes/2024/Monaco/Race"

# Get driver standings
curl http://localhost:8000/api/v1/drivers/standings/2024

# Make prediction
curl -X POST http://localhost:8000/api/v1/predictions/race \
  -H "Content-Type: application/json" \
  -d '{"year": 2024, "grand_prix": "Monaco"}'
```

### Useful Examples

**Lap Time Analysis:**
```javascript
// In browser console or React component
import { getLapTimes, getLapTimeAnalysis } from './services/api';

// Get all lap times for Monaco 2024 Race
const laps = await getLapTimes(2024, 'Monaco', 'Race');

// Get analysis for specific drivers
const analysis = await getLapTimeAnalysis(2024, 'Monaco', 'Race', 'VER,HAM,LEC');
console.log(analysis);
```

**Telemetry Comparison:**
```javascript
import { compareTelemetry } from './services/api';

// Compare Verstappen vs Hamilton
const comparison = await compareTelemetry(
  2024, 
  'Monaco', 
  'Qualifying', 
  'VER', 
  'HAM'
);

console.log('Speed difference:', comparison.delta_analysis.max_speed_diff);
console.log('Driver 1 telemetry:', comparison.driver1.telemetry);
```

**Race Prediction:**
```javascript
import { predictRace, predictPodium } from './services/api';

// Predict race outcome
const prediction = await predictRace(2024, 'Monaco');
console.log('Winner prediction:', prediction.race_winner);

// Get podium predictions
const podium = await predictPodium(2024, 'Monaco');
console.log('Predicted podium:', podium.predicted_podium);
```

## Available Grand Prix Names (Examples)

Common format for Grand Prix parameter:
- `"Bahrain"`
- `"Saudi Arabia"` or `"Saudi"`
- `"Australia"`
- `"Japan"`
- `"China"`
- `"Miami"`
- `"Emilia Romagna"` or `"Imola"`
- `"Monaco"`
- `"Spain"` or `"Spanish"`
- `"Canada"` or `"Canadian"`
- `"Austria"` or `"Austrian"`
- `"Great Britain"` or `"British"`
- `"Hungary"` or `"Hungarian"`
- `"Belgium"` or `"Belgian"`
- `"Netherlands"` or `"Dutch"`
- `"Italy"` or `"Italian"`
- `"Singapore"`
- `"United States"` or `"USA"` or `"Austin"`
- `"Mexico"` or `"Mexican"`
- `"Brazil"` or `"Brazilian"`
- `"Las Vegas"`
- `"Qatar"`
- `"Abu Dhabi"`

**Tip:** Use the schedule endpoint to get exact names:
```bash
curl http://localhost:8000/api/v1/sessions/schedule/2024
```

## Session Types

- `"Race"` - Sunday race
- `"Qualifying"` - Saturday qualifying
- `"Sprint"` - Sprint race (select events)
- `"FP1"` - Free Practice 1
- `"FP2"` - Free Practice 2
- `"FP3"` - Free Practice 3

## Driver Codes (2024 Season)

Common 3-letter codes:
- `VER` - Max Verstappen
- `PER` - Sergio Perez
- `HAM` - Lewis Hamilton
- `RUS` - George Russell
- `LEC` - Charles Leclerc
- `SAI` - Carlos Sainz
- `NOR` - Lando Norris
- `PIA` - Oscar Piastri
- `ALO` - Fernando Alonso
- `STR` - Lance Stroll
- `OCO` - Esteban Ocon
- `GAS` - Pierre Gasly
- `TSU` - Yuki Tsunoda
- `RIC` - Daniel Ricciardo
- `BOT` - Valtteri Bottas
- `ZHO` - Zhou Guanyu
- `MAG` - Kevin Magnussen
- `HUL` - Nico Hulkenberg
- `ALB` - Alexander Albon
- `SAR` - Logan Sargeant

## Troubleshooting

### Backend won't start

**Check Python version:**
```bash
python --version  # Should be 3.9+
```

**Reinstall dependencies:**
```bash
cd backend
pip install --upgrade pip
pip install -r requirements.txt
```

**Clear cache:**
```bash
rm -rf backend/cache/*
```

### Frontend errors

**Clear and reinstall:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Check API connection:**
```bash
# Verify backend is running
curl http://localhost:8000/health

# Check CORS settings in backend/.env
CORS_ORIGINS=http://localhost:3000
```

### Data loading slowly

First API calls are slow because FastF1 downloads and caches data. Subsequent requests are much faster.

**Check cache:**
```bash
ls -lh backend/cache/
```

### Import errors in backend

**Activate virtual environment:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python app/main.py
```

## Performance Tips

1. **Cache warming**: Run some API calls after starting to pre-cache data
2. **Use specific drivers**: Filter by driver codes to reduce data size
3. **Limit date range**: Request specific races instead of full seasons
4. **Check network**: First requests download data from F1 servers

## Development Workflow

1. **Start backend** in one terminal
2. **Start frontend** in another terminal
3. **Open browser** at http://localhost:3000
4. **Access API docs** at http://localhost:8000/api/v1/docs
5. **Make changes** - both support hot reload

## API Response Formats

**Lap Times:**
```json
{
  "laps": [
    {
      "lap_number": 1,
      "driver": "VER",
      "lap_time": 95.123,
      "sector1": 28.456,
      "compound": "SOFT",
      "tire_life": 1
    }
  ]
}
```

**Telemetry:**
```json
{
  "driver": "VER",
  "telemetry": [
    {
      "distance": 0,
      "speed": 280,
      "throttle": 100,
      "brake": 0,
      "gear": 8
    }
  ]
}
```

**Predictions:**
```json
{
  "race_winner": {
    "VER": 0.45,
    "HAM": 0.25,
    "LEC": 0.15
  },
  "confidence": 0.45
}
```

## Next Steps

- Explore the API documentation at `/api/v1/docs`
- Try the example queries above
- Build custom visualizations with the data
- Train ML models on historical data
- Extend with new features

## Resources

- **FastF1 Docs**: https://docs.fastf1.dev/
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **React Docs**: https://react.dev/
- **Recharts**: https://recharts.org/

---

**Need help?** Check README.md and DEPLOYMENT.md for more details.
