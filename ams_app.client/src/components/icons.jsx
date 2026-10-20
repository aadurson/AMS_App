// Lightweight inline stroke icons (lucide-style) so no extra dependency is needed.
const Icon = ({ size = 20, children, ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        {children}
    </svg>
);

export const MenuIcon = (p) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;
export const CloseIcon = (p) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const SearchIcon = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
export const UserIcon = (p) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>;
export const BagIcon = (p) => <Icon {...p}><path d="M6 7h12l1 14H5L6 7Z" /><path d="M9 10V6a3 3 0 0 1 6 0v4" /></Icon>;
export const TruckIcon = (p) => <Icon {...p}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></Icon>;
export const SparkleIcon = (p) => <Icon {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" /></Icon>;
export const ShieldIcon = (p) => <Icon {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></Icon>;
export const ChatIcon = (p) => <Icon {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></Icon>;
export const HeartIcon = (p) => <Icon {...p}><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9Z" /></Icon>;
export const StarIcon = (p) => <Icon {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></Icon>;
export const ArrowRightIcon = (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ArrowUpIcon = (p) => <Icon {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>;
export const PlusIcon = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const MinusIcon = (p) => <Icon {...p}><path d="M5 12h14" /></Icon>;
export const CheckIcon = (p) => <Icon {...p}><path d="m5 12 5 5 9-10" /></Icon>;
export const TrashIcon = (p) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Icon>;
export const GridIcon = (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>;
export const TagIcon = (p) => <Icon {...p}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" /><circle cx="7.5" cy="7.5" r="1.5" /></Icon>;
export const MailIcon = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Icon>;
export const LogoutIcon = (p) => <Icon {...p}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11" /></Icon>;
export const StoreIcon = (p) => <Icon {...p}><path d="M4 9h16l-1-5H5L4 9ZM5 9v11h14V9M9 20v-6h6v6" /></Icon>;
export const LockIcon = (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Icon>;
export const BoxIcon = (p) => <Icon {...p}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></Icon>;
export const InstagramIcon = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" /></Icon>;
export const FacebookIcon = (p) => <Icon {...p}><path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2V3Z" /></Icon>;
export const YoutubeIcon = (p) => <Icon {...p}><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3V9Z" /></Icon>;
