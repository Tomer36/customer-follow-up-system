import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auth API
export const authAPI = {
    register: async (email, password, fullName) => {
        const response = await api.post('/register', {
            email,
            password,
            full_name: fullName
        });
        return response.data;
    },

    login: async (email, password) => {
        const response = await api.post('/login', {
            email,
            password
        });
        return response.data;
    },

    getProfile: async () => {
        const response = await api.get('/me');
        return response.data;
    }
};

// Customers API
export const customersAPI = {
    getAll: (page = 1, search = '') =>
        api.get(`/customers?page=${page}&limit=20&search=${search}`).then(r => r.data),
    getById: (id) =>
        api.get(`/customers/${id}`).then(r => r.data),
    create: (data) =>
        api.post('/customers', data).then(r => r.data),
    update: (id, data) =>
        api.put(`/customers/${id}`, data).then(r => r.data),
    delete: (id) =>
        api.delete(`/customers/${id}`).then(r => r.data),
};

// Tasks API
export const tasksAPI = {
    getAll: (filters = {}) =>
        api.get('/tasks', { params: filters }).then(r => r.data),
    getDaily: () =>
        api.get('/tasks/daily').then(r => r.data),
    getOverdue: () =>
        api.get('/tasks/overdue').then(r => r.data),
    create: (data) =>
        api.post('/tasks', data).then(r => r.data),
    updateStatus: (id, status) =>
        api.patch(`/tasks/${id}/status`, { status }).then(r => r.data),
    update: (id, data) =>
        api.put(`/tasks/${id}`, data).then(r => r.data),
    delete: (id) =>
        api.delete(`/tasks/${id}`).then(r => r.data),
};

// Groups API
export const groupsAPI = {
    getAll: () =>
        api.get('/groups').then(r => r.data),
    create: (data) =>
        api.post('/groups', data).then(r => r.data),
    delete: (id) =>
        api.delete(`/groups/${id}`).then(r => r.data),
    getCustomers: (id) =>
        api.get(`/groups/${id}/customers`).then(r => r.data),
    addCustomers: (id, customerIds) =>
        api.post(`/groups/${id}/customers`, { customer_ids: customerIds }).then(r => r.data),
};

// Dashboard API
export const dashboardAPI = {
    getStats: () =>
        api.get('/dashboard/stats').then(r => r.data),
};

export default api;
