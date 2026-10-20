import { adminApi } from '../api';
import { formatDate, rupees } from './format';
import { Thumb, Badge } from './ui';

const LOW_STOCK = 10;
const num = (v) => (v === "" || v == null ? null : Number(v));

export const productsConfig = {
    title: "Products",
    singular: "Product",
    resource: adminApi.products,
    searchText: (p) => `${p.name} ${p.categoryName} ${p.tag ?? ""}`,
    tabs: [
        { label: "All", test: () => true },
        { label: "Visible", test: (p) => p.isActive },
        { label: "Hidden", test: (p) => !p.isActive },
        { label: "Low stock", test: (p) => p.stock < LOW_STOCK },
    ],
    columns: [
        {
            label: "Product", render: (p) => (
                <div className="adm-cell-main"><Thumb src={p.imageUrl} />
                    <div><strong>{p.name}</strong><small>{p.categoryName}{p.tag && <> · {p.tag}</>}</small></div>
                </div>
            )
        },
        { label: "Price", render: (p) => <span>{rupees(p.price)}{p.mrp > p.price && <small className="adm-strike">{rupees(p.mrp)}</small>}</span> },
        { label: "Stock", render: (p) => p.stock === 0 ? <Badge tone="red">Out of stock</Badge> : p.stock < LOW_STOCK ? <Badge tone="amber">{p.stock} left</Badge> : p.stock },
        { label: "Status", render: (p) => p.isActive ? <Badge tone="green">Visible</Badge> : <Badge tone="gray">Hidden</Badge> },
    ],
    rowActions: (p, quickSave) => (
        <button className="adm-btn small ghost" onClick={() => quickSave(p, productsConfig.toInput(productsConfig.toForm({ ...p, isActive: !p.isActive })),
            p.isActive ? "Product hidden from store" : "Product is now visible")}>
            {p.isActive ? "Hide" : "Show"}
        </button>
    ),
    emptyForm: { name: "", categoryId: "", price: "", mrp: "", stock: 0, rating: 0, reviewCount: 0, tag: "", imageUrl: "", description: "", isActive: true },
    toForm: (p) => ({ name: p.name, categoryId: p.categoryId, price: p.price, mrp: p.mrp ?? "", stock: p.stock, rating: p.rating,
        reviewCount: p.reviewCount, tag: p.tag ?? "", imageUrl: p.imageUrl ?? "", description: p.description ?? "", isActive: p.isActive }),
    toInput: (f) => ({ ...f, categoryId: num(f.categoryId) ?? 0, price: num(f.price) ?? 0, mrp: num(f.mrp), stock: num(f.stock) ?? 0,
        rating: num(f.rating) ?? 0, reviewCount: num(f.reviewCount) ?? 0, tag: f.tag || null, imageUrl: f.imageUrl || null, description: f.description || null }),
    fields: ({ categories, isNew }) => [
        { name: "name", label: "Product name", required: true, maxLength: 200, full: true },
        { name: "categoryId", label: "Category", type: "select", required: true, options: categories.map(c => ({ value: c.id, label: c.name })) },
        { name: "tag", label: "Badge", maxLength: 30, placeholder: "e.g. New, Bestseller", help: "Optional label shown on the product photo." },
        { name: "price", label: "Selling price (₹)", type: "number", required: true, min: 0, step: "0.01" },
        { name: "mrp", label: "MRP (₹)", type: "number", min: 0, step: "0.01", help: "Optional. If higher than the price, a discount is shown." },
        isNew
            ? { name: "stock", label: "Opening stock", type: "number", required: true, min: 0, step: 1, help: "Later changes are made on the Inventory page." }
            : { name: "stock", label: "Stock", type: "number", disabled: true, help: "Change stock on the Inventory page so every change is recorded." },
        { name: "rating", label: "Rating (0–5)", type: "number", min: 0, max: 5, step: "0.1" },
        { name: "reviewCount", label: "Number of reviews", type: "number", min: 0, step: 1 },
        { name: "imageUrl", label: "Image URL", type: "url", maxLength: 500, placeholder: "https://…", full: true },
        { name: "description", label: "Description", type: "textarea", maxLength: 2000, full: true },
        { name: "isActive", label: "Show this product in the store", type: "checkbox", full: true },
    ],
};

export const categoriesConfig = {
    title: "Categories",
    singular: "Category",
    resource: adminApi.categories,
    searchText: (c) => `${c.name} ${c.subtitle ?? ""}`,
    columns: [
        { label: "Category", render: (c) => <div className="adm-cell-main"><Thumb src={c.imageUrl} /><div><strong>{c.name}</strong><small>{c.subtitle}</small></div></div> },
        { label: "Products", render: (c) => c.productCount },
        { label: "Order", render: (c) => c.sortOrder },
    ],
    deleteWarning: (c) => c.productCount > 0
        ? `"${c.name}" still has ${c.productCount} product(s). Move or delete them first — the server will refuse to delete it.`
        : `"${c.name}" will be removed. This can't be undone.`,
    emptyForm: { name: "", subtitle: "", imageUrl: "", sortOrder: 0 },
    toForm: (c) => ({ name: c.name, subtitle: c.subtitle ?? "", imageUrl: c.imageUrl ?? "", sortOrder: c.sortOrder }),
    toInput: (f) => ({ name: f.name, subtitle: f.subtitle || null, imageUrl: f.imageUrl || null, sortOrder: num(f.sortOrder) ?? 0 }),
    fields: () => [
        { name: "name", label: "Name", required: true, maxLength: 80 },
        { name: "sortOrder", label: "Display order", type: "number", step: 1, help: "Lower numbers appear first." },
        { name: "subtitle", label: "Subtitle", maxLength: 160, full: true, placeholder: "e.g. Serums, creams & cleansers" },
        { name: "imageUrl", label: "Image URL", type: "url", maxLength: 500, placeholder: "https://…", full: true },
    ],
};

export const testimonialsConfig = {
    title: "Reviews",
    singular: "Review",
    resource: adminApi.testimonials,
    searchText: (t) => `${t.customerName} ${t.text}`,
    tabs: [
        { label: "All", test: () => true },
        { label: "Pending", test: (t) => !t.isApproved },
        { label: "Approved", test: (t) => t.isApproved },
    ],
    columns: [
        { label: "Customer", render: (t) => <div><strong>{t.customerName}</strong><small className="adm-stars">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</small></div> },
        { label: "Review", className: "wrap", render: (t) => <span className="adm-clamp">{t.text}</span> },
        { label: "Date", render: (t) => formatDate(t.createdAt) },
        { label: "Status", render: (t) => t.isApproved ? <Badge tone="green">Approved</Badge> : <Badge tone="amber">Pending</Badge> },
    ],
    rowActions: (t, quickSave) => (
        <button className="adm-btn small ghost" onClick={() => quickSave(t, testimonialsConfig.toInput({ ...testimonialsConfig.toForm(t), isApproved: !t.isApproved }),
            t.isApproved ? "Review hidden from store" : "Review approved")}>
            {t.isApproved ? "Unapprove" : "Approve"}
        </button>
    ),
    emptyForm: { customerName: "", text: "", rating: 5, isApproved: true },
    toForm: (t) => ({ customerName: t.customerName, text: t.text, rating: t.rating, isApproved: t.isApproved }),
    toInput: (f) => ({ ...f, rating: num(f.rating) ?? 5 }),
    fields: () => [
        { name: "customerName", label: "Customer name", required: true, maxLength: 100 },
        { name: "rating", label: "Rating (1–5)", type: "number", required: true, min: 1, max: 5, step: 1 },
        { name: "text", label: "Review", type: "textarea", required: true, maxLength: 1000, full: true },
        { name: "isApproved", label: "Show this review on the home page", type: "checkbox", full: true },
    ],
};

const downloadCsv = (rows) => {
    const csv = ["Email,Subscribed", ...rows.map(s => `"${s.email.replace(/"/g, '""')}",${s.subscribedAt}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "subscribers.csv" });
    a.click();
    URL.revokeObjectURL(url);
};

export const subscribersConfig = {
    title: "Subscribers",
    singular: "Subscriber",
    resource: adminApi.subscribers,
    searchText: (s) => s.email,
    columns: [
        { label: "Email", render: (s) => <a className="adm-link" href={`mailto:${s.email}`}>{s.email}</a> },
        { label: "Subscribed", render: (s) => formatDate(s.subscribedAt) },
    ],
    deleteWarning: (s) => `${s.email} will be removed from the newsletter list.`,
    toolbarExtra: (rows) => <button className="adm-btn ghost" disabled={rows.length === 0} onClick={() => downloadCsv(rows)}>Export CSV</button>,
};
