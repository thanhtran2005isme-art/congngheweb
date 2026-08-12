@echo off
title Stop All Services

echo.
echo ========================================
echo Stopping All KaitoKid Services
echo ========================================
echo.

echo Stopping Node.js processes (Frontend)...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo Frontend stopped
) else (
    echo Frontend not running
)

echo.
echo Stopping .NET processes (Backend APIs)...
taskkill /F /IM dotnet.exe 2>nul
if %errorlevel% equ 0 (
    echo Backend APIs stopped
) else (
    echo Backend APIs not running
)

echo.
echo Done!
echo.
pause
