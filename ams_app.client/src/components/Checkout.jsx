import { useState } from 'react';
import { api } from '../api';
import { rupees, shippingFor, maxQtyFor, storeConfig, INDIAN_STATES } from '../store';
import { ArrowRightIcon, MinusIcon, PlusIcon, TrashIcon, ShieldIcon, TruckIcon } from './icons';

const EMPTY = { customerName: "", phone: "", email: "", addressLine1: "", addressLine2: "", city: "", state: "", pincode: "", notes: "" };

export default function Checkout({ bag, products, config, changeQty, onPlaced, onStockProblem, onBack }) {
    const [form, setForm] = useState(EMPTY);
    const [method, setMethod] = useState(config.upiEnabled ? "Upi" : "CashOnDelivery");
    const payByUpi = method === "Upi" && config.upiEnabled;
    const [error, setError] = useState("");
    const [placing, setPlacing] = useState(false);

    const set = (name) => (e) => setForm(f => ({ ...f, [name]: e.target.value }));
    const subtotal = bag.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = shippingFor(subtotal);
    const total = subtotal + shipping;

    const submit = async (e) => {
        e.preventDefault();
        if (bag.length === 0) return;
        setPlacing(true);
        setError("");
        try {
            const phone = form.phone.replace(/\D/g, "").slice(-10);
            const order = await api.placeOrder({
                ...form,
                phone,
                email: form.email.trim() || null,
                items: bag.map(i => ({ productId: i.id, quantity: i.qty })),
                paymentMethod: payByUpi ? "Upi" : "CashOnDelivery",
            });
            onPlaced(order, phone);
        } catch (err) {
            setError(err.message);
            // Stock changed since the bag was filled: fix the bag so the customer can retry.
            if (err.status === 409 && err.data?.productId) onStockProblem(err.data.productId, err.data.available ?? 0);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } finally {
            setPlacing(false);
        }
    };

    if (bag.length === 0) {
        return (
            <section className="checkout-page">
                <div className="empty-state">
                    <h1 className="checkout-title">Your bag is empty</h1>
                    <p>Add a few favourites and come back to check out.</p>
                    <button className="primary-button" onClick={onBack}>Continue shopping</button>
                </div>
            </section>
        );
    }

    return (
        <section className="checkout-page">
            <button className="text-link back-link" onClick={onBack}>← Continue shopping</button>
            <h1 className="checkout-title">Checkout</h1>

            {error && <p className="form-alert" role="alert">{error}</p>}

            <form className="checkout-grid" onSubmit={submit}>
                <div className="checkout-main">
                    <fieldset className="checkout-card">
                        <legend><span className="step">1</span> Contact details</legend>
                        <div className="form-grid">
                            <Field label="Full name" required className="full">
                                <input required maxLength={100} autoComplete="name" value={form.customerName} onChange={set("customerName")} />
                            </Field>
                            <Field label="Mobile number" required hint="We'll call this number for delivery.">
                                <input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9 +]{10,16}"
                                    title="Enter a valid 10-digit mobile number" placeholder="10-digit number" value={form.phone} onChange={set("phone")} />
                            </Field>
                            <Field label="Email" hint="Optional — for your order details.">
                                <input type="email" maxLength={256} autoComplete="email" value={form.email} onChange={set("email")} />
                            </Field>
                        </div>
                    </fieldset>

                    <fieldset className="checkout-card">
                        <legend><span className="step">2</span> Delivery address</legend>
                        <div className="form-grid">
                            <Field label="House / flat, street" required className="full">
                                <input required maxLength={200} autoComplete="address-line1" value={form.addressLine1} onChange={set("addressLine1")} />
                            </Field>
                            <Field label="Area, landmark" className="full">
                                <input maxLength={200} autoComplete="address-line2" value={form.addressLine2} onChange={set("addressLine2")} />
                            </Field>
                            <Field label="City" required>
                                <input required maxLength={80} autoComplete="address-level2" value={form.city} onChange={set("city")} />
                            </Field>
                            <Field label="Pincode" required>
                                <input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} title="Enter a valid 6-digit pincode"
                                    autoComplete="postal-code" value={form.pincode} onChange={set("pincode")} />
                            </Field>
                            <Field label="State" required className="full">
                                <select required autoComplete="address-level1" value={form.state} onChange={set("state")}>
                                    <option value="">Select your state</option>
                                    {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </Field>
                            <Field label="Delivery notes" className="full" hint="Optional — e.g. best time to deliver.">
                                <textarea rows={2} maxLength={500} value={form.notes} onChange={set("notes")} />
                            </Field>
                        </div>
                    </fieldset>

                    <fieldset className="checkout-card">
                        <legend><span className="step">3</span> Payment</legend>
                        <div className="pay-options" role="radiogroup" aria-label="Payment method">
                            {config.upiEnabled && (
                                <label className={`pay-option ${payByUpi ? "selected" : ""}`}>
                                    <input type="radio" name="payment" value="Upi" checked={payByUpi} onChange={() => setMethod("Upi")} />
                                    <span>
                                        <strong>Pay now with UPI {config.upiTestMode && <em className="test-badge">TEST MODE</em>}</strong>
                                        <small>Google Pay, PhonePe, Paytm, BHIM or any UPI app. Your items are held for {config.paymentWindowMinutes} minutes while you pay.</small>
                                    </span>
                                </label>
                            )}
                            <label className={`pay-option ${!payByUpi ? "selected" : ""}`}>
                                <input type="radio" name="payment" value="CashOnDelivery" checked={!payByUpi} onChange={() => setMethod("CashOnDelivery")} />
                                <span><strong>Cash on Delivery</strong><small>Pay in cash or UPI when your order arrives.</small></span>
                            </label>
                        </div>
                    </fieldset>
                </div>

                <aside className="checkout-summary checkout-card">
                    <h2>Order summary</h2>
                    <ul className="summary-items">
                        {bag.map(item => {
                            const max = maxQtyFor(products.find(p => p.id === item.id) ?? item);
                            return (
                                <li key={item.id}>
                                    <img src={item.imageUrl} alt="" />
                                    <div>
                                        <p>{item.name}</p>
                                        <div className="quantity small">
                                            <button type="button" aria-label={`Decrease ${item.name}`} onClick={() => changeQty(item.id, -1)}>
                                                {item.qty === 1 ? <TrashIcon size={13} /> : <MinusIcon size={13} />}
                                            </button>
                                            <span>{item.qty}</span>
                                            <button type="button" aria-label={`Increase ${item.name}`} disabled={item.qty >= max} onClick={() => changeQty(item.id, 1)}>
                                                <PlusIcon size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <strong>{rupees(item.price * item.qty)}</strong>
                                </li>
                            );
                        })}
                    </ul>
                    <dl className="summary-totals">
                        <div><dt>Subtotal</dt><dd>{rupees(subtotal)}</dd></div>
                        <div><dt>Delivery</dt><dd>{shipping === 0 ? <span className="free">FREE</span> : rupees(shipping)}</dd></div>
                        {shipping > 0 && <p className="summary-hint">Add {rupees(storeConfig.freeShippingThreshold - subtotal)} more for free delivery.</p>}
                        <div className="grand"><dt>Total</dt><dd>{rupees(total)}</dd></div>
                    </dl>
                    <button className="checkout-button" disabled={placing}>
                        {placing ? "Placing your order…" : payByUpi ? <>Continue to pay {rupees(total)} with UPI <ArrowRightIcon size={16} /></> : <>Place Order · {rupees(total)} <ArrowRightIcon size={16} /></>}
                    </button>
                    <ul className="summary-trust">
                        <li><ShieldIcon size={16} /> Your details are only used for this delivery.</li>
                        <li><TruckIcon size={16} /> Delivery in 3–6 working days.</li>
                    </ul>
                </aside>
            </form>
        </section>
    );
}

function Field({ label, required, hint, className = "", children }) {
    return (
        <label className={`form-field ${className}`}>
            <span>{label}{required && <em aria-hidden="true"> *</em>}</span>
            {children}
            {hint && <small>{hint}</small>}
        </label>
    );
}
