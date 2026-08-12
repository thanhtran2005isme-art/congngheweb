@echo off
title Test Domain Mode

echo.
echo ========================================
echo   TESTING DOMAIN MODE
echo ========================================
echo.

echo Stopping all...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Setting .env.local...
cd /d "%~dp0kaito-kid-react"
echo # DOMAIN MODE > .env.local
echo VITE_API_BASE_URL=https://kaitokid.io.vn >> .env.local

echo.
echo Current .env.local content:
type .env.local

echo.
echo.
echo Starting Frontend (check console for BASE_URL)...
start "Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo Open browser and check Console tab
echo Should see: Using BASE_URL: https://kaitokid.io.vn
echo ========================================
echo.
pause
