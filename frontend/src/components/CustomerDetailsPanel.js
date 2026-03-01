import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
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
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('he-IL') : '-');
const basicFieldLabelMap = {
    'מפתח חשבון': 'מפתח חשבון',
    'שם חשבון': 'שם לקוח',
    'מספר כרטיס חשבון': 'מספר כרטיס',
    'שם איש קשר': 'איש קשר',
    'דוא"ל': 'דוא"ל',
    email: 'דוא"ל',
    'טלפון': 'טלפון',
    phone: 'טלפון',
    'טלפון נייד': 'נייד',
    mobile: 'נייד',
    Mobile: 'נייד',
    'כתובת': 'כתובת',
    'עיר': 'עיר',
    'מיקוד': 'מיקוד',
    'ח.פ': 'ח.פ / ת.ז',
    'ח.פ.': 'ח.פ / ת.ז',
    'ת.ז': 'ח.פ / ת.ז',
    'ת.ז.': 'ח.פ / ת.ז',
    'יתרת חשבון': 'יתרת חשבון',
    'יתרת תעודות משלוח פתוחות': 'יתרת תעודות משלוח פתוחות',
    'סה"כ אובליגו': 'סה"כ אובליגו',
    'סך אובליגו': 'סה"כ אובליגו',
    'חובה שקל': 'חובה',
    'זכות שקל': 'זכות',
    'יתרה (שקל)': 'יתרה',
    'ת.אסמכ': 'תאריך אסמכתא',
    'ת.ערך': 'תאריך ערך',
    'תאריך 3': 'תאריך נוסף',
    "אסמ'": 'אסמכתא 1',
    "אסמ'2": 'אסמכתא 2',
    'פרטים': 'פרטים',
    'ח-ן נגדי': 'חשבון נגדי',
    'שם חשבון נגדי': 'שם חשבון נגדי',
    'מזהה מלאי': 'מזהה מלאי',
    'תנועה': 'תנועה',
    'מנה': 'מנה',
    'כותרת': 'כותרת',
    'ס"ת': 'סוג תנועה'
};

const getFriendlyBasicFieldLabel = (rawKey) => basicFieldLabelMap[rawKey] || rawKey;
const mergeBasicRows = (row184, row185) => {
    const merged = {};
    if (row184 && typeof row184 === 'object') Object.assign(merged, row184);
    if (row185 && typeof row185 === 'object') {
        for (const [key, value] of Object.entries(row185)) {
            if (merged[key] === undefined || merged[key] === null || merged[key] === '') {
                merged[key] = value;
            }
        }
    }
    return merged;
};

function CustomerDetailsPanel({ customerId }) {
    const queryClient = useQueryClient();

    const [noteText, setNoteText] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [managedBy, setManagedBy] = useState('');
    const [groupId, setGroupId] = useState('');
    const [isViewNotesOpen, setIsViewNotesOpen] = useState(false);
    const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
    const [isReport180Open, setIsReport180Open] = useState(false);
    const [isBasicReportsOpen, setIsBasicReportsOpen] = useState(false);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['customer', customerId],
        queryFn: () => customersAPI.getById(customerId),
        enabled: Boolean(customerId)
    });

    const { data: notesData, isLoading: notesLoading } = useQuery({
        queryKey: ['customer-notes', customerId],
        queryFn: () => customersAPI.getNotes(customerId),
        enabled: Boolean(customerId)
    });

    const { data: customerGroupsData } = useQuery({
        queryKey: ['customer-groups', customerId],
        queryFn: () => customersAPI.getGroups(customerId),
        enabled: Boolean(customerId)
    });

    const { data: allGroupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => groupsAPI.getAll()
    });

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersAPI.getAll()
    });

    const {
        data: report180Data,
        isLoading: report180Loading,
        isError: report180IsError,
        error: report180Error
    } = useQuery({
        queryKey: ['customer-report-180', customerId],
        queryFn: () => customersAPI.getReport180(customerId),
        enabled: Boolean(customerId && isReport180Open)
    });
    const {
        data: basicReportsData,
        isLoading: basicReportsLoading,
        isError: basicReportsIsError,
        error: basicReportsError
    } = useQuery({
        queryKey: ['customer-basic-reports', customerId],
        queryFn: () => customersAPI.getBasicReports(customerId),
        enabled: Boolean(customerId && isBasicReportsOpen)
    });

    const addNoteMutation = useMutation({
        mutationFn: (payload) => customersAPI.addNote(customerId, payload),
        onSuccess: () => {
            setNoteText('');
            setDueDate('');
            setManagedBy('');
            setGroupId('');
            setIsAddNoteOpen(false);
            queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customer-groups', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
    });

    const customer = data?.customer;
    const report = customer?.report175 || {};
    const notes = notesData?.notes || [];
    const customerGroups = customerGroupsData?.groups || [];
    const allGroups = allGroupsData?.groups || [];
    const users = usersData?.users || [];
    const report180Rows = report180Data?.rows || [];
    const report184Row = basicReportsData?.report184?.row || null;
    const report185Row = basicReportsData?.report185?.row || null;
    const mergedBasicRow = mergeBasicRows(report184Row, report185Row);

    const handleAddNote = (event) => {
        event.preventDefault();
        if (!noteText.trim() || !dueDate) return;
        const payload = {
            note: noteText.trim(),
            due_date: dueDate
        };

        if (managedBy) payload.managed_by = Number(managedBy);
        if (groupId) payload.group_id = Number(groupId);

        addNoteMutation.mutate(payload);
    };

    if (!customerId) {
        return <Alert severity="info">בחר לקוח כדי לצפות בפרטים.</Alert>;
    }

    if (isLoading) {
        return (
            <Box sx={{ textAlign: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (isError) {
        return <Alert severity="error">{error?.response?.data?.error || 'טעינת פרטי הלקוח נכשלה'}</Alert>;
    }

    if (!customer) {
        return <Alert severity="warning">לקוח לא נמצא</Alert>;
    }

    return (
        <Box dir="rtl">
            <Table size="small" sx={{ mb: 3 }}>
                <TableBody>
                    <TableRow>
                        <TableCell sx={{ width: 220, fontWeight: 700 }}>מפתח חשבון</TableCell>
                        <TableCell>
                            <Button size="small" variant="text" onClick={() => setIsBasicReportsOpen(true)} sx={{ p: 0, minWidth: 'auto' }}>
                                {report.account_key || customer.company || '-'}
                            </Button>
                        </TableCell>
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
                        <TableCell>
                            <Button size="small" variant="text" onClick={() => setIsReport180Open(true)} sx={{ p: 0, minWidth: 'auto' }}>
                                {formatNumber(report.account_balance)}
                            </Button>
                        </TableCell>
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
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">הערות</Typography>
                    <Button variant="contained" onClick={() => setIsViewNotesOpen(true)}>
                        צפייה בהערות
                    </Button>
                </Stack>
            </Box>

            <Dialog open={isViewNotesOpen} onClose={() => setIsViewNotesOpen(false)} fullWidth maxWidth="lg">
                <DialogTitle>הערות לקוח</DialogTitle>
                <DialogContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="subtitle1">היסטוריית הערות</Typography>
                        <Button variant="contained" onClick={() => setIsAddNoteOpen(true)}>
                            הוסף הערה
                        </Button>
                    </Stack>

                    {notesLoading ? (
                        <CircularProgress size={18} />
                    ) : notes.length === 0 ? (
                        <Typography variant="body2">אין הערות עדיין.</Typography>
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
                                        <TableCell>{formatDate(item.created_at)}</TableCell>
                                        <TableCell>{formatDate(item.due_date)}</TableCell>
                                        <TableCell>{item.manager_name || '-'}</TableCell>
                                        <TableCell>{item.group_name || '-'}</TableCell>
                                        <TableCell>{item.created_by_name || '-'}</TableCell>
                                        <TableCell>{item.note}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsViewNotesOpen(false)} variant="outlined">סגור</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={isAddNoteOpen} onClose={() => setIsAddNoteOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>הוספת הערה ללקוח</DialogTitle>
                <Box component="form" onSubmit={handleAddNote}>
                    <DialogContent>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="מנהל אחראי"
                                value={managedBy}
                                onChange={(event) => setManagedBy(event.target.value)}
                                helperText="אופציונלי. השאר ריק כדי לשמור מנהל קיים."
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
                            required
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setIsAddNoteOpen(false)} variant="outlined">ביטול</Button>
                        <Button type="submit" variant="contained" disabled={addNoteMutation.isPending}>
                            שמור הערה
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog open={isReport180Open} onClose={() => setIsReport180Open(false)} fullWidth maxWidth="lg">
                <DialogTitle sx={{ textAlign: 'right' }}>כרטסת</DialogTitle>
                <DialogContent>
                    <Box dir="rtl">
                    {report180Loading ? (
                        <CircularProgress size={18} />
                    ) : report180IsError ? (
                        <Alert severity="error" sx={{ mb: 1 }}>
                            {report180Error?.response?.data?.error || 'טעינת דוח 180 נכשלה'}
                        </Alert>
                    ) : report180Rows.length === 0 ? (
                        <Typography variant="body2">אין נתונים להצגה.</Typography>
                    ) : (
                        <Table size="small" dir="rtl" sx={{ direction: 'rtl' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>תנועה</TableCell>
                                    <TableCell>מנה</TableCell>
                                    <TableCell>תאריך אסמכ</TableCell>
                                    <TableCell>תאריך ערך</TableCell>
                                    <TableCell>פרטים</TableCell>
                                    <TableCell align="right">חובה</TableCell>
                                    <TableCell align="right">זכות</TableCell>
                                    <TableCell align="right">יתרה (שקל)</TableCell>
                                    <TableCell>חשבון נגדי</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {report180Rows.map((row, index) => (
                                    <TableRow key={`${row.movement || 'mv'}-${index}`}>
                                        <TableCell>{row.movement ?? '-'}</TableCell>
                                        <TableCell>{row.batch ?? '-'}</TableCell>
                                        <TableCell>{row.asmach_date || '-'}</TableCell>
                                        <TableCell>{row.value_date || '-'}</TableCell>
                                        <TableCell>{String(row.details || '').trim() || '-'}</TableCell>
                                        <TableCell align="right">{row.debit_ils ?? '-'}</TableCell>
                                        <TableCell align="right">{row.credit_ils ?? '-'}</TableCell>
                                        <TableCell align="right">{row.balance_ils ?? '-'}</TableCell>
                                        <TableCell>{row.counter_account_name || row.counter_account || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsReport180Open(false)} variant="outlined">סגור</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={isBasicReportsOpen} onClose={() => setIsBasicReportsOpen(false)} fullWidth maxWidth="lg">
                <DialogTitle sx={{ textAlign: 'right' }}>אינדקס לקוח</DialogTitle>
                <DialogContent>
                    <Box dir="rtl">
                        {basicReportsLoading ? (
                            <CircularProgress size={18} />
                        ) : basicReportsIsError ? (
                            <Alert severity="error" sx={{ mb: 1 }}>
                                {basicReportsError?.response?.data?.error || 'טעינת נתוני לקוח נכשלה'}
                            </Alert>
                        ) : Object.keys(mergedBasicRow).length === 0 ? (
                            <Typography variant="body2">אין נתונים להצגה.</Typography>
                        ) : (
                            <Table size="small">
                                <TableBody>
                                    {Object.entries(mergedBasicRow).map(([key, value]) => (
                                        <TableRow key={`basic-${key}`}>
                                            <TableCell sx={{ width: 260, fontWeight: 700 }}>{getFriendlyBasicFieldLabel(key)}</TableCell>
                                            <TableCell>{value === null || value === undefined || value === '' ? '-' : String(value)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsBasicReportsOpen(false)} variant="outlined">סגור</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default CustomerDetailsPanel;
