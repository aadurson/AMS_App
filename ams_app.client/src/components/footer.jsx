import '../styles/styles.css'
import { InstagramIcon, FacebookIcon, YoutubeIcon } from './icons';

const Footer = () => {
  return (
    <footer className="footer" id="about">
      <div className="footer-brand">
        <a className="logo footer-logo" href="#home"><span className="logo-flower">❀</span><span className="logo-main">Anaya</span><span className="logo-sub">COSMETICS</span></a>
        <p>Premium beauty and skincare essentials, carefully chosen to help you look and feel your best.</p>
      </div>
      <div className="footer-col">
        <h4>Shop</h4>
        <a href="#products">All Products</a><a href="#categories">Skincare</a><a href="#categories">Makeup</a><a href="#offers">Offers</a>
      </div>
      <div className="footer-col">
        <h4>Help</h4>
        <a href="#contact">Shipping &amp; Delivery</a><a href="#contact">Returns</a><a href="#contact">FAQs</a><a href="#track">Track Order</a>
      </div>
      <div className="footer-col" id="contact">
        <h4>Contact Us</h4>
        <a href="mailto:hello@anayacosmetics.in">hello@anayacosmetics.in</a>
        <span>Mon – Sat, 10am – 7pm</span>
        <div className="socials">
          <a href="#contact" aria-label="Instagram"><InstagramIcon /></a>
          <a href="#contact" aria-label="Facebook"><FacebookIcon /></a>
          <a href="#contact" aria-label="YouTube"><YoutubeIcon /></a>
        </div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Anaya Cosmetics. All rights reserved.</span><span>Made with ♡ for your beauty</span></div>
    </footer>
  );
};
export default Footer;
