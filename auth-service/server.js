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

// Public login options
app.get('/api/login-users', async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, username FROM users ORDER BY username ASC'
        );
        res.json({ users });
    } catch (error) {
        console.error('Get login users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE username = ? LIMIT 1',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username }
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
    (? IS NOT NULL OR ? IS NOT NULL)
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
            'SELECT id, username, created_at FROM users WHERE id = ?',
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
            'SELECT id, username, created_at FROM users ORDER BY created_at DESC'
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
            'SELECT id, username, created_at FROM users WHERE id = ?',
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
        const username = String(req.body.username || '').trim();
        if (!username) {
            return res.status(400).json({ error: 'username is required' });
        }

        await pool.execute(
            'UPDATE users SET username = ? WHERE id = ?',
            [username, req.params.id]
        );

        const [users] = await pool.execute(
            'SELECT id, username, created_at FROM users WHERE id = ?',
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
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
        const values = [];

        for (const row of chunk) {
            values.push(
                row.external_id,
                row.account_name || row.account_key || row.external_id,
                null,
                null,
                row.account_key || null,
                row.account_balance || 0,
                row.credit_limit || 0,
                row.raw_payload || null,
                null,
                null,
                null,
                null
            );
        }

        await pool.execute(`
            INSERT INTO customers (
                external_id,
                name,
                email,
                phone,
                company,
                balance,
                credit_limit,
                raw_payload,
                created_by,
                assigned_user_id,
                group_id,
                status,
                last_synced_at
            )
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                email = VALUES(email),
                phone = VALUES(phone),
                company = VALUES(company),
                balance = VALUES(balance),
                credit_limit = VALUES(credit_limit),
                raw_payload = VALUES(raw_payload),
                last_synced_at = CURRENT_TIMESTAMP,
                created_by = IFNULL(created_by, VALUES(created_by)),
                assigned_user_id = IFNULL(assigned_user_id, VALUES(assigned_user_id)),
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
            SELECT
                c.id,
                c.external_id
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
            c.id as customer_id,
            latest_note.created_at as payment_start,
            latest_note.due_date as payment_target,
            c.assigned_user_id as managed_by_id,
            c.group_id as group_id,
            manager.username as managed_by_name,
            g.name as group_name
        FROM customers c
        LEFT JOIN (
            SELECT n.customer_id, n.created_at, n.due_date, n.id
            FROM customer_notes n
            INNER JOIN (
                SELECT customer_id, MAX(id) as latest_id
                FROM customer_notes
                WHERE customer_id IN (${placeholders})
                GROUP BY customer_id
            ) latest ON latest.latest_id = n.id
        ) latest_note ON latest_note.customer_id = c.id
        LEFT JOIN users manager ON manager.id = c.assigned_user_id
        LEFT JOIN \`groups\` g ON g.id = c.group_id
        WHERE c.id IN (${placeholders})
    `, [...uniqueIds, ...uniqueIds]);

    const map = new Map();
    for (const row of rows) {
        map.set(Number(row.customer_id), row);
    }
    return map;
};

const getLatestHandlingByUser = async (userId) => {
    const [rows] = await pool.execute(`
        SELECT
            c.id as customer_id,
            latest_note.created_at as payment_start,
            latest_note.due_date as payment_target,
            c.assigned_user_id as managed_by_id,
            c.group_id as group_id,
            manager.username as managed_by_name,
            g.name as group_name
        FROM customers c
        LEFT JOIN customer_notes latest_note ON latest_note.id = (
            SELECT MAX(n.id) FROM customer_notes n WHERE n.customer_id = c.id
        )
        LEFT JOIN users manager ON manager.id = c.assigned_user_id
        LEFT JOIN \`groups\` g ON g.id = c.group_id
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
        WHERE ${getCustomerAccessCondition()}
    `;
    const params = [userId, userId];

    if (hasManagerFilter) {
        query += ' AND c.assigned_user_id = ?';
        params.push(managedBy);
    }

    if (hasGroupFilter) {
        query += ' AND c.group_id = ?';
        params.push(groupId);
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
let customersSyncState = {
    report175: { status: 'idle', startedAt: null, finishedAt: null, error: null },
    background: { status: 'idle', startedAt: null, finishedAt: null, error: null },
    lastTriggeredAt: null
};

const setSyncState = (key, patch) => {
    customersSyncState = {
        ...customersSyncState,
        [key]: {
            ...customersSyncState[key],
            ...patch
        }
    };
};

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

const getCustomersSyncStatusPayload = () => ({
    sync: customersSyncState,
    caches: {
        report175SyncedAt: report175CacheSyncedAt,
        report198SyncedAt: report198CacheSyncedAt,
        report176SyncedAt: report176CacheSyncedAt
    }
});

const isCacheFresh = (syncedAt, maxAgeMs) => {
    if (!syncedAt) return false;
    const ageMs = Date.now() - new Date(syncedAt).getTime();
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < maxAgeMs;
};

const runBackgroundSupplementalSync = async () => {
    if (customersSyncState.background.status === 'running') {
        return { skipped: true };
    }

    const freshWindowMs = config.sync.supplementalFreshMs;
    const shouldSync198 = !isCacheFresh(report198CacheSyncedAt, freshWindowMs);
    const shouldSync176 = !isCacheFresh(report176CacheSyncedAt, freshWindowMs);

    if (!shouldSync198 && !shouldSync176) {
        setSyncState('background', {
            status: 'completed',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            error: null
        });
        return { skipped: true, reason: 'fresh_cache' };
    }

    setSyncState('background', {
        status: 'running',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null
    });

    try {
        const [report198Result, report176Result] = await Promise.allSettled([
            shouldSync198 ? fetchReport198Payload() : Promise.resolve(null),
            shouldSync176 ? fetchReport176Payload() : Promise.resolve(null)
        ]);

        const warnings = [];

        if (!shouldSync198) {
            // Keep existing 198 cache when it's still fresh.
        } else if (report198Result.status === 'fulfilled') {
            const rows198 = extractReportRowsByPredicate(report198Result.value, rowLooksLikeReport198).map(mapReport198Row);
            setReport198Cache(rows198);
        } else {
            warnings.push(`Failed to sync report 198: ${report198Result.reason?.message || 'Unknown error'}`);
        }

        if (!shouldSync176) {
            // Keep existing 176 cache when it's still fresh.
        } else if (report176Result.status === 'fulfilled') {
            const rows176 = extractReportRowsByPredicate(report176Result.value, rowLooksLikeReport176).map(mapReport176Row);
            setReport176Cache(rows176);
        } else {
            warnings.push(`Failed to sync report 176: ${report176Result.reason?.message || 'Unknown error'}`);
        }

        setSyncState('background', {
            status: warnings.length ? 'completed_with_warnings' : 'completed',
            finishedAt: new Date().toISOString(),
            error: warnings.length ? warnings.join(' | ') : null
        });

        return { warnings };
    } catch (error) {
        setSyncState('background', {
            status: 'failed',
            finishedAt: new Date().toISOString(),
            error: error?.message || 'Unknown error'
        });
        throw error;
    }
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

app.get('/api/customers/sync/status', auth, async (req, res) => {
    try {
        res.json(getCustomersSyncStatusPayload());
    } catch (error) {
        console.error('Get customers sync status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Sync customers (report 175 direct call)
app.post('/api/customers/sync', auth, async (req, res) => {
    try {
        if (customersSyncState.report175.status === 'running') {
            return res.status(202).json({
                message: 'Sync already in progress.',
                ...getCustomersSyncStatusPayload()
            });
        }

        setSyncState('report175', {
            status: 'running',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            error: null
        });
        customersSyncState = {
            ...customersSyncState,
            lastTriggeredAt: new Date().toISOString()
        };

        const triggerUserId = req.userId;

        void (async () => {
            try {
                const payload175 = await fetchReport175Payload();
                const rows175 = extractReport175Rows(payload175)
                    .filter((row) => row && typeof row === 'object')
                    .map(mapReport175Row);

                const result175 = await upsertReport175Rows(rows175, triggerUserId);
                setReport175Cache(rows175);

                setSyncState('report175', {
                    status: 'completed',
                    finishedAt: new Date().toISOString(),
                    error: null
                });

                runBackgroundSupplementalSync().catch((backgroundError) => {
                    console.error('Background supplemental sync error:', backgroundError);
                });

                console.log(`Sync completed: report175 received=${rows175.length}, upserted=${result175.synced}`);
            } catch (error) {
                setSyncState('report175', {
                    status: 'failed',
                    finishedAt: new Date().toISOString(),
                    error: error?.message || 'Unknown error'
                });
                console.error('Sync customers error:', error);
            }
        })();

        return res.status(202).json({
            message: 'Sync started.',
            ...getCustomersSyncStatusPayload()
        });
    } catch (error) {
        setSyncState('report175', {
            status: 'failed',
            finishedAt: new Date().toISOString(),
            error: error?.message || 'Unknown error'
        });
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
                manager.username as managed_by_name,
                g.name as group_name
            FROM customers c
            LEFT JOIN customer_notes n ON n.id = (
                SELECT MAX(n2.id) FROM customer_notes n2 WHERE n2.customer_id = c.id
            )
            LEFT JOIN users manager ON manager.id = c.assigned_user_id
            LEFT JOIN \`groups\` g ON g.id = c.group_id
            WHERE c.id = ?
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
        const report175 = report175CacheByExternalId.get(String(customer.external_id)) || {
            external_id: customer.external_id || null,
            account_key: customer.company || null,
            account_name: customer.name || null,
            account_balance: Number(customer.balance || 0),
            credit_limit: Number(customer.credit_limit || 0)
        };
        const enriched = getEnrichmentForWorkRow(report175);

        const localBasicRow = {
            'מפתח חשבון': report175.account_key || customer.company || null,
            'שם חשבון': report175.account_name || customer.name || null,
            'מספר כרטיס חשבון': report175.external_id || customer.external_id || null,
            'שם איש קשר': enriched.contact_name || null,
            'דוא"ל': enriched.email || customer.email || null,
            'טלפון': enriched.phone || customer.phone || null,
            'טלפון נייד': enriched.mobile_phone || null,
            'יתרת חשבון': report175.account_balance ?? Number(customer.balance || 0),
            'תקרת אשראי': report175.credit_limit ?? Number(customer.credit_limit || 0)
        };

        res.json({
            customer: {
                id: customer.id,
                external_id: customer.external_id || null,
                account_key: customer.company || null,
                name: customer.name || null
            },
            report184: {
                row: localBasicRow,
                rowsCount: Object.values(localBasicRow).filter((value) => value !== null && value !== '').length
            },
            report185: {
                row: null,
                rowsCount: 0
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
            SELECT g.*
            FROM customers c
            INNER JOIN \`groups\` g ON g.id = c.group_id
            WHERE c.id = ?
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
            'UPDATE customers SET group_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [group_id, req.params.id]
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
                creator.username as created_by_name,
                manager.id as managed_by_id,
                manager.username as manager_name,
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

        const [customerRows] = await pool.execute(`
            SELECT assigned_user_id, group_id
            FROM customers
            WHERE id = ?
        `, [req.params.id]);
        const customer = customerRows[0] || null;
        const managedProvided = managed_by !== undefined && managed_by !== null && managed_by !== '';
        const groupProvided = group_id !== undefined && group_id !== null && group_id !== '';
        const currentManagerId = customer?.assigned_user_id || req.userId;
        const currentGroupId = customer?.group_id || null;
        const managerId = managedProvided ? Number(managed_by) : currentManagerId;
        const groupId = groupProvided ? Number(group_id) : currentGroupId;
        const actionType = (managerId !== currentManagerId || groupId !== currentGroupId) ? 'transfer' : 'note';

        const [result] = await pool.execute(
            `INSERT INTO customer_notes (customer_id, note, due_date, created_by, managed_by, group_id, action_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, note.trim(), due_date, req.userId, managerId, groupId, actionType]
        );

        await pool.execute(
            'UPDATE customers SET assigned_user_id = ?, group_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [managerId, groupId, req.params.id]
        );

        const [rows] = await pool.execute(`
            SELECT
                n.id,
                n.note,
                n.due_date,
                n.action_type,
                n.created_at,
                creator.id as created_by_id,
                creator.username as created_by_name,
                manager.id as managed_by_id,
                manager.username as manager_name,
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
                creator.username as created_by_name,
                manager.id as managed_by_id,
                manager.username as manager_name,
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
            'UPDATE customers SET assigned_user_id = ?, group_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [managed_by, group_id, req.params.id]
        );

        const [rows] = await pool.execute(`
            SELECT
                n.id,
                n.note,
                n.due_date,
                n.created_at,
                creator.id as created_by_id,
                creator.username as created_by_name,
                manager.id as managed_by_id,
                manager.username as manager_name,
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
        const { name, email, phone, company, notes, assigned_user_id, group_id, status, priority } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const [result] = await pool.execute(
            `INSERT INTO customers
                (name, email, phone, company, notes, created_by, assigned_user_id, group_id, status, priority, internal_summary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                email || null,
                phone || null,
                company || null,
                notes || null,
                req.userId,
                assigned_user_id || req.userId,
                group_id || null,
                status || null,
                Number.isFinite(Number(priority)) ? Number(priority) : 0,
                notes || null
            ]
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

        const { name, email, phone, company, notes, assigned_user_id, group_id, status, priority } = req.body;
        await pool.execute(
            `UPDATE customers
             SET name = ?,
                 email = ?,
                 phone = ?,
                 company = ?,
                 notes = ?,
                 assigned_user_id = ?,
                 group_id = ?,
                 status = ?,
                 priority = ?,
                 internal_summary = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                name,
                email || null,
                phone || null,
                company || null,
                notes || null,
                assigned_user_id || null,
                group_id || null,
                status || null,
                Number.isFinite(Number(priority)) ? Number(priority) : 0,
                notes || null,
                req.params.id
            ]
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
                'UPDATE customers SET group_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [req.params.id, cid]
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
            WHERE c.group_id = ?
              AND ${getCustomerAccessCondition()}
            ORDER BY c.name ASC
        `, [req.params.id, req.userId, req.userId]);
        res.json({ customers });
    } catch (error) {
        console.error('Get group customers error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

const startCustomersBackgroundSync = () => {
    if (!config.sync.autoStart) return;

    runBackgroundSupplementalSync().catch((error) => {
        console.error('Initial background supplemental sync error:', error);
    });

    setInterval(() => {
        runBackgroundSupplementalSync().catch((error) => {
            console.error('Scheduled background supplemental sync error:', error);
        });
    }, config.sync.backgroundIntervalMs);
};

// Start
app.listen(config.port, () => {
    console.log(`\n✅ Auth service running on http://localhost:${config.port}`);
    console.log(`   Health: http://localhost:${config.port}/health\n`);
});

startCustomersBackgroundSync();


