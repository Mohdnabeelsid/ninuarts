@echo off
echo Starting Ninu Arts Business Manager...
echo.

start "Ninu Arts - Laravel Backend" cmd /k "cd /d %~dp0backend && php artisan serve --host=127.0.0.1 --port=8000"
start "Ninu Arts - React Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Backend started at: http://127.0.0.1:8000
echo Frontend started at: http://localhost:3000
echo.
echo Press any key to open http://localhost:3000 in your browser...
pause >nul
start http://localhost:3000
