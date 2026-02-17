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
        const [[tasksCount]] = await connection.query('SELECT COUNT(*) as total FROM tasks');

        if (usersCount.total === 0) {
            const passwordHash = await bcrypt.hash('pass123', 10);
            await connection.query(
                `INSERT INTO users (email, password, full_name) VALUES
                ('admin@example.com', ?, 'Admin User'),
                ('agent@example.com', ?, 'Follow-up Agent'),
                ('sales@example.com', ?, 'Sales Rep')`,
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

        if (tasksCount.total === 0) {
            const [users] = await connection.query('SELECT id, email FROM users ORDER BY id ASC');
            const [customers] = await connection.query('SELECT id FROM customers ORDER BY id ASC');
            const [groups] = await connection.query('SELECT id FROM `groups` ORDER BY id ASC');

            if (users.length > 0 && customers.length > 0) {
                const createdBy = users[0].id;
                const groupA = groups[0]?.id || null;
                const groupB = groups[1]?.id || null;

                await connection.query(
                    `INSERT INTO tasks (customer_id, group_id, title, description, status, priority, due_date, created_by) VALUES
                    (?, ?, 'Call to confirm requirements', 'Review requested features and timeline.', 'open', 'high', CURDATE(), ?),
                    (?, ?, 'Send pricing proposal', 'Include enterprise package discount.', 'open', 'urgent', DATE_ADD(CURDATE(), INTERVAL 1 DAY), ?),
                    (?, ?, 'Check legal documents', 'Confirm NDA has been signed.', 'postponed', 'medium', DATE_ADD(CURDATE(), INTERVAL 3 DAY), ?),
                    (?, ?, 'Re-engage cold lead', 'Share latest product case study.', 'done', 'low', DATE_SUB(CURDATE(), INTERVAL 2 DAY), ?)`,
                    [
                        customers[0].id, groupA, createdBy,
                        customers[1].id, groupA, createdBy,
                        customers[2].id, groupB, createdBy,
                        customers[3].id, groupB, createdBy
                    ]
                );
                console.log('Seeded tasks.');
            } else {
                console.log('Missing users/customers. Skipped task seed.');
            }
        } else {
            console.log('Tasks table is not empty. Skipping task seed.');
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
        console.log('Demo login: admin@example.com / pass123');
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
