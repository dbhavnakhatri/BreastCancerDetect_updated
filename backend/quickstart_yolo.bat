@echo off
REM Quick Start Script for YOLO Breast Cancer Detection Training
REM Windows PowerShell/CMD version

echo.
echo ========================================
echo YOLO Breast Cancer Detection Setup
echo ========================================
echo.

REM Check Python installation
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.8+
    pause
    exit /b 1
)

echo [1/5] Creating virtual environment...
python -m venv venv_yolo
call .\venv_yolo\Scripts\activate.bat

echo.
echo [2/5] Installing dependencies...
pip install --upgrade pip
pip install -r requirements_yolo.txt

echo.
echo [3/5] Checking GPU availability...
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}')"

echo.
echo [4/5] Creating dataset structure...
python prepare_dataset.py

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next Steps:
echo   1. Download dataset from Kaggle
echo   2. Place images in datasets/breast_cancer/images/
echo   3. Create labels in datasets/breast_cancer/labels/
echo   4. Run: python train_yolo.py
echo.
echo For detailed guide, see: YOLO_TRAINING_GUIDE.md
echo.

pause

