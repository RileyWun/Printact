import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Box, Button, Paper, Typography, Link as MuiLink, Stack, TextField, Select, MenuItem, FormControl, InputLabel, Autocomplete } from '@mui/material';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

import EmissionsMap from './EmissionsMap';
import ReportGenerator from './ReportGenerator';

// --- Components for Dashboard Cards ---
const HighestImpactStores = ({ data }) => (
    <Paper sx={{ p: 2, height: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" gutterBottom>Highest Impact Stores</Typography>
            <MuiLink href="#" underline="hover" sx={{ fontSize: '0.875rem' }}>View all</MuiLink>
        </Box>
        <Stack spacing={1} mt={2}>
            {data && data.length > 0 ? data.map(store => (
                <Box key={store.store_name} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>{store.store_name} - {store.state_name}</Typography>
                    <Typography fontWeight="bold">{parseFloat(store.total_emissions).toFixed(2)}kg CO2e</Typography>
                </Box>
            )) : <Typography color="text.secondary">No store data.</Typography> }
        </Stack>
    </Paper>
);

// UPDATED to use the correct property name 'material_name'
const HighestImpactMedia = ({ data }) => (
    <Paper sx={{ p: 2, height: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" gutterBottom>Highest Impact Media</Typography>
            <MuiLink href="#" underline="hover" sx={{ fontSize: '0.875rem' }}>View all</MuiLink>
        </Box>
        <Stack spacing={1} mt={2}>
            {data && data.length > 0 ? data.map(media => (
                 <Box key={media.material_name} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>{media.material_name}</Typography>
                    <Typography fontWeight="bold">{parseFloat(media.total_emissions).toFixed(2)}kg CO2e</Typography>
                </Box>
            )) : <Typography color="text.secondary">No media data.</Typography> }
        </Stack>
    </Paper>
);


const Dashboard = () => {
    // All state and functions remain the same
    const [impactfulStores, setImpactfulStores] = useState([]);
    const [impactfulMedia, setImpactfulMedia] = useState([]);
    const [chartData, setChartData] = useState({ labels: [], datasets: [] });
    const [clientStores, setClientStores] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [projectNames, setProjectNames] = useState([]);
    const [storeOptions, setStoreOptions] = useState([]);
    const [stateOptions, setStateOptions] = useState([]);
    const [filters, setFilters] = useState({
        dateRange: { start: '', end: '' },
        projectName: null,
        state: '',
        storeName: null,
    });

    const handleFilterChange = (name, value) => {
        if (name === 'startDate' || name === 'endDate') {
            setFilters(prev => ({
                ...prev,
                dateRange: { ...prev.dateRange, [name === 'startDate' ? 'start' : 'end']: value }
            }));
        } else {
            setFilters(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        window.location = '/login';
    };

    const fetchDashboardData = useCallback(() => {
        setLoading(true);
        
        const params = {
            startDate: filters.dateRange.start,
            endDate: filters.dateRange.end,
            state: filters.state,
            projectName: filters.projectName,
            storeName: filters.storeName?.name 
        };

        const filteredParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null && v !== ''));
        const queryString = new URLSearchParams(filteredParams).toString();

        const storesPromise = axios.get(`http://localhost:5001/api/dashboard/impact-by-store?${queryString}`);
        const mediaPromise = axios.get(`http://localhost:5001/api/dashboard/impact-by-media?${queryString}`);
        const chartPromise = axios.get(`http://localhost:5001/api/dashboard/chart-data?${queryString}`);
        const projectNamesPromise = axios.get(`http://localhost:5001/api/filters/project-names?timestamp=${new Date().getTime()}`);
        const storeOptionsPromise = axios.get('http://localhost:5001/api/filters/stores');
        const clientStoresPromise = axios.get('http://localhost:5001/api/dashboard/stores');
        const stateOptionsPromise = axios.get('http://localhost:5001/api/filters/client-states');
        const allProjectsPromise = axios.get(`http://localhost:5001/api/dashboard/projects-list?${queryString}`);
        
        Promise.all([storesPromise, mediaPromise, chartPromise, projectNamesPromise, storeOptionsPromise, clientStoresPromise, stateOptionsPromise, allProjectsPromise])
            .then(([storesResponse, mediaResponse, chartResponse, projectNamesResponse, storeOptionsResponse, clientStoresResponse, stateOptionsResponse, allProjectsResponse]) => {
                setImpactfulStores(storesResponse.data);
                setImpactfulMedia(mediaResponse.data);
                setChartData(chartResponse.data);
                setProjectNames(projectNamesResponse.data);
                setStoreOptions(storeOptionsResponse.data);
                setClientStores(clientStoresResponse.data);
                setStateOptions(stateOptionsResponse.data);
                setProjects(allProjectsResponse.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching dashboard data!", error);
                if (error.response?.status === 401) handleLogout();
                setLoading(false);
            });
    }, [filters]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);
    
    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, stacked: true }, x: { stacked: true } },
        plugins: { legend: { position: 'top', align: 'start' } },
    };
    
    const chartTotalCo2e = chartData.datasets.length > 0
        ? chartData.datasets.flatMap(d => d.data).reduce((sum, val) => sum + val, 0) : 0;
        
    const filteredStoreOptions = useMemo(() => storeOptions, [storeOptions]);

    return (
        <Box sx={{ p: 3, backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="fontWeightBold">
                    Emissions Dashboard
                </Typography>
                <Button variant="outlined" onClick={handleLogout}>Logout</Button>
            </Box>
            
            <Stack spacing={3}>
                <Paper sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField 
                            label="Start Date" type="date" size="small" 
                            InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 180 }}
                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                            value={filters.dateRange.start}
                        />
                        <TextField 
                            label="End Date" type="date" size="small" 
                            InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 180 }}
                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                            value={filters.dateRange.end}
                        />
                        <Autocomplete
                          options={projectNames}
                          getOptionLabel={(option) => option || ''}
                          renderInput={(params) => <TextField {...params} label="Project Name" size="small" />}
                          onChange={(event, newValue) => handleFilterChange('projectName', newValue)}
                          value={filters.projectName}
                          sx={{ flex: 1, minWidth: 200 }}
                        />
                        <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
                            <InputLabel>State</InputLabel>
                            <Select value={filters.state} label="State" onChange={(e) => handleFilterChange('state', e.target.value)}>
                                <MenuItem value="">All States</MenuItem>
                                {stateOptions.map(stateName => (
                                    <MenuItem key={stateName} value={stateName}>{stateName}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Autocomplete
                          options={filteredStoreOptions}
                          getOptionLabel={(option) => option.name || ''}
                          renderInput={(params) => <TextField {...params} label="Store Name" size="small" />}
                          onChange={(event, newValue) => handleFilterChange('storeName', newValue)}
                          value={filters.storeName}
                          sx={{ flex: 1, minWidth: 200 }}
                        />
                         <Box sx={{flex: 1, minWidth: 220}}>
                             <ReportGenerator projects={projects} />
                        </Box>
                    </Box>
                </Paper>

                <Box sx={{ display: 'flex', gap: 3 }}>
                    <Box sx={{ flex: 2 }}>
                        <Paper sx={{ p: 2, height: '400px' }}>
                             <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="h6">Carbon Footprint</Typography>
                                <Typography variant="h5" fontWeight="bold">{chartTotalCo2e.toFixed(2)}kg CO2e</Typography>
                            </Box>
                            <Box sx={{ height: '320px', mt: 2 }}>
                                <Bar data={chartData} options={chartOptions} />
                            </Box>
                        </Paper>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Paper sx={{ p: 2, height: '400px' }}>
                            <Typography variant="h6" gutterBottom>Emissions by Store</Typography>
                            <EmissionsMap stores={clientStores} />
                        </Paper>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 3 }}>
                    <Box sx={{ flex: 1 }}>
                        <HighestImpactStores data={impactfulStores} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <HighestImpactMedia data={impactfulMedia} />
                    </Box>
                </Box>
            </Stack>
        </Box>
    );
};

export default Dashboard;