import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, Container, Button } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Link } from 'react-router-dom';

const ManageProjects = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAllProjects = () => {
        setLoading(true);
        axios.get('http://localhost:5001/api/internal/all-projects')
            .then(res => {
                setProjects(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Could not fetch projects", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchAllProjects();
    }, []);

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            axios.delete(`http://localhost:5001/api/internal/projects/${id}`)
                .then(res => {
                    fetchAllProjects();
                })
                .catch(err => {
                    console.error('Error deleting project', err);
                    alert('Could not delete project.');
                });
        }
    };

    const columns = [
        { field: 'job_id', headerName: 'Job ID', width: 120 },
        { field: 'client_name', headerName: 'Client', width: 180 },
        { field: 'name', headerName: 'Project Name', flex: 1, minWidth: 200 },
        { field: 'store_name', headerName: 'Store', width: 180 },
        {
            field: 'project_date',
            headerName: 'Date',
            width: 120,
            valueFormatter: (value) => value ? new Date(value).toLocaleDateString() : '',
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 150,
            sortable: false,
            renderCell: (params) => {
                return (
                    <Box>
                        <Button component={Link} to={`/internal/edit-project/${params.row.id}`} size="small" sx={{ mr: 1 }}>
                            Edit
                        </Button>
                        <Button size="small" color="error" onClick={() => handleDelete(params.row.id)}>
                            Delete
                        </Button>
                    </Box>
                );
            }
        }
    ];

    return (
        <Container component="main" maxWidth="lg">
            <Paper sx={{ mt: 4, p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography component="h1" variant="h4" gutterBottom>
                        Manage All Projects
                    </Typography>
                    <Button component={Link} to="/internal/add-project" variant="contained">
                        Add New Project
                    </Button>
                </Box>
                <Box sx={{ height: 600, width: '100%' }}>
                    <DataGrid
                        rows={projects}
                        columns={columns}
                        loading={loading}
                        density="compact"
                        initialState={{
                          pagination: {
                            paginationModel: {
                              pageSize: 10,
                            },
                          },
                        }}
                        pageSizeOptions={[10, 20, 50]}
                    />
                </Box>
            </Paper>
        </Container>
    );
};

export default ManageProjects;