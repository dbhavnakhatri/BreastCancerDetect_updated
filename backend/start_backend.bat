@echo off
REM Start Backend Server

echo.
echo ========================================
echo Starting Backend Server
echo ========================================
echo.

cd /d "%~dp0"

echo Activating virtual environment...
call .\venv\Scripts\activate.bat

echo.
echo Starting FastAPI server...
echo Backend will be available at: http://127.0.0.1:8001
echo API Documentation: http://127.0.0.1:8001/docs
echo.
echo Press Ctrl+C to stop the server
echo.

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001

