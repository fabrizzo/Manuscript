@echo off
:: Force UTF-8 encoding in Command Prompt to avoid gibberish
chcp 65001 >nul
cls

echo.
echo ====================================================
echo    STARTING LARAVEL & VITE SERVERS
echo ====================================================
echo.

:: 1. Move to project directory
cd /d "C:\Users\alexa\WorkProjects\perepie_site"

:: --- CHECKS ---
if not exist "artisan" (
    echo ERROR: artisan file not found. Wrong directory?
    pause
    exit
)

if not exist "package.json" (
    echo ERROR: package.json not found.
    pause
    exit
)

:: Check PHP Herd path
set "PHP_PATH=C:\Users\alexa\.config\herd-lite\bin\php.exe"
if not exist "%PHP_PATH%" (
    echo ERROR: PHP Herd not found at %PHP_PATH%
    pause
    exit
)

echo [1/2] Starting Backend (PHP) on http://0.0.0.0:8000
echo ----------------------------------------------------
:: Start PHP in a new window. /K keeps the window open.
start "Laravel Backend" /d "%cd%" "%PHP_PATH%" artisan serve --host=0.0.0.0 --port=8000

:: Wait 3 seconds for PHP to bind the port
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Starting Frontend (Vite) on http://localhost:5173
echo -------------------------------------------------------
:: Start Vite in a new window
start "Vite Frontend" /d "%cd%" cmd /c "npm run dev"

echo.
echo ====================================================
echo   Servers are running in separate windows.
echo   DO NOT CLOSE these black windows!
echo ====================================================
echo.

:: Keep this master window open so you can see the status
pause