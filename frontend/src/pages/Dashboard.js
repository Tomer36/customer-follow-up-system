import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Container,
    Paper,
    Typography,
    Box,
    Button,
    Grid,
    Avatar,
    Stack
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../context/AuthContext';

function Dashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <Container maxWidth="md">
            <Box sx={{ mt: 4 }}>
                <Paper elevation={3} sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                        <Typography variant="h4" component="h1">
                            Dashboard
                        </Typography>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<LogoutIcon />}
                            onClick={handleLogout}
                        >
                            Logout
                        </Button>
                    </Box>

                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Paper sx={{ p: 3, bgcolor: 'primary.main', color: 'white' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'white' }}>
                                        <PersonIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h5" gutterBottom>
                                            Welcome, {user?.full_name}!
                                        </Typography>
                                        <Typography variant="body1">
                                            {user?.email}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Account Information
                                </Typography>
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        User ID
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {user?.id}
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        Email
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {user?.email}
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        Member Since
                                    </Typography>
                                    <Typography variant="body1">
                                        {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                    </Typography>
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Quick Stats
                                </Typography>
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Status
                                    </Typography>
                                    <Typography variant="body1" color="success.main" gutterBottom>
                                        ✓ Active
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        Session
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        Valid for 24 hours
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        Last Login
                                    </Typography>
                                    <Typography variant="body1">
                                        {new Date().toLocaleString()}
                                    </Typography>
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Quick Navigation
                                </Typography>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    <Button component={Link} to="/customers" variant="contained">
                                        Customers
                                    </Button>
                                    <Button component={Link} to="/tasks" variant="outlined">
                                        Tasks
                                    </Button>
                                </Stack>
                            </Paper>
                        </Grid>
                    </Grid>

                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            You are successfully logged in to the system!
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
}

export default Dashboard;
