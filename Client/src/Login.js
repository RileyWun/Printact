// client/src/Login.js
import React, { useState } from 'react';
import axios from 'axios';
import { Button, TextField, Box, Typography, Container, Paper } from '@mui/material';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            // UPDATED endpoint URL
            const res = await axios.post('http://localhost:5001/api/users/login', formData);
            localStorage.setItem('token', res.data.token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
            window.location = '/';
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed.');
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Paper sx={{ p: 3, mt: 4 }}>
                <Typography component="h1" variant="h5" align="center">Client Portal Sign In</Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
                    <TextField margin="normal" required fullWidth id="email" label="Email Address" name="email" onChange={handleChange} />
                    <TextField margin="normal" required fullWidth name="password" label="Password" type="password" id="password" onChange={handleChange} />
                    {error && <Typography color="error" align="center" sx={{ mt: 1 }}>{error}</Typography>}
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>Sign In</Button>
                </Box>
                 {/* The old link to register is no longer needed as it's invite-only */}
            </Paper>
        </Container>
    );
};

export default Login;