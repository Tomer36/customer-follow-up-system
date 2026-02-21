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
    Paper,
    Radio,
    RadioGroup,
    Select,
    MenuItem,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
    InputLabel
} from '@mui/material';
import { customersAPI, groupsAPI, usersAPI } from '../services/api';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('he-IL') : '-');
const formatNumber = (value) => Number(value || 0).toFixed(2);

function CustomersList() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [managedBy, setManagedBy] = useState('');
    const [groupId, setGroupId] = useState('');
    const [balanceMode, setBalanceMode] = useState('balance_non_zero');

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

    const customers = useMemo(() => data?.customers || [], [data]);
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

    return (
        <Container maxWidth="xl">
            <Box sx={{ mt: 4, mb: 4 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                    <Typography variant="h4">לקוחות</Typography>
                    <Stack direction="row" spacing={1}>
                        <Button component={Link} to="/dashboard" variant="outlined">לוח בקרה</Button>
                        <Button onClick={() => syncMutation.mutate()} variant="contained" disabled={syncMutation.isPending}>
                            {syncMutation.isPending ? 'מסנכרן...' : 'סנכרן'}
                        </Button>
                    </Stack>
                </Stack>

                <Box component="form" onSubmit={handleSearchSubmit} sx={{ mt: 2, mb: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                            fullWidth
                            size="small"
                            label="חיפוש לפי שם לקוח או מפתח חשבון"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                        />
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                            <InputLabel>מנהל מטפל</InputLabel>
                            <Select label="מנהל מטפל" value={managedBy} onChange={handleFiltersChange(setManagedBy)}>
                                <MenuItem value="">הכל</MenuItem>
                                {users.map((u) => (
                                    <MenuItem key={u.id} value={u.id}>{u.full_name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                            <InputLabel>קבוצה</InputLabel>
                            <Select label="קבוצה" value={groupId} onChange={handleFiltersChange(setGroupId)}>
                                <MenuItem value="">הכל</MenuItem>
                                {groups.map((g) => (
                                    <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button type="submit" variant="outlined">חפש</Button>
                    </Stack>
                </Box>

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
                    <Paper sx={{ flex: 1 }}>
                        {isLoading ? (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <CircularProgress />
                            </Box>
                        ) : isError ? (
                            <Alert severity="error">{error?.response?.data?.error || 'טעינת הלקוחות נכשלה'}</Alert>
                        ) : (
                            <>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>מפתח חשבון</TableCell>
                                            <TableCell>שם לקוח</TableCell>
                                            <TableCell>תחילת תשלום</TableCell>
                                            <TableCell>יעד תשלום</TableCell>
                                            <TableCell align="right">יתרה</TableCell>
                                            <TableCell>בטיפול (איזה מנהל)</TableCell>
                                            <TableCell>קבוצה</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {customers.map((customer) => (
                                            <TableRow key={customer.id} hover>
                                                <TableCell>{customer.account_key || '-'}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        component={Link}
                                                        to={`/customers/${customer.customer_id}`}
                                                        size="small"
                                                        disabled={!customer.customer_id}
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
                                    <Button disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>הקודם</Button>
                                    <Typography variant="body2">
                                        עמוד {pagination?.page || page} מתוך {pagination?.totalPages || 1}
                                    </Typography>
                                    <Button disabled={!pagination || page >= pagination.totalPages} onClick={() => setPage((prev) => prev + 1)}>הבא</Button>
                                </Stack>
                            </>
                        )}
                    </Paper>

                    <Paper sx={{ width: { xs: '100%', md: 280 }, p: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                            תנאי הצגה
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
                                    label="יתרת חשבון שונה מ-0"
                                />
                                <FormControlLabel
                                    value="balance_zero"
                                    control={<Radio />}
                                    label="יתרת חשבון שווה ל-0"
                                />
                                <FormControlLabel
                                    value="balance_zero_obligo_non_zero"
                                    control={<Radio />}
                                    label="יתרת חשבון 0 וסה''כ אובליגו שונה מ-0"
                                />
                            </RadioGroup>
                        </FormControl>
                    </Paper>
                </Stack>
            </Box>
        </Container>
    );
}

export default CustomersList;
