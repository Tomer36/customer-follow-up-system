import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography
} from '@mui/material';
import { customersAPI } from '../services/api';

function CustomersList() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['customers', page, search],
        queryFn: () => customersAPI.getAll(page, search)
    });

    const syncMutation = useMutation({
        mutationFn: customersAPI.sync,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
    });

    const customers = useMemo(() => data?.customers || [], [data]);
    const pagination = data?.pagination;

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput);
    };

    return (
        <Container maxWidth="lg">
            <Box sx={{ mt: 4, mb: 4 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                    <Typography variant="h4">Customers</Typography>
                    <Stack direction="row" spacing={1}>
                        <Button component={Link} to="/dashboard" variant="outlined">Dashboard</Button>
                        <Button onClick={() => syncMutation.mutate()} variant="contained" disabled={syncMutation.isPending}>
                            {syncMutation.isPending ? 'Syncing...' : 'Sync Customers'}
                        </Button>
                    </Stack>
                </Stack>

                <Box component="form" onSubmit={handleSearchSubmit} sx={{ mt: 2, mb: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Search by name or company"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                        />
                        <Button type="submit" variant="outlined">Search</Button>
                    </Stack>
                </Box>

                {syncMutation.isSuccess && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        {syncMutation.data?.message || 'Sync completed.'}
                    </Alert>
                )}

                {syncMutation.isError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {syncMutation.error?.response?.data?.error || 'Sync failed.'}
                    </Alert>
                )}

                <Paper>
                    {isLoading ? (
                        <Box sx={{ p: 4, textAlign: 'center' }}>
                            <CircularProgress />
                        </Box>
                    ) : isError ? (
                        <Alert severity="error">{error?.response?.data?.error || 'Failed to load customers.'}</Alert>
                    ) : (
                        <>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Company</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Phone</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {customers.map((customer) => (
                                        <TableRow key={customer.id}>
                                            <TableCell>{customer.name}</TableCell>
                                            <TableCell>{customer.company || '-'}</TableCell>
                                            <TableCell>{customer.email || '-'}</TableCell>
                                            <TableCell>{customer.phone || '-'}</TableCell>
                                            <TableCell align="right">
                                                <Button component={Link} to={`/customers/${customer.id}`} size="small">View</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {customers.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center">No customers found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <Stack direction="row" justifyContent="space-between" sx={{ p: 2 }}>
                                <Button disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>Previous</Button>
                                <Typography variant="body2">
                                    Page {pagination?.page || page} / {pagination?.totalPages || 1}
                                </Typography>
                                <Button disabled={!pagination || page >= pagination.totalPages} onClick={() => setPage((prev) => prev + 1)}>Next</Button>
                            </Stack>
                        </>
                    )}
                </Paper>
            </Box>
        </Container>
    );
}

export default CustomersList;
