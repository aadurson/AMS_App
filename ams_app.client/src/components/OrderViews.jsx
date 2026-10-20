import { useState } from 'react';
import { api } from '../api';
import { rupees, STATUS_STEPS, STATUS_LABELS, PAYMENT_LABELS } from '../store';
import { CheckIcon, SearchIcon } from './icons';

const formatDate = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const isUpi = (order) => order.paymentMethod === "Upi";

const paymentText = (order) => isUpi(order) ? `UPI · ${PAYMENT_LABELS[order.paymentStatus]}` : "Cash on Delivery";

const totalLabel = (order) =>
    order.paymentStatus === "Paid" ? "Paid" : isUpi(order) ? "Amount" : order.status === "Delivered" ? "Paid" : "To pay on delivery";

export function OrderDetails({ order }) {
    return (
        <div className="checkout-card order-details">
            <div className="order-meta">
                <div><small>Order number</small><strong className="order-number">{order.orderNumber}</strong></div>
                <div><small>Placed on</small><strong>{formatDate(order.createdAt)}</strong></div>
                <div><small>Payment</small><strong className={`pay-state ${order.paymentStatus}`}>{paymentText(order)}</strong></div>
            </div>
            <StatusTracker status={order.status} />
            <ul className="summary-items">
                {order.items.map(i => (
                    <li key={i.productId}>
                        <img src={i.imageUrl} alt="" />
                        <div><p>{i.productName}</p><small>{i.quantity} × {rupees(i.unitPrice)}</small></div>
                        <strong>{rupees(i.lineTotal)}</strong>
                    </li>
                ))}
            </ul>
            <dl className="summary-totals">
                <div><dt>Subtotal</dt><dd>{rupees(order.subtotal)}</dd></div>
                <div><dt>Delivery</dt><dd>{order.shippingFee === 0 ? <span className="free">FREE</span> : rupees(order.shippingFee)}</dd></div>
                <div className="grand"><dt>{totalLabel(order)}</dt><dd>{rupees(order.total)}</dd></div>
            </dl>
        </div>
    );
}

function StatusTracker({ status }) {
    if (status === "Cancelled")
        return <p className="status-cancelled">This order was cancelled. If you paid anything, it will be refunded.</p>;

    const current = STATUS_STEPS.indexOf(status);
    return (
        <ol className="status-steps" aria-label={`Order status: ${STATUS_LABELS[status]}`}>
            {STATUS_STEPS.map((s, i) => (
                <li key={s} className={i < current ? "done" : i === current ? "current" : ""}>
                    <span className="dot">{i <= current ? <CheckIcon size={13} /> : i + 1}</span>
                    {STATUS_LABELS[s]}
                </li>
            ))}
        </ol>
    );
}

export function OrderConfirmation({ order, onContinue }) {
    return (
        <section className="checkout-page narrow">
            <div className="confirm-hero">
                <span className="confirm-icon"><CheckIcon size={30} /></span>
                <h1 className="checkout-title">Thank you, {order.customerName.split(" ")[0]}!</h1>
                <p>{order.paymentStatus === "Paid"
                    ? <>We've received your payment of <strong>{rupees(order.total)}</strong>. Your order will ship to {order.city} soon.</>
                    : <>Your order has been placed. We'll call you to confirm before it ships to {order.city}.</>}</p>
                <p className="confirm-note">Save your order number <strong>{order.orderNumber}</strong> to track your order.</p>
            </div>
            <OrderDetails order={order} />
            <div className="confirm-actions">
                <button className="primary-button" onClick={onContinue}>Continue shopping</button>
                <a className="secondary-button" href="#track">Track your order</a>
            </div>
        </section>
    );
}

export function TrackOrder({ onBack, onPay }) {
    const [orderNumber, setOrderNumber] = useState("");
    const [phone, setPhone] = useState("");
    const [order, setOrder] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setOrder(null);
        try {
            setOrder(await api.trackOrder(orderNumber.trim(), phone.replace(/\D/g, "").slice(-10)));
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="checkout-page narrow">
            <button className="text-link back-link" onClick={onBack}>← Back to store</button>
            <h1 className="checkout-title">Track your order</h1>
            <p className="track-intro">Enter the order number from your confirmation and the mobile number you used.</p>
            <form className="checkout-card track-form" onSubmit={submit}>
                <label className="form-field">
                    <span>Order number</span>
                    <input required placeholder="e.g. AC-261020-7KQ4X9" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
                </label>
                <label className="form-field">
                    <span>Mobile number</span>
                    <input required type="tel" inputMode="numeric" placeholder="10-digit number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <button className="primary-button" disabled={busy}><SearchIcon size={16} /> {busy ? "Searching…" : "Track order"}</button>
            </form>
            {error && <p className="form-alert" role="alert">{error}</p>}
            {order?.paymentStatus === "Pending" && order.status === "Pending" && (
                <div className="checkout-card pay-reminder">
                    <p>This order is waiting for payment.</p>
                    <button className="primary-button" onClick={() => onPay(order.orderNumber, phone.replace(/\D/g, "").slice(-10))}>Pay {rupees(order.total)} now</button>
                </div>
            )}
            {order && <OrderDetails order={order} />}
        </section>
    );
}
