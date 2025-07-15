// client/src/InternalHome.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Paper, Box, Typography, Grid, TextField, FormControl, InputLabel, Select, MenuItem, Stack } from '@mui/material';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

const InternalHome = () => {
    const [trendData, setTrendData] = useState({ labels: [], datasets: [] });
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState([]);
    const [filters, setFilters] = useState({
        clientId: '',
        startDate: '',
        endDate: '',
    });

    useEffect(() => {
        axios.get('http://localhost:5001/api/filters/clients')
            .then(res => setClients(res.data))
            .catch(err => console.error("Could not fetch clients", err));
    }, []);

    const fetchTrendData = useCallback(() => {
        setLoading(true);
        const filteredParams = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
        const queryString = new URLSearchParams(filteredParams).toString();

        axios.get(`http://localhost:5001/api/internal/c02e-trends?${queryString}`)
            .then(res => {
                const data = res.data;
                const labels = data.map(d => d.period);
                const emissions = data.map(d => parseFloat(d.total_emissions));

                setTrendData({
                    labels: labels,
                    datasets: [{
                        label: 'Total CO2e Emissions per Month (kg)',
                        data: emissions,
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                });
                setLoading(false);
            })
            .catch(err => {
                console.error("Could not fetch trend data", err);
                setLoading(false);
            });
    }, [filters]);

    useEffect(() => {
        fetchTrendData();
    }, [fetchTrendData]);

    const handleFilterChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <Stack spacing={3}>
            <Paper sx={{ p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                        {/* ADDED MINIMUM WIDTH TO THIS COMPONENT */}
                        <FormControl fullWidth sx={{ minWidth: 180 }}>
                            <InputLabel>Client</InputLabel>
                            <Select name="clientId" label="Client" value={filters.clientId} onChange={handleFilterChange}>
                                <MenuItem value="">All Clients</MenuItem>
                                {clients.map(client => (
                                    <MenuItem key={client.id} value={client.id}>{client.client_name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField name="startDate" label="Start Date" type="date" value={filters.startDate} onChange={handleFilterChange} fullWidth InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField name="endDate" label="End Date" type="date" value={filters.endDate} onChange={handleFilterChange} fullWidth InputLabelProps={{ shrink: true }} />
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>CO2e Trends</Typography>
                <Box sx={{ height: 400 }}>
                    {loading ? <Typography>Loading trends...</Typography> : <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false }} />}
                </Box>
            </Paper>
        </Stack>
    );
};

export default InternalHome;