@echo off
echo ================================
echo Auth Frontend - Quick Start
echo ================================
echo.

if not exist node_modules (
    echo [1/2] Installing dependencies...
    echo This may take a few minutes...
    call npm install
) else (
    echo [1/2] ✓ Dependencies installed
)

echo.
echo [2/2] Starting development server...
echo.
echo ⚠️  Make sure backend is running on http://localhost:3000
echo.
echo Opening http://localhost:3001
echo.

call npm start
