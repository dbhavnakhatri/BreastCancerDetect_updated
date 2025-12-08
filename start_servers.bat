@echo off
echo ========================================
echo Starting Breast Cancer Detection App
echo ========================================

echo.
echo [1/2] Starting Backend on port 8001...
start "Backend Server" cmd /k "cd /d C:\Users\vrajr\Downloads\BreastCancerDetect\BreastCancerDetect\backend && uvicorn main:app --host 0.0.0.0 --port 8001"

echo Waiting for backend to initialize (30 seconds)...
timeout /t 30 /nobreak

echo.
echo [2/2] Starting Frontend on port 3000...
start "Frontend Server" cmd /k "cd /d C:\Users\vrajr\Downloads\BreastCancerDetect\BreastCancerDetect\frontend && npm start"

echo.
echo ========================================
echo Both servers are starting!
echo ========================================
echo.
echo Backend: http://localhost:8001
echo Frontend: http://localhost:3000
echo Health Check: http://localhost:8001/health
echo.
echo Wait for both windows to show "startup complete"
echo Then refresh http://localhost:3000 in your browser
echo ========================================
pause

