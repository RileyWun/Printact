// client/src/EditClient.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button, TextField, Grid, Box, Typography, Container, Paper } from '@mui/material';

const EditClient = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState(null);
    const [status, setStatus] = useState('');

    useEffect(() => {
        axios.get(`http://localhost:5001/api/internal/clients/${id}`)
            .then(res => {
                setFormData({ ...res.data, password: '' }); // Initialize password as empty
            })
            .catch(err => setStatus("Could not load client data."));
    }, [id]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus('Updating client...');

        // Create a payload object, don't include empty password
        const payload = { ...formData };
        if (!payload.password) {
            delete payload.password;
        }

        axios.put(`http://localhost:5001/api/internal/clients/${id}`, payload)
            .then(response => {
                setStatus(`Client "${response.data.client_name}" updated successfully!`);
                setTimeout(() => navigate('/internal/manage-clients'), 1500);
            })
            .catch(err => {
                setStatus(err.response?.data?.message || 'An unexpected error occurred.');
            });
    };

    if (!formData) return <Typography>Loading client...</Typography>;

    return (
        <Container component="main" maxWidth="md">
            <Paper sx={{ mt: 4, p: 3 }}>
                <Typography component="h1" variant="h4" gutterBottom>
                    Edit Client: {formData.client_name}
                </Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField name="client_name" label="Client Name" value={formData.client_name} onChange={handleChange} fullWidth required />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField name="email" label="Email Address" type="email" value={formData.email} onChange={handleChange} fullWidth required />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField name="password" label="New Password (optional)" type="password" value={formData.password} onChange={handleChange} fullWidth 
                                helperText="Leave blank to keep the current password."
                            />
                        </Grid>
                    </Grid>
                    <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                        <Button type="submit" variant="contained">Save Changes</Button>
                        <Button component={Link} to="/internal/manage-clients" variant="outlined">Cancel</Button>
                    </Box>
                    {status && <Typography sx={{ mt: 2 }}>{status}</Typography>}
                </Box>
            </Paper>
        </Container>
    );
};

export default EditClient;
