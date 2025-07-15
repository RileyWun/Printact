import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import Papa from 'papaparse';

const ManageStores = () => {
    const { clientId } = useParams();
    const [stores, setStores] = useState([]);
    const [clientName, setClientName] = useState('');
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    // Removed state_id from initial state
    const [currentStore, setCurrentStore] = useState({ name: '', address: '' });
    const [dialogStatus, setDialogStatus] = useState('');
    const [csvData, setCsvData] = useState([]);
    const [csvError, setCsvError] = useState('');
    const fileInputRef = useRef();

    const fetchPageData = useCallback(() => {
        setLoading(true);
        const clientPromise = axios.get(`http://localhost:5001/api/internal/clients/${clientId}`);
        const storesPromise = axios.get(`http://localhost:5001/api/internal/clients/${clientId}/stores`);

        Promise.all([clientPromise, storesPromise])
            .then(([clientRes, storesRes]) => {
                setClientName(clientRes.data.client_name);
                setStores(storesRes.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Could not fetch data", err);
                setLoading(false);
            });
    }, [clientId]);

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);

    const handleOpen = (store = null) => {
        setDialogStatus('');
        if (store && store.id) {
            setIsEditing(true);
            setCurrentStore({
                id: store.id,
                name: store.name || '',
                address: store.address || ''
            });
        } else {
            setIsEditing(false);
            setCurrentStore({ name: '', address: '' });
        }
        setOpen(true);
    };

    const handleClose = () => setOpen(false);
    const handleChange = (e) => {
        setCurrentStore({ ...currentStore, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setDialogStatus(isEditing ? 'Updating store...' : 'Adding store...');
        const payload = { ...currentStore, client_id: clientId };
        const request = isEditing
            ? axios.put(`http://localhost:5001/api/internal/stores/${currentStore.id}`, payload)
            : axios.post('http://localhost:5001/api/internal/stores', payload);
        request.then(() => {
            fetchPageData();
            handleClose();
        }).catch(err => {
            setDialogStatus(err.response?.data?.message || 'An error occurred.');
        });
    };
    
     const handleDelete = (storeId) => {
        if (window.confirm('Are you sure? This action cannot be undone.')) {
            axios.delete(`http://localhost:5001/api/internal/stores/${storeId}`)
                .then(() => fetchPageData())
                .catch(err => {
                    console.error("Failed to delete store", err);
                    alert(err.response?.data?.message || 'An error occurred.');
                });
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const requiredHeaders = ['name', 'state_abbreviation'];
                const headers = results.meta.fields;
                const hasRequiredHeaders = requiredHeaders.every(h => headers.includes(h));

                if (!hasRequiredHeaders) {
                    setCsvError(`CSV must have the following headers: ${requiredHeaders.join(', ')}`);
                    setCsvData([]);
                } else {
                    setCsvError('');
                    setCsvData(results.data);
                }
            },
            error: (error) => {
                setCsvError('Failed to parse CSV file.');
                setCsvData([]);
            }
        });
    };
    
    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleConfirmUpload = () => {
        axios.post('http://localhost:5001/api/internal/stores/bulk', { stores: csvData, client_id: clientId })
            .then(res => {
                alert(res.data.message);
                setCsvData([]);
                fetchPageData();
            })
            .catch(err => {
                console.error("Failed to upload stores", err);
                alert(err.response?.data?.message || 'An error occurred during upload.');
            });
    };

    const columns = [
        { field: 'name', headerName: 'Store Name', flex: 1 },
        { field: 'address', headerName: 'Address', flex: 2 },
        { field: 'state_name', headerName: 'State', width: 150 },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 180,
            sortable: false,
            renderCell: (params) => (
                <Box>
                    <Button size="small" sx={{ mr: 1 }} onClick={() => handleOpen(params.row)}>Edit</Button>
                    <Button size="small" color="error" onClick={() => handleDelete(params.row.id)}>Delete</Button>
                </Box>
            )
        }
    ];

   return (
        <Paper sx={{ p: 3, mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography component="h2" variant="h5">Manage Stores for: {clientName}</Typography>
                <Box>
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                    <Button variant="outlined" sx={{ mr: 2 }} onClick={handleUploadClick}>Upload CSV</Button>
                    <Button variant="contained" onClick={() => handleOpen()}>Add New Store</Button>
                </Box>
            </Box>

            {csvData.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>CSV Upload Preview</Typography>
                    <Typography>Found {csvData.length} records to upload. Please confirm.</Typography>
                    <Box mt={2}>
                        <Button variant="contained" color="success" onClick={handleConfirmUpload}>Confirm and Upload</Button>
                        <Button sx={{ ml: 1 }} onClick={() => setCsvData([])}>Cancel</Button>
                    </Box>
                </Paper>
            )}
           {csvError && <Alert severity="error" sx={{ mb: 2 }}>{csvError}</Alert>}
            <Box sx={{ height: 500, width: '100%' }}>
                <DataGrid rows={stores} columns={columns} loading={loading} />
            </Box>

            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>{isEditing ? 'Edit Store' : 'Add New Store'}</DialogTitle>
                <DialogContent>
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                        <TextField margin="normal" required fullWidth autoFocus name="name" label="Store Name" value={currentStore.name} onChange={handleChange} />
                        <TextField margin="normal" required fullWidth name="address" label="Full Street Address" helperText="e.g., 123 Example St, Sydney NSW 2000" value={currentStore.address} onChange={handleChange} />
                        {/* The State dropdown has been removed */}
                        {dialogStatus && <Typography color={dialogStatus.includes('success') ? 'primary' : 'error'} sx={{ mt: 2 }}>{dialogStatus}</Typography>}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained">Save</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default ManageStores;