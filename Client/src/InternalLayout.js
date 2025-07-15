import React from 'react';
import { Box, Tabs, Tab, Container, Typography } from '@mui/material';
import { Link, useLocation, Outlet } from 'react-router-dom';

const InternalLayout = () => {
    const location = useLocation();

    // This logic finds the base path to highlight the correct tab
    const currentTab = `/internal/${location.pathname.split('/')[2]}`;

    return (
        <Container maxWidth="xl" sx={{ mt: 4 }}>
            <Typography variant="h3" component="h1" gutterBottom>
                Internal Dashboard
            </Typography>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={currentTab}>
                    <Tab label="Home" value="/internal/undefined" to="/internal" component={Link} />
                    <Tab label="Manage Clients" value="/internal/manage-clients" to="/internal/manage-clients" component={Link} />
                    <Tab label="Add Project" value="/internal/add-project" to="/internal/add-project" component={Link} />
                    <Tab label="Manage Projects" value="/internal/manage-projects" to="/internal/manage-projects" component={Link} />
                </Tabs>
            </Box>

            {/* Child routes will render here */}
            <Outlet />
        </Container>
    );
};

export default InternalLayout;