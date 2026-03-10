import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableSortLabel,
    TextField,
    Typography
} from '@mui/material';
import { customersAPI, groupsAPI, usersAPI } from '../services/api';
import CustomerDetailsPanel from '../components/CustomerDetailsPanel';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('he-IL') : '-');
const formatNumber = (value) => Number(value || 0).toFixed(2);

const pageShellSx = {
    minHeight: '100vh',
    py: 4,
    background: 'linear-gradient(180deg, #f7fbff 0%, #edf3fb 45%, #f8fbff 100%)'
};

const glassCardSx = {
    borderRadius: 4,
    border: '1px solid rgba(25, 118, 210, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
    backdropFilter: 'blur(10px)'
};

const fieldSx = {
    '& .MuiOutlinedInput-root': {
        borderRadius: 3,
        backgroundColor: '#fff'
    }
};

const sortableColumns = {
    account_key: {
        label: 'מפתח חשבון',
        getValue: (customer) => Number(customer.account_key || 0)
    },
    account_name: {
        label: 'שם לקוח',
        getValue: (customer) => String(customer.account_name || '')
    },
    payment_start: {
        label: 'תחילת תשלום',
        getValue: (customer) => String(customer.payment_start || '')
    },
    payment_target: {
        label: 'יעד תשלום',
        getValue: (customer) => String(customer.payment_target || '')
    },
    account_balance: {
        label: 'יתרה',
        getValue: (customer) => Number(customer.account_balance || 0)
    },
    managed_by_name: {
        label: 'בטיפול',
        getValue: (customer) => String(customer.managed_by_name || '')
    },
    group_name: {
        label: 'קבוצה',
        getValue: (customer) => String(customer.group_name || '')
    }
};

function CustomersList() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [managedBy, setManagedBy] = useState('');
    const [groupId, setGroupId] = useState('');
    const [balanceMode, setBalanceMode] = useState('balance_non_zero');
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [sortBy, setSortBy] = useState('account_key');
    const [sortDirection, setSortDirection] = useState('asc');

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['customers', page, search, managedBy, groupId, balanceMode],
        queryFn: () => customersAPI.getReport175(page, search, 20, { managedBy, groupId, balanceMode })
    });

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersAPI.getAll()
    });

    const { data: groupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => groupsAPI.getAll()
    });

    const syncMutation = useMutation({
        mutationFn: customersAPI.sync,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
    });

    const customers = useMemo(() => {
        const baseCustomers = [...(data?.customers || [])];
        const sortConfig = sortableColumns[sortBy];
        if (!sortConfig) return baseCustomers;

        return baseCustomers.sort((a, b) => {
            const first = sortConfig.getValue(a);
            const second = sortConfig.getValue(b);

            if (typeof first === 'number' && typeof second === 'number') {
                return sortDirection === 'asc' ? first - second : second - first;
            }

            const comparison = String(first).localeCompare(String(second), 'he');
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [data, sortBy, sortDirection]);

    const pagination = data?.pagination;
    const users = usersData?.users || [];
    const groups = groupsData?.groups || [];

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput);
    };

    const handleFiltersChange = (setter) => (event) => {
        setPage(1);
        setter(event.target.value);
    };

    const openCustomerInPlace = (customerId) => {
        if (!customerId) return;
        setSelectedCustomerId(customerId);
    };

    const handleSort = (columnKey) => {
        if (sortBy === columnKey) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }

        setSortBy(columnKey);
        setSortDirection('asc');
    };

    return (
        <Box sx={pageShellSx}>
            <Container maxWidth="xl">
                <Paper
                    sx={{
                        ...glassCardSx,
                        p: { xs: 2.5, md: 3 },
                        mb: 2.5,
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            background: 'radial-gradient(circle at top right, rgba(25, 118, 210, 0.16), transparent 38%)',
                            pointerEvents: 'none'
                        }}
                    />
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        spacing={2}
                        sx={{ position: 'relative' }}
                    >
                        <Box>
                            <Typography
                                variant="overline"
                                sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: '0.18em' }}
                            >
                                CLIENTS
                            </Typography>
                            <Typography
                                variant="h3"
                                sx={{
                                    fontWeight: 900,
                                    color: '#102a43',
                                    lineHeight: 1.08
                                }}
                            >
                                לקוחות
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={1}>
                            <Button component={Link} to="/dashboard" variant="outlined" sx={{ borderRadius: 999 }}>
                                לוח בקרה
                            </Button>
                            <Button
                                onClick={() => syncMutation.mutate()}
                                variant="contained"
                                disabled={syncMutation.isPending}
                                sx={{
                                    borderRadius: 999,
                                    px: 2.5,
                                    boxShadow: '0 12px 30px rgba(25, 118, 210, 0.28)'
                                }}
                            >
                                {syncMutation.isPending ? 'מסנכרן...' : 'סנכרן'}
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>

                <Paper sx={{ ...glassCardSx, p: 2, mb: 2.5 }}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        spacing={1.5}
                        sx={{ mb: 1.5 }}
                    >
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#102a43' }}>
                                חיפוש וסינון
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                מצא לקוחות במהירות לפי חיפוש חופשי, מנהל מטפל או קבוצה.
                            </Typography>
                        </Box>
                    </Stack>

                    <Box component="form" onSubmit={handleSearchSubmit}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                            <TextField
                                fullWidth
                                size="small"
                                label="חיפוש לפי שם לקוח, מפתח חשבון או טלפון"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                sx={fieldSx}
                            />
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                                <InputLabel>מנהל מטפל</InputLabel>
                                <Select
                                    label="מנהל מטפל"
                                    value={managedBy}
                                    onChange={handleFiltersChange(setManagedBy)}
                                    sx={fieldSx}
                                >
                                    <MenuItem value="">הכל</MenuItem>
                                    {users.map((u) => (
                                        <MenuItem key={u.id} value={u.id}>{u.full_name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                                <InputLabel>קבוצה</InputLabel>
                                <Select
                                    label="קבוצה"
                                    value={groupId}
                                    onChange={handleFiltersChange(setGroupId)}
                                    sx={fieldSx}
                                >
                                    <MenuItem value="">הכל</MenuItem>
                                    {groups.map((g) => (
                                        <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Button
                                type="submit"
                                variant="contained"
                                sx={{ minWidth: 110, borderRadius: 3, px: 3 }}
                            >
                                חפש
                            </Button>
                        </Stack>
                    </Box>
                </Paper>

                {selectedCustomerId && (
                    <Paper sx={{ ...glassCardSx, p: 2, mb: 2.5 }}>
                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 800, color: '#102a43' }}>
                            פרטי לקוח
                        </Typography>
                        <CustomerDetailsPanel customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />
                    </Paper>
                )}

                {syncMutation.isSuccess && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        {syncMutation.data?.message || 'הסנכרון הושלם'}
                    </Alert>
                )}

                {syncMutation.isError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {syncMutation.error?.response?.data?.error || 'הסנכרון נכשל'}
                    </Alert>
                )}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
                    <Paper sx={{ ...glassCardSx, flex: 1, order: { xs: 1, md: 2 }, overflow: 'hidden' }}>
                        {isLoading ? (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <CircularProgress />
                            </Box>
                        ) : isError ? (
                            <Alert severity="error">{error?.response?.data?.error || 'טעינת הלקוחות נכשלה'}</Alert>
                        ) : (
                            <>
                                    <Box
                                        sx={{
                                            px: 2,
                                            py: 1.5,
                                        borderBottom: '1px solid',
                                        borderColor: 'divider',
                                        background: 'linear-gradient(180deg, rgba(25, 118, 210, 0.06), rgba(25, 118, 210, 0.015))'
                                    }}
                                    >
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#102a43' }}>
                                            רשימת לקוחות
                                        </Typography>
                                    </Box>

                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: 'rgba(15, 23, 42, 0.03)' }}>
                                            {Object.entries(sortableColumns).map(([columnKey, config]) => (
                                                <TableCell key={columnKey} align="right" sx={{ fontWeight: 800 }}>
                                                    <TableSortLabel
                                                        active={sortBy === columnKey}
                                                        direction={sortBy === columnKey ? sortDirection : 'asc'}
                                                        onClick={() => handleSort(columnKey)}
                                                    >
                                                        {config.label}
                                                    </TableSortLabel>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {customers.map((customer) => (
                                            <TableRow
                                                key={customer.id}
                                                hover
                                                sx={{
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(25, 118, 210, 0.035)'
                                                    }
                                                }}
                                            >
                                                <TableCell>{customer.account_key || '-'}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        onClick={() => openCustomerInPlace(customer.customer_id)}
                                                        size="small"
                                                        disabled={!customer.customer_id}
                                                        sx={{ borderRadius: 999 }}
                                                    >
                                                        {customer.account_name || '-'}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>{formatDate(customer.payment_start)}</TableCell>
                                                <TableCell>{formatDate(customer.payment_target)}</TableCell>
                                                <TableCell align="right">{formatNumber(customer.account_balance)}</TableCell>
                                                <TableCell>{customer.managed_by_name || '-'}</TableCell>
                                                <TableCell>{customer.group_name || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {customers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center">לא נמצאו לקוחות</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>

                                <Stack direction="row" justifyContent="space-between" sx={{ p: 2 }}>
                                    <Button disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)} sx={{ borderRadius: 999 }}>
                                        הקודם
                                    </Button>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                        עמוד {pagination?.page || page} מתוך {pagination?.totalPages || 1}
                                    </Typography>
                                    <Button
                                        disabled={!pagination || page >= pagination.totalPages}
                                        onClick={() => setPage((prev) => prev + 1)}
                                        sx={{ borderRadius: 999 }}
                                    >
                                        הבא
                                    </Button>
                                </Stack>
                            </>
                        )}
                    </Paper>

                    <Paper sx={{ ...glassCardSx, width: { xs: '100%', md: 300 }, p: 2, order: { xs: 2, md: 1 } }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5, color: '#102a43' }}>
                            תנאי הצגה
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            בחר אילו לקוחות יוצגו לפי מצב היתרה.
                        </Typography>
                        <FormControl>
                            <RadioGroup
                                value={balanceMode}
                                onChange={(event) => {
                                    setPage(1);
                                    setBalanceMode(event.target.value);
                                }}
                            >
                                <FormControlLabel
                                    value="balance_non_zero"
                                    control={<Radio />}
                                    label="הכל בלי יתרה אפס"
                                />
                                <FormControlLabel
                                    value="balance_zero"
                                    control={<Radio />}
                                    label="הכל כולל יתרה אפס"
                                />
                            </RadioGroup>
                        </FormControl>
                    </Paper>
                </Stack>
            </Container>
        </Box>
    );
}

export default CustomersList;
