@echo off
echo ========================================
echo Killing Old Backend Process
echo ========================================
echo.

echo Finding process on port 8001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001') do (
    echo Found process: %%a
    echo Killing process %%a...
    taskkill /F /PID %%a
)

echo.
echo Done! Old backend process killed.
echo.
echo Now you can start the backend again with:
echo   START_BACKEND_SIMPLE.bat
echo.
pause
