import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
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
import { customersAPI, groupsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

function CustomerDetail() {
    const queryClient = useQueryClient();
    const { id } = useParams();
    const { user } = useAuth();

    const [noteText, setNoteText] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [managedBy, setManagedBy] = useState('');
    const [groupId, setGroupId] = useState('');

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['customer', id],
        queryFn: () => customersAPI.getById(id),
        enabled: Boolean(id)
    });

    const { data: notesData, isLoading: notesLoading } = useQuery({
        queryKey: ['customer-notes', id],
        queryFn: () => customersAPI.getNotes(id),
        enabled: Boolean(id)
    });

    const { data: customerGroupsData, isLoading: customerGroupsLoading } = useQuery({
        queryKey: ['customer-groups', id],
        queryFn: () => customersAPI.getGroups(id),
        enabled: Boolean(id)
    });

    const { data: allGroupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => groupsAPI.getAll()
    });

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersAPI.getAll()
    });

    const addNoteMutation = useMutation({
        mutationFn: (payload) => customersAPI.addNote(id, payload),
        onSuccess: () => {
            setNoteText('');
            setDueDate('');
            setManagedBy('');
            setGroupId('');
            queryClient.invalidateQueries({ queryKey: ['customer-notes', id] });
            queryClient.invalidateQueries({ queryKey: ['customer-groups', id] });
        }
    });

    const customer = data?.customer;
    const notes = notesData?.notes || [];
    const customerGroups = customerGroupsData?.groups || [];
    const allGroups = allGroupsData?.groups || [];
    const users = usersData?.users || [];

    const handleAddNote = (event) => {
        event.preventDefault();
        if (!noteText.trim() || !dueDate) return;
        const payload = {
            note: noteText.trim(),
            due_date: dueDate
        };

        if (managedBy) {
            payload.managed_by = Number(managedBy);
        }
        if (groupId) {
            payload.group_id = Number(groupId);
        }

        addNoteMutation.mutate(payload);
    };

    return (
        <Container maxWidth="md">
            <Box sx={{ mt: 4 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button component={Link} to="/customers" variant="outlined">Back</Button>
                    <Button component={Link} to="/dashboard" variant="outlined">Dashboard</Button>
                </Stack>
                <Paper sx={{ p: 3 }}>
                    {isLoading ? (
                        <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>
                    ) : isError ? (
                        <Alert severity="error">{error?.response?.data?.error || 'Failed to load customer.'}</Alert>
                    ) : !customer ? (
                        <Alert severity="warning">Customer not found.</Alert>
                    ) : (
                        <>
                            <Typography variant="h4" gutterBottom>{customer.name}</Typography>
                            <Typography><strong>Company:</strong> {customer.company || '-'}</Typography>
                            <Typography><strong>Email:</strong> {customer.email || '-'}</Typography>
                            <Typography><strong>Phone:</strong> {customer.phone || '-'}</Typography>

                            <Box sx={{ mt: 3 }}>
                                <Typography variant="subtitle2">Current Groups</Typography>
                                {customerGroupsLoading ? (
                                    <CircularProgress size={18} />
                                ) : customerGroups.length === 0 ? (
                                    <Typography variant="body2">No groups assigned.</Typography>
                                ) : (
                                    <Box>
                                        {customerGroups.map((group) => (
                                            <Typography key={group.id} variant="body2">
                                                {group.name} ({group.color})
                                            </Typography>
                                        ))}
                                    </Box>
                                )}
                            </Box>

                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" gutterBottom>Add Note</Typography>
                                <Box component="form" onSubmit={handleAddNote}>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Current Date: {new Date().toLocaleDateString()}
                                    </Typography>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                                        <TextField
                                            select
                                            fullWidth
                                            size="small"
                                            label="Manager"
                                            value={managedBy}
                                            onChange={(event) => setManagedBy(event.target.value)}
                                            helperText="Leave empty to keep current manager"
                                        >
                                            {users.map((u) => (
                                                <MenuItem key={u.id} value={u.id}>
                                                    {u.full_name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField
                                            select
                                            fullWidth
                                            size="small"
                                            label="Group (optional)"
                                            value={groupId}
                                            onChange={(event) => setGroupId(event.target.value)}
                                        >
                                            <MenuItem value="">No group</MenuItem>
                                            {allGroups.map((group) => (
                                                <MenuItem key={group.id} value={group.id}>
                                                    {group.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Stack>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                                        <TextField
                                            type="date"
                                            fullWidth
                                            size="small"
                                            label="Due Date"
                                            value={dueDate}
                                            onChange={(event) => setDueDate(event.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                            required
                                        />
                                    </Stack>
                                    <TextField
                                        fullWidth
                                        multiline
                                        minRows={3}
                                        label="Note details"
                                        value={noteText}
                                        onChange={(event) => setNoteText(event.target.value)}
                                    />
                                    <Button type="submit" variant="contained" sx={{ mt: 1 }} disabled={addNoteMutation.isPending}>
                                        Save Note
                                    </Button>
                                </Box>
                                {addNoteMutation.isError && (
                                    <Alert severity="error" sx={{ mt: 1 }}>
                                        {addNoteMutation.error?.response?.data?.error || 'Failed to add note.'}
                                    </Alert>
                                )}
                            </Box>

                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" gutterBottom>Notes History</Typography>
                                {notesLoading ? (
                                    <CircularProgress size={18} />
                                ) : notes.length === 0 ? (
                                    <Typography variant="body2">No notes yet.</Typography>
                                ) : (
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Current Date</TableCell>
                                                <TableCell>Due Date</TableCell>
                                                <TableCell>Manager</TableCell>
                                                <TableCell>Group</TableCell>
                                                <TableCell>Created By</TableCell>
                                                <TableCell>Details</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {notes.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell>{item.due_date ? new Date(item.due_date).toLocaleDateString() : '-'}</TableCell>
                                                    <TableCell>{item.manager_name || '-'}</TableCell>
                                                    <TableCell>{item.group_name || '-'}</TableCell>
                                                    <TableCell>{item.created_by_name || '-'}</TableCell>
                                                    <TableCell>{item.note}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </Box>
                        </>
                    )}
                </Paper>
            </Box>
        </Container>
    );
}

export default CustomerDetail;
