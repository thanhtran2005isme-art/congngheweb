@echo off
title KaitoKid Shop

echo.
echo ========================================
echo        KAITO KID SHOP
echo ========================================
echo.
echo Choose mode:
echo.
echo [1] LOCALHOST  (http://localhost:5173)
echo [2] DOMAIN     (https://kaitokid.io.vn)
echo.
set /p choice="Enter 1 or 2: "

if "%choice%"=="1" goto localhost
if "%choice%"=="2" goto domain

echo Invalid choice!
pause
exit

:localhost
echo.
echo Setting up LOCALHOST mode...
cd /d "%~dp0kaito-kid-react"
echo # LOCALHOST MODE > .env.local
echo VITE_API_BASE_URL=http://localhost:5155 >> .env.local
cd /d "%~dp0"

REM Kill existing frontend to force restart with new env
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

goto start_services

:domain
echo.
echo Setting up DOMAIN mode...
cd /d "%~dp0kaito-kid-react"
echo # DOMAIN MODE > .env.local
echo VITE_API_BASE_URL=https://kaitokid.io.vn >> .env.local
cd /d "%~dp0"

REM Kill existing frontend to force restart with new env
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

:start_services
echo.
echo ========================================
echo   Starting Backend APIs...
echo ========================================

start "API.Auth - 5053" cmd /k "cd /d %~dp0BACKEND\API.Auth && dotnet run"
timeout /t 2 /nobreak >nul

start "API.Admin - 5089" cmd /k "cd /d %~dp0BACKEND\API.Admin && dotnet run"
timeout /t 2 /nobreak >nul

start "API.Customer - 5265" cmd /k "cd /d %~dp0BACKEND\API.Customer && dotnet run"
timeout /t 2 /nobreak >nul

start "API.Gateway - 5155" cmd /k "cd /d %~dp0BACKEND\API.Gateway && dotnet run"
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo   Starting Frontend...
echo ========================================

cd /d "%~dp0kaito-kid-react"
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)
start "Frontend - 5173" cmd /k "npm run dev"

if "%choice%"=="2" (
    timeout /t 10 /nobreak >nul
    echo.
    echo ========================================
    echo   Starting Cloudflare Tunnel...
    echo ========================================
    cd /d "%~dp0"
    start "Cloudflare Tunnel" cmd /k ""C:\Program Files\cloudflared\cloudflared.exe" tunnel --config "%~dp0cloudflare-tunnel-config.yml" run kaitokid-shop"
)

echo.
echo ========================================
echo   ALL SERVICES STARTED!
echo ========================================
echo.
if "%choice%"=="1" (
    echo Access: http://localhost:5173
) else (
    echo Access: https://kaitokid.io.vn
    echo Wait 30-60 seconds for tunnel to connect
)
echo.
echo To stop: stop-all.bat
echo.
pause
