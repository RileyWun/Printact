import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, TextField, Select, MenuItem, FormControl, InputLabel, Grid, Box, Typography, Container, Paper, IconButton } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';

// --- Define constants for materials ---
const ALL_MATERIALS = [
    'Self Adhesive Vinyl', 'Static Cling Vinyl', 'Vinyl Banner', 'Fabric', 'Paper', 
    'Synthetic Paper', 'Ferrous Paper', 'PVC Board', 'Foam Board', 'ReBoard', 
    'Polypropylene', 'Corflute'
];

const REQUIRES_THICKNESS = [
    'PVC Board', 'Foam Board', 'ReBoard', 'Polypropylene', 'Corflute'
];


const AddProjectForm = () => {
    // State for main project details
    const [projectData, setProjectData] = useState({
        job_id: '', name: '', project_date: new Date().toISOString().slice(0, 10),
        store_id: '', client_id: '', kwh_used: '', freight_km: ''
    });

    // State for the list of materials
    const [materials, setMaterials] = useState([
        { material_name: 'Self Adhesive Vinyl', material_sqm: '', thickness_mm: '' }
    ]);
    
    const [status, setStatus] = useState('');
    const [stores, setStores] = useState([]);
    const [clients, setClients] = useState([]);

    // Fetch lists for dropdowns
    useEffect(() => {
        const fetchStores = axios.get('http://localhost:5001/api/filters/stores');
        const fetchClients = axios.get('http://localhost:5001/api/filters/clients');

        Promise.all([fetchStores, fetchClients])
            .then(([storesRes, clientsRes]) => {
                setStores(storesRes.data);
                setClients(clientsRes.data);
            })
            .catch(err => console.error("Could not fetch dropdown data", err));
    }, []);

    const handleProjectDataChange = (e) => {
        setProjectData({ ...projectData, [e.target.name]: e.target.value });
    };

    // Handlers for the dynamic material list
    const handleMaterialChange = (index, event) => {
        const { name, value } = event.target;
        const updatedMaterials = [...materials];
        updatedMaterials[index][name] = value;
        
        if (name === 'material_name' && !REQUIRES_THICKNESS.includes(value)) {
            updatedMaterials[index].thickness_mm = '';
        }
        setMaterials(updatedMaterials);
    };

    const handleAddMaterialRow = () => {
        setMaterials([...materials, { material_name: 'Self Adhesive Vinyl', material_sqm: '', thickness_mm: '' }]);
    };

    const handleRemoveMaterialRow = (index) => {
        const updatedMaterials = [...materials];
        updatedMaterials.splice(index, 1);
        setMaterials(updatedMaterials);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus('Adding project...');
        
        const payload = {
            ...projectData,
            materials: materials.filter(m => m.material_sqm)
        };

        axios.post('http://localhost:5001/api/projects', payload)
            .then(response => {
                setStatus(response.data.message);
                setProjectData({
                    job_id: '', name: '', project_date: new Date().toISOString().slice(0, 10),
                    store_id: '', client_id: '', kwh_used: '', freight_km: ''
                });
                setMaterials([{ material_name: 'Self Adhesive Vinyl', material_sqm: '', thickness_mm: '' }]);
            })
            .catch(err => {
                setStatus(err.response?.data?.error || 'An unexpected error occurred.');
            });
    };

    return (
        <Container component="main" maxWidth="md">
            <Paper sx={{ mt: 4, p: 3 }}>
                <Typography component="h1" variant="h4" gutterBottom>
                    Internal Dashboard: Add New Project
                </Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                    <Grid container spacing={2}>
                        {/* Project Detail Fields */}
                        <Grid item xs={12} sm={6}> <FormControl fullWidth required sx={{ minWidth: 180 }}> <InputLabel>Client</InputLabel> <Select name="client_id" label="Client" value={projectData.client_id} onChange={handleProjectDataChange}> {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.client_name}</MenuItem>)} </Select> </FormControl> </Grid>
                        <Grid item xs={12} sm={6}> <FormControl fullWidth required sx={{ minWidth: 180 }}> <InputLabel>Store</InputLabel> <Select name="store_id" label="Store" value={projectData.store_id} onChange={handleProjectDataChange}> {stores.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)} </Select> </FormControl> </Grid>
                        <Grid item xs={12} sm={6}> <TextField name="job_id" label="Job ID" value={projectData.job_id} onChange={handleProjectDataChange} fullWidth required /> </Grid>
                        <Grid item xs={12} sm={6}> <TextField name="name" label="Project Name" value={projectData.name} onChange={handleProjectDataChange} fullWidth required /> </Grid>
                        <Grid item xs={12} sm={6}> <TextField name="project_date" label="Project Date" type="date" value={projectData.project_date} onChange={handleProjectDataChange} fullWidth required InputLabelProps={{ shrink: true }} /> </Grid>
                        <Grid item xs={12} sm={6}></Grid>
                        <Grid item xs={12} sm={6}> <TextField name="kwh_used" label="Energy (kWh) - for entire project" type="number" value={projectData.kwh_used} onChange={handleProjectDataChange} fullWidth /> </Grid>
                        <Grid item xs={12} sm={6}> <TextField name="freight_km" label="Freight (km) - for entire project" type="number" value={projectData.freight_km} onChange={handleProjectDataChange} fullWidth /> </Grid>
                    </Grid>

                    <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>Project Materials</Typography>
                    
                    {materials.map((material, index) => {
                        const showThickness = REQUIRES_THICKNESS.includes(material.material_name);
                        return (
                            <Grid container spacing={2} key={index} sx={{ mb: 2, alignItems: 'center' }}>
                                <Grid item xs={12} sm={showThickness ? 4 : 6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Material</InputLabel>
                                        <Select name="material_name" label="Material" value={material.material_name} onChange={(e) => handleMaterialChange(index, e)}>
                                            {ALL_MATERIALS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={6} sm={showThickness ? 3 : 5}>
                                    <TextField name="material_sqm" label="Material (m²)" type="number" value={material.material_sqm} onChange={(e) => handleMaterialChange(index, e)} fullWidth required />
                                </Grid>
                                {showThickness && (
                                    <Grid item xs={6} sm={3}>
                                        <TextField 
                                            name="thickness_mm" 
                                            label="Thickness (mm)" 
                                            type="number" 
                                            value={material.thickness_mm} 
                                            onChange={(e) => handleMaterialChange(index, e)} 
                                            fullWidth required 
                                            inputProps={{ min: 1, max: 25 }}
                                            sx={{ minWidth: 140 }} // ADDED MINIMUM WIDTH
                                        />
                                    </Grid>
                                )}
                                <Grid item xs={12} sm={1}>
                                    <IconButton onClick={() => handleRemoveMaterialRow(index)} color="error" aria-label="Remove Material">
                                        <DeleteIcon />
                                    </IconButton>
                                </Grid>
                            </Grid>
                        );
                    })}

                    <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddMaterialRow} sx={{ mt: 1 }}>
                        Add Another Material
                    </Button>

                    <Button type="submit" variant="contained" sx={{ mt: 3, display: 'block' }}>Add Project</Button>
                    {status && <Typography sx={{ mt: 2 }}>{status}</Typography>}
                </Box>
            </Paper>
        </Container>
    );
};

export default AddProjectForm;