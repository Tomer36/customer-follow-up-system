# 🚀 Complete Setup Guide

## What You Have

✅ **Backend API** - Node.js authentication service
✅ **Frontend** - React + Material UI interface
✅ **Database** - MySQL with users table
✅ **Authentication** - JWT tokens, password hashing

---

## 📁 Project Structure

```
customer-follow-up-system/
│
├── auth-service/           # Backend (Node.js + Express)
│   ├── server.js          # 170 lines - complete auth API
│   ├── setup.js           # Database setup script
│   ├── START.bat          # One-click start
│   └── package.json
│
├── frontend/              # Frontend (React + Material UI)
│   ├── src/
│   │   ├── pages/        # Login, Register, Dashboard
│   │   ├── context/      # Auth state management
│   │   ├── services/     # API calls
│   │   └── components/   # Reusable components
│   ├── START.bat         # One-click start
│   └── package.json
│
├── START-ALL.bat          # Start everything at once
└── README.md              # Documentation
```

---

## ⚡ Quick Start (3 Steps)

### Step 1: Setup Backend

```bash
cd auth-service
```

**Option A - Automatic:**
```bash
START.bat
```

**Option B - Manual:**
```bash
npm install
copy .env.example .env
# Edit .env - set MySQL password!
node setup.js
npm run dev
```

**Backend runs on:** http://localhost:3000

---

### Step 2: Setup Frontend

Open **new terminal window**:

```bash
cd frontend
```

**Option A - Automatic:**
```bash
START.bat
```

**Option B - Manual:**
```bash
npm install
npm start
```

**Frontend runs on:** http://localhost:3001

---

### Step 3: Test It!

1. Open browser: **http://localhost:3001**
2. Click **"Register"**
3. Create account
4. Login
5. View your dashboard!

---

## 🎯 Even Easier - Start Everything at Once

From project root:
```bash
START-ALL.bat
```

This opens 2 terminal windows automatically!

---

## 📸 What You'll See

### Login Page
- Clean Material UI design
- Email + password fields
- Link to register
- Error messages

### Register Page
- Full name, email, password
- Validation (min 6 chars)
- Link to login
- Error messages

### Dashboard
- Welcome message with your name
- User profile card
- Account information
- Quick stats
- Logout button

---

## 🧪 Test Backend API (curl)

```bash
# Health check
curl http://localhost:3000/health

# Register
curl -X POST http://localhost:3000/api/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"pass123\",\"full_name\":\"Test User\"}"

# Login
curl -X POST http://localhost:3000/api/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"pass123\"}"

# Get profile (use token from login)
curl http://localhost:3000/api/me ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🔧 Configuration

### Backend (.env)
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password    # CHANGE THIS!
DB_NAME=auth_db
JWT_SECRET=your_secret       # CHANGE THIS!
```

### Frontend
No configuration needed! It automatically connects to http://localhost:3000

---

## 📦 What's Installed

### Backend Dependencies
- express - Web server
- mysql2 - Database
- bcrypt - Password hashing
- jsonwebtoken - JWT tokens
- cors - Cross-origin requests

### Frontend Dependencies
- react - UI framework
- @mui/material - Material UI
- react-router-dom - Routing
- axios - HTTP client

---

## 🛠️ Troubleshooting

### Backend Won't Start

**Problem:** Can't connect to MySQL
**Solution:**
- Check MySQL is running
- Verify password in `.env`

**Problem:** Port 3000 in use
**Solution:**
```bash
# Change port in .env
PORT=3001
```

### Frontend Won't Start

**Problem:** "Network Error"
**Solution:**
- Make sure backend is running
- Check backend is on http://localhost:3000

**Problem:** Port 3001 in use
**Solution:**
- Kill process using port 3001
- Or change port: `PORT=3002 npm start`

### Login Issues

**Problem:** "Invalid credentials"
**Solution:**
- Check email and password are correct
- Try registering new account

**Problem:** "Token expired"
**Solution:**
- Logout and login again
- Token expires after 24 hours

---

## 📊 Database

After setup, you'll have:

**Database:** `auth_db`

**Table:** `users`
```
id           INT (auto increment)
email        VARCHAR (unique)
password     VARCHAR (hashed)
full_name    VARCHAR
created_at   TIMESTAMP
```

View users:
```bash
mysql -u root -p
use auth_db;
SELECT id, email, full_name FROM users;
```

---

## 🎨 Customization

### Change Backend Port

Edit `auth-service/.env`:
```env
PORT=3001  # Change here
```

### Change Theme Colors

Edit `frontend/src/App.js`:
```javascript
const theme = createTheme({
    palette: {
        primary: { main: '#1976d2' },  // Blue
        secondary: { main: '#dc004e' }, // Red
    },
});
```

### Change API URL

Edit `frontend/src/services/api.js`:
```javascript
const API_URL = 'http://your-backend-url/api';
```

---

## 🚀 Production Deployment

### Backend (PM2)
```bash
cd auth-service
pm2 start server.js --name auth
pm2 save
pm2 startup
```

### Frontend (Build)
```bash
cd frontend
npm run build
```

Serve the `build/` folder with Nginx or any web server.

---

## ✅ Checklist

Before running:
- [ ] MySQL installed and running
- [ ] Node.js installed
- [ ] `.env` file created with correct password
- [ ] Backend dependencies installed (`npm install`)
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Database setup completed (`node setup.js`)

Running:
- [ ] Backend running on http://localhost:3000
- [ ] Frontend running on http://localhost:3001
- [ ] Can access frontend in browser
- [ ] Can register new user
- [ ] Can login
- [ ] Can view dashboard

---

## 📝 Summary

**Total Files:** ~20 files
**Total Code:** ~700 lines
**Setup Time:** 5-10 minutes
**Complexity:** Simple!

**Features:**
- ✅ User registration
- ✅ User login
- ✅ Protected dashboard
- ✅ Material UI design
- ✅ JWT authentication
- ✅ Password security
- ✅ Error handling
- ✅ Responsive design

**Ready to extend with:**
- Customer management
- Task management
- Groups
- More features!

---

**Everything is ready. Just run START-ALL.bat and you're good to go!** 🎉
