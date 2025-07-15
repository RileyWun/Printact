import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Link as MuiLink } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Link } from 'react-router-dom';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const ManageClients = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [clientName, setClientName] = useState('');
    const [generatedLink, setGeneratedLink] = useState('');
    const [status, setStatus] = useState('');

    const fetchClients = () => {
        setLoading(true);
        axios.get('http://localhost:5001/api/filters/clients')
            .then(res => {
                // The DataGrid component requires each row to have a unique 'id' property.
                // The API aliases the 'name' column as 'client_name' for consistency.
                setClients(res.data.map(client => ({ ...client, id: client.id })));
                setLoading(false);
            })
            .catch(err => {
                console.error("Could not fetch clients", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this client? This will also delete all of their associated projects and stores.')) {
            axios.delete(`http://localhost:5001/api/internal/clients/${id}`)
                .then(res => {
                    fetchClients(); // Refresh the list
                })
                .catch(err => {
                    console.error('Error deleting client', err);
                    alert('Could not delete client.');
                });
        }
    };

    const handleOpen = () => setOpen(true);
    const handleClose = () => {
        setOpen(false);
        setClientName('');
        setGeneratedLink('');
        setStatus('');
    };

    const handleInviteSubmit = (e) => {
        e.preventDefault();
        setStatus('Generating link...');
        axios.post('http://localhost:5001/api/internal/invites', { client_name: clientName })
            .then(res => {
                const link = `${window.location.origin}/register/${res.data.token}`;
                setGeneratedLink(link);
                setStatus('Link generated successfully! Send this to the client.');
                fetchClients(); // Refresh the client list in the background
            })
            .catch(err => {
                setStatus(err.response?.data?.message || 'Failed to generate link.');
            });
    };

    const columns = [
        { field: 'client_name', headerName: 'Client Name', flex: 1 },
        { field: 'email', headerName: 'Primary Contact Email', flex: 1, renderCell: (params) => (params.row.email || 'No users yet') },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 300,
            sortable: false,
            renderCell: (params) => (
                <Box>
                    <Button component={Link} to={`/internal/manage-clients/${params.row.id}/stores`} size="small" sx={{ mr: 1 }}>
                        Manage Stores
                    </Button>
                    <Button component={Link} to={`/internal/edit-client/${params.row.id}`} size="small" sx={{ mr: 1 }}>
                        Edit
                    </Button>
                    <Button size="small" color="error" onClick={() => handleDelete(params.row.id)}>
                        Delete
                    </Button>
                </Box>
            )
        }
    ];

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography component="h2" variant="h5">
                    Client Management
                </Typography>
                <Button variant="contained" onClick={handleOpen}>
                    Invite New Client
                </Button>
            </Box>
            <Box sx={{ height: 500, width: '100%' }}>
                <DataGrid
                    rows={clients}
                    columns={columns}
                    loading={loading}
                    density="compact"
                />
            </Box>

            {/* "Invite Client" Dialog */}
            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
                <DialogTitle>Invite a New Client</DialogTitle>
                <DialogContent>
                    {!generatedLink ? (
                        <Box component="form" onSubmit={handleInviteSubmit} sx={{ mt: 1 }}>
                            <TextField
                                margin="normal" required fullWidth autoFocus
                                label="Client Business Name"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                            />
                        </Box>
                    ) : (
                        <Box sx={{ mt: 2 }}>
                            <Typography>Share this unique registration link with the new user:</Typography>
                            <MuiLink href={generatedLink} target="_blank" sx={{ display: 'block', my: 2, wordBreak: 'break-all' }}>
                                {generatedLink}
                            </MuiLink>
                            <Button
                                variant="outlined"
                                startIcon={<ContentCopyIcon />}
                                onClick={() => navigator.clipboard.writeText(generatedLink)}
                            >
                                Copy Link
                            </Button>
                        </Box>
                    )}
                    {status && <Typography sx={{ mt: 2 }}>{status}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Close</Button>
                    {!generatedLink && <Button onClick={handleInviteSubmit} variant="contained">Generate Link</Button>}
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default ManageClients;