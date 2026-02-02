@echo off
echo ========================================
echo STARTING BREAST CANCER DETECTION PROJECT
echo ========================================
echo.

echo This will start:
echo   1. Backend API (Port 8001)
echo   2. Frontend UI (Port 3001)
echo.
echo Press any key to continue...
pause >nul

echo.
echo ========================================
echo Step 1: Starting Backend Server
echo ========================================
echo.

start "Backend Server" cmd /k "cd backend && echo Starting Backend on http://localhost:8001 && echo API Docs: http://localhost:8001/docs && echo. && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo Step 2: Starting Frontend Server
echo ========================================
echo.

start "Frontend Server" cmd /k "cd frontend && echo Starting Frontend on http://localhost:3001 && echo. && npm start"

echo.
echo ========================================
echo PROJECT STARTED!
echo ========================================
echo.
echo Backend:  http://localhost:8001
echo API Docs: http://localhost:8001/docs
echo Frontend: http://localhost:3001
echo.
echo Two windows have opened:
echo   - Backend Server (Port 8001)
echo   - Frontend Server (Port 3001)
echo.
echo The frontend will open in your browser automatically.
echo.
echo To stop the servers:
echo   - Close both terminal windows
echo   - Or press Ctrl+C in each window
echo.
echo ========================================
echo VALIDATION STATUS: ACTIVE ✅
echo ========================================
echo   ✅ Mammograms → Will be analyzed
echo   ❌ Photos of people → Will be rejected
echo   ❌ Flowers/objects → Will be rejected
echo   ❌ Color images → Will be rejected
echo ========================================
echo.
pause
