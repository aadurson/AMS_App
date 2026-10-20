export const formatDate = (iso, withTime = false) => new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", ...(withTime && { hour: "numeric", minute: "2-digit" }),
});
export const rupees = (n) => n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`;
