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

const getCustomerAccessCondition = () => `
    (c.created_by = ? OR EXISTS (
        SELECT 1
        FROM customer_notes cn
        WHERE cn.customer_id = c.id
          AND cn.managed_by = ?
    ))
`;

const canAccessCustomer = async (customerId, userId) => {
    const [rows] = await pool.execute(`
        SELECT c.id
        FROM customers c
        WHERE c.id = ?
          AND ${getCustomerAccessCondition()}
        LIMIT 1
    `, [customerId, userId, userId]);
    return rows.length > 0;
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

// ===== USER ROUTES =====

app.get('/api/users', auth, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, full_name, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/users/:id', auth, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, full_name, created_at FROM users WHERE id = ?',
            [req.params.id]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ user: users[0] });
    } catch (error) {
        console.error('Get user by id error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/users/:id', auth, async (req, res) => {
    try {
        const { email, full_name } = req.body;
        if (!email || !full_name) {
            return res.status(400).json({ error: 'email and full_name are required' });
        }

        await pool.execute(
            'UPDATE users SET email = ?, full_name = ? WHERE id = ?',
            [email, full_name, req.params.id]
        );

        const [users] = await pool.execute(
            'SELECT id, email, full_name, created_at FROM users WHERE id = ?',
            [req.params.id]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User updated', user: users[0] });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/users/:id', auth, async (req, res) => {
    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
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

        let query = `SELECT c.* FROM customers c WHERE ${getCustomerAccessCondition()}`;
        let countQuery = `SELECT COUNT(*) as total FROM customers c WHERE ${getCustomerAccessCondition()}`;
        const params = [req.userId, req.userId];
        const countParams = [req.userId, req.userId];

        if (search) {
            query += ' AND (c.name LIKE ? OR c.company LIKE ?)';
            countQuery += ' AND (c.name LIKE ? OR c.company LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
            countParams.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY c.name ASC LIMIT ? OFFSET ?';

        const [customers] = await pool.execute(query, [...params, limit, offset]);
        const [countResult] = await pool.execute(countQuery, countParams);

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

// Sync customers (placeholder scaffold)
app.post('/api/customers/sync', auth, async (req, res) => {
    try {
        // Placeholder: external API fetching is intentionally not implemented.
        // For now, pass customers in request body:
        // { customers: [{ external_id, name, email, phone, company, notes }] }
        const incomingCustomers = Array.isArray(req.body?.customers) ? req.body.customers : [];

        if (incomingCustomers.length === 0) {
            return res.json({
                message: 'Sync scaffold is ready. Provide customers in request body to test upsert.',
                synced: 0
            });
        }

        let synced = 0;
        for (const item of incomingCustomers) {
            if (!item?.external_id || !item?.name) continue;

            await pool.execute(`
                INSERT INTO customers (external_id, name, email, phone, company, notes, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    email = VALUES(email),
                    phone = VALUES(phone),
                    company = VALUES(company),
                    notes = VALUES(notes),
                    created_by = COALESCE(customers.created_by, VALUES(created_by)),
                    updated_at = CURRENT_TIMESTAMP
            `, [
                item.external_id,
                item.name,
                item.email || null,
                item.phone || null,
                item.company || null,
                item.notes || null,
                req.userId
            ]);
            synced += 1;
        }

        return res.json({
            message: 'Customers upserted using sync scaffold. External API integration is still a placeholder.',
            synced
        });
    } catch (error) {
        console.error('Sync customers error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get customer by ID
app.get('/api/customers/:id', auth, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT c.*
            FROM customers c
            WHERE c.id = ?
              AND ${getCustomerAccessCondition()}
        `, [req.params.id, req.userId, req.userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
        res.json({ customer: rows[0] });
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get groups for one customer
app.get('/api/customers/:id/groups', auth, async (req, res) => {
    try {
        const hasAccess = await canAccessCustomer(req.params.id, req.userId);
        if (!hasAccess) return res.status(404).json({ error: 'Customer not found' });

        const [groups] = await pool.execute(`
            SELECT g.* FROM \`groups\` g
            INNER JOIN customer_groups cg ON cg.group_id = g.id
            WHERE cg.customer_id = ?
            ORDER BY g.name ASC
        `, [req.params.id]);
        res.json({ groups });
    } catch (error) {
        console.error('Get customer groups error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Assign customer to a group
app.post('/api/customers/:id/groups', auth, async (req, res) => {
    try {
        const hasAccess = await canAccessCustomer(req.params.id, req.userId);
        if (!hasAccess) return res.status(404).json({ error: 'Customer not found' });

        const { group_id } = req.body;
        if (!group_id) return res.status(400).json({ error: 'group_id is required' });

        await pool.execute(
            'INSERT IGNORE INTO customer_groups (customer_id, group_id) VALUES (?, ?)',
            [req.params.id, group_id]
        );

        res.json({ message: 'Customer assigned to group' });
    } catch (error) {
        console.error('Assign customer group error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get notes for one customer
app.get('/api/customers/:id/notes', auth, async (req, res) => {
    try {
        const hasAccess = await canAccessCustomer(req.params.id, req.userId);
        if (!hasAccess) return res.status(404).json({ error: 'Customer not found' });

        const [notes] = await pool.execute(`
            SELECT
                n.id,
                n.note,
                n.due_date,
                n.action_type,
                n.created_at,
                creator.id as created_by_id,
                creator.full_name as created_by_name,
                manager.id as managed_by_id,
                manager.full_name as manager_name,
                g.id as group_id,
                g.name as group_name
            FROM customer_notes n
            INNER JOIN users creator ON creator.id = n.created_by
            LEFT JOIN users manager ON manager.id = n.managed_by
            LEFT JOIN \`groups\` g ON g.id = n.group_id
            WHERE n.customer_id = ?
            ORDER BY n.created_at DESC
        `, [req.params.id]);
        res.json({ notes });
    } catch (error) {
        console.error('Get customer notes error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add note for one customer
app.post('/api/customers/:id/notes', auth, async (req, res) => {
    try {
        const hasAccess = await canAccessCustomer(req.params.id, req.userId);
        if (!hasAccess) return res.status(404).json({ error: 'Customer not found' });

        const { note, due_date, managed_by, group_id } = req.body;
        if (!note || !note.trim()) return res.status(400).json({ error: 'note is required' });
        if (!due_date) return res.status(400).json({ error: 'due_date is required' });

        const managedProvided = managed_by !== undefined && managed_by !== null && managed_by !== '';
        const groupProvided = group_id !== undefined && group_id !== null && group_id !== '';

        const [latestRows] = await pool.execute(`
            SELECT managed_by, group_id
            FROM customer_notes
            WHERE customer_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        `, [req.params.id]);

        const latest = latestRows[0] || null;
        const managerId = managedProvided
            ? Number(managed_by)
            : (latest?.managed_by || req.userId);
        const groupId = groupProvided
            ? Number(group_id)
            : (latest?.group_id || null);
        const actionType = (managerId !== req.userId || groupId) ? 'transfer' : 'note';

        const [result] = await pool.execute(
            `INSERT INTO customer_notes (customer_id, note, due_date, created_by, managed_by, group_id, action_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, note.trim(), due_date, req.userId, managerId, groupId, actionType]
        );

        if (groupId) {
            await pool.execute(
                'INSERT IGNORE INTO customer_groups (customer_id, group_id) VALUES (?, ?)',
                [req.params.id, groupId]
            );
        }

        const [rows] = await pool.execute(`
            SELECT
                n.id,
                n.note,
                n.due_date,
                n.action_type,
                n.created_at,
                creator.id as created_by_id,
                creator.full_name as created_by_name,
                manager.id as managed_by_id,
                manager.full_name as manager_name,
                g.id as group_id,
                g.name as group_name
            FROM customer_notes n
            INNER JOIN users creator ON creator.id = n.created_by
            LEFT JOIN users manager ON manager.id = n.managed_by
            LEFT JOIN \`groups\` g ON g.id = n.group_id
            WHERE n.id = ?
        `, [result.insertId]);

        res.status(201).json({ message: 'Note added', note: rows[0] });
    } catch (error) {
        console.error('Add customer note error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get transfer records for one customer
app.get('/api/customers/:id/transfers', auth, async (req, res) => {
    try {
        const hasAccess = await canAccessCustomer(req.params.id, req.userId);
        if (!hasAccess) return res.status(404).json({ error: 'Customer not found' });

        const [transfers] = await pool.execute(`
            SELECT
                n.id,
                n.note,
                n.due_date,
                n.created_at,
                creator.id as created_by_id,
                creator.full_name as created_by_name,
                manager.id as managed_by_id,
                manager.full_name as manager_name,
                g.id as group_id,
                g.name as group_name
            FROM customer_notes n
            INNER JOIN users creator ON creator.id = n.created_by
            LEFT JOIN users manager ON manager.id = n.managed_by
            LEFT JOIN \`groups\` g ON g.id = n.group_id
            WHERE n.customer_id = ?
              AND n.action_type = 'transfer'
            ORDER BY n.created_at DESC
        `, [req.params.id]);
        res.json({ transfers });
    } catch (error) {
        console.error('Get customer transfers error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Transfer customer to manager/group
app.post('/api/customers/:id/transfers', auth, async (req, res) => {
    try {
        const hasAccess = await canAccessCustomer(req.params.id, req.userId);
        if (!hasAccess) return res.status(404).json({ error: 'Customer not found' });

        const { note, due_date, managed_by, group_id } = req.body;
        if (!due_date) return res.status(400).json({ error: 'due_date is required' });
        if (!managed_by) return res.status(400).json({ error: 'managed_by is required' });
        if (!group_id) return res.status(400).json({ error: 'group_id is required' });

        const text = (note || '').trim();
        const [result] = await pool.execute(
            `INSERT INTO customer_notes (customer_id, note, due_date, created_by, managed_by, group_id, action_type)
             VALUES (?, ?, ?, ?, ?, ?, 'transfer')`,
            [req.params.id, text || 'Transfer to handling', due_date, req.userId, managed_by, group_id]
        );

        await pool.execute(
            'INSERT IGNORE INTO customer_groups (customer_id, group_id) VALUES (?, ?)',
            [req.params.id, group_id]
        );

        const [rows] = await pool.execute(`
            SELECT
                n.id,
                n.note,
                n.due_date,
                n.created_at,
                creator.id as created_by_id,
                creator.full_name as created_by_name,
                manager.id as managed_by_id,
                manager.full_name as manager_name,
                g.id as group_id,
                g.name as group_name
            FROM customer_notes n
            INNER JOIN users creator ON creator.id = n.created_by
            LEFT JOIN users manager ON manager.id = n.managed_by
            LEFT JOIN \`groups\` g ON g.id = n.group_id
            WHERE n.id = ?
        `, [result.insertId]);

        res.status(201).json({ message: 'Customer transferred', transfer: rows[0] });
    } catch (error) {
        console.error('Transfer customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create customer
app.post('/api/customers', auth, async (req, res) => {
    try {
        const { name, email, phone, company, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const [result] = await pool.execute(
            'INSERT INTO customers (name, email, phone, company, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email || null, phone || null, company || null, notes || null, req.userId]
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
        const hasAccess = await canAccessCustomer(req.params.id, req.userId);
        if (!hasAccess) return res.status(404).json({ error: 'Customer not found' });

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
        const hasAccess = await canAccessCustomer(req.params.id, req.userId);
        if (!hasAccess) return res.status(404).json({ error: 'Customer not found' });

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

// Get task by ID
app.get('/api/tasks/:id', auth, async (req, res) => {
    try {
        const [tasks] = await pool.execute(`
            SELECT t.*, c.name as customer_name, g.name as group_name
            FROM tasks t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN \`groups\` g ON t.group_id = g.id
            WHERE t.id = ?
        `, [req.params.id]);

        if (tasks.length === 0) return res.status(404).json({ error: 'Task not found' });
        res.json({ task: tasks[0] });
    } catch (error) {
        console.error('Get task error:', error);
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
              AND ${getCustomerAccessCondition()}
            ORDER BY c.name ASC
        `, [req.params.id, req.userId, req.userId]);
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
