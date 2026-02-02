@echo off
echo ========================================
echo Starting Backend Server
echo ========================================
echo.

cd backend

echo Starting server on port 8001...
echo.
echo Backend URL: http://localhost:8001
echo API Docs: http://localhost:8001/docs
echo.
echo Press Ctrl+C to stop
echo.

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

pause
