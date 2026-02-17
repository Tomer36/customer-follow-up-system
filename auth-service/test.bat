@echo off
echo Testing Auth Service...
echo.

echo 1. Health Check
curl http://localhost:3000/health
echo.
echo.

echo 2. Register User
curl -X POST http://localhost:3000/api/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"pass123\",\"full_name\":\"Test User\"}"
echo.
echo.

echo 3. Login
curl -X POST http://localhost:3000/api/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"pass123\"}"
echo.
echo.

echo Copy the token from above and run:
echo curl http://localhost:3000/api/me -H "Authorization: Bearer YOUR_TOKEN"
echo.
pause
