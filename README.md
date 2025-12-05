# F1 Analytics & Prediction Platform

A comprehensive full-stack Formula 1 analytics and prediction web application featuring real-time telemetry analysis, machine learning-powered race predictions, and interactive data visualizations.

## 🏎️ Features

### Core Analytics
- **Lap Time Analysis**: Compare lap times between drivers, visualize pace across stints, analyze consistency
- **Telemetry Comparison**: Overlay speed, throttle, brake, and gear data for any two drivers
- **Strategy Analysis**: Pit stop timing, tire degradation tracking, stint performance comparison
- **Race Predictions**: ML-powered predictions for race winners, podium finishers, and fastest laps
- **Driver Performance**: Historical trends, season statistics, and career progression
- **Circuit Analysis**: Track-specific statistics, historical data, and weather impact
- **Head-to-Head**: Direct driver comparisons with detailed performance metrics

### Technology Stack

**Backend:**
- Python 3.9+
- FastAPI for RESTful API
- FastF1 library for F1 data
- scikit-learn for machine learning
- pandas/numpy for data processing

**Frontend:**
- React 19 with Hooks
- React Router for navigation
- Axios for API calls
- Recharts for data visualization
- Tailwind CSS for styling

## 🚀 Quick Start

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

5. **Run the backend:**
   ```bash
   python app/main.py
   ```

   The API will be available at `http://localhost:8000`
   API documentation at `http://localhost:8000/api/v1/docs`

### Frontend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   echo "REACT_APP_API_URL=http://localhost:8000/api/v1" > .env
   ```

3. **Run development server:**
   ```bash
   npm start
   ```

   The application will open at `http://localhost:3000`

## 📊 API Endpoints

### Sessions
- `GET /api/v1/sessions/schedule/{year}` - Get race schedule
- `GET /api/v1/sessions/{year}/{grand_prix}/{session_name}` - Get session info

### Lap Times
- `GET /api/v1/laptimes/{year}/{grand_prix}/{session_name}` - Get lap times
- `GET /api/v1/laptimes/{year}/{grand_prix}/{session_name}/analysis` - Lap time analysis

### Telemetry
- `GET /api/v1/telemetry/{year}/{grand_prix}/{session_name}/compare` - Compare two drivers

### Predictions
- `POST /api/v1/predictions/race` - Predict race outcome
- `GET /api/v1/predictions/championship/{year}` - Predict championship

### Drivers & More
See full API documentation at `http://localhost:8000/api/v1/docs`

## 🤖 Machine Learning

The platform uses RandomForest and GradientBoosting models for predictions based on:
- Qualifying positions
- Historical race results
- Driver performance statistics
- Team performance trends

## 📝 Usage Example

```javascript
import { getLapTimes, predictRace } from './services/api';

// Get lap times
const laps = await getLapTimes(2024, 'Monaco', 'Race', 'VER');

// Make prediction
const prediction = await predictRace(2024, 'Monaco');
console.log(prediction.race_winner);
```

## 🐛 Troubleshooting

- **Slow first request**: FastF1 caches data on first load
- **CORS errors**: Check backend CORS_ORIGINS setting
- **Import errors**: Ensure all Python dependencies are installed

## 📄 License

MIT License - Free to use for personal or commercial purposes.

## 🙏 Acknowledgments

- FastF1 library for F1 data access
- Formula 1 for the amazing sport
- React and FastAPI communities

---

**Built with ❤️ for F1 fans and data enthusiasts**

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
