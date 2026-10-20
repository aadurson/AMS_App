import { useEffect, useMemo, useState } from 'react';
import Header from './components/header';
import Footer from './components/footer';
import Checkout from './components/Checkout';
import { OrderConfirmation, TrackOrder } from './components/OrderViews';
import { api } from './api';
import { storeConfig, applyStoreConfig, rupees, maxQtyFor, loadBag, saveBag, savePendingPayment } from './store';
import PaymentPage from './components/PaymentPage';
import {
    TruckIcon, SparkleIcon, ShieldIcon, ChatIcon, HeartIcon, StarIcon, ArrowRightIcon,
    ArrowUpIcon, PlusIcon, MinusIcon, CheckIcon, CloseIcon, TrashIcon, BagIcon
} from './components/icons';

// Pages other than the home page are addressed by URL hash so the browser Back button works.
const PAGE_HASHES = { "#checkout": "checkout", "#pay": "pay", "#track": "track", "#order-confirmed": "confirmation" };

// Keep bag items in line with the latest catalog: current price/name, drop products no longer sold, respect stock.
const reconcileBag = (items, products) => items.flatMap(item => {
    const p = products.find(x => x.id === item.id);
    if (!p || !p.inStock) return [];
    return [{ ...item, name: p.name, price: p.price, imageUrl: p.imageUrl, qty: Math.min(item.qty, maxQtyFor(p)) }];
});

const benefits = [
    { icon: TruckIcon, title: "Free Shipping", text: () => `On orders over ${rupees(storeConfig.freeShippingThreshold)}` },
    { icon: SparkleIcon, title: "Carefully Curated", text: "Beauty picks you'll love" },
    { icon: ShieldIcon, title: "Secure Payments", text: "Safe & trusted checkout" },
    { icon: ChatIcon, title: "Here to Help", text: "Mon – Sat, 10am – 7pm" },
];

function App() {
    const [filter, setFilter] = useState("All");
    const [search, setSearch] = useState("");
    const [bag, setBag] = useState(loadBag);
    const [hash, setHash] = useState(() => window.location.hash);
    const [placedOrder, setPlacedOrder] = useState(null);
    const [favorites, setFavorites] = useState([]);
    const [bagOpen, setBagOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const [email, setEmail] = useState("");
    const [subscribed, setSubscribed] = useState("");
    const [subscribing, setSubscribing] = useState(false);
    const [subscribeError, setSubscribeError] = useState("");
    const [showTop, setShowTop] = useState(false);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [testimonials, setTestimonials] = useState([]);
    const [status, setStatus] = useState("loading");

    const [config, setConfig] = useState(storeConfig);

    const fetchStore = () =>
        Promise.all([api.getCategories(), api.getProducts(), api.getTestimonials(), api.getStoreConfig().catch(() => null)])
            .then(([c, p, t, cfg]) => {
                if (cfg) setConfig({ ...applyStoreConfig(cfg) });
                setCategories(c); setProducts(p); setTestimonials(t); setStatus("ready");
                setBag(items => reconcileBag(items, p));
            })
            .catch(() => setStatus("error"));

    const retryLoad = () => { setStatus("loading"); fetchStore(); };

    useEffect(() => { fetchStore(); }, []);

    useEffect(() => saveBag(bag), [bag]);

    useEffect(() => {
        const onHash = () => setHash(window.location.hash);
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);

    const page = PAGE_HASHES[hash] === "confirmation" && !placedOrder ? "shop" : (PAGE_HASHES[hash] ?? "shop");

    // When switching pages, start at the top — or at the section a link pointed to (e.g. #products).
    useEffect(() => {
        const target = page === "shop" && hash ? document.querySelector(hash) : null;
        if (target) target.scrollIntoView();
        else window.scrollTo(0, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the page itself changes
    }, [page]);

    const goTo = (newHash) => {
        if (window.location.hash === newHash) setHash(newHash);
        else window.location.hash = newHash;
    };

    // Only offer filter chips for categories that actually have products.
    const filters = useMemo(() => ["All", ...categories.filter(c => c.productCount > 0).map(c => c.name)], [categories]);

    useEffect(() => {
        const onScroll = () => setShowTop(window.scrollY > 600);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 2800);
        return () => clearTimeout(t);
    }, [toast]);

    useEffect(() => {
        if (!bagOpen) return;
        const onKey = (e) => e.key === "Escape" && setBagOpen(false);
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    }, [bagOpen]);

    const visibleProducts = useMemo(() => {
        const q = search.trim().toLowerCase();
        return products.filter(p =>
            (filter === "All" || p.category === filter) &&
            (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
    }, [products, filter, search]);

    const bagCount = bag.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = bag.reduce((sum, i) => sum + i.qty * i.price, 0);
    const toFreeShipping = Math.max(0, storeConfig.freeShippingThreshold - subtotal);

    const chooseCategory = (name) => {
        setFilter(filters.includes(name) ? name : "All");
        setSearch("");
        document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
    };

    const addToBag = (product) => {
        const inBag = bag.find(i => i.id === product.id)?.qty ?? 0;
        const max = maxQtyFor(product);
        if (inBag >= max) {
            setToast(product.stockLeft != null && product.stockLeft <= max
                ? `Only ${product.stockLeft} of ${product.name} available`
                : `You can add up to ${max} of each item`);
            return;
        }
        // Decide from the latest bag (not `inBag`), so quick repeated clicks never create duplicate lines.
        setBag(items => items.some(i => i.id === product.id)
            ? items.map(i => i.id === product.id ? { ...i, qty: Math.min(i.qty + 1, max) } : i)
            : [...items, { id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl, qty: 1 }]);
        setToast(`${product.name} added to your bag`);
    };

    const changeQty = (id, delta) => {
        const max = maxQtyFor(products.find(p => p.id === id));
        setBag(items => items.map(i => i.id === id ? { ...i, qty: Math.min(i.qty + delta, max) } : i).filter(i => i.qty > 0));
    };

    const goToCheckout = () => { setBagOpen(false); goTo("#checkout"); };

    // Called when the server says an item no longer has enough stock: fix the bag and refresh stock levels.
    const handleStockProblem = (productId, available) => {
        setBag(items => items.map(i => i.id === productId ? { ...i, qty: available } : i).filter(i => i.qty > 0));
        fetchStore();
    };

    const handleOrderPlaced = (order, phone) => {
        setBag([]);
        fetchStore(); // stock levels changed
        if (order.paymentStatus === "Pending") {
            // UPI: the order is reserved; now collect the payment.
            savePendingPayment({ orderNumber: order.orderNumber, phone });
            goTo("#pay");
        } else {
            setPlacedOrder(order);
            goTo("#order-confirmed");
        }
    };

    const handlePaid = (order) => {
        savePendingPayment(null);
        setPlacedOrder(order);
        goTo("#order-confirmed");
    };

    const payForOrder = (orderNumber, phone) => {
        savePendingPayment({ orderNumber, phone });
        goTo("#pay");
    };

    const toggleFavorite = (id) =>
        setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);

    const subscribe = async (e) => {
        e.preventDefault();
        setSubscribing(true);
        setSubscribeError("");
        try {
            const result = await api.subscribe(email);
            setSubscribed(result?.message || "Thanks for subscribing!");
        } catch (err) {
            setSubscribeError(err.message || "Something went wrong. Please try again.");
        } finally {
            setSubscribing(false);
        }
    };

    return (
        <div className="store">
            <a className="skip-link" href="#products">Skip to products</a>
            <div className="announcement">
                <span>✦</span> A little luxury, just for you — Free delivery on orders over {rupees(storeConfig.freeShippingThreshold)} <span>✦</span>
            </div>
            <Header bagCount={bagCount} onBagClick={() => setBagOpen(true)} search={search} onSearch={setSearch} />

            {page === "checkout" && (
                <main>
                    <Checkout bag={bag} products={products} config={config} changeQty={changeQty} onPlaced={handleOrderPlaced}
                        onStockProblem={handleStockProblem} onBack={() => goTo("#products")} />
                </main>
            )}
            {page === "confirmation" && <main><OrderConfirmation order={placedOrder} onContinue={() => goTo("#products")} /></main>}
            {page === "pay" && <main><PaymentPage onPaid={handlePaid} onBack={() => goTo("#products")} /></main>}
            {page === "track" && <main><TrackOrder onBack={() => goTo("#home")} onPay={payForOrder} /></main>}

            {page === "shop" && <main>
                <section className="hero" id="home">
                    <div className="hero-copy">
                        <p className="eyebrow">BEAUTY&nbsp; • &nbsp;SKINCARE&nbsp; • &nbsp;SELF-CARE</p>
                        <h1>Your beauty,<br />your glow.</h1>
                        <p className="hero-description">
                            Discover premium beauty and skincare essentials that bring out the best in you.
                        </p>
                        <div className="hero-actions">
                            <a className="primary-button" href="#products">Shop Collection <ArrowRightIcon size={16} /></a>
                            <a className="secondary-button" href="#categories">Browse Categories</a>
                        </div>
                        <ul className="hero-trust">
                            <li><StarIcon size={15} className="filled" /> 4.8/5 from 1,200+ reviews</li>
                            <li><CheckIcon size={15} /> 100% genuine products</li>
                        </ul>
                    </div>
                    <div className="hero-photo">
                        <img src="https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1400&q=90"
                            alt="Beauty skincare editorial" />
                        <div className="hero-product-note">
                            <span>THE GLOW EDIT</span>
                            <strong>Your daily beauty ritual</strong>
                        </div>
                    </div>
                </section>

                <section className="benefits" aria-label="Shopping benefits">
                    {benefits.map(({ icon: BenefitIcon, title, text }) => (
                        <div className="benefit" key={title}>
                            <span className="benefit-icon"><BenefitIcon /></span>
                            <div><strong>{title}</strong><small>{typeof text === "function" ? text() : text}</small></div>
                        </div>
                    ))}
                </section>

                <section className="section categories-section" id="categories">
                    <div className="section-top">
                        <div><p className="eyebrow">SHOP BY CATEGORY</p><h2>Beauty for every you.</h2></div>
                        <button className="text-link" onClick={() => chooseCategory("All")}>Explore all <ArrowRightIcon size={15} /></button>
                    </div>
                    <div className="category-grid">
                        {categories.map((item) => (
                            <button className="category-card" key={item.name} onClick={() => chooseCategory(item.name)}>
                                <img src={item.imageUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                                <span className="category-shade" />
                                <span className="category-copy">
                                    <strong>{item.name}</strong><small>{item.subtitle}</small>
                                    <em>Shop Now <ArrowRightIcon size={14} /></em>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="section products-section" id="products">
                    <div className="section-top">
                        <div><p className="eyebrow">OUR BESTSELLERS</p><h2>Loved by our customers.</h2></div>
                    </div>
                    <div className="filter-row" role="group" aria-label="Filter products">
                        {filters.map(f => (
                            <button key={f} className={`filter ${filter === f ? "active-filter" : ""}`}
                                aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
                        ))}
                        {search && (
                            <button className="filter search-chip" onClick={() => setSearch("")}>
                                “{search}” <CloseIcon size={14} />
                            </button>
                        )}
                    </div>

                    {status === "loading" ? (
                        <div className="product-grid" aria-busy="true" aria-label="Loading products">
                            {Array.from({ length: 4 }, (_, i) => <div className="product-card skeleton" key={i} />)}
                        </div>
                    ) : status === "error" ? (
                        <div className="empty-state" role="alert">
                            <p>We couldn't load products right now. Please check your connection and try again.</p>
                            <button className="secondary-button" onClick={retryLoad}>Try again</button>
                        </div>
                    ) : visibleProducts.length === 0 ? (
                        <div className="empty-state">
                            <p>No products match your search.</p>
                            <button className="secondary-button" onClick={() => { setSearch(""); setFilter("All"); }}>Show all products</button>
                        </div>
                    ) : (
                        <div className="product-grid">
                            {visibleProducts.map(p => {
                                const fav = favorites.includes(p.id);
                                return (
                                    <article className="product-card" key={p.id}>
                                        <div className="product-photo">
                                            <img src={p.imageUrl} alt={p.name} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                                            {p.tag && <span className="product-tag">{p.tag}</span>}
                                            <button className={`favorite ${fav ? "favorite-active" : ""}`} aria-pressed={fav}
                                                aria-label={fav ? `Remove ${p.name} from wishlist` : `Add ${p.name} to wishlist`}
                                                onClick={() => toggleFavorite(p.id)}>
                                                <HeartIcon size={17} fill={fav ? "currentColor" : "none"} />
                                            </button>
                                        </div>
                                        <div className="product-info">
                                            <p className="product-category">{p.category}</p>
                                            <h3 title={p.name}>{p.name}</h3>
                                            <div className="rating">
                                                <span className="stars" aria-label={`Rated ${p.rating} out of 5`}><StarIcon size={14} /></span>
                                                <span className="rating-value">{p.rating}</span>
                                                <small>({p.reviewCount} reviews)</small>
                                            </div>
                                            <div className="price">
                                                <strong>{rupees(p.price)}</strong>
                                                {p.mrp > p.price && <><del>{rupees(p.mrp)}</del><span className="save">Save {Math.round((1 - p.price / p.mrp) * 100)}%</span></>}
                                            </div>
                                            {p.inStock && p.stockLeft != null && <p className="stock-left">Only {p.stockLeft} left — order soon</p>}
                                            <button className="add-button" onClick={() => addToBag(p)} disabled={!p.inStock}>
                                                <BagIcon size={16} /> {p.inStock ? "Add to Bag" : "Out of Stock"}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="savings-banner" id="offers">
                    <div className="savings-copy">
                        <p className="eyebrow">LIMITED TIME OFFER</p>
                        <h2>Glow more,<br />spend less.</h2>
                        <p>Get up to 25% off on selected skincare &amp; makeup.</p>
                        <button className="primary-button" onClick={() => chooseCategory("All")}>Shop the Sale <ArrowRightIcon size={15} /></button>
                    </div>
                    <img src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80" alt="" loading="lazy" />
                    <div className="savings-note">Up to<span>25% OFF</span></div>
                </section>

                {testimonials.length > 0 && <section className="section testimonials" id="reviews">
                    <p className="eyebrow">REAL REVIEWS</p>
                    <h2>What our customers say</h2>
                    <div className="testimonial-grid">
                        {testimonials.map(t => (
                            <figure className="testimonial-card" key={t.id}>
                                <span className="avatar" aria-hidden="true">{t.name[0]}</span>
                                <div>
                                    <blockquote>“{t.text}”</blockquote>
                                    <figcaption><strong>{t.name}</strong> · Verified buyer</figcaption>
                                    <div className="review-stars" aria-label={`${t.rating} out of 5 stars`}>{"★".repeat(t.rating)}</div>
                                </div>
                            </figure>
                        ))}
                    </div>
                </section>}

                <section className="newsletter">
                    <div>
                        <p className="eyebrow">JOIN THE GLOW CLUB</p>
                        <h2>Get 10% off your first order</h2>
                        <p>Beauty tips, new arrivals and members-only offers. No spam, unsubscribe anytime.</p>
                    </div>
                    {subscribed ? (
                        <p className="subscribed" role="status"><CheckIcon /> {subscribed}</p>
                    ) : (
                        <form onSubmit={subscribe}>
                            <input type="email" required placeholder="Enter your email address" aria-label="Email address"
                                value={email} onChange={(e) => setEmail(e.target.value)} />
                            <button type="submit" disabled={subscribing}>
                                {subscribing ? "Subscribing…" : <>Subscribe <ArrowRightIcon size={15} /></>}
                            </button>
                            {subscribeError && <p className="form-error" role="alert">{subscribeError}</p>}
                        </form>
                    )}
                </section>
            </main>}

            <Footer />

            {toast && (
                <div className="toast" role="status">
                    <CheckIcon size={18} /> <span>{toast}</span>
                    <button className="toast-link" onClick={() => { setToast(null); setBagOpen(true); }}>View bag</button>
                </div>
            )}

            {showTop && (
                <button className="back-to-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    <ArrowUpIcon size={18} />
                </button>
            )}

            {bagOpen && (
                <div className="drawer-backdrop" onClick={() => setBagOpen(false)}>
                    <aside className="bag-drawer" role="dialog" aria-modal="true" aria-label="Shopping bag" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <h2>Your Bag {bagCount > 0 && <small>({bagCount})</small>}</h2>
                            <button className="icon-button" aria-label="Close bag" onClick={() => setBagOpen(false)} autoFocus><CloseIcon /></button>
                        </div>

                        {bag.length === 0 ? (
                            <div className="empty-bag">
                                <BagIcon size={42} />
                                <p>Your bag is empty.</p>
                                <a className="primary-button" href="#products" onClick={() => setBagOpen(false)}>Start Shopping</a>
                            </div>
                        ) : (
                            <>
                                <div className={`shipping-progress ${toFreeShipping === 0 ? "done" : ""}`}>
                                    <p>{toFreeShipping === 0
                                        ? "🎉 You've unlocked free delivery!"
                                        : <>Add <strong>{rupees(toFreeShipping)}</strong> more for free delivery</>}</p>
                                    <span><i style={{ width: `${Math.min(100, (subtotal / storeConfig.freeShippingThreshold) * 100)}%` }} /></span>
                                </div>
                                <div className="bag-items">
                                    {bag.map(item => (
                                        <div className="bag-item" key={item.id}>
                                            <img src={item.imageUrl} alt="" />
                                            <div className="bag-item-details">
                                                <p>{item.name}</p>
                                                <span>{rupees(item.price * item.qty)}</span>
                                                <div className="bag-item-row">
                                                    <div className="quantity">
                                                        <button aria-label="Decrease quantity" onClick={() => changeQty(item.id, -1)}><MinusIcon size={14} /></button>
                                                        <span aria-live="polite">{item.qty}</span>
                                                        <button aria-label="Increase quantity" disabled={item.qty >= maxQtyFor(products.find(p => p.id === item.id))} onClick={() => changeQty(item.id, 1)}><PlusIcon size={14} /></button>
                                                    </div>
                                                    <button className="remove-button" onClick={() => changeQty(item.id, -item.qty)}><TrashIcon size={15} /> Remove</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="bag-total">
                                    <div><span>Subtotal</span><strong>{rupees(subtotal)}</strong></div>
                                    <small>Taxes included. Shipping calculated at checkout.</small>
                                    <button className="checkout-button" onClick={goToCheckout}>Proceed to Checkout <ArrowRightIcon size={16} /></button>
                                </div>
                            </>
                        )}
                    </aside>
                </div>
            )}
        </div>
    );
}

export default App;
