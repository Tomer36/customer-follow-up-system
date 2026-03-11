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
    TextField,
    Typography
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

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
        <Container maxWidth="sm">
            <Box sx={{ mt: 8 }}>
                <Paper elevation={3} sx={{ p: 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom align="center">
                        התחברות
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <FormControl fullWidth margin="normal" required>
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
                            sx={{ mt: 3, mb: 2 }}
                            disabled={loading || isUsersLoading || !username}
                        >
                            {loading ? 'מתחבר...' : 'התחבר'}
                        </Button>
                    </form>
                </Paper>
            </Box>
        </Container>
    );
}

export default Login;
