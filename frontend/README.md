# Auth Frontend - React + Material UI

Simple, clean authentication frontend.

## Features

✅ Login page
✅ Register page
✅ Dashboard (protected route)
✅ Material UI design
✅ JWT authentication
✅ Auto token refresh
✅ Protected routes
✅ Responsive design

---

## Quick Start

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Start development server
```bash
npm start
```

Frontend runs on **http://localhost:3001**

**Important:** Backend must be running on http://localhost:3000

---

## Usage

1. **Open** http://localhost:3001
2. **Register** a new account
3. **Login** with your credentials
4. **View** your dashboard

---

## Pages

### Login (`/login`)
- Email and password fields
- Form validation
- Error messages
- Link to register

### Register (`/register`)
- Full name, email, password fields
- Password validation (min 6 chars)
- Error messages
- Link to login

### Dashboard (`/dashboard`)
- Protected route (requires login)
- User profile display
- Account information
- Logout button
- Clean Material UI cards

---

## File Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   └── PrivateRoute.js      # Protected route wrapper
│   ├── context/
│   │   └── AuthContext.js       # Authentication state
│   ├── pages/
│   │   ├── Login.js             # Login page
│   │   ├── Register.js          # Register page
│   │   └── Dashboard.js         # Dashboard page
│   ├── services/
│   │   └── api.js               # API calls
│   ├── App.js                   # Main app + routing
│   └── index.js                 # Entry point
├── package.json
└── README.md
```

---

## Routes

| Route | Component | Protected |
|-------|-----------|-----------|
| `/` | Redirect to dashboard | No |
| `/login` | Login | No |
| `/register` | Register | No |
| `/dashboard` | Dashboard | Yes ✓ |

---

## API Integration

Backend URL: `http://localhost:3000/api`

**Endpoints used:**
- POST `/register` - Register new user
- POST `/login` - Login user
- GET `/me` - Get user profile

**Authentication:**
- JWT token stored in `localStorage`
- Auto-attached to requests via axios interceptor
- Token expires in 24 hours

---

## Customization

### Change Backend URL

Edit `src/services/api.js`:
```javascript
const API_URL = 'http://your-backend-url/api';
```

### Change Theme Colors

Edit `src/App.js`:
```javascript
const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2', // Change this
        },
        secondary: {
            main: '#dc004e', // Change this
        },
    },
});
```

---

## Build for Production

```bash
npm run build
```

Creates optimized build in `build/` folder.

Serve with:
```bash
npx serve -s build
```

---

## Troubleshooting

**"Network Error"**
- Make sure backend is running on http://localhost:3000
- Check CORS is enabled in backend

**"Invalid token"**
- Token expired (24h limit)
- Logout and login again

**Port 3001 already in use**
- Change port by setting `PORT=3002` before `npm start`
- Or kill process using port 3001

---

## Screenshots

**Login Page:**
- Clean Material UI design
- Email and password fields
- Error alerts
- Register link

**Dashboard:**
- Welcome message
- User profile card
- Account information
- Quick stats
- Logout button

---

## Next Steps

Add more features:
- Customer management pages
- Tasks pages
- Groups pages
- Settings page
- Profile editing

---

**Simple, clean, and ready to use!** 🎨
