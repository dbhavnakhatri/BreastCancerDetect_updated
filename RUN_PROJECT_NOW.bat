@echo off
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║     BREAST CANCER DETECTION - PROJECT STARTUP             ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo This will start:
echo   1. Backend API Server (Port 8001)
echo   2. Frontend React App (Port 3001)
echo.
echo ════════════════════════════════════════════════════════════
echo.

REM Kill any existing processes on these ports
echo [1/4] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING') do (
    echo      Killing process on port 8001 (PID: %%a)
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo      Killing process on port 3001 (PID: %%a)
    taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul

echo.
echo [2/4] Starting Backend Server...
echo      Backend will run on: http://localhost:8001
echo      API Documentation: http://localhost:8001/docs
echo.

start "Backend Server - Port 8001" cmd /k "cd backend && echo ════════════════════════════════════════════════════════════ && echo BACKEND SERVER STARTING && echo ════════════════════════════════════════════════════════════ && echo. && echo URL: http://localhost:8001 && echo API Docs: http://localhost:8001/docs && echo. && echo ✅ Validation Active: && echo    - Mammograms will be analyzed && echo    - Photos of people will be rejected && echo    - Flowers/objects will be rejected && echo. && echo ════════════════════════════════════════════════════════════ && echo. && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001"

echo      Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo.
echo [3/4] Starting Frontend Server...
echo      Frontend will run on: http://localhost:3001
echo      Browser will open automatically
echo.

start "Frontend Server - Port 3001" cmd /k "cd frontend && echo ════════════════════════════════════════════════════════════ && echo FRONTEND SERVER STARTING && echo ════════════════════════════════════════════════════════════ && echo. && echo URL: http://localhost:3001 && echo. && echo Features: && echo    ✅ Progressive analysis (see results as they complete) && echo    ✅ Multiple image upload && echo    ✅ Individual error handling && echo    ✅ Real-time tab updates && echo. && echo ════════════════════════════════════════════════════════════ && echo. && npm start"

echo.
echo [4/4] Project Started Successfully!
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo ✅ Backend Server:  http://localhost:8001
echo ✅ API Docs:        http://localhost:8001/docs
echo ✅ Frontend App:    http://localhost:3001
echo.
echo Two terminal windows have opened:
echo   1. Backend Server (Port 8001)
echo   2. Frontend Server (Port 3001)
echo.
echo The frontend will open in your browser automatically.
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo 📋 FEATURES IMPLEMENTED:
echo.
echo ✅ Mammogram Validation
echo    - Rejects photos of people
echo    - Rejects flowers/objects
echo    - Rejects color images
echo    - Only accepts medical mammograms
echo.
echo ✅ Progressive Analysis
echo    - See results as each image completes
echo    - Don't wait for all images
echo    - Real-time tab updates
echo.
echo ✅ Multiple Image Upload
echo    - Upload up to multiple images
echo    - Each processed independently
echo    - Errors don't block valid images
echo.
echo ✅ Individual Error Handling
echo    - Clear error messages per image
echo    - Valid images still analyzed
echo    - Status shows success count
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo To stop the servers:
echo   - Close both terminal windows
echo   - Or press Ctrl+C in each window
echo.
echo ════════════════════════════════════════════════════════════
echo.
pause
