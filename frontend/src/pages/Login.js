import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const pageShellSx = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    py: 6,
    background: 'linear-gradient(180deg, #f4f9ff 0%, #eaf2fd 42%, #f8fbff 100%)'
};

const glassCardSx = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 5,
    border: '1px solid rgba(25, 118, 210, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.12)',
    backdropFilter: 'blur(10px)'
};

const fieldSx = {
    '& .MuiOutlinedInput-root': {
        borderRadius: 3,
        backgroundColor: '#fff'
    }
};

function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { data: loginUsersData, isLoading: isUsersLoading } = useQuery({
        queryKey: ['login-users'],
        queryFn: () => authAPI.getLoginUsers()
    });

    const loginUsers = loginUsersData?.users || [];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(username, password);
            navigate('/customers');
        } catch (err) {
            setError(err.response?.data?.error || 'ההתחברות נכשלה');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={pageShellSx}>
            <Container maxWidth="md">
                <Paper sx={glassCardSx}>
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            background: 'radial-gradient(circle at top right, rgba(25, 118, 210, 0.16), transparent 34%)',
                            pointerEvents: 'none'
                        }}
                    />

                    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ position: 'relative' }}>
                        <Box
                            sx={{
                                flex: 1,
                                px: { xs: 3, md: 5 },
                                py: { xs: 4, md: 5 },
                                textAlign: 'center',
                                background: 'linear-gradient(180deg, rgba(232, 241, 252, 0.9), rgba(244, 249, 255, 0.65))',
                                borderBottom: { xs: '1px solid rgba(15, 23, 42, 0.08)', md: 'none' },
                                borderLeft: { xs: 'none', md: '1px solid rgba(15, 23, 42, 0.08)' }
                            }}
                        >
                            <Typography
                                variant="overline"
                                sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: '0.24em' }}
                            >
                                CUSTOMER FOLLOW-UP
                            </Typography>
                            <Typography
                                variant="h3"
                                sx={{
                                    mt: 1,
                                    mb: 2.5,
                                    fontWeight: 900,
                                    color: '#102a43',
                                    lineHeight: 1.08,
                                    textShadow: '0 1px 0 rgba(255,255,255,0.7)'
                                }}
                            >
                                התחברות למערכת
                            </Typography>
                            <Box
                                sx={{
                                    mx: 'auto',
                                    width: 112,
                                    height: 112,
                                    borderRadius: '28px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    background: 'linear-gradient(145deg, rgba(25, 118, 210, 0.22), rgba(255, 255, 255, 0.9))',
                                    color: 'primary.main',
                                    border: '1px solid rgba(25, 118, 210, 0.16)',
                                    boxShadow: '0 22px 40px rgba(25, 118, 210, 0.16), inset 0 1px 0 rgba(255,255,255,0.8)',
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        inset: 10,
                                        borderRadius: '22px',
                                        border: '1px dashed rgba(25, 118, 210, 0.18)'
                                    }
                                }}
                            >
                                <LoginRoundedIcon sx={{ fontSize: 48, position: 'relative', zIndex: 1 }} />
                            </Box>
                        </Box>

                        <Box sx={{ flex: 1, px: { xs: 3, md: 5 }, py: { xs: 4, md: 5 } }}>
                            <Box
                                sx={{
                                    p: { xs: 0, md: 1.5 },
                                    borderRadius: 4,
                                    backgroundColor: { xs: 'transparent', md: 'rgba(255, 255, 255, 0.72)' }
                                }}
                            >
                            <Typography variant="h5" sx={{ fontWeight: 800, color: '#102a43', mb: 0.75 }}>
                                כניסה
                            </Typography>

                            {error && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {error}
                                </Alert>
                            )}

                            <Box component="form" onSubmit={handleSubmit}>
                                <FormControl fullWidth margin="normal" required sx={fieldSx}>
                                    <InputLabel>שם משתמש</InputLabel>
                                    <Select
                                        label="שם משתמש"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        disabled={isUsersLoading}
                                    >
                                        {loginUsers.map((user) => (
                                            <MenuItem key={user.id} value={user.username}>
                                                {user.username}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <TextField
                                    label="סיסמה"
                                    type="password"
                                    fullWidth
                                    margin="normal"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    sx={fieldSx}
                                />

                                {isUsersLoading && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                        <CircularProgress size={22} />
                                    </Box>
                                )}

                                <Button
                                    type="submit"
                                    variant="contained"
                                    fullWidth
                                    size="large"
                                    sx={{
                                        mt: 3,
                                        borderRadius: 999,
                                        py: 1.4,
                                        fontWeight: 800,
                                        background: 'linear-gradient(135deg, #1976d2, #1565c0)',
                                        boxShadow: '0 16px 30px rgba(25, 118, 210, 0.28)',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #1565c0, #0f5aa8)',
                                            boxShadow: '0 18px 34px rgba(25, 118, 210, 0.32)'
                                        }
                                    }}
                                    disabled={loading || isUsersLoading || !username}
                                >
                                    {loading ? 'מתחבר...' : 'התחבר'}
                                </Button>
                            </Box>
                            </Box>
                        </Box>
                    </Stack>
                </Paper>
            </Container>
        </Box>
    );
}

export default Login;
