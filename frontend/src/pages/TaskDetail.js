import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import { tasksAPI } from '../services/api';

const statusLabels = {
    open: 'פתוחה',
    done: 'הושלמה',
    postponed: 'נדחתה'
};

const priorityLabels = {
    low: 'נמוכה',
    medium: 'בינונית',
    high: 'גבוהה',
    urgent: 'דחופה'
};

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
                    <Button component={Link} to="/tasks" variant="outlined">חזרה</Button>
                    <Button component={Link} to="/customers" variant="outlined">לקוחות</Button>
                </Stack>
                <Paper sx={{ p: 3 }}>
                    {isLoading ? (
                        <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>
                    ) : isError ? (
                        <Alert severity="error">{error?.response?.data?.error || 'טעינת המשימה נכשלה'}</Alert>
                    ) : !task ? (
                        <Alert severity="warning">משימה לא נמצאה</Alert>
                    ) : (
                        <>
                            <Typography variant="h4" gutterBottom>{task.title}</Typography>
                            <Typography><strong>סטטוס:</strong> {statusLabels[task.status] || task.status}</Typography>
                            <Typography><strong>עדיפות:</strong> {priorityLabels[task.priority] || task.priority}</Typography>
                            <Typography><strong>לקוח:</strong> {task.customer_name || task.customer_id || '-'}</Typography>
                            <Typography><strong>קבוצה:</strong> {task.group_name || task.group_id || '-'}</Typography>
                            <Typography><strong>תאריך יעד:</strong> {task.due_date ? new Date(task.due_date).toLocaleDateString('he-IL') : '-'}</Typography>
                            <Typography sx={{ mt: 2 }}><strong>תיאור:</strong> {task.description || '-'}</Typography>

                            <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                                <Button onClick={() => statusMutation.mutate('open')} disabled={statusMutation.isPending}>סמן כפתוחה</Button>
                                <Button onClick={() => statusMutation.mutate('done')} disabled={statusMutation.isPending}>סמן כהושלמה</Button>
                                <Button onClick={() => statusMutation.mutate('postponed')} disabled={statusMutation.isPending}>דחה</Button>
                            </Stack>
                        </>
                    )}
                </Paper>
            </Box>
        </Container>
    );
}

export default TaskDetail;
