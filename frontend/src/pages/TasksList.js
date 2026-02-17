import React from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    MenuItem,
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
import { customersAPI, groupsAPI, tasksAPI } from '../services/api';

function TasksList() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        customer_id: '',
        group_id: '',
        title: '',
        description: '',
        priority: 'medium',
        due_date: ''
    });

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['tasks'],
        queryFn: () => tasksAPI.getAll({ page: 1, limit: 50 })
    });

    const { data: customersData } = useQuery({
        queryKey: ['task-form-customers'],
        queryFn: () => customersAPI.getAll(1, '', 200)
    });

    const { data: groupsData } = useQuery({
        queryKey: ['task-form-groups'],
        queryFn: () => groupsAPI.getAll()
    });

    const createTaskMutation = useMutation({
        mutationFn: tasksAPI.create,
        onSuccess: () => {
            setForm({
                customer_id: '',
                group_id: '',
                title: '',
                description: '',
                priority: 'medium',
                due_date: ''
            });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
    });

    const tasks = data?.tasks || [];
    const customers = useMemo(() => customersData?.customers || [], [customersData]);
    const groups = useMemo(() => groupsData?.groups || [], [groupsData]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleCreateTask = (event) => {
        event.preventDefault();
        createTaskMutation.mutate({
            customer_id: Number(form.customer_id),
            group_id: form.group_id ? Number(form.group_id) : null,
            title: form.title.trim(),
            description: form.description.trim() || null,
            priority: form.priority,
            due_date: form.due_date
        });
    };

    return (
        <Container maxWidth="lg">
            <Box sx={{ mt: 4, mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h4">Tasks</Typography>
                    <Box>
                        <Button component={Link} to="/dashboard" variant="outlined" sx={{ mr: 1 }}>Dashboard</Button>
                        <Button component={Link} to="/customers" variant="outlined">Customers</Button>
                    </Box>
                </Box>

                <Paper sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Add Task</Typography>
                    <Box component="form" onSubmit={handleCreateTask}>
                        <Stack spacing={2}>
                            <TextField
                                name="title"
                                label="Task Title"
                                value={form.title}
                                onChange={handleFormChange}
                                required
                            />
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <TextField
                                    select
                                    name="customer_id"
                                    label="Customer"
                                    value={form.customer_id}
                                    onChange={handleFormChange}
                                    required
                                    fullWidth
                                >
                                    {customers.map((customer) => (
                                        <MenuItem key={customer.id} value={customer.id}>
                                            {customer.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select
                                    name="group_id"
                                    label="Group"
                                    value={form.group_id}
                                    onChange={handleFormChange}
                                    fullWidth
                                >
                                    <MenuItem value="">No Group</MenuItem>
                                    {groups.map((group) => (
                                        <MenuItem key={group.id} value={group.id}>
                                            {group.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <TextField
                                    select
                                    name="priority"
                                    label="Priority"
                                    value={form.priority}
                                    onChange={handleFormChange}
                                    fullWidth
                                >
                                    <MenuItem value="low">Low</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                    <MenuItem value="urgent">Urgent</MenuItem>
                                </TextField>
                                <TextField
                                    type="date"
                                    name="due_date"
                                    label="Due Date"
                                    value={form.due_date}
                                    onChange={handleFormChange}
                                    InputLabelProps={{ shrink: true }}
                                    required
                                    fullWidth
                                />
                            </Stack>
                            <TextField
                                name="description"
                                label="Description"
                                value={form.description}
                                onChange={handleFormChange}
                                multiline
                                minRows={2}
                            />
                            <Box>
                                <Button type="submit" variant="contained" disabled={createTaskMutation.isPending}>
                                    {createTaskMutation.isPending ? 'Saving...' : 'Create Task'}
                                </Button>
                            </Box>
                        </Stack>
                    </Box>
                    {createTaskMutation.isSuccess && (
                        <Alert severity="success" sx={{ mt: 2 }}>
                            Task created successfully.
                        </Alert>
                    )}
                    {createTaskMutation.isError && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {createTaskMutation.error?.response?.data?.error || 'Failed to create task.'}
                        </Alert>
                    )}
                </Paper>

                <Paper>
                    {isLoading ? (
                        <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>
                    ) : isError ? (
                        <Alert severity="error">{error?.response?.data?.error || 'Failed to load tasks.'}</Alert>
                    ) : (
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Title</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Priority</TableCell>
                                    <TableCell>Customer</TableCell>
                                    <TableCell>Group</TableCell>
                                    <TableCell>Due Date</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {tasks.map((task) => (
                                    <TableRow key={task.id}>
                                        <TableCell>{task.title}</TableCell>
                                        <TableCell>{task.status}</TableCell>
                                        <TableCell>{task.priority}</TableCell>
                                        <TableCell>{task.customer_name || '-'}</TableCell>
                                        <TableCell>{task.group_name || '-'}</TableCell>
                                        <TableCell>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell align="right">
                                            <Button component={Link} to={`/tasks/${task.id}`} size="small">View</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {tasks.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">No tasks found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </Paper>
            </Box>
        </Container>
    );
}

export default TasksList;
