import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { heIL } from '@mui/material/locale';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import CustomersList from './pages/CustomersList';
import CustomerDetail from './pages/CustomerDetail';

const theme = createTheme({
    direction: 'rtl',
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
    components: {
        MuiDialog: {
            defaultProps: {
                PaperProps: {
                    dir: 'rtl'
                }
            }
        },
        MuiDialogContent: {
            styleOverrides: {
                root: {
                    direction: 'rtl',
                    textAlign: 'right'
                }
            }
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    direction: 'rtl'
                }
            }
        },
        MuiTable: {
            styleOverrides: {
                root: {
                    direction: 'rtl'
                }
            }
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    textAlign: 'right'
                }
            }
        },
        MuiInputBase: {
            styleOverrides: {
                input: {
                    textAlign: 'right'
                }
            }
        },
        MuiSelect: {
            styleOverrides: {
                select: {
                    textAlign: 'right'
                }
            }
        },
        MuiFormControl: {
            defaultProps: {
                fullWidth: true
            }
        }
    }
}, heIL);

function App() {
    useEffect(() => {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'he');
        document.body.setAttribute('dir', 'rtl');
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <GlobalStyles
                styles={{
                    html: {
                        direction: 'rtl'
                    },
                    body: {
                        direction: 'rtl',
                        textAlign: 'right'
                    },
                    '#root': {
                        direction: 'rtl'
                    }
                }}
            />
            <div dir="rtl">
                <AuthProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/login" element={<Login />} />
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
                            <Route path="/" element={<Navigate to="/customers" replace />} />
                        </Routes>
                    </BrowserRouter>
                </AuthProvider>
            </div>
        </ThemeProvider>
    );
}

export default App;
