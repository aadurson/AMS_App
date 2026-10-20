import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { rupees, loadPendingPayment, savePendingPayment } from '../store';
import { OrderDetails } from './OrderViews';
import { CheckIcon, CloseIcon, LockIcon, ShieldIcon } from './icons';

/** Remaining time until `iso`, as m:ss (or null once passed). */
function useCountdown(iso) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!iso) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [iso]);
    if (!iso) return null;
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return null;
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Razorpay's checkout script is loaded only when someone actually pays with Razorpay.
let razorpayScript;
const loadRazorpay = () => razorpayScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => { razorpayScript = null; reject(new Error("Couldn't load the payment window. Check your connection and try again.")); };
    document.body.appendChild(s);
});

export default function PaymentPage({ onPaid, onBack }) {
    const [pending] = useState(loadPendingPayment);
    const [order, setOrder] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [session, setSession] = useState(null);   // open simulator window
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const remaining = useCountdown(order?.paymentStatus === "Pending" ? order.paymentExpiresAt : null);

    // Keep the latest callback without re-running effects each time the parent re-renders.
    const onPaidRef = useRef(onPaid);
    useEffect(() => { onPaidRef.current = onPaid; });

    const refresh = useCallback(() => {
        if (!pending) return Promise.resolve();
        return api.trackOrder(pending.orderNumber, pending.phone)
            .then(o => {
                setOrder(o);
                if (o.paymentStatus === "Paid") onPaidRef.current(o); // e.g. paid in another tab
            })
            .catch(err => setLoadError(err.message));
    }, [pending]);

    useEffect(() => { refresh(); }, [refresh]);

    // The server's verdict on a payment result from the gateway.
    const verify = async (result) => {
        setBusy(true);
        setError("");
        try {
            const paid = await api.verifyPayment(pending.orderNumber, { phone: pending.phone, ...result });
            onPaid(paid);
        } catch (err) {
            setError(err.message);
            refresh();
        } finally {
            setBusy(false);
        }
    };

    const pay = async () => {
        setBusy(true);
        setError("");
        try {
            const s = await api.startPayment(pending.orderNumber, pending.phone);
            if (s.provider === "Simulator") {
                setSession(s);
            } else if (s.provider === "Razorpay") {
                await openRazorpay(s);
            }
        } catch (err) {
            setError(err.message);
            refresh();
        } finally {
            setBusy(false);
        }
    };

    const openRazorpay = async (s) => {
        const Razorpay = await loadRazorpay();
        const checkout = new Razorpay({
            key: s.keyId,
            order_id: s.gatewayOrderId,
            amount: s.amountPaise,
            currency: s.currency,
            name: "Anaya Cosmetics",
            description: `Order ${s.orderNumber}`,
            prefill: { name: s.customerName, email: s.email ?? undefined, contact: s.phone },
            theme: { color: "#853b56" },
            // Show UPI only.
            config: {
                display: {
                    blocks: { upi: { name: "Pay using UPI", instruments: [{ method: "upi" }] } },
                    sequence: ["block.upi"],
                    preferences: { show_default_blocks: false },
                },
            },
            handler: (r) => verify({ gatewayOrderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
            modal: { ondismiss: () => setError("Payment window closed. Your order is still reserved — you can try again.") },
        });
        checkout.on("payment.failed", (r) => setError(`${r.error?.description ?? "Payment failed."} No money was taken — please try again.`));
        checkout.open();
    };

    if (!pending)
        return <Shell onBack={onBack}><p className="track-intro">There's no payment in progress. If you placed an order, you can find it under Track Order.</p></Shell>;
    if (loadError)
        return <Shell onBack={onBack}><p className="form-alert" role="alert">{loadError}</p></Shell>;
    if (!order)
        return <Shell onBack={onBack}><p className="track-intro">Loading your order…</p></Shell>;

    const expired = order.paymentStatus === "Expired" || (order.paymentStatus === "Pending" && !remaining);

    return (
        <Shell onBack={onBack}>
            {order.paymentStatus === "Pending" && !expired && (
                <div className="checkout-card pay-card">
                    <div>
                        <p className="pay-amount">{rupees(order.total)}</p>
                        <p className="pay-sub">Order {order.orderNumber} · reserved for <strong>{remaining}</strong></p>
                    </div>
                    {error && <p className="form-alert" role="alert">{error}</p>}
                    <button className="checkout-button" onClick={pay} disabled={busy}>
                        <LockIcon size={16} /> {busy ? "Opening payment…" : error ? "Try again" : `Pay ${rupees(order.total)} with UPI`}
                    </button>
                    <p className="pay-note"><ShieldIcon size={15} /> You'll approve the payment in your UPI app. We never see your UPI PIN.</p>
                </div>
            )}
            {expired && (
                <div className="checkout-card">
                    <p className="form-alert" role="alert">
                        The time to pay for order {order.orderNumber} ran out, so it was cancelled and the items were released. No money was taken.
                    </p>
                    <button className="primary-button" onClick={() => { savePendingPayment(null); onBack(); }}>Back to shop</button>
                </div>
            )}
            {order.paymentStatus === "RefundDue" && (
                <p className="form-alert" role="alert">{error || "This order was cancelled after your payment. Your money will be refunded in 5–7 working days."}</p>
            )}
            <OrderDetails order={order} />
            {session && (
                <UpiSimulator session={session} onClose={() => { setSession(null); setError("Payment window closed. Your order is still reserved — you can try again."); }}
                    onSuccess={(result) => { setSession(null); verify(result); }} />
            )}
        </Shell>
    );
}

function Shell({ onBack, children }) {
    return (
        <section className="checkout-page narrow">
            <button className="text-link back-link" onClick={onBack}>← Back to store</button>
            <h1 className="checkout-title">Complete your payment</h1>
            {children}
        </section>
    );
}

/**
 * Sandbox UPI payment window used with the built-in simulator gateway. It mimics a real gateway's
 * "collect" flow: enter a UPI ID, approve in the app, get a signed result. No real money is involved.
 */
function UpiSimulator({ session, onSuccess, onClose }) {
    const [vpa, setVpa] = useState("");
    const [stage, setStage] = useState("enter"); // enter | waiting | failed | success
    const [error, setError] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
        const onKey = (e) => e.key === "Escape" && stage !== "waiting" && onClose();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose, stage]);

    const submit = async (e) => {
        e.preventDefault();
        setStage("waiting");
        setError("");
        try {
            const result = await api.simulatorPay(session.gatewayOrderId, vpa.trim());
            setStage("success");
            setTimeout(() => onSuccess({ gatewayOrderId: result.gatewayOrderId, paymentId: result.paymentId, signature: result.signature }), 700);
        } catch (err) {
            setError(err.message);
            setStage("failed");
        }
    };

    return (
        <div className="drawer-backdrop sim-backdrop">
            <div className="sim-window" role="dialog" aria-modal="true" aria-label="UPI payment (test mode)">
                <div className="sim-head">
                    <div>
                        <span className="test-badge">TEST MODE · NO REAL MONEY</span>
                        <h2>Anaya Cosmetics</h2>
                        <p>Order {session.orderNumber}</p>
                    </div>
                    <div className="sim-amount">{rupees(session.amountPaise / 100)}</div>
                    {stage !== "waiting" && <button className="icon-button sim-close" aria-label="Close payment window" onClick={onClose}><CloseIcon size={18} /></button>}
                </div>

                {stage === "success" ? (
                    <div className="sim-body sim-center">
                        <span className="confirm-icon"><CheckIcon size={30} /></span>
                        <p><strong>Payment successful</strong></p>
                        <p className="sim-muted">Confirming with the store…</p>
                    </div>
                ) : stage === "waiting" ? (
                    <div className="sim-body sim-center">
                        <span className="sim-spinner" aria-hidden="true" />
                        <p><strong>Approve the payment in your UPI app</strong></p>
                        <p className="sim-muted">A request for {rupees(session.amountPaise / 100)} was sent to {vpa}</p>
                    </div>
                ) : (
                    <form className="sim-body" onSubmit={submit}>
                        {stage === "failed" && <p className="form-alert" role="alert">{error}</p>}
                        <label className="form-field">
                            <span>UPI ID</span>
                            <input ref={inputRef} required placeholder="yourname@upi" autoComplete="off" value={vpa} onChange={(e) => setVpa(e.target.value)} />
                        </label>
                        <div className="sim-hints">
                            <span>Test IDs:</span>
                            <button type="button" onClick={() => setVpa("success@upi")}>success@upi</button>
                            <button type="button" onClick={() => setVpa("failure@upi")}>failure@upi</button>
                        </div>
                        <button className="checkout-button"><LockIcon size={16} /> Pay {rupees(session.amountPaise / 100)}</button>
                        <p className="sim-muted sim-small">This is the built-in payment simulator for development. Switch to Razorpay test or live keys in appsettings.json.</p>
                    </form>
                )}
            </div>
        </div>
    );
}
