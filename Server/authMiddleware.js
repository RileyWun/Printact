// server/authMiddleware.js
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// We need a pool here to query the user details
const pool = new Pool({
  user: 'rileyaickin', // Replace with your macOS username
  host: 'localhost',
  database: 'co2_portal',
  port: 5432,
});

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, 'your_jwt_secret');

            // Get user from the users table based on the ID from the token
            const result = await pool.query('SELECT id, client_id, email FROM users WHERE id = $1', [decoded.id]);
            
            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            req.user = result.rows[0]; // Attach user info to the request object
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };