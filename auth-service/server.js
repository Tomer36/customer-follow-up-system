import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import config from './config.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database pool
const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    waitForConnections: true,
    connectionLimit: 10
});

// ===== ROUTES =====

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Auth service is running' });
});

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.execute(
            'INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)',
            [email, hashedPassword, full_name]
        );

        const token = jwt.sign(
            { id: result.insertId, email },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: result.insertId, email, full_name }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, full_name: user.full_name }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Auth middleware - reusable for protected routes
const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'No token provided' });

        const decoded = jwt.verify(token, config.jwt.secret);
        req.userId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Get profile (protected)
app.get('/api/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, config.jwt.secret);

        const [users] = await pool.execute(
            'SELECT id, email, full_name, created_at FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== CUSTOMER ROUTES =====

// Get all customers
app.get('/api/customers', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let query = 'SELECT * FROM customers';
        let countQuery = 'SELECT COUNT(*) as total FROM customers';
        const params = [];

        if (search) {
            query += ' WHERE name LIKE ? OR company LIKE ?';
            countQuery += ' WHERE name LIKE ? OR company LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY name ASC LIMIT ? OFFSET ?';

        const [customers] = await pool.execute(query, [...params, limit, offset]);
        const [countResult] = await pool.execute(countQuery, params);

        res.json({
            customers,
            pagination: {
                total: countResult[0].total,
                page,
                limit,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get customer by ID
app.get('/api/customers/:id', auth, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
        res.json({ customer: rows[0] });
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create customer
app.post('/api/customers', auth, async (req, res) => {
    try {
        const { name, email, phone, company, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const [result] = await pool.execute(
            'INSERT INTO customers (name, email, phone, company, notes) VALUES (?, ?, ?, ?, ?)',
            [name, email || null, phone || null, company || null, notes || null]
        );

        const [customer] = await pool.execute('SELECT * FROM customers WHERE id = ?', [result.insertId]);
        res.status(201).json({ message: 'Customer created', customer: customer[0] });
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update customer
app.put('/api/customers/:id', auth, async (req, res) => {
    try {
        const { name, email, phone, company, notes } = req.body;
        await pool.execute(
            'UPDATE customers SET name = ?, email = ?, phone = ?, company = ?, notes = ? WHERE id = ?',
            [name, email || null, phone || null, company || null, notes || null, req.params.id]
        );
        const [customer] = await pool.execute('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Customer updated', customer: customer[0] });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete customer
app.delete('/api/customers/:id', auth, async (req, res) => {
    try {
        await pool.execute('DELETE FROM customers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Customer deleted' });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== TASK ROUTES =====

// Get daily tasks
app.get('/api/tasks/daily', auth, async (req, res) => {
    try {
        const [tasks] = await pool.execute(`
            SELECT t.*, c.name as customer_name, g.name as group_name
            FROM tasks t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN \`groups\` g ON t.group_id = g.id
            WHERE t.due_date = CURDATE() AND t.status = 'open'
            ORDER BY FIELD(t.priority, 'urgent', 'high', 'medium', 'low')
        `);
        res.json({ tasks });
    } catch (error) {
        console.error('Get daily tasks error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get overdue tasks
app.get('/api/tasks/overdue', auth, async (req, res) => {
    try {
        const [tasks] = await pool.execute(`
            SELECT t.*, c.name as customer_name, g.name as group_name,
                   DATEDIFF(CURDATE(), t.due_date) as days_overdue
            FROM tasks t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN \`groups\` g ON t.group_id = g.id
            WHERE t.due_date < CURDATE() AND t.status = 'open'
            ORDER BY t.due_date ASC
        `);
        res.json({ tasks });
    } catch (error) {
        console.error('Get overdue tasks error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all tasks (filtered)
app.get('/api/tasks', auth, async (req, res) => {
    try {
        const { status, customer_id, group_id } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        let query = `
            SELECT t.*, c.name as customer_name, g.name as group_name
            FROM tasks t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN \`groups\` g ON t.group_id = g.id
            WHERE 1=1
        `;
        const params = [];

        if (status) { query += ' AND t.status = ?'; params.push(status); }
        if (customer_id) { query += ' AND t.customer_id = ?'; params.push(customer_id); }
        if (group_id) { query += ' AND t.group_id = ?'; params.push(group_id); }

        query += ' ORDER BY t.due_date ASC, FIELD(t.priority, \'urgent\', \'high\', \'medium\', \'low\') LIMIT ? OFFSET ?';

        const [tasks] = await pool.execute(query, [...params, limit, offset]);
        res.json({ tasks });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create task
app.post('/api/tasks', auth, async (req, res) => {
    try {
        const { customer_id, group_id, title, description, priority, due_date } = req.body;
        if (!customer_id || !title || !due_date) {
            return res.status(400).json({ error: 'customer_id, title, and due_date are required' });
        }

        const [result] = await pool.execute(
            'INSERT INTO tasks (customer_id, group_id, title, description, priority, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [customer_id, group_id || null, title, description || null, priority || 'medium', due_date, req.userId]
        );

        const [task] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
        res.status(201).json({ message: 'Task created', task: task[0] });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update task status
app.patch('/api/tasks/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['open', 'done', 'postponed'].includes(status)) {
            return res.status(400).json({ error: 'Status must be open, done, or postponed' });
        }
        await pool.execute('UPDATE tasks SET status = ? WHERE id = ?', [status, req.params.id]);
        const [task] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
        res.json({ message: 'Status updated', task: task[0] });
    } catch (error) {
        console.error('Update task status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update task
app.put('/api/tasks/:id', auth, async (req, res) => {
    try {
        const { title, description, priority, due_date, group_id } = req.body;
        await pool.execute(
            'UPDATE tasks SET title = ?, description = ?, priority = ?, due_date = ?, group_id = ? WHERE id = ?',
            [title, description || null, priority || 'medium', due_date, group_id || null, req.params.id]
        );
        const [task] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
        res.json({ message: 'Task updated', task: task[0] });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete task
app.delete('/api/tasks/:id', auth, async (req, res) => {
    try {
        await pool.execute('DELETE FROM tasks WHERE id = ?', [req.params.id]);
        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== GROUP ROUTES =====

// Get all groups
app.get('/api/groups', auth, async (req, res) => {
    try {
        const [groups] = await pool.execute('SELECT * FROM `groups` ORDER BY name ASC');
        res.json({ groups });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create group
app.post('/api/groups', auth, async (req, res) => {
    try {
        const { name, color } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const [result] = await pool.execute(
            'INSERT INTO `groups` (name, color) VALUES (?, ?)',
            [name, color || '#3498db']
        );
        const [group] = await pool.execute('SELECT * FROM `groups` WHERE id = ?', [result.insertId]);
        res.status(201).json({ message: 'Group created', group: group[0] });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete group
app.delete('/api/groups/:id', auth, async (req, res) => {
    try {
        await pool.execute('DELETE FROM `groups` WHERE id = ?', [req.params.id]);
        res.json({ message: 'Group deleted' });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add customers to group
app.post('/api/groups/:id/customers', auth, async (req, res) => {
    try {
        const { customer_ids } = req.body;
        if (!Array.isArray(customer_ids)) return res.status(400).json({ error: 'customer_ids array required' });

        for (const cid of customer_ids) {
            await pool.execute(
                'INSERT IGNORE INTO customer_groups (customer_id, group_id) VALUES (?, ?)',
                [cid, req.params.id]
            );
        }
        res.json({ message: 'Customers added to group' });
    } catch (error) {
        console.error('Add to group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get customers in group
app.get('/api/groups/:id/customers', auth, async (req, res) => {
    try {
        const [customers] = await pool.execute(`
            SELECT c.* FROM customers c
            INNER JOIN customer_groups cg ON c.id = cg.customer_id
            WHERE cg.group_id = ?
            ORDER BY c.name ASC
        `, [req.params.id]);
        res.json({ customers });
    } catch (error) {
        console.error('Get group customers error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== DASHBOARD =====

app.get('/api/dashboard/stats', auth, async (req, res) => {
    try {
        const [[{ total_customers }]] = await pool.execute('SELECT COUNT(*) as total_customers FROM customers');
        const [[{ active_tasks }]] = await pool.execute("SELECT COUNT(*) as active_tasks FROM tasks WHERE status = 'open'");
        const [[{ daily_tasks }]] = await pool.execute("SELECT COUNT(*) as daily_tasks FROM tasks WHERE due_date = CURDATE() AND status = 'open'");
        const [[{ overdue_tasks }]] = await pool.execute("SELECT COUNT(*) as overdue_tasks FROM tasks WHERE due_date < CURDATE() AND status = 'open'");
        const [[{ total_groups }]] = await pool.execute('SELECT COUNT(*) as total_groups FROM `groups`');

        res.json({
            stats: { total_customers, active_tasks, daily_tasks, overdue_tasks, total_groups }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start
app.listen(config.port, () => {
    console.log(`\n✅ Auth service running on http://localhost:${config.port}`);
    console.log(`   Health: http://localhost:${config.port}/health\n`);
});
