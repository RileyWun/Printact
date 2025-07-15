// client/src/EditProject.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, TextField, Select, MenuItem, FormControl, InputLabel, Grid, Box, Typography, Container, Paper } from '@mui/material';

const EditProject = () => {
    const { id } = useParams(); // Get project ID from URL
    const navigate = useNavigate(); // To redirect after update
    const [formData, setFormData] = useState(null);
    const [status, setStatus] = useState('');
    const [stores, setStores] = useState([]);
    const [clients, setClients] = useState([]);

    useEffect(() => {
        // Fetch the specific project's data
        const fetchProject = axios.get(`http://localhost:5001/api/internal/projects/${id}`);
        const fetchStores = axios.get('http://localhost:5001/api/filters/stores');
        const fetchClients = axios.get('http://localhost:5001/api/filters/clients');

        Promise.all([fetchProject, fetchStores, fetchClients])
            .then(([projectRes, storesRes, clientsRes]) => {
                // Format date correctly for the date input field
                const projectData = projectRes.data;
                projectData.project_date = new Date(projectData.project_date).toISOString().slice(0, 10);
                setFormData(projectData);
                setStores(storesRes.data);
                setClients(clientsRes.data);
            })
            .catch(err => setStatus("Could not load project data."));
    }, [id]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus('Updating project...');
        axios.put(`http://localhost:5001/api/internal/projects/${id}`, formData)
            .then(response => {
                setStatus(`Project "${response.data.name}" updated successfully!`);
                // Redirect back to the manage page after a short delay
                setTimeout(() => navigate('/internal/manage-projects'), 1500);
            })
            .catch(err => {
                setStatus(err.response?.data?.error || 'An unexpected error occurred.');
            });
    };

    if (!formData) {
        return <Typography>Loading project...</Typography>;
    }

    return (
        <Container component="main" maxWidth="md">
            <Paper sx={{ mt: 4, p: 3 }}>
                <Typography component="h1" variant="h4" gutterBottom>
                    Edit Project: {formData.name}
                </Typography>
                {/* Reusing the same form structure as AddProjectForm */}
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                    <Grid container spacing={2}>
                       {/* Form fields are the same as AddProjectForm, just pre-filled */}
                       <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required>
                                <InputLabel>Client</InputLabel>
                                <Select name="client_id" label="Client" value={formData.client_id} onChange={handleChange}>
                                    {clients.map(client => (
                                        <MenuItem key={client.id} value={client.id}>{client.client_name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/* ... and so on for all other fields ... */}
                         <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required>
                                <InputLabel>Store</InputLabel>
                                <Select name="store_id" label="Store" value={formData.store_id} onChange={handleChange}>
                                    {stores.map(store => (
                                        <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField name="job_id" label="Job ID" value={formData.job_id} onChange={handleChange} fullWidth required />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField name="name" label="Project Name" value={formData.name} onChange={handleChange} fullWidth required />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField name="project_date" label="Project Date" type="date" value={formData.project_date} onChange={handleChange} fullWidth required InputLabelProps={{ shrink: true }} />
                        </Grid>
                         <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Material</InputLabel>
                                <Select name="material" label="Material" value={formData.material} onChange={handleChange}>
                                    <MenuItem value="Vinyl">Vinyl</MenuItem>
                                    <MenuItem value="Foam Board">Foam Board</MenuItem>
                                    <MenuItem value="Canvas">Canvas</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        {/* ... continue for material_sqm, kwh_used, freight_km */}
                    </Grid>
                    <Button type="submit" variant="contained" sx={{ mt: 3 }}>Save Changes</Button>
                    {status && <Typography sx={{ mt: 2 }}>{status}</Typography>}
                </Box>
            </Paper>
        </Container>
    );
};

export default EditProject;
