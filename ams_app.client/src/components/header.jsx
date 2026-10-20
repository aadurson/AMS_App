import { useState } from 'react';
import '../styles/styles.css'
import { MenuIcon, CloseIcon, SearchIcon, UserIcon, BagIcon } from './icons';

const links = [
  { label: "Home", href: "#home" },
  { label: "Shop", href: "#products" },
  { label: "Categories", href: "#categories" },
  { label: "Reviews", href: "#reviews" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const Header = ({ bagCount = 0, onBagClick, search = "", onSearch }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const submitSearch = (e) => {
    e.preventDefault();
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="header">
      <button className="icon-button mobile-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      <a className="logo" href="#home" aria-label="Anaya Cosmetics home">
        <span className="logo-flower">❀</span>
        <span className="logo-main">Anaya</span>
        <span className="logo-sub">COSMETICS</span>
      </a>

      <nav className={`nav ${menuOpen ? "nav-open" : ""}`} aria-label="Main">
        {links.map((item) => (
          <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <form className="search-box" role="search" onSubmit={submitSearch}>
          <SearchIcon size={18} />
          <input type="search" aria-label="Search products" placeholder="Search products..."
            value={search} onChange={(e) => onSearch?.(e.target.value)} />
        </form>
        <button className="icon-button account-button" aria-label="Account">
          <UserIcon />
        </button>
        <button className="icon-button bag-icon" aria-label={`Shopping bag, ${bagCount} items`} onClick={onBagClick}>
          <BagIcon />
          {bagCount > 0 && <span className="bag-count">{bagCount}</span>}
        </button>
      </div>
    </header>
  );
};
export default Header;
