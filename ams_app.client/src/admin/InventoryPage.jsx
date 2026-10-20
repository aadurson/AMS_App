import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api';
import CrudPage from './CrudPage';
import { Modal, Thumb, Badge } from './ui';
import { formatDate } from './format';

const LOW_STOCK = 10;

const REASON_LABELS = {
    InitialStock: "Opening stock", Restock: "Restock", Sale: "Sold", OrderCancelled: "Order cancelled",
    Correction: "Count correction", Damaged: "Damaged / expired",
};

// The three ways an admin changes stock. "count" lets them enter what's on the shelf instead of doing the maths.
const ACTIONS = [
    { id: "restock", label: "Add new stock", help: "Stock received from a supplier.", reason: "Restock" },
    { id: "damaged", label: "Remove damaged / expired", help: "Items that can't be sold.", reason: "Damaged" },
    { id: "count", label: "Correct the count", help: "Enter how many are actually on the shelf.", reason: "Correction" },
];

const StockBadge = ({ stock }) =>
    stock === 0 ? <Badge tone="red">Out of stock</Badge>
        : stock < LOW_STOCK ? <Badge tone="amber">{stock} — low</Badge>
            : <Badge tone="green">{stock} in stock</Badge>;

export default function InventoryPage({ onError, notify, onChanged }) {
    const [adjusting, setAdjusting] = useState(null);
    const [history, setHistory] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const config = useMemo(() => ({
        title: "Inventory",
        singular: "Product",
        resource: { list: adminApi.inventory.list },
        canDelete: false,
        searchText: (p) => `${p.name} ${p.categoryName}`,
        tabs: [
            { label: "All", test: () => true },
            { label: "Low stock", test: (p) => p.stock > 0 && p.stock < LOW_STOCK },
            { label: "Out of stock", test: (p) => p.stock === 0 },
        ],
        columns: [
            {
                label: "Product", render: (p) => (
                    <div className="adm-cell-main"><Thumb src={p.imageUrl} />
                        <div><strong>{p.name}</strong><small>{p.categoryName}{!p.isActive && " · hidden from store"}</small></div>
                    </div>
                )
            },
            { label: "Stock", render: (p) => <StockBadge stock={p.stock} /> },
            { label: "Last change", render: (p) => p.lastMovementAt ? formatDate(p.lastMovementAt, true) : "—" },
        ],
        rowActions: (p) => <>
            <button className="adm-btn small ghost" onClick={() => setHistory(p)}>History</button>
            <button className="adm-btn small primary" onClick={() => setAdjusting(p)}>Adjust stock</button>
        </>,
    }), []);

    return (
        <>
            <CrudPage config={config} refreshKey={refreshKey} onError={onError} notify={notify} />
            {adjusting && <AdjustStock product={adjusting} onClose={() => setAdjusting(null)} onError={onError}
                onSaved={(stock) => {
                    notify(`Stock updated — ${adjusting.name} now has ${stock}`);
                    setAdjusting(null);
                    setRefreshKey(k => k + 1);
                    onChanged?.();
                }} />}
            {history && <StockHistory product={history} onClose={() => setHistory(null)} onError={onError} />}
        </>
    );
}

function AdjustStock({ product, onClose, onSaved, onError }) {
    const [action, setAction] = useState("restock");
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const n = amount === "" ? null : Math.floor(Number(amount));
    const change = n == null || Number.isNaN(n) ? 0
        : action === "restock" ? n
            : action === "damaged" ? -n
                : n - product.stock; // count: the new total
    const newStock = product.stock + change;
    const chosen = ACTIONS.find(a => a.id === action);

    const submit = async (e) => {
        e.preventDefault();
        if (change === 0) { setError(action === "count" ? "That's already the current stock." : "Enter a quantity greater than zero."); return; }
        if (newStock < 0) { setError(`You can't remove more than the ${product.stock} in stock.`); return; }
        setBusy(true);
        setError("");
        try {
            const result = await adminApi.inventory.adjust(product.id, change, chosen.reason, note.trim() || null);
            onSaved(result.stock);
        } catch (err) {
            if (err.status === 401) onError(err); else setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title="Adjust stock" onClose={onClose} footer={<>
            <button type="button" className="adm-btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" form="adjust-form" className="adm-btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </>}>
            <form id="adjust-form" className="adm-adjust" onSubmit={submit}>
                <div className="adm-cell-main"><Thumb src={product.imageUrl} />
                    <div><strong>{product.name}</strong><small>Currently {product.stock} in stock</small></div>
                </div>
                {error && <p className="adm-alert" role="alert">{error}</p>}
                <fieldset className="adm-choices">
                    <legend>What happened?</legend>
                    {ACTIONS.map(a => (
                        <label key={a.id} className={action === a.id ? "selected" : ""}>
                            <input type="radio" name="action" value={a.id} checked={action === a.id}
                                onChange={() => { setAction(a.id); setAmount(""); setError(""); }} />
                            <span><strong>{a.label}</strong><small>{a.help}</small></span>
                        </label>
                    ))}
                </fieldset>
                <div className="adm-field">
                    <label htmlFor="adjust-amount">{action === "count" ? "Actual quantity on the shelf" : "Quantity"}</label>
                    <input id="adjust-amount" type="number" min={action === "count" ? 0 : 1} step={1} required
                        max={action === "damaged" ? product.stock : undefined} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="adm-field">
                    <label htmlFor="adjust-note">Note</label>
                    <input id="adjust-note" maxLength={300} placeholder="Optional — e.g. supplier invoice no." value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                {change !== 0 && (
                    <p className={`adm-stock-preview ${newStock < 0 ? "bad" : ""}`}>
                        {product.stock} → <strong>{newStock}</strong> ({change > 0 ? "+" : ""}{change})
                    </p>
                )}
            </form>
        </Modal>
    );
}

function StockHistory({ product, onClose, onError }) {
    const [rows, setRows] = useState(null);
    useEffect(() => { adminApi.inventory.movements(product.id).then(setRows).catch(onError); }, [product.id, onError]);

    return (
        <Modal wide title={`Stock history — ${product.name}`} onClose={onClose}>
            {!rows ? <p className="adm-muted">Loading…</p>
                : rows.length === 0 ? <p className="adm-muted">No stock changes recorded yet.</p>
                    : (
                        <table className="adm-table">
                            <thead><tr><th>Date</th><th>Change</th><th>Reason</th><th>Stock after</th><th>Details</th></tr></thead>
                            <tbody>
                                {rows.map(m => (
                                    <tr key={m.id}>
                                        <td data-label="Date">{formatDate(m.createdAt, true)}</td>
                                        <td data-label="Change"><span className={m.change > 0 ? "adm-plus" : "adm-minus"}>{m.change > 0 ? "+" : ""}{m.change}</span></td>
                                        <td data-label="Reason">{REASON_LABELS[m.reason] ?? m.reason}</td>
                                        <td data-label="Stock after">{m.stockAfter}</td>
                                        <td data-label="Details" className="wrap">
                                            {[m.orderNumber && `Order ${m.orderNumber}`, m.note, m.createdBy && `by ${m.createdBy}`].filter(Boolean).join(" · ") || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
        </Modal>
    );
}
