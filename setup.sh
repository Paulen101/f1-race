#!/bin/bash

# F1 Analytics Platform - Setup Script

echo "🏎️  F1 Analytics Platform Setup"
echo "================================"
echo ""

# Check Python version
echo "Checking Python version..."
python3 --version || { echo "Error: Python 3 is required"; exit 1; }

# Check Node version
echo "Checking Node.js version..."
node --version || { echo "Error: Node.js is required"; exit 1; }

echo ""
echo "Setting up Backend..."
echo "--------------------"

# Navigate to backend
cd backend || exit 1

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate || . venv/Scripts/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating backend .env file..."
    cp .env.example .env
    echo "✓ Backend .env file created. Please review and update as needed."
fi

# Create necessary directories
echo "Creating cache and model directories..."
mkdir -p cache
mkdir -p app/ml/models

echo "✓ Backend setup complete!"
echo ""

# Navigate back to root
cd ..

echo "Setting up Frontend..."
echo "---------------------"

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Create frontend .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating frontend .env file..."
    echo "REACT_APP_API_URL=http://localhost:8000/api/v1" > .env
    echo "✓ Frontend .env file created."
fi

echo "✓ Frontend setup complete!"
echo ""
echo "================================"
echo "✅ Setup Complete!"
echo ""
echo "To start the application:"
echo ""
echo "1. Start the backend:"
echo "   cd backend"
echo "   source venv/bin/activate  # or . venv/Scripts/activate on Windows"
echo "   python app/main.py"
echo ""
echo "2. In a new terminal, start the frontend:"
echo "   npm start"
echo ""
echo "Access the application at: http://localhost:3000"
echo "API documentation at: http://localhost:8000/api/v1/docs"
echo ""
echo "Happy analyzing! 🏁"
