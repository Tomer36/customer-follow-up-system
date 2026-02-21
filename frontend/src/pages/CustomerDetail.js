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

const formatNumber = (value) => Number(value || 0).toFixed(2);

function CustomerDetail() {
    const queryClient = useQueryClient();
    const { id } = useParams();

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
            queryClient.invalidateQueries({ queryKey: ['customer', id] });
            queryClient.invalidateQueries({ queryKey: ['customer-notes', id] });
            queryClient.invalidateQueries({ queryKey: ['customer-groups', id] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
    });

    const customer = data?.customer;
    const report = customer?.report175 || {};
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
        <Container maxWidth="lg">
            <Box sx={{ mt: 4 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button component={Link} to="/customers" variant="outlined">חזרה</Button>
                    <Button component={Link} to="/dashboard" variant="outlined">לוח בקרה</Button>
                </Stack>

                <Paper sx={{ p: 3 }}>
                    {isLoading ? (
                        <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>
                    ) : isError ? (
                        <Alert severity="error">{error?.response?.data?.error || 'טעינת הלקוח נכשלה'}</Alert>
                    ) : !customer ? (
                        <Alert severity="warning">לקוח לא נמצא</Alert>
                    ) : (
                        <>
                            <Typography variant="h5" gutterBottom>פרטי לקוח</Typography>
                            <Table size="small" sx={{ mb: 3 }}>
                                <TableBody>
                                    <TableRow>
                                        <TableCell sx={{ width: 260, fontWeight: 700 }}>מפתח חשבון</TableCell>
                                        <TableCell>{report.account_key || customer.company || '-'}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>שם חשבון</TableCell>
                                        <TableCell>{report.account_name || customer.name || '-'}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>יתרת תעודות משלוח פתוחות</TableCell>
                                        <TableCell>{formatNumber(report.open_delivery_notes_balance)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>יתרת חשבון</TableCell>
                                        <TableCell>{formatNumber(report.account_balance)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>סה"כ אובליגו</TableCell>
                                        <TableCell>{formatNumber(report.total_obligo)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>בטיפול (איזה מנהל)</TableCell>
                                        <TableCell>{customer.managed_by_name || '-'}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>קבוצה</TableCell>
                                        <TableCell>{customer.group_name || customerGroups[0]?.name || '-'}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>

                            <Box sx={{ mt: 3 }}>
                                <Typography variant="subtitle2">קבוצות נוכחיות</Typography>
                                {customerGroupsLoading ? (
                                    <CircularProgress size={18} />
                                ) : customerGroups.length === 0 ? (
                                    <Typography variant="body2">לא שויכו קבוצות</Typography>
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
                                <Typography variant="h6" gutterBottom>הוספת הערה</Typography>
                                <Box component="form" onSubmit={handleAddNote}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                                        <TextField
                                            select
                                            fullWidth
                                            size="small"
                                            label="מנהל אחראי"
                                            value={managedBy}
                                            onChange={(event) => setManagedBy(event.target.value)}
                                            helperText="אפשר להשאיר ריק כדי לשמור מנהל קיים"
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
                                            label="קבוצה (אופציונלי)"
                                            value={groupId}
                                            onChange={(event) => setGroupId(event.target.value)}
                                        >
                                            <MenuItem value="">ללא קבוצה</MenuItem>
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
                                            label="תאריך יעד"
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
                                        label="פרטי ההערה"
                                        value={noteText}
                                        onChange={(event) => setNoteText(event.target.value)}
                                    />
                                    <Button type="submit" variant="contained" sx={{ mt: 1 }} disabled={addNoteMutation.isPending}>
                                        שמור הערה
                                    </Button>
                                </Box>
                                {addNoteMutation.isError && (
                                    <Alert severity="error" sx={{ mt: 1 }}>
                                        {addNoteMutation.error?.response?.data?.error || 'הוספת ההערה נכשלה'}
                                    </Alert>
                                )}
                            </Box>

                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" gutterBottom>היסטוריית הערות</Typography>
                                {notesLoading ? (
                                    <CircularProgress size={18} />
                                ) : notes.length === 0 ? (
                                    <Typography variant="body2">אין הערות עדיין</Typography>
                                ) : (
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>תאריך יצירה</TableCell>
                                                <TableCell>תאריך יעד</TableCell>
                                                <TableCell>מנהל</TableCell>
                                                <TableCell>קבוצה</TableCell>
                                                <TableCell>נוצר על ידי</TableCell>
                                                <TableCell>פרטים</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {notes.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{new Date(item.created_at).toLocaleDateString('he-IL')}</TableCell>
                                                    <TableCell>{item.due_date ? new Date(item.due_date).toLocaleDateString('he-IL') : '-'}</TableCell>
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
