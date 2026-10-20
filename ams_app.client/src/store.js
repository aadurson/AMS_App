// Shared store constants and helpers.

// Store settings. These defaults are replaced by the server's values (GET /api/store/config) when the app loads,
// so delivery charges and payment options are configured in one place: AMS_App.Server/appsettings.json.
export const storeConfig = {
    freeShippingThreshold: 999,
    shippingFee: 49,
    upiEnabled: false,
    upiProvider: null,
    upiTestMode: false,
    paymentWindowMinutes: 15,
};
export const applyStoreConfig = (config) => Object.assign(storeConfig, config);

export const MAX_PER_ITEM = 10;

export const rupees = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const shippingFor = (subtotal) =>
    (subtotal >= storeConfig.freeShippingThreshold || subtotal === 0 ? 0 : storeConfig.shippingFee);

// An order waiting for UPI payment, kept for this browser tab so a refresh doesn't lose it.
const PENDING_KEY = "anaya.pendingPayment";
export const loadPendingPayment = () => {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null"); } catch { return null; }
};
export const savePendingPayment = (value) => {
    try {
        if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
        else sessionStorage.removeItem(PENDING_KEY);
    } catch { /* ignore */ }
};

export const PAYMENT_LABELS = {
    NotRequired: "Cash on Delivery", Pending: "Awaiting payment", Paid: "Paid", Expired: "Payment not completed", RefundDue: "Refund due", Refunded: "Refunded",
};

/** How many of a product can go in the bag: the per-item limit, or fewer if stock is low. */
export const maxQtyFor = (product) => Math.min(MAX_PER_ITEM, product?.stockLeft ?? MAX_PER_ITEM);

const BAG_KEY = "anaya.bag";

// The bag is kept in this browser so it survives a refresh. Storage can be unavailable (private mode), so fail quietly.
export const loadBag = () => {
    try {
        const items = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
        if (!Array.isArray(items)) return [];
        // Merge any duplicate lines for the same product.
        const merged = new Map();
        for (const i of items.filter(i => i && i.id && i.qty > 0))
            merged.set(i.id, merged.has(i.id) ? { ...i, qty: merged.get(i.id).qty + i.qty } : i);
        return [...merged.values()];
    } catch {
        return [];
    }
};

export const saveBag = (items) => {
    try { localStorage.setItem(BAG_KEY, JSON.stringify(items)); } catch { /* ignore */ }
};

export const INDIAN_STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
    "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export const STATUS_STEPS = ["Pending", "Confirmed", "Shipped", "Delivered"];
export const STATUS_LABELS = {
    Pending: "Order placed", Confirmed: "Confirmed", Shipped: "Shipped", Delivered: "Delivered", Cancelled: "Cancelled",
};
