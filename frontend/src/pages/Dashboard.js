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
                            לוח בקרה
                        </Typography>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<LogoutIcon />}
                            onClick={handleLogout}
                        >
                            התנתק
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
                                            ברוך הבא, {user?.full_name}!
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
                                    פרטי חשבון
                                </Typography>
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        מזהה משתמש
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {user?.id}
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        אימייל
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {user?.email}
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        חבר מאז
                                    </Typography>
                                    <Typography variant="body1">
                                        {user?.created_at ? new Date(user.created_at).toLocaleDateString('he-IL') : 'לא זמין'}
                                    </Typography>
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    סטטוס מהיר
                                </Typography>
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        מצב
                                    </Typography>
                                    <Typography variant="body1" color="success.main" gutterBottom>
                                        פעיל
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        סשן
                                    </Typography>
                                    <Typography variant="body1" gutterBottom>
                                        תקף ל-24 שעות
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        התחברות אחרונה
                                    </Typography>
                                    <Typography variant="body1">
                                        {new Date().toLocaleString('he-IL')}
                                    </Typography>
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid item xs={12}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    ניווט מהיר
                                </Typography>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    <Button component={Link} to="/customers" variant="contained">
                                        לקוחות
                                    </Button>
                                    <Button component={Link} to="/tasks" variant="outlined">
                                        משימות
                                    </Button>
                                </Stack>
                            </Paper>
                        </Grid>
                    </Grid>

                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            התחברת בהצלחה למערכת
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
}

export default Dashboard;
