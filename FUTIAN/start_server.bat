@echo off
title FUTIAN AI Backend Server
color 0A

echo ===================================================
echo      STARTING FUTIAN AI BACKEND SERVER
echo ===================================================

:: Navigate to backend directory
cd /d "%~dp0backend"
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Could not find 'backend' directory!
    echo Please ensure this script is in the root folder.
    pause
    exit /b
)

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ and try again.
    pause
    exit /b
)

echo [INFO] Checking dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    color 0E
    echo [WARNING] Failed to install some dependencies.
    echo Attempting to run anyway...
)

echo.
echo [INFO] Starting Server...
echo [INFO] Server will run at: http://localhost:8000
echo [INFO] Press Ctrl+C to stop the server.
echo.

:: Run the server
python main.py

:: If server crashes
color 0C
echo.
echo [ERROR] Server stopped unexpectedly!
pause
