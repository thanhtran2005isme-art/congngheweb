@echo off
title Clean and Start

echo.
echo Stopping all services...
taskkill /F /IM dotnet.exe 2>nul
taskkill /F /IM node.exe 2>nul
taskkill /F /IM cloudflared.exe 2>nul

timeout /t 3 /nobreak >nul

echo.
echo Cleaning Vite cache...
cd /d "%~dp0kaito-kid-react"
if exist ".vite\" rd /s /q ".vite"
if exist "dist\" rd /s /q "dist"

echo.
echo Setting DOMAIN mode...
echo # DOMAIN MODE > .env.local
echo VITE_API_BASE_URL=https://kaitokid.io.vn >> .env.local

echo.
echo Starting services...
cd /d "%~dp0"

start "API.Auth - 5053" cmd /k "cd /d %~dp0BACKEND\API.Auth && dotnet run"
timeout /t 2 /nobreak >nul

start "API.Admin - 5089" cmd /k "cd /d %~dp0BACKEND\API.Admin && dotnet run"
timeout /t 2 /nobreak >nul

start "API.Customer - 5265" cmd /k "cd /d %~dp0BACKEND\API.Customer && dotnet run"
timeout /t 2 /nobreak >nul

start "API.Gateway - 5155" cmd /k "cd /d %~dp0BACKEND\API.Gateway && dotnet run"
timeout /t 10 /nobreak >nul

cd /d "%~dp0kaito-kid-react"
start "Frontend - 5173" cmd /k "npm run dev -- --force"

timeout /t 10 /nobreak >nul

cd /d "%~dp0"
start "Cloudflare Tunnel" cmd /k ""C:\Program Files\cloudflared\cloudflared.exe" tunnel --config "%~dp0cloudflare-tunnel-config.yml" run kaitokid-shop"

echo.
echo ========================================
echo   ALL SERVICES STARTED (CLEAN)
echo ========================================
echo.
echo Access: https://kaitokid.io.vn
echo.
echo IMPORTANT:
echo 1. Wait 60 seconds
echo 2. Open browser in INCOGNITO mode
echo 3. Go to: https://kaitokid.io.vn
echo.
pause
