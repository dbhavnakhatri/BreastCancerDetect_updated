@echo off
echo Killing existing backend processes...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM uvicorn.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting backend server...
cd backend
start cmd /k "uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

echo Backend restarted!
echo Backend running on http://localhost:8001
pause
