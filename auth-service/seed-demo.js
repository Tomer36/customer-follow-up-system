import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import config from './config.js';

async function seed() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            database: config.db.name
        });

        console.log('Connected to database for seeding.');

        const [[usersCount]] = await connection.query('SELECT COUNT(*) as total FROM users');
        const [[customersCount]] = await connection.query('SELECT COUNT(*) as total FROM customers');
        const [[groupsCount]] = await connection.query('SELECT COUNT(*) as total FROM `groups`');
        if (usersCount.total === 0) {
            const passwordHash = await bcrypt.hash('pass123', 10);
            await connection.query(
                `INSERT INTO users (username, password) VALUES
                ('Admin User', ?),
                ('Follow-up Agent', ?),
                ('Sales Rep', ?)`,
                [passwordHash, passwordHash, passwordHash]
            );
            console.log('Seeded users.');
        } else {
            console.log('Users table is not empty. Skipping user seed.');
        }

        if (customersCount.total === 0) {
            await connection.query(`
                INSERT INTO customers (external_id, name, email, phone, company, notes) VALUES
                ('ext-1001', 'John Carter', 'john.carter@example.com', '+1-555-0101', 'Northwind LLC', 'Interested in annual plan.'),
                ('ext-1002', 'Mary Stone', 'mary.stone@example.com', '+1-555-0102', 'Acme Retail', 'Requested callback next week.'),
                ('ext-1003', 'Daniel Reed', 'daniel.reed@example.com', '+1-555-0103', 'Summit Logistics', 'Needs pricing proposal.'),
                ('ext-1004', 'Nina Lopez', 'nina.lopez@example.com', '+1-555-0104', 'Blue Harbor', 'Follow up after product demo.'),
                ('ext-1005', 'Omar Khan', 'omar.khan@example.com', '+1-555-0105', 'Green Valley Farms', 'Waiting for compliance documents.')
            `);
            console.log('Seeded customers.');
        } else {
            console.log('Customers table is not empty. Skipping customer seed.');
        }

        if (groupsCount.total === 0) {
            await connection.query(`
                INSERT INTO \`groups\` (name, color) VALUES
                ('VIP Leads', '#d35400'),
                ('Needs Follow-up', '#2980b9'),
                ('Cold Leads', '#7f8c8d')
            `);
            console.log('Seeded groups.');
        } else {
            console.log('Groups table is not empty. Skipping group seed.');
        }

        const [customerRows] = await connection.query('SELECT id FROM customers ORDER BY id ASC LIMIT 3');
        const [groupRows] = await connection.query('SELECT id FROM `groups` ORDER BY id ASC LIMIT 2');
        if (customerRows.length > 0 && groupRows.length > 0) {
            for (const customer of customerRows) {
                for (const group of groupRows) {
                    await connection.query(
                        'INSERT IGNORE INTO customer_groups (customer_id, group_id) VALUES (?, ?)',
                        [customer.id, group.id]
                    );
                }
            }
            console.log('Seeded customer_groups links.');
        }

        console.log('\nDemo seed completed.');
        console.log('Demo login: Admin User / pass123');
    } catch (error) {
        console.error('Seed failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

seed();
