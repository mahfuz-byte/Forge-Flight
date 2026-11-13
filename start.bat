@echo off
title Launch Forge & Flight
echo ========================================================
echo               Starting Forge & Flight
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Ensuring PostgreSQL Database is running...
cd backend
docker compose up -d
cd ..

echo.
echo [2/4] Ensuring Ollama AI Engine is running...
start "" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve

echo.
echo [3/4] Starting Django REST Backend (Port 8000)...
start "Forge & Flight - Backend" cmd /k "cd /d \"%~dp0backend\" && call venv\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000"

echo.
echo [4/4] Starting React / Vite Frontend (Port 5173)...
start "Forge & Flight - Frontend" cmd /k "cd /d \"%~dp0\" && node ./node_modules/vite/bin/vite.js"

echo.
echo ========================================================
echo  All services launched!
echo  - Frontend:  http://localhost:5173/
echo  - Backend:   http://localhost:8000/
echo  - AI Engine: http://localhost:11434/ (DeepSeek)
echo.
echo  Demo Founder Login:
echo  Email:    amara@healthsync.io
echo  Password: AU-4TxXYoUGgpHkw
echo ========================================================
echo.
timeout /t 3 >nul
start http://localhost:5173/
pause
