# Simple Auth Service

Clean authentication service with login and register. **One file, easy to understand.**

## Quick Start

### 1. Install dependencies
```bash
cd auth-service
npm install
```

### 2. Configure environment
```bash
copy .env.example .env
```

**Edit `.env`** and set your MySQL password:
```env
DB_PASSWORD=your_actual_mysql_password
```

### 3. Setup database
```bash
node setup.js
```

### 4. Start server
```bash
npm run dev
```

Server runs on **http://localhost:3000**

---

## API Endpoints

### 1. Register User

```bash
POST /api/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

### 2. Login

```bash
POST /api/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

### 3. Get User Profile

```bash
GET /api/me
Authorization: Bearer YOUR_TOKEN_HERE
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "created_at": "2026-02-09T..."
  }
}
```

---

## Test with curl

```bash
# 1. Register
curl -X POST http://localhost:3000/api/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"pass123\",\"full_name\":\"Test User\"}"

# Copy the token from response

# 2. Login
curl -X POST http://localhost:3000/api/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"pass123\"}"

# 3. Get profile (replace YOUR_TOKEN)
curl http://localhost:3000/api/me ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Database

**Database name:** `auth_db`

**Table:** `users`
- id (auto increment)
- email (unique)
- password (hashed with bcrypt)
- full_name
- created_at

---

## Features

✅ User registration
✅ User login
✅ JWT authentication (24h expiration)
✅ Password hashing (bcrypt)
✅ Protected routes
✅ Input validation
✅ Error handling

---

## File Structure

```
auth-service/
├── server.js          # Main server file (everything here)
├── setup.js           # Database setup
├── package.json       # Dependencies
├── .env.example       # Environment template
├── .env               # Your config (git ignored)
└── README.md          # This file
```

**Total code: ~170 lines**

---

## Security

- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ JWT tokens for authentication
- ✅ Email uniqueness enforced
- ✅ Password minimum length (6 chars)
- ✅ SQL injection protection (parameterized queries)

---

## Production (PM2)

```bash
pm2 start server.js --name auth-service
pm2 save
```

---

## Troubleshooting

**Can't connect to MySQL?**
- Check MySQL is running
- Verify password in `.env`

**"Email already exists"**
- Use different email or login instead

**"Invalid token"**
- Token expired (24h limit)
- Login again to get new token

---

**That's it! Simple and working.** 🚀
