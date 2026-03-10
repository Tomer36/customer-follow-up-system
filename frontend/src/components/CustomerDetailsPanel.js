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
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import { customersAPI, groupsAPI, usersAPI } from '../services/api';

const formatNumber = (value) => Number(value || 0).toFixed(2);
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('he-IL') : '-');
const rtlFieldSx = {
    '& .MuiInputBase-input': {
        direction: 'rtl',
        textAlign: 'right'
    },
    '& .MuiSelect-select': {
        direction: 'rtl',
        textAlign: 'right'
    }
};

const rtlDialogPaperProps = {
    dir: 'rtl',
    sx: {
        direction: 'rtl'
    }
};

const rtlDialogContentSx = {
    direction: 'rtl',
    textAlign: 'right'
};

const rtlTableSx = {
    direction: 'rtl',
    '& .MuiTableCell-root': {
        textAlign: 'right'
    }
};

const dialogCardSx = {
    borderRadius: 4,
    overflow: 'hidden',
    border: '1px solid rgba(25, 118, 210, 0.08)',
    boxShadow: '0 22px 60px rgba(15, 23, 42, 0.12)'
};

const dialogHeaderSx = {
    px: 3,
    py: 2,
    borderBottom: '1px solid',
    borderColor: 'divider',
    background: 'linear-gradient(180deg, rgba(25, 118, 210, 0.08), rgba(25, 118, 210, 0.02))',
    textAlign: 'right',
    fontWeight: 800,
    color: '#102a43'
};

const dialogContentCardSx = {
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#fff'
};

const ledgerHeaderCellSx = {
    fontWeight: 800,
    fontSize: '1rem',
    fontFamily: '"Noto Sans Hebrew", "Segoe UI", sans-serif'
};

const ledgerBodyCellSx = {
    fontSize: '0.98rem',
    fontFamily: '"Noto Sans Hebrew", "Segoe UI", sans-serif'
};

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

function CustomerDetailsPanel({ customerId, onClose }) {
    const queryClient = useQueryClient();

    const [noteText, setNoteText] = useState('');
    const [noteDueDate, setNoteDueDate] = useState('');
    const [noteGroupId, setNoteGroupId] = useState('');
    const [transferText, setTransferText] = useState('');
    const [transferDueDate, setTransferDueDate] = useState('');
    const [transferManagedBy, setTransferManagedBy] = useState('');
    const [transferGroupId, setTransferGroupId] = useState('');
    const [isViewNotesOpen, setIsViewNotesOpen] = useState(false);
    const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
    const [isTransferOpen, setIsTransferOpen] = useState(false);
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
            setNoteDueDate('');
            setNoteGroupId('');
            setIsAddNoteOpen(false);
            queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customer-groups', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
    });

    const addTransferMutation = useMutation({
        mutationFn: (payload) => customersAPI.addTransfer(customerId, payload),
        onSuccess: () => {
            setTransferText('');
            setTransferDueDate('');
            setTransferManagedBy('');
            setTransferGroupId('');
            setIsTransferOpen(false);
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
        if (!noteText.trim() || !noteDueDate) return;

        addNoteMutation.mutate({
            note: noteText.trim(),
            due_date: noteDueDate,
            ...(noteGroupId ? { group_id: Number(noteGroupId) } : {})
        });
    };

    const handleTransfer = (event) => {
        event.preventDefault();
        if (!transferManagedBy || !transferGroupId || !transferDueDate) return;

        addTransferMutation.mutate({
            note: transferText.trim(),
            due_date: transferDueDate,
            managed_by: Number(transferManagedBy),
            group_id: Number(transferGroupId)
        });
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
                        <TableCell sx={{ fontWeight: 700 }}>בטיפול</TableCell>
                        <TableCell>{customer.managed_by_name || '-'}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>קבוצה</TableCell>
                        <TableCell>{customer.group_name || customerGroups[0]?.name || '-'}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Box
                sx={{
                    mt: 3,
                    pt: 1.5,
                    borderTop: '1px solid',
                    borderColor: 'divider'
                }}
            >
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 1.25 }}>
                    <Typography variant="h6">פעולות</Typography>
                </Stack>

                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                    sx={{ direction: 'ltr' }}
                >
                    {onClose ? (
                        <Button
                            startIcon={<CloseOutlinedIcon />}
                            variant="text"
                            color="inherit"
                            onClick={onClose}
                            sx={{
                                minHeight: 34,
                                px: 1,
                                borderRadius: 999,
                                minWidth: 0,
                                color: 'text.secondary',
                                gap: 0,
                                direction: 'rtl',
                                '& .MuiButton-startIcon': {
                                    marginInlineStart: 0,
                                    marginInlineEnd: 0
                                }
                            }}
                        >
                            סגור
                        </Button>
                    ) : <Box />}

                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        sx={{
                            p: 0.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 999,
                            backgroundColor: '#fbfcfe',
                            width: 'fit-content',
                            maxWidth: '100%',
                            alignItems: 'stretch'
                        }}
                    >
                        <Button
                            startIcon={<SwapHorizOutlinedIcon />}
                            variant="outlined"
                            color="secondary"
                            onClick={() => setIsTransferOpen(true)}
                            sx={{
                                minHeight: 36,
                                px: 1.25,
                                borderRadius: 999,
                                justifyContent: 'center',
                                fontWeight: 700,
                                minWidth: 148,
                                gap: 0,
                                direction: 'rtl',
                                '& .MuiButton-startIcon': {
                                    marginInlineStart: 0,
                                    marginInlineEnd: 0
                                }
                            }}
                        >
                            העבר לטיפול
                        </Button>

                        <Button
                            startIcon={<HistoryOutlinedIcon />}
                            variant="outlined"
                            onClick={() => setIsViewNotesOpen(true)}
                            sx={{
                                minHeight: 36,
                                px: 1.25,
                                borderRadius: 999,
                                justifyContent: 'center',
                                fontWeight: 700,
                                minWidth: 148,
                                gap: 0,
                                direction: 'rtl',
                                '& .MuiButton-startIcon': {
                                    marginInlineStart: 0,
                                    marginInlineEnd: 0
                                }
                            }}
                        >
                            צפייה בהערות
                        </Button>

                        <Button
                            startIcon={<EditNoteOutlinedIcon />}
                            variant="contained"
                            onClick={() => setIsAddNoteOpen(true)}
                            sx={{
                                minHeight: 36,
                                px: 1.25,
                                borderRadius: 999,
                                justifyContent: 'center',
                                fontWeight: 700,
                                boxShadow: 'none',
                                minWidth: 148,
                                gap: 0,
                                direction: 'rtl',
                                '& .MuiButton-startIcon': {
                                    marginInlineStart: 0,
                                    marginInlineEnd: 0
                                }
                            }}
                        >
                            הוסף הערה
                        </Button>
                    </Stack>
                </Stack>
            </Box>

            <Dialog open={isViewNotesOpen} onClose={() => setIsViewNotesOpen(false)} fullWidth maxWidth="lg" PaperProps={rtlDialogPaperProps}>
                <DialogTitle>הערות לקוח</DialogTitle>
                <DialogContent sx={rtlDialogContentSx}>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>היסטוריית הערות</Typography>

                    {notesLoading ? (
                        <CircularProgress size={18} />
                    ) : notes.length === 0 ? (
                        <Typography variant="body2">אין הערות עדיין.</Typography>
                    ) : (
                        <Table size="small" sx={rtlTableSx}>
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
                <DialogActions sx={{ direction: 'rtl', justifyContent: 'flex-start' }}>
                    <Button onClick={() => setIsViewNotesOpen(false)} variant="outlined">סגור</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={isAddNoteOpen} onClose={() => setIsAddNoteOpen(false)} fullWidth maxWidth="md" PaperProps={rtlDialogPaperProps}>
                <DialogTitle>הוספת הערה ללקוח</DialogTitle>
                <Box component="form" onSubmit={handleAddNote}>
                    <DialogContent sx={rtlDialogContentSx}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="קבוצה"
                                value={noteGroupId}
                                onChange={(event) => setNoteGroupId(event.target.value)}
                                sx={rtlFieldSx}
                                SelectProps={{ sx: { textAlign: 'right' } }}
                            >
                                <MenuItem value="">ללא קבוצה</MenuItem>
                                {allGroups.map((group) => (
                                    <MenuItem key={group.id} value={group.id}>
                                        {group.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                type="date"
                                fullWidth
                                size="small"
                                label="תאריך יעד"
                                value={noteDueDate}
                                onChange={(event) => setNoteDueDate(event.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ dir: 'rtl' }}
                                sx={rtlFieldSx}
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
                            inputProps={{ dir: 'rtl' }}
                            sx={rtlFieldSx}
                            required
                        />
                    </DialogContent>
                    <DialogActions sx={{ direction: 'rtl', justifyContent: 'flex-start' }}>
                        <Button onClick={() => setIsAddNoteOpen(false)} variant="outlined">ביטול</Button>
                        <Button type="submit" variant="contained" disabled={addNoteMutation.isPending}>
                            שמור הערה
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog open={isTransferOpen} onClose={() => setIsTransferOpen(false)} fullWidth maxWidth="md" PaperProps={rtlDialogPaperProps}>
                <DialogTitle>העברת לקוח למנהל אחר</DialogTitle>
                <Box component="form" onSubmit={handleTransfer}>
                    <DialogContent sx={rtlDialogContentSx}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="מנהל חדש"
                                value={transferManagedBy}
                                onChange={(event) => setTransferManagedBy(event.target.value)}
                                sx={rtlFieldSx}
                                SelectProps={{ sx: { textAlign: 'right' } }}
                                required
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
                                label="קבוצה"
                                value={transferGroupId}
                                onChange={(event) => setTransferGroupId(event.target.value)}
                                sx={rtlFieldSx}
                                SelectProps={{ sx: { textAlign: 'right' } }}
                                required
                            >
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
                                value={transferDueDate}
                                onChange={(event) => setTransferDueDate(event.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ dir: 'rtl' }}
                                sx={rtlFieldSx}
                                required
                            />
                        </Stack>
                        <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            label="הערה (אופציונלי)"
                            value={transferText}
                            onChange={(event) => setTransferText(event.target.value)}
                            inputProps={{ dir: 'rtl' }}
                            sx={rtlFieldSx}
                        />
                    </DialogContent>
                    <DialogActions sx={{ direction: 'rtl', justifyContent: 'flex-start' }}>
                        <Button onClick={() => setIsTransferOpen(false)} variant="outlined">ביטול</Button>
                        <Button type="submit" variant="contained" disabled={addTransferMutation.isPending}>
                            העבר לטיפול
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog
                open={isReport180Open}
                onClose={() => setIsReport180Open(false)}
                fullWidth
                maxWidth="lg"
                PaperProps={{ ...rtlDialogPaperProps, sx: { ...rtlDialogPaperProps.sx, ...dialogCardSx } }}
            >
                <DialogTitle sx={dialogHeaderSx}>כרטסת</DialogTitle>
                <DialogContent sx={rtlDialogContentSx}>
                    <Box dir="rtl" sx={{ pt: 2 }}>
                        {report180Loading ? (
                            <CircularProgress size={18} />
                        ) : report180IsError ? (
                            <Alert severity="error" sx={{ mb: 1 }}>
                                {report180Error?.response?.data?.error || 'טעינת דוח 180 נכשלה'}
                            </Alert>
                        ) : report180Rows.length === 0 ? (
                            <Typography variant="body2">אין נתונים להצגה.</Typography>
                        ) : (
                            <Box sx={dialogContentCardSx}>
                                <Table size="small" dir="rtl" sx={rtlTableSx}>
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: 'rgba(15, 23, 42, 0.03)' }}>
                                            <TableCell sx={ledgerHeaderCellSx}>תנועה</TableCell>
                                            <TableCell sx={ledgerHeaderCellSx}>מנה</TableCell>
                                            <TableCell sx={ledgerHeaderCellSx}>תאריך אסמכ</TableCell>
                                            <TableCell sx={ledgerHeaderCellSx}>תאריך ערך</TableCell>
                                            <TableCell sx={ledgerHeaderCellSx}>פרטים</TableCell>
                                            <TableCell align="right" sx={ledgerHeaderCellSx}>חובה</TableCell>
                                            <TableCell align="right" sx={ledgerHeaderCellSx}>זכות</TableCell>
                                            <TableCell align="right" sx={ledgerHeaderCellSx}>יתרה (שקל)</TableCell>
                                            <TableCell sx={ledgerHeaderCellSx}>חשבון נגדי</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {report180Rows.map((row, index) => (
                                            <TableRow
                                                key={`${row.movement || 'mv'}-${index}`}
                                                hover
                                                sx={{ '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.035)' } }}
                                            >
                                                <TableCell sx={ledgerBodyCellSx}>{row.movement ?? '-'}</TableCell>
                                                <TableCell sx={ledgerBodyCellSx}>{row.batch ?? '-'}</TableCell>
                                                <TableCell sx={ledgerBodyCellSx}>{row.asmach_date || '-'}</TableCell>
                                                <TableCell sx={ledgerBodyCellSx}>{row.value_date || '-'}</TableCell>
                                                <TableCell sx={ledgerBodyCellSx}>{String(row.details || '').trim() || '-'}</TableCell>
                                                <TableCell align="right" sx={ledgerBodyCellSx}>{row.debit_ils ?? '-'}</TableCell>
                                                <TableCell align="right" sx={ledgerBodyCellSx}>{row.credit_ils ?? '-'}</TableCell>
                                                <TableCell align="right" sx={ledgerBodyCellSx}>{row.balance_ils ?? '-'}</TableCell>
                                                <TableCell sx={ledgerBodyCellSx}>{row.counter_account_name || row.counter_account || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ direction: 'rtl', justifyContent: 'flex-start' }}>
                    <Button onClick={() => setIsReport180Open(false)} variant="outlined">סגור</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={isBasicReportsOpen}
                onClose={() => setIsBasicReportsOpen(false)}
                fullWidth
                maxWidth="lg"
                PaperProps={{ ...rtlDialogPaperProps, sx: { ...rtlDialogPaperProps.sx, ...dialogCardSx } }}
            >
                <DialogTitle sx={dialogHeaderSx}>אינדקס לקוח</DialogTitle>
                <DialogContent sx={rtlDialogContentSx}>
                    <Box dir="rtl" sx={{ pt: 2 }}>
                        {basicReportsLoading ? (
                            <CircularProgress size={18} />
                        ) : basicReportsIsError ? (
                            <Alert severity="error" sx={{ mb: 1 }}>
                                {basicReportsError?.response?.data?.error || 'טעינת נתוני לקוח נכשלה'}
                            </Alert>
                        ) : Object.keys(mergedBasicRow).length === 0 ? (
                            <Typography variant="body2">אין נתונים להצגה.</Typography>
                        ) : (
                            <Box sx={dialogContentCardSx}>
                                <Table size="small" sx={rtlTableSx}>
                                    <TableBody>
                                        {Object.entries(mergedBasicRow).map(([key, value], index) => (
                                            <TableRow
                                                key={`basic-${key}`}
                                                sx={{
                                                    backgroundColor: index % 2 === 0 ? 'rgba(15, 23, 42, 0.015)' : 'transparent'
                                                }}
                                            >
                                                <TableCell sx={{ width: 260, fontWeight: 800, color: '#102a43' }}>
                                                    {getFriendlyBasicFieldLabel(key)}
                                                </TableCell>
                                                <TableCell>{value === null || value === undefined || value === '' ? '-' : String(value)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ direction: 'rtl', justifyContent: 'flex-start' }}>
                    <Button onClick={() => setIsBasicReportsOpen(false)} variant="outlined">סגור</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default CustomerDetailsPanel;
