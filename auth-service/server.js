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

const fetchExternalReportPayload = async (sourceUrl, payloadBody = null, timeoutMs = config.externalApi.timeoutMs) => {
    if (!sourceUrl) {
        const err = new Error('External API URL is missing. Check external report URLs in .env');
        err.status = 500;
        throw err;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
        if (config.externalApi.token) {
            headers.Authorization = `Bearer ${config.externalApi.token}`;
        }

        const response = await fetch(sourceUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payloadBody || { dateFrom: '01/01/2020' }),
            signal: controller.signal
        });

        if (!response.ok) {
            const err = new Error(`External API failed with status ${response.status}`);
            err.status = 502;
            throw err;
        }

        return response.json();
    } catch (error) {
        const code = error?.cause?.code || error?.code;
        if (code === 'ECONNREFUSED') {
            const err = new Error(`Cannot connect to external API at ${sourceUrl}`);
            err.status = 502;
            throw err;
        }
        if (error?.name === 'AbortError') {
            const err = new Error(`External API timeout after ${timeoutMs}ms`);
            err.status = 504;
            throw err;
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

const fetchReport175Payload = async () => fetchExternalReportPayload(config.externalApi.report175Url, { dateFrom: '01/01/2020' }, config.externalApi.timeoutMs);
const fetchReport198Payload = async () => fetchExternalReportPayload(config.externalApi.report198Url, { dateFrom: '01/01/2020' }, config.externalApi.report198TimeoutMs);
const fetchReport176Payload = async () => fetchExternalReportPayload(config.externalApi.report176Url, { dateFrom: '01/01/2020' }, config.externalApi.timeoutMs);
const fetchReport180Payload = async (customer) => {
    const sourceUrl = config.externalApi.report180Url;
    if (!sourceUrl) return null;

    const clientNumber = String(customer?.company || '').trim() || String(customer?.external_id || '').trim() || null;

    const payload = {
        clientNumber
    };

    return fetchExternalReportPayload(sourceUrl, payload, config.externalApi.report198TimeoutMs || config.externalApi.timeoutMs);
};

const fetchReport184Payload = async (customer) => {
    const sourceUrl = config.externalApi.customerDetailsUrl || config.externalApi.report175Url;
    if (!sourceUrl) return null;
    const clientNumber = String(customer?.company || '').trim() || String(customer?.external_id || '').trim() || null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.externalApi.timeoutMs);

    try {
        const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
        if (config.externalApi.token) {
            headers.Authorization = `Bearer ${config.externalApi.token}`;
        }

        const payload = {
            clientNumber
        };

        const response = await fetch(sourceUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            return null;
        }

        return response.json();
    } catch (error) {
        return null;
    } finally {
        clearTimeout(timeout);
    }
};

const rowLooksLikeReport175 = (row) =>
    row &&
    typeof row === 'object' &&
    (
        Object.prototype.hasOwnProperty.call(row, '\u05de\u05e1\u05e4\u05e8 \u05db\u05e8\u05d8\u05d9\u05e1 \u05d7\u05e9\u05d1\u05d5\u05df') ||
        Object.prototype.hasOwnProperty.call(row, 'מספר כרטיס חשבון') ||
        Object.prototype.hasOwnProperty.call(row, '×ž×¡×¤×¨ ×›×¨×˜×™×¡ ×—×©×‘×•×Ÿ')
    );

const pickReport175Value = (row, keys) => {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            return row[key];
        }
    }
    return null;
};

const toReport175Number = (value) => {
    const numeric = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(numeric) ? numeric : 0;
};

const extractReport175Rows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    const arrays = [];
    const queue = [payload];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;

        for (const value of Object.values(current)) {
            if (Array.isArray(value)) {
                arrays.push(value);
            } else if (value && typeof value === 'object') {
                queue.push(value);
            }
        }
    }

    if (arrays.length === 0) return [];

    let best = arrays[0];
    let bestScore = -1;
    for (const arr of arrays) {
        const objectRows = arr.filter((x) => x && typeof x === 'object');
        const reportRows = objectRows.filter(rowLooksLikeReport175);
        const score = (reportRows.length * 1000) + objectRows.length;
        if (score > bestScore) {
            bestScore = score;
            best = arr;
        }
    }

    return best;
};

const rowLooksLikeReport198 = (row) =>
    row &&
    typeof row === 'object' &&
    (
        Object.prototype.hasOwnProperty.call(row, '\u05de\u05e4\u05ea\u05d7 \u05d7\u05e9\u05d1\u05d5\u05df') ||
        Object.prototype.hasOwnProperty.call(row, '\u05e9\u05dd \u05d7\u05e9\u05d1\u05d5\u05df')
    );

const rowLooksLikeReport176 = (row) =>
    row &&
    typeof row === 'object' &&
    (
        Object.prototype.hasOwnProperty.call(row, '\u05e9\u05dd \u05d0\u05d9\u05e9 \u05e7\u05e9\u05e8') ||
        Object.prototype.hasOwnProperty.call(row, '\u05d8\u05dc\u05e4\u05d5\u05df \u05e0\u05d9\u05d9\u05d3') ||
        Object.prototype.hasOwnProperty.call(row, '\u05d3\u05d5\u05d0"\u05dc')
    );

const extractReportRowsByPredicate = (payload, predicate) => {
    const rows = extractReport175Rows(payload);
    if (!rows.length) return [];
    const matching = rows.filter((row) => row && typeof row === 'object' && predicate(row));
    return matching.length ? matching : rows.filter((row) => row && typeof row === 'object');
};

const pickReportRowForCustomer = (rows, customer) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const mapped = rows
        .filter((row) => row && typeof row === 'object')
        .map(mapReport175Row);

    if (!mapped.length) return null;

    const byExternalId = mapped.find((row) => String(row.external_id) === String(customer?.external_id));
    if (byExternalId) return byExternalId;

    const byAccountKey = mapped.find((row) => String(row.account_key || '') === String(customer?.company || ''));
    if (byAccountKey) return byAccountKey;

    return mapped[0] || null;
};

const mapReport175Row = (row) => {
    const accountCardNumber = toReport175Number(pickReport175Value(row, [
        '\u05de\u05e1\u05e4\u05e8 \u05db\u05e8\u05d8\u05d9\u05e1 \u05d7\u05e9\u05d1\u05d5\u05df',
        'מספר כרטיס חשבון',
        '×ž×¡×¤×¨ ×›×¨×˜×™×¡ ×—×©×‘×•×Ÿ'
    ]));
    const accountKey = String(pickReport175Value(row, [
        '\u05de\u05e4\u05ea\u05d7 \u05d7\u05e9\u05d1\u05d5\u05df',
        'מפתח חשבון',
        '×ž×¤×ª×— ×—×©×‘×•×Ÿ'
    ]) ?? '').trim();
    const accountName = String(pickReport175Value(row, [
        '\u05e9\u05dd \u05d7\u05e9\u05d1\u05d5\u05df',
        'שם חשבון',
        '×©× ×—×©×‘×•×Ÿ'
    ]) ?? '').trim();

    const external_id = accountCardNumber > 0
        ? String(accountCardNumber)
        : (accountKey || `row_${crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex')}`);

    return {
        external_id,
        account_card_number: accountCardNumber > 0 ? accountCardNumber : null,
        account_key: accountKey || null,
        account_name: accountName || null,
        account_balance: toReport175Number(pickReport175Value(row, [
            '\u05d9\u05ea\u05e8\u05ea \u05d7\u05e9\u05d1\u05d5\u05df',
            'יתרת חשבון',
            '×™×ª×¨×ª ×—×©×‘×•×Ÿ'
        ])),
        deferred_checks: toReport175Number(pickReport175Value(row, ['\u05e9\u05d9\u05e7\u05d9\u05dd \u05d3\u05d7\u05d5\u05d9\u05d9\u05dd'])),
        open_delivery_notes_balance: toReport175Number(pickReport175Value(row, ['\u05d9\u05ea\u05e8\u05ea \u05ea\u05e2\u05d5\u05d3\u05d5\u05ea \u05de\u05e9\u05dc\u05d5\u05d7 \u05e4\u05ea\u05d5\u05d7\u05d5\u05ea'])),
        total_obligo: toReport175Number(pickReport175Value(row, ['\u05e1\u05d4"\u05db \u05d0\u05d5\u05d1\u05dc\u05d9\u05d2\u05d5'])),
        total_credit: toReport175Number(pickReport175Value(row, ['\u05e1\u05d4"\u05db \u05d0\u05e9\u05e8\u05d0\u05d9'])),
        credit_limit: toReport175Number(pickReport175Value(row, ['\u05ea\u05e7\u05e8\u05ea \u05d0\u05e9\u05e8\u05d0\u05d9'])),
        credit_deviation: toReport175Number(pickReport175Value(row, ['\u05d7\u05e8\u05d9\u05d2\u05d4 \u05de\u05d0\u05e9\u05e8\u05d0\u05d9'])),
        obligo_limit: toReport175Number(pickReport175Value(row, ['\u05ea\u05e7\u05e8\u05ea \u05d0\u05d5\u05d1\u05dc\u05d9\u05d2\u05d5'])),
        obligo_deviation: toReport175Number(pickReport175Value(row, ['\u05d7\u05e8\u05d9\u05d2\u05d4 \u05de\u05d0\u05d5\u05d1\u05dc\u05d9\u05d2\u05d5'])),
        raw_payload: JSON.stringify(row)
    };
};

const mapReport198Row = (row) => {
    const accountKey = String(pickReport175Value(row, ['\u05de\u05e4\u05ea\u05d7 \u05d7\u05e9\u05d1\u05d5\u05df']) ?? '').trim();
    const accountName = String(pickReport175Value(row, ['\u05e9\u05dd \u05d7\u05e9\u05d1\u05d5\u05df']) ?? '').trim();
    const email = String(pickReport175Value(row, ['\u05d3\u05d5\u05d0"\u05dc', 'email', 'Email']) ?? '').trim();
    const phone = String(pickReport175Value(row, ['\u05d8\u05dc\u05e4\u05d5\u05df', 'phone', 'Phone']) ?? '').trim();
    const mobilePhone = String(pickReport175Value(row, ['\u05d8\u05dc\u05e4\u05d5\u05df \u05e0\u05d9\u05d9\u05d3', 'mobile', 'Mobile']) ?? '').trim();
    const accountCardNumber = toReport175Number(pickReport175Value(row, ['\u05de\u05e1\u05e4\u05e8 \u05db\u05e8\u05d8\u05d9\u05e1 \u05d7\u05e9\u05d1\u05d5\u05df']));

    return {
        external_id: accountCardNumber > 0 ? String(accountCardNumber) : null,
        account_key: accountKey || null,
        account_name: accountName || null,
        email: email || null,
        phone: phone || null,
        mobile_phone: mobilePhone || null
    };
};

const mapReport176Row = (row) => {
    const accountKey = String(pickReport175Value(row, ['\u05de\u05e4\u05ea\u05d7 \u05d7\u05e9\u05d1\u05d5\u05df']) ?? '').trim();
    const accountName = String(pickReport175Value(row, ['\u05e9\u05dd \u05d7\u05e9\u05d1\u05d5\u05df']) ?? '').trim();
    const contactName = String(pickReport175Value(row, ['\u05e9\u05dd \u05d0\u05d9\u05e9 \u05e7\u05e9\u05e8']) ?? '').trim();
    const email = String(pickReport175Value(row, ['\u05d3\u05d5\u05d0"\u05dc']) ?? '').trim();
    const phone = String(pickReport175Value(row, ['\u05d8\u05dc\u05e4\u05d5\u05df']) ?? '').trim();
    const mobilePhone = String(pickReport175Value(row, ['\u05d8\u05dc\u05e4\u05d5\u05df \u05e0\u05d9\u05d9\u05d3']) ?? '').trim();

    return {
        account_key: accountKey || null,
        account_name: accountName || null,
        contact_name: contactName || null,
        email: email || null,
        phone: phone || null,
        mobile_phone: mobilePhone || null
    };
};

const fetchReport185Payload = async (customer) => {
    const sourceUrl = config.externalApi.report185Url;
    if (!sourceUrl) return null;
    const clientNumber = String(customer?.company || '').trim() || String(customer?.external_id || '').trim() || null;

    const payload = {
        clientNumber
    };

    return fetchExternalReportPayload(sourceUrl, payload, config.externalApi.timeoutMs);
};

const mapReport180Row = (row) => {
    if (!row || typeof row !== 'object') return null;
    return {
        title: row['כותרת'] ?? null,
        movement: row['תנועה'] ?? null,
        batch: row['מנה'] ?? null,
        entry_type: row['ס"ת'] ?? null,
        account_key: row['מפתח חשבון'] ?? null,
        account_name: row['שם חשבון'] ?? null,
        counter_account: row['ח-ן נגדי'] ?? null,
        counter_account_name: row['שם חשבון נגדי'] ?? null,
        asmach_date: row['ת.אסמכ'] ?? null,
        value_date: row['ת.ערך'] ?? null,
        extra_date: row['תאריך 3'] ?? null,
        asmach_1: row["אסמ'"] ?? null,
        asmach_2: row["אסמ'2"] ?? null,
        details: row['פרטים'] ?? null,
        debit_ils: row['חובה שקל'] ?? null,
        credit_ils: row['זכות שקל'] ?? null,
        balance_ils: row['יתרה (שקל)'] ?? null,
        inventory_id: row['מזהה מלאי'] ?? null
    };
};

const upsertReport175Rows = async (rows, userId) => {
    if (rows.length === 0) return { synced: 0 };

    const chunkSize = 100;
    let synced = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
        const values = [];

        for (const row of chunk) {
            values.push(
                row.external_id,
                row.account_name || row.account_key || row.external_id,
                row.account_key || null,
                userId
            );
        }

        await pool.execute(`
            INSERT INTO customers (external_id, name, company, created_by)
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                company = VALUES(company),
                created_by = COALESCE(customers.created_by, VALUES(created_by)),
                updated_at = CURRENT_TIMESTAMP
        `, values);

        synced += chunk.length;
    }

    return { synced };
};

const getCustomerIdsByExternalIds = async (externalIds, userId) => {
    if (!externalIds.length) return new Map();

    const uniqueIds = [...new Set(externalIds)].filter(Boolean);
    if (uniqueIds.length === 0) return new Map();
    const map = new Map();

    const chunkSize = 500;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => '?').join(', ');
        const [rows] = await pool.execute(`
            SELECT c.id, c.external_id
            FROM customers c
            WHERE c.external_id IN (${placeholders})
              AND ${getCustomerAccessCondition()}
        `, [...chunk, userId, userId]);

        for (const row of rows) {
            map.set(row.external_id, row.id);
        }
    }

    return map;
};

const getLatestHandlingByCustomerIds = async (customerIds) => {
    const uniqueIds = [...new Set((customerIds || []).filter(Boolean).map(Number).filter(Number.isFinite))];
    if (uniqueIds.length === 0) return new Map();

    const placeholders = uniqueIds.map(() => '?').join(', ');
    const [rows] = await pool.execute(`
        SELECT
            n.customer_id,
            n.created_at as payment_start,
            n.due_date as payment_target,
            n.managed_by as managed_by_id,
            n.group_id as group_id,
            manager.full_name as managed_by_name,
            g.name as group_name
        FROM customer_notes n
        INNER JOIN (
            SELECT customer_id, MAX(id) as latest_id
            FROM customer_notes
            WHERE customer_id IN (${placeholders})
            GROUP BY customer_id
        ) latest ON latest.latest_id = n.id
        LEFT JOIN users manager ON manager.id = n.managed_by
        LEFT JOIN \`groups\` g ON g.id = n.group_id
    `, uniqueIds);

    const map = new Map();
    for (const row of rows) {
        map.set(Number(row.customer_id), row);
    }
    return map;
};

const getLatestHandlingByUser = async (userId) => {
    const [rows] = await pool.execute(`
        SELECT
            n.customer_id,
            n.created_at as payment_start,
            n.due_date as payment_target,
            n.managed_by as managed_by_id,
            n.group_id as group_id,
            manager.full_name as managed_by_name,
            g.name as group_name
        FROM customer_notes n
        INNER JOIN (
            SELECT customer_id, MAX(id) as latest_id
            FROM customer_notes
            GROUP BY customer_id
        ) latest ON latest.latest_id = n.id
        INNER JOIN customers c ON c.id = n.customer_id
        LEFT JOIN users manager ON manager.id = n.managed_by
        LEFT JOIN \`groups\` g ON g.id = n.group_id
        WHERE ${getCustomerAccessCondition()}
    `, [userId, userId]);

    const map = new Map();
    for (const row of rows) {
        map.set(Number(row.customer_id), row);
    }
    return map;
};

const parseOptionalInt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
};

const getEligibleCustomerIdsByFilters = async (userId, managedBy, groupId) => {
    const hasManagerFilter = managedBy !== null;
    const hasGroupFilter = groupId !== null;
    if (!hasManagerFilter && !hasGroupFilter) return null;

    let query = `
        SELECT c.id
        FROM customers c
        LEFT JOIN (
            SELECT n.customer_id, n.managed_by, n.group_id
            FROM customer_notes n
            INNER JOIN (
                SELECT customer_id, MAX(id) as latest_id
                FROM customer_notes
                GROUP BY customer_id
            ) latest ON latest.latest_id = n.id
        ) ln ON ln.customer_id = c.id
        WHERE ${getCustomerAccessCondition()}
    `;
    const params = [userId, userId];

    if (hasManagerFilter) {
        query += ' AND ln.managed_by = ?';
        params.push(managedBy);
    }

    if (hasGroupFilter) {
        query += ` AND (
            EXISTS (
                SELECT 1
                FROM customer_groups cg
                WHERE cg.customer_id = c.id AND cg.group_id = ?
            )
            OR ln.group_id = ?
        )`;
        params.push(groupId, groupId);
    }

    const [rows] = await pool.execute(query, params);
    return new Set(rows.map((row) => Number(row.id)));
};

let report175CacheRows = [];
let report175CacheByExternalId = new Map();
let report175CacheSyncedAt = null;
let report198CacheByAccountKey = new Map();
let report198CacheByExternalId = new Map();
let report198CacheSyncedAt = null;
let report176CacheByAccountKey = new Map();
let report176CacheSyncedAt = null;
let report184CacheByCustomerId = new Map();
let report185CacheByCustomerId = new Map();

const setReport175Cache = (rows) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    report175CacheRows = safeRows;
    report175CacheByExternalId = new Map(
        safeRows
            .filter((row) => row && row.external_id)
            .map((row) => [String(row.external_id), row])
    );
    report175CacheSyncedAt = new Date().toISOString();
};

const setReport198Cache = (rows) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    report198CacheByAccountKey = new Map();
    report198CacheByExternalId = new Map();

    for (const row of safeRows) {
        if (!row) continue;
        if (row.account_key) report198CacheByAccountKey.set(String(row.account_key), row);
        if (row.external_id) report198CacheByExternalId.set(String(row.external_id), row);
    }
    report198CacheSyncedAt = new Date().toISOString();
};

const setReport176Cache = (rows) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    report176CacheByAccountKey = new Map();
    for (const row of safeRows) {
        if (!row || !row.account_key) continue;
        report176CacheByAccountKey.set(String(row.account_key), row);
    }
    report176CacheSyncedAt = new Date().toISOString();
};

const getEnrichmentForWorkRow = (workRow) => {
    const accountKey = String(workRow?.account_key || '');
    const externalId = String(workRow?.external_id || '');
    const from198 = report198CacheByAccountKey.get(accountKey) || report198CacheByExternalId.get(externalId) || null;
    const from176 = report176CacheByAccountKey.get(accountKey) || null;

    return {
        account_name: from176?.account_name || from198?.account_name || workRow?.account_name || null,
        contact_name: from176?.contact_name || null,
        email: from176?.email || from198?.email || null,
        phone: from176?.phone || from198?.phone || null,
        mobile_phone: from176?.mobile_phone || from198?.mobile_phone || null
    };
};

const normalizeTextSearch = (value) => String(value || '').toLowerCase().trim();
const normalizePhoneSearch = (value) => String(value || '').replace(/\D+/g, '');
const extractObjectRows = (payload) => extractReport175Rows(payload).filter((row) => row && typeof row === 'object');

const pickRawReportRowForCustomer = (rows, customer) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const targetExternalId = String(customer?.external_id || '').trim();
    const targetAccountKey = String(customer?.company || '').trim();

    const byExternalId = rows.find((row) => {
        const rowExternalId = String(
            pickReport175Value(row, [
                'מספר כרטיס חשבון',
                '×ž×¡×¤×¨ ×›×¨×˜×™×¡ ×—×©×‘×•×Ÿ',
                'Ã—Å¾Ã—Â¡Ã—Â¤Ã—Â¨ Ã—â€ºÃ—Â¨Ã—ËœÃ—â„¢Ã—Â¡ Ã—â€”Ã—Â©Ã—â€˜Ã—â€¢Ã—Å¸'
            ]) ?? ''
        ).trim();
        return rowExternalId && rowExternalId === targetExternalId;
    });
    if (byExternalId) return byExternalId;

    const byAccountKey = rows.find((row) => {
        const rowAccountKey = String(
            pickReport175Value(row, [
                'מפתח חשבון',
                '×ž×¤×ª×— ×—×©×‘×•×Ÿ',
                'Ã—Å¾Ã—Â¤Ã—ÂªÃ—â€” Ã—â€”Ã—Â©Ã—â€˜Ã—â€¢Ã—Å¸'
            ]) ?? ''
        ).trim();
        return rowAccountKey && rowAccountKey === targetAccountKey;
    });
    if (byAccountKey) return byAccountKey;

    return rows[0] || null;
};

const rowMatchesSearch = (workRow, search) => {
    if (!search) return true;
    const enriched = getEnrichmentForWorkRow(workRow);
    const normalizedSearchText = normalizeTextSearch(search);
    const normalizedSearchPhone = normalizePhoneSearch(search);

    const textHaystack = [
        workRow?.account_key,
        workRow?.account_name,
        workRow?.account_card_number,
        enriched.account_name,
        enriched.contact_name,
        enriched.email,
        enriched.phone,
        enriched.mobile_phone,
        workRow?.phone
    ]
        .map((v) => normalizeTextSearch(v))
        .join(' ');

    if (textHaystack.includes(normalizedSearchText)) return true;

    if (normalizedSearchPhone) {
        const phoneCandidates = [
            enriched.mobile_phone,
            enriched.phone,
            workRow?.phone
        ]
            .map((v) => normalizePhoneSearch(v))
            .filter(Boolean);
        return phoneCandidates.some((phone) => phone.includes(normalizedSearchPhone));
    }

    return false;
};

// Get report 175 customers
app.get('/api/customers/reports/175', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = String(req.query.search || '').trim().toLowerCase();
        const managedBy = parseOptionalInt(req.query.managedBy);
        const groupId = parseOptionalInt(req.query.groupId);
        const balanceMode = String(req.query.balanceMode || 'balance_non_zero');

        const baseRows = report175CacheRows
            .filter((row) => rowMatchesSearch(row, search));

        const applyBalanceMode = (row) => {
            if (balanceMode === 'balance_zero') {
                return Number(row.account_balance || 0) === 0;
            }
            return Number(row.account_balance || 0) !== 0;
        };

        const balanceFilteredRows = baseRows.filter(applyBalanceMode);
        const needsHandlingFilters = managedBy !== null || groupId !== null;

        let filteredRowsWithHandling = [];
        if (needsHandlingFilters) {
            const idMapAll = await getCustomerIdsByExternalIds(balanceFilteredRows.map((r) => r.external_id), req.userId);
            const handlingMapAll = await getLatestHandlingByUser(req.userId);
            const eligibleCustomerIds = await getEligibleCustomerIdsByFilters(req.userId, managedBy, groupId);

            if (eligibleCustomerIds && eligibleCustomerIds.size === 0) {
                return res.json({
                    customers: [],
                    pagination: {
                        total: 0,
                        page,
                        limit,
                        totalPages: 1
                    },
                    cache: {
                        syncedAt: report175CacheSyncedAt
                    }
                });
            }

            filteredRowsWithHandling = balanceFilteredRows
                .map((row) => {
                    const customerId = idMapAll.get(row.external_id) || null;
                    const handling = customerId ? handlingMapAll.get(Number(customerId)) : null;
                    return {
                        ...row,
                        customer_id: customerId,
                        payment_start: handling?.payment_start || null,
                        payment_target: handling?.payment_target || null,
                        managed_by_id: handling?.managed_by_id || null,
                        group_id: handling?.group_id || null,
                        managed_by_name: handling?.managed_by_name || null,
                        group_name: handling?.group_name || null
                    };
                })
                .filter((row) => {
                    if (!row.customer_id) return false;
                    if (eligibleCustomerIds && !eligibleCustomerIds.has(Number(row.customer_id))) return false;
                    return true;
                });
        } else {
            const pagedBaseRows = balanceFilteredRows.slice(offset, offset + limit);
            const idMapPaged = await getCustomerIdsByExternalIds(pagedBaseRows.map((r) => r.external_id), req.userId);
            const handlingMapPaged = await getLatestHandlingByCustomerIds(
                pagedBaseRows.map((row) => idMapPaged.get(row.external_id)).filter(Boolean)
            );
            filteredRowsWithHandling = pagedBaseRows.map((row) => {
                const customerId = idMapPaged.get(row.external_id) || null;
                const handling = customerId ? handlingMapPaged.get(Number(customerId)) : null;
                return {
                    ...row,
                    customer_id: customerId,
                    payment_start: handling?.payment_start || null,
                    payment_target: handling?.payment_target || null,
                    managed_by_id: handling?.managed_by_id || null,
                    group_id: handling?.group_id || null,
                    managed_by_name: handling?.managed_by_name || null,
                    group_name: handling?.group_name || null
                };
            });
        }

        const pagedRows = needsHandlingFilters
            ? filteredRowsWithHandling.slice(offset, offset + limit)
            : filteredRowsWithHandling;

        const hydratedRows = pagedRows.map((row, idx) => {
            const enriched = getEnrichmentForWorkRow(row);
            return {
                id: offset + idx + 1,
                ...row,
                account_name: enriched.account_name || row.account_name,
                contact_name: enriched.contact_name,
                email: enriched.email,
                phone: enriched.phone,
                mobile_phone: enriched.mobile_phone
            };
        });

        res.json({
            customers: hydratedRows,
            pagination: {
                total: needsHandlingFilters ? filteredRowsWithHandling.length : balanceFilteredRows.length,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil((needsHandlingFilters ? filteredRowsWithHandling.length : balanceFilteredRows.length) / limit))
            },
            cache: {
                syncedAt: report175CacheSyncedAt,
                report198SyncedAt: report198CacheSyncedAt,
                report176SyncedAt: report176CacheSyncedAt
            }
        });
    } catch (error) {
        console.error('Get report 175 error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Server error' });
    }
});

// Sync customers (report 175 direct call)
app.post('/api/customers/sync', auth, async (req, res) => {
    try {
        const payload175 = await fetchReport175Payload();
        const rows175 = extractReport175Rows(payload175)
            .filter((row) => row && typeof row === 'object')
            .map(mapReport175Row);

        const result175 = await upsertReport175Rows(rows175, req.userId);
        setReport175Cache(rows175);

        let rows198 = [];
        let rows176 = [];
        const warnings = [];

        try {
            const payload198 = await fetchReport198Payload();
            rows198 = extractReportRowsByPredicate(payload198, rowLooksLikeReport198).map(mapReport198Row);
            setReport198Cache(rows198);
        } catch (err) {
            warnings.push(`Failed to sync report 198: ${err?.message || 'Unknown error'}`);
        }

        try {
            const payload176 = await fetchReport176Payload();
            rows176 = extractReportRowsByPredicate(payload176, rowLooksLikeReport176).map(mapReport176Row);
            setReport176Cache(rows176);
        } catch (err) {
            warnings.push(`Failed to sync report 176: ${err?.message || 'Unknown error'}`);
        }

        return res.json({
            message: warnings.length ? 'Sync completed with warnings.' : 'Sync completed successfully.',
            synced: {
                report175: { received: rows175.length, upserted: result175.synced, syncedAt: report175CacheSyncedAt },
                report198: { received: rows198.length, syncedAt: report198CacheSyncedAt },
                report176: { received: rows176.length, syncedAt: report176CacheSyncedAt }
            },
            warnings
        });
    } catch (error) {
        console.error('Sync customers error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Server error' });
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

        const customer = rows[0];
        let report175 = report175CacheByExternalId.get(String(customer.external_id)) || null;
        if (!report175) {
            const payload184 = await fetchReport184Payload(customer);
            const rows184 = extractReport175Rows(payload184);
            report175 = pickReportRowForCustomer(rows184, customer);
        }
        if (!report175) {
            report175 = {
                external_id: customer.external_id || null,
                account_key: customer.company || null,
                account_name: customer.name || null,
                account_balance: 0,
                open_delivery_notes_balance: 0,
                total_obligo: 0
            };
        }

        const enriched = getEnrichmentForWorkRow(report175);

        const [latestRows] = await pool.execute(`
            SELECT
                n.created_at as payment_start,
                n.due_date as payment_target,
                manager.full_name as managed_by_name,
                g.name as group_name
            FROM customer_notes n
            LEFT JOIN users manager ON manager.id = n.managed_by
            LEFT JOIN \`groups\` g ON g.id = n.group_id
            WHERE n.customer_id = ?
            ORDER BY n.id DESC
            LIMIT 1
        `, [req.params.id]);

        const latest = latestRows[0] || null;
        res.json({
            customer: {
                ...customer,
                report175,
                profile: {
                    account_name: enriched.account_name || customer.name || null,
                    contact_name: enriched.contact_name || null,
                    email: enriched.email || customer.email || null,
                    phone: enriched.mobile_phone || enriched.phone || customer.phone || null
                },
                payment_start: latest?.payment_start || null,
                payment_target: latest?.payment_target || null,
                managed_by_name: latest?.managed_by_name || null,
                group_name: latest?.group_name || null
            }
        });
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get report 184/185 basic details for one customer
app.get('/api/customers/:id/basic-reports', auth, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT c.*
            FROM customers c
            WHERE c.id = ?
              AND ${getCustomerAccessCondition()}
            LIMIT 1
        `, [req.params.id, req.userId, req.userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

        const customer = rows[0];
        const customerId = Number(customer.id);

        let payload184 = report184CacheByCustomerId.get(customerId) || null;
        if (!payload184) {
            payload184 = await fetchReport184Payload(customer);
            if (payload184) report184CacheByCustomerId.set(customerId, payload184);
        }

        let payload185 = report185CacheByCustomerId.get(customerId) || null;
        if (!payload185) {
            payload185 = await fetchReport185Payload(customer);
            if (payload185) report185CacheByCustomerId.set(customerId, payload185);
        }

        const rows184 = extractObjectRows(payload184);
        const rows185 = extractObjectRows(payload185);

        res.json({
            customer: {
                id: customer.id,
                external_id: customer.external_id || null,
                account_key: customer.company || null,
                name: customer.name || null
            },
            report184: {
                row: pickRawReportRowForCustomer(rows184, customer),
                rowsCount: rows184.length
            },
            report185: {
                row: pickRawReportRowForCustomer(rows185, customer),
                rowsCount: rows185.length
            }
        });
    } catch (error) {
        console.error('Get basic reports error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Server error' });
    }
});

// Get report 180 rows for one customer
app.get('/api/customers/:id/report-180', auth, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT c.*
            FROM customers c
            WHERE c.id = ?
              AND ${getCustomerAccessCondition()}
            LIMIT 1
        `, [req.params.id, req.userId, req.userId]);

        if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

        const customer = rows[0];
        const payload180 = await fetchReport180Payload(customer);
        const rawRows = extractReport175Rows(payload180)
            .filter((row) => row && typeof row === 'object');

        const normalizedRows = rawRows.map(mapReport180Row).filter(Boolean);

        res.json({
            customer: {
                id: customer.id,
                account_key: customer.company || null,
                external_id: customer.external_id || null,
                name: customer.name || null
            },
            rows: normalizedRows
        });
    } catch (error) {
        console.error('Get report 180 error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Server error' });
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


