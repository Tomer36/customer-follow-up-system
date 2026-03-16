import mysql from 'mysql2/promise';
import config from './config.js';

async function setup() {
    let connection;

    try {
        console.log('Setting up database...\n');

        connection = await mysql.createConnection({
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password
        });

        console.log('Connected to MySQL');

        await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.db.name}`);
        console.log(`Database '${config.db.name}' created`);

        await connection.query(`USE ${config.db.name}`);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_username (username)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Users table created');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`groups\` (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                color VARCHAR(7) DEFAULT '#3498db',
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Groups table created');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                external_id VARCHAR(128) UNIQUE,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                company VARCHAR(255),
                balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
                credit_limit DECIMAL(18, 2) NOT NULL DEFAULT 0,
                raw_payload JSON NULL,
                last_synced_at TIMESTAMP NULL,
                notes TEXT,
                created_by INT NULL,
                assigned_user_id INT NULL,
                group_id INT NULL,
                status VARCHAR(50) NULL,
                priority INT NOT NULL DEFAULT 0,
                internal_summary TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE SET NULL,
                INDEX idx_name (name),
                INDEX idx_assigned_user_id (assigned_user_id),
                INDEX idx_group_id (group_id),
                INDEX idx_status (status),
                FULLTEXT idx_search (name, company)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Customers table created');

        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS external_id VARCHAR(128) UNIQUE AFTER id
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS created_by INT NULL AFTER notes
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS assigned_user_id INT NULL AFTER created_by
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS group_id INT NULL AFTER assigned_user_id
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) NULL AFTER group_id
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0 AFTER status
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS internal_summary TEXT NULL AFTER priority
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS balance DECIMAL(18, 2) NOT NULL DEFAULT 0 AFTER company
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(18, 2) NOT NULL DEFAULT 0 AFTER balance
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS raw_payload JSON NULL AFTER credit_limit
        `);
        await connection.query(`
            ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP NULL AFTER raw_payload
        `);
        console.log('Customers external_id column checked');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS customer_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                note TEXT NOT NULL,
                due_date DATE,
                created_by INT NOT NULL,
                managed_by INT,
                group_id INT NULL,
                action_type ENUM('note', 'transfer') NOT NULL DEFAULT 'note',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (managed_by) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE SET NULL,
                INDEX idx_customer_created (customer_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Customer_notes table created');

        await connection.query(`
            ALTER TABLE customer_notes
            ADD COLUMN IF NOT EXISTS due_date DATE AFTER note
        `);
        await connection.query(`
            ALTER TABLE customer_notes
            ADD COLUMN IF NOT EXISTS managed_by INT AFTER created_by
        `);
        await connection.query(`
            ALTER TABLE customer_notes
            ADD COLUMN IF NOT EXISTS group_id INT NULL AFTER managed_by
        `);
        await connection.query(`
            ALTER TABLE customer_notes
            ADD COLUMN IF NOT EXISTS action_type ENUM('note', 'transfer') NOT NULL DEFAULT 'note' AFTER group_id
        `);
        console.log('Customer_notes due date and managed_by columns checked');

        console.log('\nSetup completed successfully!\n');

    } catch (error) {
        console.error('\nSetup failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

setup();
