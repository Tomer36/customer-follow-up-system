@echo off
echo ========================================
echo Customer Follow-Up System
echo Starting Backend + Frontend
echo ========================================
echo.

echo This will open 2 terminal windows:
echo 1. Backend  (http://localhost:3000)
echo 2. Frontend (http://localhost:3001)
echo.
pause

echo Starting Backend...
start cmd /k "cd auth-service && npm run dev"

timeout /t 3

echo Starting Frontend...
start cmd /k "cd frontend && npm start"

echo.
echo ✅ Both services starting...
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:3001
echo.
pause
