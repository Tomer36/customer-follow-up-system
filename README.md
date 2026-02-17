# Customer Follow-Up System

Simple authentication system with Node.js backend and React frontend.

## What's Included

### Backend (auth-service)
- ✅ Node.js + Express
- ✅ MySQL database
- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ Register, Login, Get Profile

### Frontend (React + Material UI)
- ✅ Login page
- ✅ Register page
- ✅ Dashboard (protected)
- ✅ Material UI design
- ✅ Responsive layout

---

## Quick Start (Easy Way)

### Method 1: Automatic Setup

**1. Start Backend:**
```bash
cd auth-service
START.bat
```

**2. Start Frontend (new terminal):**
```bash
cd frontend
START.bat
```

Done! 🎉

---

## Quick Start (Manual Way)

### Prerequisites
- Node.js installed
- MySQL installed and running

### 1. Setup Backend

```bash
# Install dependencies
cd auth-service
npm install

# Configure environment
copy .env.example .env
# Edit .env - set your MySQL password!

# Setup database
node setup.js

# Start server
npm run dev
```

Backend runs on **http://localhost:3000**

### 2. Setup Frontend

```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm start
```

Frontend runs on **http://localhost:3001**

---

## Testing the System

1. **Open browser:** http://localhost:3001
2. **Register** new account
3. **Login** with your credentials
4. **View** dashboard

### Test with curl

```bash
# Register
curl -X POST http://localhost:3000/api/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"pass123\",\"full_name\":\"Test User\"}"

# Login
curl -X POST http://localhost:3000/api/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"pass123\"}"
```

---

## Project Structure

```
customer-follow-up-system/
├── auth-service/              # Backend API
│   ├── server.js              # Main server (170 lines)
│   ├── setup.js               # Database setup
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── frontend/                  # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── context/           # Auth context
│   │   ├── pages/             # Login, Register, Dashboard
│   │   ├── services/          # API calls
│   │   ├── App.js             # Main app + routing
│   │   └── index.js
│   ├── package.json
│   └── README.md
│
└── README.md                  # This file
```

---

## Features

### Backend Features
- ✅ User registration with validation
- ✅ User login with JWT tokens
- ✅ Protected routes
- ✅ Password hashing (bcrypt)
- ✅ MySQL database
- ✅ Error handling
- ✅ CORS enabled

### Frontend Features
- ✅ Material UI design
- ✅ Responsive layout
- ✅ Login page
- ✅ Register page
- ✅ Protected dashboard
- ✅ Auto token management
- ✅ Error messages
- ✅ Loading states
- ✅ Form validation

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login user |
| GET | `/api/me` | Get user profile (protected) |
| GET | `/health` | Health check |

---

## Tech Stack

### Backend
- Node.js
- Express
- MySQL
- JWT (jsonwebtoken)
- bcrypt
- CORS

### Frontend
- React 18
- Material UI 5
- React Router v6
- Axios
- Context API

---

## Ports

- **Backend:** http://localhost:3000
- **Frontend:** http://localhost:3001

---

## Database

**Database name:** `auth_db`

**Table:** `users`
- id (auto increment)
- email (unique)
- password (hashed)
- full_name
- created_at

---

## Security

- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ JWT tokens (24-hour expiration)
- ✅ Email validation
- ✅ Password minimum length (6 chars)
- ✅ SQL injection protection
- ✅ CORS enabled
- ✅ Protected routes

---

## Development

### Start Backend
```bash
cd auth-service
npm run dev
```

### Start Frontend
```bash
cd frontend
npm start
```

### Run Both (from root)
```bash
# Terminal 1
npm run backend

# Terminal 2
npm run frontend
```

---

## Production Deployment

### Backend with PM2
```bash
cd auth-service
pm2 start server.js --name auth-service
pm2 save
```

### Frontend Build
```bash
cd frontend
npm run build
```

Serve the `build/` folder with your web server.

---

## Troubleshooting

### Backend Issues

**"Can't connect to MySQL"**
- Check MySQL is running
- Verify password in `.env`

**"Email already exists"**
- User already registered
- Use different email or login

### Frontend Issues

**"Network Error"**
- Make sure backend is running on http://localhost:3000
- Check backend CORS is enabled

**"Invalid token"**
- Token expired (24h)
- Logout and login again

**Port already in use**
- Backend: Change PORT in `.env`
- Frontend: Kill process or use different port

---

## Next Steps

Extend the system:
1. ✅ Add customer management
2. ✅ Add task management
3. ✅ Add groups
4. ✅ Add dashboard statistics
5. ✅ Add profile editing
6. ✅ Add password reset

---

## File Count

- **Backend:** 7 files (~200 lines total)
- **Frontend:** 12 files (~500 lines total)

**Simple, clean, and production-ready!** 🚀

---

## Support

For issues:
1. Check README files in each folder
2. Verify backend is running
3. Check browser console for errors
4. Check backend logs

---

## License

ISC
