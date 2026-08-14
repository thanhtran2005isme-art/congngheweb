@echo off
setlocal EnableExtensions EnableDelayedExpansion
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
exit /b 1

:localhost
echo.
echo Setting up LOCALHOST mode...
cd /d "%~dp0kaito-kid-react"
echo # LOCALHOST MODE > .env.local
echo VITE_API_BASE_URL=http://localhost:5155 >> .env.local
cd /d "%~dp0"
goto prepare_services

:domain
echo.
echo Setting up DOMAIN mode...
cd /d "%~dp0kaito-kid-react"
echo # DOMAIN MODE > .env.local
echo VITE_API_BASE_URL=https://kaitokid.io.vn >> .env.local
cd /d "%~dp0"
goto prepare_services

:prepare_services
echo.
echo ========================================
echo   Cleaning stale KaitoKid processes...
echo ========================================

REM Stop only processes listening on KaitoKid ports. This avoids killing unrelated dotnet apps.
for %%P in (5053 5089 5265 5155 5173) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids = Get-NetTCPConnection -State Listen -LocalPort %%P -ErrorAction SilentlyContinue ^| Select-Object -ExpandProperty OwningProcess -Unique; foreach ($pidValue in $pids) { Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue }" >nul 2>&1
)

timeout /t 2 /nobreak >nul

goto start_services

:start_services
echo.
echo ========================================
echo   Starting Backend APIs...
echo ========================================

start "API.Auth - 5053" cmd /k "cd /d %~dp0BACKEND\API.Auth && dotnet run --launch-profile http"
call :wait_port "API.Auth" 5053 35
if errorlevel 1 goto backend_failed

start "API.Admin - 5089" cmd /k "cd /d %~dp0BACKEND\API.Admin && dotnet run --launch-profile http"
call :wait_port "API.Admin" 5089 35
if errorlevel 1 goto backend_failed

start "API.Customer - 5265" cmd /k "cd /d %~dp0BACKEND\API.Customer && dotnet run --launch-profile http"
call :wait_port "API.Customer" 5265 45
if errorlevel 1 goto backend_failed

start "API.Gateway - 5155" cmd /k "cd /d %~dp0BACKEND\API.Gateway && dotnet run --launch-profile http"
call :wait_port "API.Gateway" 5155 35
if errorlevel 1 goto backend_failed

echo.
echo ========================================
echo   Backend ports are healthy
necho ========================================
echo   Auth     : 5053  OK
echo   Admin    : 5089  OK
echo   Customer : 5265  OK
echo   Gateway  : 5155  OK
echo ========================================

echo.
echo ========================================
echo   Starting Frontend...
echo ========================================

cd /d "%~dp0kaito-kid-react"
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 goto frontend_failed
)
start "Frontend - 5173" cmd /k "npm run dev"
call :wait_port "Frontend" 5173 35
if errorlevel 1 goto frontend_failed

if "%choice%"=="2" (
    echo.
    echo ========================================
    echo   Starting Cloudflare Tunnel...
    echo ========================================
    cd /d "%~dp0"
    start "Cloudflare Tunnel" cmd /k ""C:\Program Files\cloudflared\cloudflared.exe" tunnel --config "%~dp0cloudflare-tunnel-config.yml" run kaitokid-shop"
)

echo.
echo ========================================
echo   ALL REQUIRED SERVICES STARTED!
echo ========================================
echo.
if "%choice%"=="1" (
    echo Access: http://localhost:5173
) else (
    echo Access: https://kaitokid.io.vn
    echo Wait a few seconds for Cloudflare Tunnel to connect.
)
echo.
echo To stop: stop-all.bat
pause
exit /b 0

:wait_port
set "WAIT_NAME=%~1"
set "WAIT_PORT=%~2"
set "WAIT_MAX=%~3"
set /a WAIT_COUNT=0

:wait_port_loop
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -State Listen -LocalPort %WAIT_PORT% -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo [OK] %WAIT_NAME% is listening on port %WAIT_PORT%.
    exit /b 0
)

set /a WAIT_COUNT+=1
if !WAIT_COUNT! GEQ %WAIT_MAX% (
    echo [ERROR] %WAIT_NAME% did not start on port %WAIT_PORT% after %WAIT_MAX% seconds.
    echo         Check the "%WAIT_NAME%" terminal window for the real dotnet error.
    exit /b 1
)

timeout /t 1 /nobreak >nul
goto wait_port_loop

:backend_failed
echo.
echo ========================================
echo   BACKEND START FAILED
necho ========================================
echo One API did not open its expected port.
echo Cloudflare Tunnel was NOT started, so the public site will not hide this as a 502.
echo Check the API terminal window that shows a build/runtime exception.
echo.
pause
exit /b 1

:frontend_failed
echo.
echo ========================================
echo   FRONTEND START FAILED
necho ========================================
echo Vite did not open port 5173. Check the Frontend terminal window.
echo.
pause
exit /b 1
