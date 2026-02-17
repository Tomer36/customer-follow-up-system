import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import { tasksAPI } from '../services/api';

function TaskDetail() {
    const queryClient = useQueryClient();
    const { id } = useParams();

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['task', id],
        queryFn: () => tasksAPI.getById(id),
        enabled: Boolean(id)
    });

    const statusMutation = useMutation({
        mutationFn: (status) => tasksAPI.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task', id] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
    });

    const task = data?.task;

    return (
        <Container maxWidth="md">
            <Box sx={{ mt: 4 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button component={Link} to="/tasks" variant="outlined">Back</Button>
                    <Button component={Link} to="/customers" variant="outlined">Customers</Button>
                </Stack>
                <Paper sx={{ p: 3 }}>
                    {isLoading ? (
                        <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>
                    ) : isError ? (
                        <Alert severity="error">{error?.response?.data?.error || 'Failed to load task.'}</Alert>
                    ) : !task ? (
                        <Alert severity="warning">Task not found.</Alert>
                    ) : (
                        <>
                            <Typography variant="h4" gutterBottom>{task.title}</Typography>
                            <Typography><strong>Status:</strong> {task.status}</Typography>
                            <Typography><strong>Priority:</strong> {task.priority}</Typography>
                            <Typography><strong>Customer:</strong> {task.customer_name || task.customer_id || '-'}</Typography>
                            <Typography><strong>Group:</strong> {task.group_name || task.group_id || '-'}</Typography>
                            <Typography><strong>Due Date:</strong> {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</Typography>
                            <Typography sx={{ mt: 2 }}><strong>Description:</strong> {task.description || '-'}</Typography>

                            <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                                <Button onClick={() => statusMutation.mutate('open')} disabled={statusMutation.isPending}>Mark Open</Button>
                                <Button onClick={() => statusMutation.mutate('done')} disabled={statusMutation.isPending}>Mark Done</Button>
                                <Button onClick={() => statusMutation.mutate('postponed')} disabled={statusMutation.isPending}>Postpone</Button>
                            </Stack>
                        </>
                    )}
                </Paper>
            </Box>
        </Container>
    );
}

export default TaskDetail;
