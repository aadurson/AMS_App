import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api';
import CrudPage from './CrudPage';
import { Modal, ConfirmDialog, Badge } from './ui';
import { formatDate, rupees } from './format';

const STATUS_TONES = { Pending: "amber", Confirmed: "blue", Shipped: "purple", Delivered: "green", Cancelled: "gray" };
const ACTION_LABELS = { Confirmed: "Confirm order", Shipped: "Mark as shipped", Delivered: "Mark as delivered", Cancelled: "Cancel order" };
const STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];

const PAYMENT_TONES = { Pending: "amber", Paid: "green", Expired: "gray", RefundDue: "red", Refunded: "blue" };
const PAYMENT_LABELS = { Pending: "Awaiting payment", Paid: "Paid", Expired: "Not paid", RefundDue: "Refund due", Refunded: "Refunded" };
const PaymentBadge = ({ method, status }) => method !== "Upi"
    ? <Badge tone="gray">COD</Badge>
    : <Badge tone={PAYMENT_TONES[status]}>UPI · {PAYMENT_LABELS[status]}</Badge>;

const StatusBadge = ({ status }) => <Badge tone={STATUS_TONES[status]}>{status}</Badge>;

export default function OrdersPage({ onError, notify, onChanged }) {
    const [viewingId, setViewingId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const config = useMemo(() => ({
        title: "Orders",
        singular: "Order",
        resource: { list: adminApi.orders.list },
        canDelete: false,
        searchText: (o) => `${o.orderNumber} ${o.customerName} ${o.phone} ${o.city}`,
        tabs: [
            { label: "All", test: () => true },
            ...STATUSES.map(s => ({ label: s, test: (o) => o.status === s })),
            { label: "Awaiting payment", test: (o) => o.paymentStatus === "Pending" },
            { label: "Refund due", test: (o) => o.paymentStatus === "RefundDue" },
        ],
        columns: [
            { label: "Order", render: (o) => <div><strong className="adm-mono">{o.orderNumber}</strong><small>{formatDate(o.createdAt, true)}</small></div> },
            { label: "Customer", render: (o) => <div><strong>{o.customerName}</strong><small>{o.phone} · {o.city}</small></div> },
            { label: "Items", render: (o) => o.itemCount },
            { label: "Total", render: (o) => <strong>{rupees(o.total)}</strong> },
            { label: "Payment", render: (o) => <PaymentBadge method={o.paymentMethod} status={o.paymentStatus} /> },
            { label: "Status", render: (o) => <StatusBadge status={o.status} /> },
        ],
        rowActions: (o) => <button className="adm-btn small primary" onClick={() => setViewingId(o.id)}>View</button>,
    }), []);

    const changed = () => { setRefreshKey(k => k + 1); onChanged?.(); };

    return (
        <>
            <CrudPage config={config} refreshKey={refreshKey} onError={onError} notify={notify} />
            {viewingId && <OrderDetails id={viewingId} onClose={() => setViewingId(null)} onError={onError} notify={notify} onChanged={changed} />}
        </>
    );
}

function OrderDetails({ id, onClose, onError, notify, onChanged }) {
    const [order, setOrder] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);

    const load = useCallback(() => adminApi.orders.get(id).then(setOrder).catch(onError), [id, onError]);
    useEffect(() => { load(); }, [load]);

    const setStatus = async (status) => {
        setBusy(true);
        try {
            await adminApi.orders.setStatus(id, status);
            notify(status === "Cancelled" ? "Order cancelled — items returned to stock" : `Order marked as ${status.toLowerCase()}`);
            setConfirmCancel(false);
            await load();
            onChanged();
        } catch (err) {
            onError(err);
        } finally {
            setBusy(false);
        }
    };

    if (!order) return <Modal title="Order" onClose={onClose}><p className="adm-muted">Loading…</p></Modal>;

    const next = order.allowedNextStatuses;
    const forward = next.filter(s => s !== "Cancelled");

    return (
        <>
            <Modal wide title={`Order ${order.orderNumber}`} onClose={onClose} footer={<>
                {next.includes("Cancelled") && <button className="adm-btn ghost danger-text" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel order</button>}
                <span className="adm-spacer" />
                <button className="adm-btn ghost" onClick={onClose}>Close</button>
                {forward.map(s => (
                    <button key={s} className="adm-btn primary" disabled={busy} onClick={() => setStatus(s)}>{busy ? "Saving…" : ACTION_LABELS[s]}</button>
                ))}
            </>}>
                <div className="adm-order-head">
                    <StatusBadge status={order.status} />
                    <PaymentBadge method={order.paymentMethod} status={order.paymentStatus} />
                    <span className="adm-muted">Placed {formatDate(order.createdAt, true)}</span>
                </div>

                <div className="adm-order-grid">
                    <section>
                        <h3>Customer</h3>
                        <p><strong>{order.customerName}</strong></p>
                        <p><a className="adm-link" href={`tel:+91${order.phone}`}>{order.phone}</a></p>
                        {order.email && <p><a className="adm-link" href={`mailto:${order.email}`}>{order.email}</a></p>}
                    </section>
                    <section>
                        <h3>Deliver to</h3>
                        <p>{order.addressLine1}</p>
                        {order.addressLine2 && <p>{order.addressLine2}</p>}
                        <p>{order.city}, {order.state} – {order.pincode}</p>
                    </section>
                </div>
                {order.notes && <p className="adm-note"><strong>Customer note:</strong> {order.notes}</p>}
                {order.paymentMethod === "Upi" && <PaymentInfo order={order} />}

                <table className="adm-table adm-order-items">
                    <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th className="num">Total</th></tr></thead>
                    <tbody>
                        {order.items.map(i => (
                            <tr key={i.productId}>
                                <td data-label="Item">{i.productName}</td>
                                <td data-label="Price">{rupees(i.unitPrice)}</td>
                                <td data-label="Qty">{i.quantity}</td>
                                <td data-label="Total" className="num">{rupees(i.lineTotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <dl className="adm-totals">
                    <div><dt>Subtotal</dt><dd>{rupees(order.subtotal)}</dd></div>
                    <div><dt>Delivery</dt><dd>{order.shippingFee ? rupees(order.shippingFee) : "Free"}</dd></div>
                    <div className="grand"><dt>{order.paymentMethod === "Upi" ? (order.paymentStatus === "Paid" ? "Paid online" : "Total") : order.status === "Delivered" ? "Collected" : "To collect on delivery"}</dt><dd>{rupees(order.total)}</dd></div>
                </dl>
                {next.length === 0 && <p className="adm-muted">This order is {order.status.toLowerCase()} — no further changes.</p>}
            </Modal>

            {confirmCancel && (
                <ConfirmDialog title="Cancel this order?" confirmLabel="Cancel order" busy={busy} onCancel={() => setConfirmCancel(false)}
                    onConfirm={() => setStatus("Cancelled")}
                    message={`The ${order.items.reduce((s, i) => s + i.quantity, 0)} item(s) in ${order.orderNumber} will be put back into stock.${order.paymentStatus === "Paid" ? " The UPI payment will be marked Refund due — refund it from the payment gateway's dashboard." : ""} This can't be undone.`} />
            )}
        </>
    );
}

function PaymentInfo({ order }) {
    const notes = {
        Pending: "The customer hasn't finished paying. Stock is held; the order is cancelled automatically if the payment window runs out. It can't be confirmed until paid.",
        Paid: null,
        Expired: "The customer didn't pay in time. No money was taken.",
        RefundDue: "Money was received but the order is cancelled. Refund it from the payment gateway's dashboard using the payment id below — the gateway's webhook will then mark it Refunded.",
        Refunded: "The gateway confirmed the full refund.",
    };
    return (
        <section className={`adm-payment ${order.paymentStatus}`}>
            <h3>UPI payment</h3>
            <dl>
                <div><dt>Status</dt><dd><PaymentBadge method="Upi" status={order.paymentStatus} /></dd></div>
                <div><dt>Gateway</dt><dd>{order.paymentProvider ?? "—"}{order.paymentProvider === "Simulator" && " (test)"}</dd></div>
                <div><dt>Gateway order</dt><dd className="adm-mono">{order.paymentReference ?? "—"}</dd></div>
                <div><dt>Payment id</dt><dd className="adm-mono">{order.paymentId ?? "—"}</dd></div>
                {order.paidAt && <div><dt>Paid at</dt><dd>{formatDate(order.paidAt, true)}</dd></div>}
            </dl>
            {notes[order.paymentStatus] && <p>{notes[order.paymentStatus]}</p>}
            {order.paymentEvents?.length > 0 && (
                <details className="adm-events">
                    <summary>Gateway notifications ({order.paymentEvents.length})</summary>
                    <ul>
                        {order.paymentEvents.map((e, i) => (
                            <li key={i}><span className="adm-mono">{e.eventType}</span> · {formatDate(e.receivedAt, true)}<br /><small>{e.result}</small></li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}
