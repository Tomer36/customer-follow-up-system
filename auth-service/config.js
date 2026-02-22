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
        report175Url: process.env.EXTERNAL_REPORT_175_API_URL || process.env.EXTERNAL_CUSTOMERS_API_URL || 'http://localhost:5000/hashAPI/route-hashAPI/175',
        report198Url: process.env.EXTERNAL_REPORT_198_API_URL || 'http://localhost:5000/hashAPI/route-hashAPI/198',
        report176Url: process.env.EXTERNAL_REPORT_176_API_URL || 'http://localhost:5000/hashAPI/route-hashAPI/176',
        customerDetailsUrl: process.env.EXTERNAL_CUSTOMER_DETAILS_API_URL || 'http://localhost:5000/hashAPI/route-hashAPI/184',
        token: process.env.EXTERNAL_CUSTOMERS_API_TOKEN || '',
        timeoutMs: parseInt(process.env.EXTERNAL_CUSTOMERS_API_TIMEOUT_MS || '30000'),
        report198TimeoutMs: parseInt(process.env.EXTERNAL_REPORT_198_TIMEOUT_MS || process.env.EXTERNAL_CUSTOMERS_API_TIMEOUT_MS || '120000')
    }
};

export default config;

