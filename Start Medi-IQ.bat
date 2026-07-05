@echo off
title Medi-IQ Launcher
cd /d "%~dp0"
echo ============================================
echo   Medi-IQ - starting backend and frontend
echo ============================================
echo.
start "Medi-IQ Backend" /D "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"
start "Medi-IQ Frontend" /D "%~dp0frontend" cmd /k "npm run dev"
echo Waiting for the servers to start...
ping -n 12 127.0.0.1 >nul
start "" http://localhost:5173
echo.
echo Medi-IQ is opening at http://localhost:5173
echo Close the two server windows to stop the app.
ping -n 4 127.0.0.1 >nul