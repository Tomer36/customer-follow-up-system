import dotenv from 'dotenv';
dotenv.config();

const config = {
    port: process.env.PORT || 3001,

    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || 'auth_db'
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'default_secret_change_me',
        expiresIn: '24h'
    },

    externalApi: {
        customersUrl: process.env.EXTERNAL_CUSTOMERS_API_URL || 'http://localhost:5000/hashAPI/route-hashAPI/175',
        customerDetailsUrl: process.env.EXTERNAL_CUSTOMER_DETAILS_API_URL || 'http://localhost:5000/hashAPI/route-hashAPI/184',
        token: process.env.EXTERNAL_CUSTOMERS_API_TOKEN || '',
        timeoutMs: parseInt(process.env.EXTERNAL_CUSTOMERS_API_TIMEOUT_MS || '30000')
    }
};

export default config;

