import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CustomersList from './pages/CustomersList';
import CustomerDetail from './pages/CustomerDetail';
import TasksList from './pages/TasksList';
import TaskDetail from './pages/TaskDetail';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route
                            path="/dashboard"
                            element={
                                <PrivateRoute>
                                    <Dashboard />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/customers"
                            element={
                                <PrivateRoute>
                                    <CustomersList />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/customers/:id"
                            element={
                                <PrivateRoute>
                                    <CustomerDetail />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/tasks"
                            element={
                                <PrivateRoute>
                                    <TasksList />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/tasks/:id"
                            element={
                                <PrivateRoute>
                                    <TaskDetail />
                                </PrivateRoute>
                            }
                        />
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
