@echo off
echo ========================================
echo RESTARTING BACKEND WITH VALIDATION
echo ========================================
echo.

echo [1/4] Stopping all Python processes...
taskkill /F /IM python.exe 2>nul
if %errorlevel% equ 0 (
    echo     ✅ Stopped old processes
) else (
    echo     ℹ️  No Python processes were running
)
timeout /t 2 /nobreak >nul

echo.
echo [2/4] Checking port 8001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING') do (
    echo     Killing process on port 8001 (PID: %%a)
    taskkill /F /PID %%a 2>nul
)
timeout /t 1 /nobreak >nul

echo.
echo [3/4] Verifying files...
if exist "backend\mammogram_validator.py" (
    echo     ✅ Validation module found
) else (
    echo     ❌ ERROR: mammogram_validator.py not found!
    echo     Please make sure all files are in place.
    pause
    exit /b 1
)

if exist "backend\main.py" (
    echo     ✅ Main backend file found
) else (
    echo     ❌ ERROR: main.py not found!
    pause
    exit /b 1
)

echo.
echo [4/4] Starting backend server...
echo.
echo ========================================
echo Backend Configuration:
echo   URL: http://localhost:8001
echo   API Docs: http://localhost:8001/docs
echo   Validation: ACTIVE ✅
echo ========================================
echo.
echo What will happen:
echo   ✅ Mammograms → Analyzed
echo   ❌ Photos of people → Rejected
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

pause
