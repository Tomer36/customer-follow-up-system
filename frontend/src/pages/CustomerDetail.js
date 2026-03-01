import { Link, useParams } from 'react-router-dom';
import { Box, Button, Container, Paper, Stack } from '@mui/material';
import CustomerDetailsPanel from '../components/CustomerDetailsPanel';

function CustomerDetail() {
    const { id } = useParams();

    return (
        <Container maxWidth="lg">
            <Box sx={{ mt: 4 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button component={Link} to="/customers" variant="outlined">חזרה</Button>
                    <Button component={Link} to="/dashboard" variant="outlined">לוח בקרה</Button>
                </Stack>

                <Paper sx={{ p: 3 }}>
                    <CustomerDetailsPanel customerId={id} />
                </Paper>
            </Box>
        </Container>
    );
}

export default CustomerDetail;
