const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { protect } = require('./authMiddleware');

const app = express();
const port = 5001;

const GEOAPIFY_API_KEY = 'dd864883f99046a29cd06c562a04f6a3';

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'rileyaickin', // Replace with your macOS username
  host: 'localhost',
  database: 'co2_portal',
  port: 5432,
});

const generateToken = (id) => {
    return jwt.sign({ id }, 'your_jwt_secret', { expiresIn: '30d' });
};

const setNoCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

const PROJECT_CO2E_SUBQUERY = `
    (
        SELECT 
            p.id AS project_id,
            COALESCE(SUM(
                CASE
                    WHEN ef.factor_type = 'PER_SQM' THEN pm.material_sqm * ef.co2e_per_unit
                    WHEN ef.factor_type = 'PER_KG' THEN (pm.material_sqm * (pm.thickness_mm / 1000.0) * ef.density_kg_per_m3) * ef.co2e_per_unit
                    ELSE 0
                END
            ), 0) + 
            (COALESCE(p.kwh_used, 0) * 0.5) +
            (COALESCE(p.freight_km, 0) * 0.1)
            AS total_co2e
        FROM projects p
        LEFT JOIN project_materials pm ON p.id = pm.project_id
        LEFT JOIN emission_factors ef ON pm.material_name = ef.material_name
        GROUP BY p.id
    )
`;

// --- AUTH & REGISTRATION ROUTES ---
app.post('/api/internal/invites', async (req, res) => {
    const { client_name } = req.body;
    if (!client_name) { return res.status(400).json({ message: 'Client name is required' }); }
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        let clientResult = await dbClient.query('SELECT id FROM clients WHERE name = $1', [client_name]);
        let clientId;
        if (clientResult.rows.length > 0) {
            clientId = clientResult.rows[0].id;
        } else {
            const newClient = await dbClient.query('INSERT INTO clients (name) VALUES ($1) RETURNING id', [client_name]);
            clientId = newClient.rows[0].id;
        }
        const registrationToken = crypto.randomBytes(32).toString('hex');
        const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await dbClient.query('INSERT INTO registration_tokens (client_id, token, expires_at) VALUES ($1, $2, $3)',[clientId, registrationToken, expires_at]);
        await dbClient.query('COMMIT');
        res.status(201).json({ token: registrationToken });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        console.error("Error creating invite", err.stack);
        res.status(500).json({ message: 'Server error' });
    } finally {
        dbClient.release();
    }
});

app.post('/api/users/register', async (req, res) => {
    const { first_name, last_name, email, password, token } = req.body;
    try {
        const tokenResult = await pool.query("SELECT * FROM registration_tokens WHERE token = $1 AND expires_at > NOW() AND is_used = FALSE", [token]);
        if (tokenResult.rows.length === 0) { return res.status(400).json({ message: 'Invalid or expired registration link.' }); }
        const { client_id } = tokenResult.rows[0];
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) { return res.status(400).json({ message: 'A user with this email already exists.' }); }
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        await pool.query('INSERT INTO users (client_id, first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4, $5)', [client_id, first_name, last_name, email, password_hash]);
        await pool.query('UPDATE registration_tokens SET is_used = TRUE WHERE token = $1', [token]);
        res.status(201).json({ message: 'Registration successful! You can now log in.' });
    } catch (err) {
        console.error("Error during registration", err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/users/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (user && (await bcrypt.compare(password, user.password_hash))) {
            res.json({ id: user.id, email: user.email, token: generateToken(user.id) });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error("Error during login", err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});


// --- CLIENT-FACING DASHBOARD & FILTER ROUTES ---

app.get('/api/dashboard/impact-by-store', protect, setNoCache, async (req, res) => {
    const { state, startDate, endDate } = req.query;
    let conditions = ['p.client_id = $1'];
    const params = [req.user.client_id];
    if (state) { params.push(state); conditions.push(`st.name = $${params.length}`); }
    if (startDate) { params.push(startDate); conditions.push(`p.project_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`p.project_date <= $${params.length}`); }
    const whereClause = conditions.join(' AND ');
    const query = `
        SELECT s.name AS store_name, st.name AS state_name, SUM(co2e.total_co2e) AS total_emissions
        FROM projects p
        JOIN stores s ON p.store_id = s.id
        JOIN states st ON s.state_id = st.id
        JOIN ${PROJECT_CO2E_SUBQUERY} co2e ON p.id = co2e.project_id
        WHERE ${whereClause}
        GROUP BY s.name, st.name ORDER BY total_emissions DESC LIMIT 5;
    `;
    try { res.json((await pool.query(query, params)).rows); }
    catch (err) { console.error('Error fetching impact by store', err.stack); res.status(500).json({ message: 'Server error' }); }
});

app.get('/api/dashboard/impact-by-media', protect, setNoCache, async (req, res) => {
    const { startDate, endDate, projectName, state, storeName } = req.query;
    let conditions = ['p.client_id = $1'];
    const params = [req.user.client_id];

    if (startDate) { params.push(startDate); conditions.push(`p.project_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`p.project_date <= $${params.length}`); }
    if (projectName) { params.push(projectName); conditions.push(`p.name = $${params.length}`); }
    if (state) { params.push(state); conditions.push(`st.name = $${params.length}`); }
    if (storeName) { params.push(storeName); conditions.push(`s.name = $${params.length}`); }

    const whereClause = conditions.join(' AND ');

    const query = `
        SELECT 
            pm.material_name, 
            -- This COALESCE ensures that if a sum is null, it becomes 0
            COALESCE(SUM(
                CASE
                    WHEN ef.factor_type = 'PER_SQM' THEN pm.material_sqm * ef.co2e_per_unit
                    WHEN ef.factor_type = 'PER_KG' THEN (pm.material_sqm * (pm.thickness_mm / 1000.0) * ef.density_kg_per_m3) * ef.co2e_per_unit
                    ELSE 0
                END
            ), 0) AS total_emissions
        FROM projects p
        JOIN project_materials pm ON p.id = pm.project_id
        JOIN emission_factors ef ON pm.material_name = ef.material_name
        JOIN stores s ON p.store_id = s.id
        JOIN states st ON s.state_id = st.id
        WHERE ${whereClause}
        GROUP BY pm.material_name 
        ORDER BY total_emissions DESC 
        LIMIT 5;
    `;
    try {
        const result = await pool.query(query, params);
        // On the frontend, we now use material_name instead of material
        res.json(result.rows.map(row => ({ ...row, material: row.material_name })));
    } 
    catch (err) {
        console.error('Error fetching impact by media', err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/dashboard/chart-data', protect, setNoCache, async (req, res) => {
    const { startDate, endDate, projectName, state, storeName } = req.query;
    let conditions = ['p.client_id = $1'];
    const params = [req.user.client_id];
    if (startDate) { params.push(startDate); conditions.push(`p.project_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`p.project_date <= $${params.length}`); }
    if (projectName) { params.push(projectName); conditions.push(`p.name = $${params.length}`); }
    if (state) { params.push(state); conditions.push(`st.name = $${params.length}`); }
    if (storeName) { params.push(storeName); conditions.push(`s.name = $${params.length}`); }
    const whereClause = conditions.join(' AND ');
    const query = `
        SELECT 
            to_char(p.project_date, 'YYYY-MM') AS period, -- Changed to group by month
            pm.material_name,
            SUM(
                CASE
                    WHEN ef.factor_type = 'PER_SQM' THEN pm.material_sqm * ef.co2e_per_unit
                    WHEN ef.factor_type = 'PER_KG' THEN (pm.material_sqm * (pm.thickness_mm / 1000.0) * ef.density_kg_per_m3) * ef.co2e_per_unit
                    ELSE 0
                END
            ) AS total_emissions
        FROM projects p
        JOIN project_materials pm ON p.id = pm.project_id
        JOIN emission_factors ef ON pm.material_name = ef.material_name
        JOIN stores s ON p.store_id = s.id
        JOIN states st ON s.state_id = st.id
        WHERE ${whereClause}
        GROUP BY period, pm.material_name ORDER BY period, pm.material_name;
    `;
    try {
        const result = await pool.query(query, params);
        const dbRows = result.rows;
        const labels = [...new Set(dbRows.map(r => r.period))].sort();
        const materials = [...new Set(dbRows.map(r => r.material_name))];
        const materialColors = {
            'Self Adhesive Vinyl': 'rgba(255, 99, 132, 0.7)', 'Static Cling Vinyl': 'rgba(255, 159, 64, 0.7)',
            'Vinyl Banner': 'rgba(255, 205, 86, 0.7)', 'Fabric': 'rgba(75, 192, 192, 0.7)',
            'Paper': 'rgba(54, 162, 235, 0.7)', 'Synthetic Paper': 'rgba(153, 102, 255, 0.7)',
            'Ferrous Paper': 'rgba(102, 102, 102, 0.7)', 'PVC Board': 'rgba(201, 203, 207, 0.7)',
            'Foam Board': 'rgba(210, 105, 30, 0.7)', 'ReBoard': 'rgba(0, 128, 0, 0.7)',
            'Polypropylene': 'rgba(0, 0, 128, 0.7)', 'Corflute': 'rgba(255, 20, 147, 0.7)',
        };
        const datasets = materials.map(material => ({
            label: material,
            data: labels.map(label => {
                const row = dbRows.find(r => r.period === label && r.material_name === material);
                return row ? parseFloat(row.total_emissions) : 0;
            }),
            backgroundColor: materialColors[material] || 'rgba(153, 102, 255, 0.7)',
            stack: 'stack0',
        }));
        res.json({ labels, datasets });
    } catch (err) {
        console.error('Error fetching chart data', err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});

// UPDATED to be dynamic and include CO2e totals
app.get('/api/dashboard/stores', protect, setNoCache, async (req, res) => {
    const { startDate, endDate, projectName, state, storeName } = req.query;
    let conditions = ['p.client_id = $1'];
    const params = [req.user.client_id];

    if (startDate) { params.push(startDate); conditions.push(`p.project_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`p.project_date <= $${params.length}`); }
    if (projectName) { params.push(projectName); conditions.push(`p.name = $${params.length}`); }
    if (state) { params.push(state); conditions.push(`st.name = $${params.length}`); }
    if (storeName) { params.push(storeName); conditions.push(`s.name = $${params.length}`); }

    const whereClause = conditions.join(' AND ');

    // This query now groups by store and sums the total CO2e for each one based on the filters.
    const query = `
        SELECT 
            s.id, 
            s.name, 
            s.lat, 
            s.lng, 
            SUM(co2e.total_co2e) as total_emissions
        FROM projects p
        JOIN stores s ON p.store_id = s.id
        JOIN states st ON s.state_id = st.id
        JOIN ${PROJECT_CO2E_SUBQUERY} co2e ON p.id = co2e.project_id
        WHERE ${whereClause}
        GROUP BY s.id, s.name, s.lat, s.lng
        ORDER BY s.name;
    `;
    try {
        const results = await pool.query(query, params);
        res.json(results.rows);
    } catch (err) {
        console.error('Error fetching client stores', err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/filters/project-names', protect, setNoCache, async (req, res) => {
    try {
        const results = await pool.query("SELECT DISTINCT name FROM projects WHERE client_id = $1 ORDER BY name", [req.user.client_id]);
        res.json(results.rows.map(row => row.name));
    } catch (err) { console.error('Error fetching project names', err.stack); res.status(500).json({ message: 'Server error' }); }
});

app.get('/api/filters/client-states', protect, setNoCache, async (req, res) => {
    try {
        const results = await pool.query(`SELECT DISTINCT st.name FROM states st JOIN stores s ON st.id = s.state_id WHERE s.client_id = $1 ORDER BY st.name`, [req.user.client_id]);
        res.json(results.rows.map(row => row.name));
    } catch (err) { console.error('Error fetching client states', err.stack); res.status(500).json({ message: 'Server error' }); }
});

app.get('/api/dashboard/projects-list', protect, setNoCache, async (req, res) => {
    const { startDate, endDate, projectName, state, storeName } = req.query;
    let conditions = ['p.client_id = $1'];
    const params = [req.user.client_id];
    if (startDate) { params.push(startDate); conditions.push(`p.project_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`p.project_date <= $${params.length}`); }
    if (projectName) { params.push(projectName); conditions.push(`p.name = $${params.length}`); }
    if (state) { params.push(state); conditions.push(`st.name = $${params.length}`); }
    if (storeName) { params.push(storeName); conditions.push(`s.name = $${params.length}`); }
    const whereClause = conditions.join(' AND ');
    const query = `
        SELECT p.id, p.job_id, p.name, p.project_date, s.name as store_name, st.name as state_name, co2e.total_co2e
        FROM projects p
        JOIN stores s ON p.store_id = s.id
        JOIN states st ON s.state_id = st.id
        JOIN ${PROJECT_CO2E_SUBQUERY} co2e ON p.id = co2e.project_id
        WHERE ${whereClause}
        ORDER BY p.project_date DESC;
    `;
    try { res.json((await pool.query(query, params)).rows); } 
    catch (err) { console.error('Error fetching project list for client', err.stack); res.status(500).json({ message: 'Server error' }); }
});


// --- INTERNAL & GLOBAL ROUTES ---

app.get('/api/filters/stores', async (req, res) => {
    try { res.json((await pool.query("SELECT id, name FROM stores ORDER BY name")).rows); } 
    catch (err) { console.error('Error fetching stores', err.stack); res.status(500).json({ message: 'Server error' }); }
});

app.get('/api/filters/clients', setNoCache, async (req, res) => {
    try { 
        const results = await pool.query(`
            SELECT c.id, c.name as client_name, u.email
            FROM clients c
            LEFT JOIN (
                SELECT client_id, email, ROW_NUMBER() OVER(PARTITION BY client_id ORDER BY id) as rn FROM users
            ) u ON c.id = u.client_id AND u.rn = 1
            ORDER BY c.name
        `);
        res.json(results.rows);
    } 
    catch (err) { console.error('Error fetching clients', err.stack); res.status(500).json({ message: 'Server error' }); }
});

// ## NEW ## GET /api/filters/all-states
// Gets a list of all states for dropdowns
app.get('/api/filters/all-states', async (req, res) => {
    try {
        const results = await pool.query("SELECT id, name FROM states ORDER BY name");
        res.json(results.rows);
    } catch (err) {
        console.error('Error fetching all states', err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/projects', async (req, res) => {
    const { job_id, name, project_date, store_id, client_id, kwh_used, freight_km, materials } = req.body;
    if (!job_id || !name || !project_date || !store_id || !client_id || !materials || !Array.isArray(materials) || materials.length === 0) {
        return res.status(400).json({ error: 'Missing required project data or at least one material item.' });
    }
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const projectQuery = `INSERT INTO projects (job_id, name, project_date, store_id, client_id, kwh_used, freight_km) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`;
        const projectResult = await dbClient.query(projectQuery, [job_id, name, project_date, store_id, client_id, kwh_used, freight_km]);
        const projectId = projectResult.rows[0].id;
        const materialQuery = `INSERT INTO project_materials (project_id, material_name, material_sqm, thickness_mm) VALUES ($1, $2, $3, $4)`;
        for (const material of materials) {
            const thickness = material.thickness_mm || null;
            if (thickness !== null) {
                const thicknessNum = parseInt(thickness, 10);
                if (isNaN(thicknessNum) || thicknessNum < 1 || thicknessNum > 25) { throw new Error(`Invalid thickness for ${material.material_name}. Must be a number between 1 and 25.`); }
            }
            await dbClient.query(materialQuery, [projectId, material.material_name, material.material_sqm, thickness]);
        }
        await dbClient.query('COMMIT');
        res.status(201).json({ message: `Project "${name}" added successfully with ${materials.length} material(s).`});
    } catch (err) {
        await dbClient.query('ROLLBACK');
        if (err.code === '23505') { return res.status(409).json({ error: 'A project with this Job ID or Name already exists for this client.' }); }
        console.error('Error adding project', err.stack);
        res.status(500).send({ error: err.message || 'Error adding data to database' });
    } finally {
        dbClient.release();
    }
});

app.get('/api/internal/all-projects', async (req, res) => {
    try {
        const results = await pool.query(`
            SELECT p.id, p.job_id, p.name, p.project_date, c.name as client_name, s.name as store_name
            FROM projects p
            JOIN clients c ON p.client_id = c.id
            JOIN stores s ON p.store_id = s.id
            ORDER BY p.project_date DESC
        `);
        res.json(results.rows);
    } catch (err) { console.error('Error fetching all projects', err.stack); res.status(500).json({ message: 'Server error' }); }
});

app.get('/api/internal/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
        if (result.rows.length === 0) { return res.status(404).json({ message: 'Project not found' }); }
        res.json(result.rows[0]);
    } catch (err) { console.error('Error fetching single project', err.stack); res.status(500).json({ message: 'Server error' }); }
});

app.put('/api/internal/projects/:id', async (req, res) => {
    res.status(501).json({ message: 'Edit project functionality not fully implemented for multiple materials.' });
});

app.delete('/api/internal/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM projects WHERE id = $1", [id]);
        res.status(200).json({ message: 'Project deleted successfully' });
    } catch (err) { console.error('Error deleting project', err.stack); res.status(500).json({ message: 'Server error' }); }
});

app.get('/api/internal/c02e-trends', async (req, res) => {
    const { clientId, startDate, endDate } = req.query;
    const conditions = [];
    const params = [];
    if (clientId) { params.push(clientId); conditions.push(`p.client_id = $${params.length}`); }
    if (startDate) { params.push(startDate); conditions.push(`p.project_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); conditions.push(`p.project_date <= $${params.length}`); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
        SELECT 
            to_char(p.project_date, 'YYYY-MM') AS period, -- Changed to group by month
            SUM(co2e.total_co2e) AS total_emissions
        FROM projects p
        JOIN ${PROJECT_CO2E_SUBQUERY} co2e ON p.id = co2e.project_id
        ${whereClause}
        GROUP BY period 
        ORDER BY period;
    `;
    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching C02e trends', err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/internal/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT id, name as client_name FROM clients WHERE id = $1", [id]);
        if (result.rows.length === 0) { return res.status(404).json({ message: 'Client not found' }); }
        res.json(result.rows[0]);
    } catch (err) { console.error('Error fetching single client', err.stack); res.status(500).json({ message: 'Server error' });}
});

app.put('/api/internal/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { client_name } = req.body; 
        if (!client_name) { return res.status(400).json({ error: 'Client Name is required.' }); }
        const updatedClient = await pool.query(`UPDATE clients SET name = $1 WHERE id = $2 RETURNING id, name as client_name`, [client_name, id]);
        res.status(200).json(updatedClient.rows[0]);
    } catch (err) {
        if (err.code === '23505') { return res.status(409).json({ message: 'A client with this name already exists.' }); }
        console.error('Error updating client', err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/internal/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM clients WHERE id = $1", [id]);
        res.status(200).json({ message: 'Client deleted successfully' });
    } catch (err) { console.error('Error deleting client', err.stack); res.status(500).json({ message: 'Server error' });}
});

// UPDATED to include the address field
app.get('/api/internal/clients/:clientId/stores', async (req, res) => {
    const { clientId } = req.params;
    try {
        const results = await pool.query(
            `SELECT s.id, s.name, s.address, s.state_id, st.name as state_name 
             FROM stores s 
             JOIN states st ON s.state_id = st.id 
             WHERE s.client_id = $1 ORDER BY s.name`, [clientId]
        );
        res.json(results.rows);
    } catch (err) {
        console.error('Error fetching stores for client', err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});

// ## UPDATED ## POST /api/internal/stores
// Adds a new store and geocodes the address
app.post('/api/internal/stores', async (req, res) => {
    // state_id is no longer sent from the frontend
    const { name, client_id, address } = req.body;
    if (!name || !client_id || !address) {
        return res.status(400).json({ message: 'Name, Client, and Address are required' });
    }

    try {
        const geoResponse = await axios.get('https://api.geoapify.com/v1/geocode/search', {
            params: { text: address, apiKey: GEOAPIFY_API_KEY }
        });

        if (!geoResponse.data || geoResponse.data.features.length === 0) {
            return res.status(400).json({ message: `Could not find coordinates for address.` });
        }

        const properties = geoResponse.data.features[0].properties;
        const lat = properties.lat;
        const lng = properties.lon;
        const stateName = properties.state;

        if (!stateName) {
            return res.status(400).json({ message: `Could not determine the state from the address provided.` });
        }

        // Find the ID for the state returned by the geocoding service
        const stateResult = await pool.query('SELECT id FROM states WHERE name = $1', [stateName]);
        if (stateResult.rows.length === 0) {
            return res.status(400).json({ message: `The state '${stateName}' is not configured in the system.` });
        }
        const state_id = stateResult.rows[0].id;

        const newStore = await pool.query(
            `INSERT INTO stores (name, state_id, client_id, address, lat, lng) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, state_id, client_id, address, lat, lng]
        );
        res.status(201).json(newStore.rows[0]);
    } catch (err) {
        console.error('Error adding store:', err.message);
        res.status(500).json({ message: 'Server error during geocoding or database operation.' });
    }
});

// UPDATED to auto-detect state from address
app.put('/api/internal/stores/:storeId', async (req, res) => {
    const { storeId } = req.params;
    const { name, address } = req.body; // state_id is no longer sent from the frontend
    if (!name || !address) {
        return res.status(400).json({ message: 'Name and Address are required' });
    }
    
    try {
        const geoResponse = await axios.get('https://api.geoapify.com/v1/geocode/search', {
            params: { text: address, apiKey: GEOAPIFY_API_KEY }
        });

        if (!geoResponse.data || geoResponse.data.features.length === 0) {
            return res.status(400).json({ message: `Could not find coordinates for the address.` });
        }

        const properties = geoResponse.data.features[0].properties;
        const lat = properties.lat;
        const lng = properties.lon;
        const stateName = properties.state;

        if (!stateName) {
            return res.status(400).json({ message: `Could not determine the state from the address provided.` });
        }

        const stateResult = await pool.query('SELECT id FROM states WHERE name = $1', [stateName]);
        if (stateResult.rows.length === 0) {
            return res.status(400).json({ message: `The state '${stateName}' is not configured in the system.` });
        }
        const state_id = stateResult.rows[0].id;

        const updatedStore = await pool.query(
            `UPDATE stores SET name = $1, state_id = $2, address = $3, lat = $4, lng = $5 WHERE id = $6 RETURNING *`,
            [name, state_id, address, lat, lng, storeId]
        );
        res.json(updatedStore.rows[0]);
    } catch (err) {
        console.error('Error updating store:', err.message);
        res.status(500).json({ message: 'Server error during geocoding or database operation.' });
    }
});

app.delete('/api/internal/stores/:storeId', async (req, res) => {
    const { storeId } = req.params;
    try {
        await pool.query('DELETE FROM stores WHERE id = $1', [storeId]);
        res.status(200).json({ message: 'Store deleted successfully' });
    } catch (err) {
        if (err.code === '23503') { return res.status(400).json({ message: 'Cannot delete store. It is still linked to existing projects.' }); }
        console.error('Error deleting store', err.stack);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/internal/stores/bulk', async (req, res) => {
    const { stores, client_id } = req.body;
    if (!stores || !client_id || !Array.isArray(stores) || stores.length === 0) {
        return res.status(400).json({ message: 'A valid array of stores and a client_id are required.' });
    }
    const statesResult = await pool.query('SELECT id, abbreviation FROM states');
    const stateMap = new Map(statesResult.rows.map(s => [s.abbreviation, s.id]));
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const queryText = `INSERT INTO stores (name, state_id, client_id, lat, lng) VALUES ($1, $2, $3, $4, $5)`;
        for (const store of stores) {
            const stateAbbr = store.state_abbreviation;
            const state_id = stateMap.get(stateAbbr);
            if (!store.name || !state_id) { throw new Error(`Invalid data in CSV row. Could not find State ID for '${stateAbbr}' or name is missing.`); }
            const lat = store.lat ? parseFloat(store.lat) : null;
            const lng = store.lng ? parseFloat(store.lng) : null;
            await dbClient.query(queryText, [store.name, state_id, client_id, lat, lng]);
        }
        await dbClient.query('COMMIT');
        res.status(201).json({ message: `${stores.length} stores added successfully.` });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        console.error('Error during bulk store insert', err.stack);
        res.status(500).json({ message: err.message || 'Failed to add stores. The entire upload has been cancelled.' });
    } finally {
        dbClient.release();
    }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});