// Thin wrapper around the ASP.NET Core API. In development Vite proxies /api to the backend.
export class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

async function request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options,
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
        const message = data?.errors ? Object.values(data.errors).flat()[0] : data?.message || data?.title;
        throw new ApiError(message || defaultMessage(response.status), response.status, data);
    }
    return data;
}

const defaultMessage = (status) =>
    status === 401 ? "Please sign in again." :
    status === 403 ? "You don't have permission to do that." :
    status === 404 ? "That item no longer exists." :
    `Something went wrong (${status}). Please try again.`;

const send = (method) => (path, body) => request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const post = send("POST"), put = send("PUT"), del = send("DELETE");

export const api = {
    getCategories: () => request("/categories"),
    getProducts: () => request("/products"),
    getTestimonials: () => request("/testimonials"),
    subscribe: (email) => post("/newsletter", { email }),
    getStoreConfig: () => request("/store/config"),
    placeOrder: (order) => post("/orders", order),
    startPayment: (orderNumber, phone) => post(`/orders/${encodeURIComponent(orderNumber)}/payment`, { phone }),
    verifyPayment: (orderNumber, result) => post(`/orders/${encodeURIComponent(orderNumber)}/payment/verify`, result),
    simulatorPay: (gatewayOrderId, vpa) => post("/payments/simulator/pay", { gatewayOrderId, vpa }),
    trackOrder: (orderNumber, phone) =>
        request(`/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`),
};

export const authApi = {
    me: () => request("/auth/me"),
    login: (email, password, rememberMe) => post("/auth/login", { email, password, rememberMe }),
    logout: () => post("/auth/logout"),
    changePassword: (currentPassword, newPassword) => post("/auth/change-password", { currentPassword, newPassword }),
};

// Generic CRUD helpers for /api/admin/<resource>
const resource = (name) => ({
    list: () => request(`/admin/${name}`),
    create: (item) => post(`/admin/${name}`, item),
    update: (id, item) => put(`/admin/${name}/${id}`, item),
    remove: (id) => del(`/admin/${name}/${id}`),
});

export const adminApi = {
    dashboard: () => request("/admin/dashboard"),
    products: resource("products"),
    categories: resource("categories"),
    testimonials: resource("testimonials"),
    subscribers: resource("subscribers"),
    orders: {
        list: () => request("/admin/orders"),
        get: (id) => request(`/admin/orders/${id}`),
        setStatus: (id, status) => put(`/admin/orders/${id}/status`, { status }),
    },
    inventory: {
        list: () => request("/admin/inventory"),
        movements: (productId) => request(`/admin/inventory/${productId}/movements`),
        adjust: (productId, change, reason, note) => post(`/admin/inventory/${productId}/adjust`, { change, reason, note }),
    },
};
