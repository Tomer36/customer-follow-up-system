@echo off
echo ================================
echo Auth Service - Quick Start
echo ================================
echo.

if not exist .env (
    echo [1/4] Creating .env file...
    copy .env.example .env
    echo.
    echo ⚠️  IMPORTANT: Edit .env and set your MySQL password!
    echo.
    pause
) else (
    echo [1/4] ✓ .env exists
)

if not exist node_modules (
    echo [2/4] Installing dependencies...
    call npm install
) else (
    echo [2/4] ✓ Dependencies installed
)

echo [3/4] Setting up database...
call node setup.js

echo.
echo [4/4] Starting server...
echo.
call npm run dev
