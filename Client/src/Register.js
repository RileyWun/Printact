import React, { useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button, TextField, Box, Typography, Container, Paper } from '@mui/material';

const Register = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (formData.password !== formData.confirmPassword) {
            return setError('Passwords do not match.');
        }

        try {
            // We don't need to send confirmPassword to the backend
            const payload = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                email: formData.email,
                password: formData.password,
                token: token
            };

            const res = await axios.post('http://localhost:5001/api/users/register', payload);
            
            setSuccess(res.data.message); // Show success message
            setTimeout(() => navigate('/login'), 2000); // Redirect to login after 2 seconds

        } catch (err) {
            // Log the detailed error to the console and set the display error
            const errorMessage = err.response?.data?.message || 'Registration failed.';
            console.error('Registration API Error:', err.response || err);
            setError(errorMessage);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Paper sx={{ p: 3, mt: 4 }}>
                <Typography component="h1" variant="h5" align="center">
                    Complete Your Registration
                </Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                    <TextField margin="normal" required fullWidth name="first_name" label="First Name" onChange={handleChange} autoFocus />
                    <TextField margin="normal" required fullWidth name="last_name" label="Last Name" onChange={handleChange} />
                    <TextField margin="normal" required fullWidth name="email" label="Email Address" type="email" onChange={handleChange} />
                    <TextField margin="normal" required fullWidth name="password" label="Password" type="password" onChange={handleChange} />
                    <TextField margin="normal" required fullWidth name="confirmPassword" label="Confirm Password" type="password" onChange={handleChange} />
                    
                    {/* Display Success or Error Messages */}
                    {success && <Typography color="primary" align="center" sx={{ mt: 2 }}>{success}</Typography>}
                    {error && <Typography color="error" align="center" sx={{ mt: 2 }}>{error}</Typography>}

                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>Register</Button>
                </Box>
            </Paper>
        </Container>
    );
};

export default Register;