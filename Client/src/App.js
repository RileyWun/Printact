import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import axios from 'axios';

// Import MUI components
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

// Import Page Components
import Dashboard from './Dashboard';
import Login from './Login';
import Register from './Register';
import AddProjectForm from './AddProjectForm';
import ManageProjects from './ManageProjects';
import EditProject from './EditProject';
import InternalLayout from './InternalLayout';
import InternalHome from './InternalHome';
import ManageClients from './ManageClients';
import EditClient from './EditClient';
import ManageStores from './ManageStores';

// Create a default theme
const defaultTheme = createTheme();

// Set default auth header for axios if a token exists in local storage
const token = localStorage.getItem('token');
if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

const App = () => {
    // Check if the user is authenticated
    const isAuth = !!localStorage.getItem('token');

    return (
        <ThemeProvider theme={defaultTheme}>
            <CssBaseline />
            <Router>
                <div>
                    <Routes>
                        {/* Client-facing Routes */}
                        <Route path="/login" element={!isAuth ? <Login /> : <Navigate to="/" />} />
                        {/* UPDATED registration route */}
                        <Route path="/register/:token" element={<Register />} />
                        <Route path="/" element={isAuth ? <Dashboard /> : <Navigate to="/login" />} />
                        
                        <Route path="/internal" element={<InternalLayout />}>
                            <Route index element={<InternalHome />} />
                            <Route path="manage-clients" element={<ManageClients />} />
                            <Route path="edit-client/:id" element={<EditClient />} />
                            <Route path="/internal/manage-clients/:clientId/stores" element={<ManageStores />} />
                            <Route path="add-project" element={<AddProjectForm />} />
                            <Route path="manage-projects" element={<ManageProjects />} />
                            <Route path="edit-project/:id" element={<EditProject />} />
                        </Route>
                    </Routes>
                </div>
            </Router>
        </ThemeProvider>
    );
};

export default App;