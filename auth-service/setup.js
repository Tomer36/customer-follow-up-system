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
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Users table created');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                external_id VARCHAR(128) UNIQUE,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                company VARCHAR(255),
                notes TEXT,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_name (name),
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
        console.log('Customers external_id column checked');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`groups\` (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                color VARCHAR(7) DEFAULT '#3498db',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Groups table created');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                group_id INT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status ENUM('open', 'done', 'postponed') DEFAULT 'open',
                priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
                due_date DATE NOT NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE SET NULL,
                INDEX idx_status_due (status, due_date),
                INDEX idx_customer (customer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Tasks table created');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS customer_groups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                group_id INT NOT NULL,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
                UNIQUE KEY unique_pair (customer_id, group_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Customer_groups table created');

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
