@echo off
echo ========================================
echo FIX AND RESTART BACKEND
echo ========================================
echo.

echo Step 1: Killing old backend processes...
echo.
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" 2>nul
timeout /t 2 /nobreak >nul

echo Step 2: Killing any process on port 8001...
echo.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING') do (
    echo Killing process %%a...
    taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul

echo.
echo Step 3: Starting new backend with validation...
echo.
cd backend
echo Backend will start on: http://localhost:8001
echo API Documentation: http://localhost:8001/docs
echo.
echo ✅ Validation is active - photos of people will be rejected!
echo.
echo Press Ctrl+C to stop the server
echo.

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
