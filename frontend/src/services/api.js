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

// Users API
export const usersAPI = {
    getAll: () =>
        api.get('/users').then(r => r.data),
};

// Customers API
export const customersAPI = {
    getAll: (page = 1, search = '', limit = 20) =>
        api.get(`/customers?page=${page}&limit=${limit}&search=${search}`).then(r => r.data),
    getReport175: (page = 1, search = '', limit = 20, filters = {}) =>
        api.get('/customers/reports/175', {
            params: {
                page,
                limit,
                search,
                balanceMode: filters.balanceMode || 'balance_non_zero',
                ...(filters.managedBy ? { managedBy: filters.managedBy } : {}),
                ...(filters.groupId ? { groupId: filters.groupId } : {})
            }
        }).then(r => r.data),
    getById: (id) =>
        api.get(`/customers/${id}`).then(r => r.data),
    getBasicReports: (id) =>
        api.get(`/customers/${id}/basic-reports`).then(r => r.data),
    getReport180: (id) =>
        api.get(`/customers/${id}/report-180`).then(r => r.data),
    getNotes: (id) =>
        api.get(`/customers/${id}/notes`).then(r => r.data),
    getTransfers: (id) =>
        api.get(`/customers/${id}/transfers`).then(r => r.data),
    addNote: (id, payload) =>
        api.post(`/customers/${id}/notes`, payload).then(r => r.data),
    addTransfer: (id, payload) =>
        api.post(`/customers/${id}/transfers`, payload).then(r => r.data),
    getGroups: (id) =>
        api.get(`/customers/${id}/groups`).then(r => r.data),
    assignGroup: (id, groupId) =>
        api.post(`/customers/${id}/groups`, { group_id: groupId }).then(r => r.data),
    sync: () =>
        api.post('/customers/sync').then(r => r.data),
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
    getById: (id) =>
        api.get(`/tasks/${id}`).then(r => r.data),
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
