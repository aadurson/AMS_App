import { useCallback, useEffect, useState } from 'react';
import { adminApi, authApi } from '../api';
import CrudPage from './CrudPage';
import { productsConfig, categoriesConfig, testimonialsConfig, subscribersConfig } from './resources';
import OrdersPage from './OrdersPage';
import InventoryPage from './InventoryPage';
import { rupees } from './format';
import {
    GridIcon, BagIcon, TagIcon, StarIcon, MailIcon, UserIcon, LogoutIcon, StoreIcon, LockIcon, MenuIcon, CloseIcon, CheckIcon,
    TruckIcon, BoxIcon
} from '../components/icons';
import './admin.css';

const SECTIONS = [
    { id: "dashboard", label: "Dashboard", icon: GridIcon },
    { id: "orders", label: "Orders", icon: TruckIcon },
    { id: "products", label: "Products", icon: BagIcon },
    { id: "inventory", label: "Inventory", icon: BoxIcon },
    { id: "categories", label: "Categories", icon: TagIcon },
    { id: "reviews", label: "Reviews", icon: StarIcon },
    { id: "subscribers", label: "Subscribers", icon: MailIcon },
    { id: "account", label: "Account", icon: UserIcon },
];

const sectionFromHash = () => {
    const id = window.location.hash.replace("#", "");
    return SECTIONS.some(s => s.id === id) ? id : "dashboard";
};

export default function AdminApp() {
    const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
    const [section, setSection] = useState(sectionFromHash);
    const [toast, setToast] = useState(null);
    const [navOpen, setNavOpen] = useState(false);
    const [dashboardKey, setDashboardKey] = useState(0);

    useEffect(() => {
        document.title = "Admin · Anaya Cosmetics";
        authApi.me().then(setUser).catch(() => setUser(null));
        const onHash = () => setSection(sectionFromHash());
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    const notify = useCallback((message, tone = "success") => setToast({ message, tone }), []);

    // Any 401 means the session expired: send the admin back to the login screen.
    const onError = useCallback((err) => {
        if (err?.status === 401) { setUser(null); notify("Your session has expired. Please sign in again.", "error"); }
        else notify(err?.message || "Something went wrong.", "error");
    }, [notify]);

    const logout = async () => {
        await authApi.logout().catch(() => { });
        setUser(null);
    };

    if (user === undefined) return <div className="adm-center"><p className="adm-muted">Loading…</p></div>;

    return (
        <div className="adm">
            {user === null
                ? <Login onSignedIn={setUser} />
                : (
                    <div className="adm-shell">
                        <aside className={`adm-sidebar ${navOpen ? "open" : ""}`}>
                            <a className="adm-brand" href="/admin#dashboard"><span>❀</span> Anaya <small>Admin</small></a>
                            <nav aria-label="Admin">
                                {SECTIONS.map(({ id, label, icon: Icon }) => (
                                    <a key={id} href={`#${id}`} className={section === id ? "active" : ""} aria-current={section === id ? "page" : undefined}
                                        onClick={() => setNavOpen(false)}>
                                        <Icon size={18} /> {label}
                                    </a>
                                ))}
                            </nav>
                            <div className="adm-sidebar-foot">
                                <a href="/" target="_blank" rel="noreferrer"><StoreIcon size={18} /> View store</a>
                                <button onClick={logout}><LogoutIcon size={18} /> Sign out</button>
                            </div>
                        </aside>
                        {navOpen && <div className="adm-scrim" onClick={() => setNavOpen(false)} />}

                        <div className="adm-main">
                            <header className="adm-topbar">
                                <button className="adm-icon-btn adm-menu" aria-label={navOpen ? "Close menu" : "Open menu"} onClick={() => setNavOpen(!navOpen)}>
                                    {navOpen ? <CloseIcon /> : <MenuIcon />}
                                </button>
                                <span className="adm-topbar-title">{SECTIONS.find(s => s.id === section).label}</span>
                                <span className="adm-user"><UserIcon size={16} /> {user.email}</span>
                            </header>

                            <main className="adm-content">
                                {section === "dashboard" && <Dashboard key={dashboardKey} onError={onError} />}
                                {section === "orders" && <OrdersPage onError={onError} notify={notify} onChanged={() => setDashboardKey(k => k + 1)} />}
                                {section === "inventory" && <InventoryPage onError={onError} notify={notify} onChanged={() => setDashboardKey(k => k + 1)} />}
                                {section === "products" && <ProductsPage onError={onError} notify={notify} onChanged={() => setDashboardKey(k => k + 1)} />}
                                {section === "categories" && <CrudPage config={categoriesConfig} onError={onError} notify={notify} onChanged={() => setDashboardKey(k => k + 1)} />}
                                {section === "reviews" && <CrudPage config={testimonialsConfig} onError={onError} notify={notify} onChanged={() => setDashboardKey(k => k + 1)} />}
                                {section === "subscribers" && <CrudPage config={subscribersConfig} onError={onError} notify={notify} onChanged={() => setDashboardKey(k => k + 1)} />}
                                {section === "account" && <Account user={user} notify={notify} onError={onError} />}
                            </main>
                        </div>
                    </div>
                )}

            {toast && (
                <div className={`adm-toast ${toast.tone}`} role="status">
                    {toast.tone === "success" && <CheckIcon size={18} />} {toast.message}
                </div>
            )}
        </div>
    );
}

function Login({ onSignedIn }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            onSignedIn(await authApi.login(email, password, remember));
        } catch (err) {
            setError(err.message);
            setPassword("");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="adm-center adm-login-bg">
            <form className="adm-login" onSubmit={submit}>
                <div className="adm-login-logo"><span>❀</span>Anaya<small>COSMETICS · ADMIN</small></div>
                <h1>Welcome back</h1>
                <p className="adm-muted">Sign in to manage your store.</p>
                {error && <p className="adm-alert" role="alert">{error}</p>}
                <div className="adm-field">
                    <label htmlFor="login-email">Email</label>
                    <input id="login-email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="adm-field">
                    <label htmlFor="login-password">Password</label>
                    <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <label className="adm-check">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    <span>Keep me signed in</span>
                </label>
                <button className="adm-btn primary block" disabled={busy}><LockIcon size={16} /> {busy ? "Signing in…" : "Sign in"}</button>
                <a className="adm-back" href="/">← Back to store</a>
            </form>
        </div>
    );
}

function Dashboard({ onError }) {
    const [stats, setStats] = useState(null);

    useEffect(() => { adminApi.dashboard().then(setStats).catch(onError); }, [onError]);

    const cards = stats && [
        { label: "New orders", value: stats.pendingOrders, note: "Waiting for you to confirm", href: "#orders", icon: TruckIcon, alert: stats.pendingOrders > 0 },
        { label: "Orders today", value: stats.ordersToday, note: "Excluding cancelled", href: "#orders", icon: BagIcon },
        { label: "Total sales", value: rupees(stats.revenue), note: "Cash on delivery + paid UPI, excluding cancelled", href: "#orders", icon: CheckIcon },
        ...(stats.awaitingPayment > 0 ? [{ label: "Awaiting payment", value: stats.awaitingPayment, note: "UPI orders not paid yet", href: "#orders", icon: LockIcon }] : []),
        ...(stats.refundsDue > 0 ? [{ label: "Refunds due", value: stats.refundsDue, note: "Refund from the gateway dashboard", href: "#orders", icon: MailIcon, alert: true }] : []),
        { label: "Low stock", value: stats.lowStock, note: "Visible products with fewer than 10 left", href: "#inventory", icon: BoxIcon, alert: stats.lowStock > 0 },
        { label: "Products", value: stats.products, note: `${stats.activeProducts} visible in store`, href: "#products", icon: TagIcon },
        { label: "Categories", value: stats.categories, note: "Shown on home page", href: "#categories", icon: GridIcon },
        { label: "Reviews", value: stats.testimonials, note: `${stats.pendingTestimonials} waiting for approval`, href: "#reviews", icon: StarIcon, alert: stats.pendingTestimonials > 0 },
        { label: "Subscribers", value: stats.subscribers, note: "Newsletter sign-ups", href: "#subscribers", icon: MailIcon },
    ];

    return (
        <section>
            <div className="adm-page-head"><div><h1>Dashboard</h1><p>A quick look at your store.</p></div></div>
            {!stats ? <p className="adm-muted">Loading…</p> : (
                <div className="adm-stats">
                    {cards.map(({ label, value, note, href, icon: Icon, alert }) => (
                        <a key={label} href={href} className={`adm-card adm-stat ${alert ? "alert" : ""}`}>
                            <span className="adm-stat-icon"><Icon size={20} /></span>
                            <span className="adm-stat-label">{label}</span>
                            <strong>{value}</strong>
                            <small>{note}</small>
                        </a>
                    ))}
                </div>
            )}
            <div className="adm-card adm-quick">
                <h2>Quick actions</h2>
                <div>
                    <a className="adm-btn ghost" href="#orders">Process orders</a>
                    <a className="adm-btn ghost" href="#inventory">Update stock</a>
                    <a className="adm-btn ghost" href="#products">Manage products</a>
                    <a className="adm-btn ghost" href="#reviews">Review customer feedback</a>
                    <a className="adm-btn ghost" href="/" target="_blank" rel="noreferrer">Open the store</a>
                </div>
            </div>
        </section>
    );
}

function ProductsPage(props) {
    const [categories, setCategories] = useState([]);
    const { onError } = props;
    useEffect(() => { adminApi.categories.list().then(setCategories).catch(onError); }, [onError]);
    return <CrudPage config={productsConfig} context={{ categories }} {...props} />;
}

function Account({ user, notify, onError }) {
    const [form, setForm] = useState({ current: "", next: "", confirm: "" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        if (form.next !== form.confirm) { setError("The new passwords don't match."); return; }
        setBusy(true);
        setError("");
        try {
            await authApi.changePassword(form.current, form.next);
            setForm({ current: "", next: "", confirm: "" });
            notify("Password changed");
        } catch (err) {
            if (err.status === 401) onError(err); else setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section>
            <div className="adm-page-head"><div><h1>Account</h1><p>Signed in as {user.email}</p></div></div>
            <form className="adm-card adm-form narrow" onSubmit={submit}>
                <h2 className="full">Change password</h2>
                {error && <p className="adm-alert full" role="alert">{error}</p>}
                <div className="adm-field full">
                    <label htmlFor="pw-current">Current password</label>
                    <input id="pw-current" type="password" autoComplete="current-password" required value={form.current} onChange={set("current")} />
                </div>
                <div className="adm-field full">
                    <label htmlFor="pw-new">New password</label>
                    <input id="pw-new" type="password" autoComplete="new-password" required minLength={8} value={form.next} onChange={set("next")} />
                    <small>At least 8 characters, with upper and lower case letters, a number and a symbol.</small>
                </div>
                <div className="adm-field full">
                    <label htmlFor="pw-confirm">Confirm new password</label>
                    <input id="pw-confirm" type="password" autoComplete="new-password" required value={form.confirm} onChange={set("confirm")} />
                </div>
                <div className="full"><button className="adm-btn primary" disabled={busy}>{busy ? "Saving…" : "Update password"}</button></div>
            </form>
        </section>
    );
}
