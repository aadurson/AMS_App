import { useEffect, useRef } from 'react';
import { CloseIcon } from '../components/icons';

let openModals = 0;

export function Modal({ title, onClose, children, footer, wide }) {
    const ref = useRef(null);
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; });

    // Runs once per opening, so re-renders while typing don't steal focus.
    useEffect(() => {
        // With stacked dialogs (e.g. a confirm over order details) only the top one reacts to Escape.
        const onKey = (e) => {
            const open = document.querySelectorAll(".adm-modal");
            if (e.key === "Escape" && open[open.length - 1] === ref.current) closeRef.current();
        };
        document.addEventListener("keydown", onKey);
        openModals++;
        document.body.style.overflow = "hidden";
        ref.current?.querySelector("input:not(:disabled), select, textarea, button:not(.modal-close)")?.focus();
        return () => {
            document.removeEventListener("keydown", onKey);
            if (--openModals === 0) document.body.style.overflow = "";
        };
    }, []);

    return (
        <div className="adm-backdrop" onMouseDown={onClose}>
            <div className={`adm-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}
                ref={ref} onMouseDown={(e) => e.stopPropagation()}>
                <div className="adm-modal-head">
                    <h2>{title}</h2>
                    <button className="adm-icon-btn modal-close" aria-label="Close" onClick={onClose}><CloseIcon size={18} /></button>
                </div>
                <div className="adm-modal-body">{children}</div>
                {footer && <div className="adm-modal-foot">{footer}</div>}
            </div>
        </div>
    );
}

export function ConfirmDialog({ title, message, confirmLabel = "Delete", busy, onConfirm, onCancel }) {
    return (
        <Modal title={title} onClose={onCancel} footer={<>
            <button className="adm-btn ghost" onClick={onCancel}>Cancel</button>
            <button className="adm-btn danger" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
        </>}>
            <p className="adm-confirm-text">{message}</p>
        </Modal>
    );
}

/** Renders one form control from a field definition: { name, label, type, options, required, help, ... } */
export function Field({ field, value, onChange }) {
    const id = `f-${field.name}`;
    const common = { id, name: field.name, required: field.required, placeholder: field.placeholder, disabled: field.disabled };

    if (field.type === "checkbox") {
        return (
            <label className="adm-check" htmlFor={id}>
                <input type="checkbox" {...common} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
                <span>{field.label}</span>
                {field.help && <small>{field.help}</small>}
            </label>
        );
    }

    let control;
    if (field.type === "textarea") {
        control = <textarea {...common} rows={field.rows ?? 4} maxLength={field.maxLength} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    } else if (field.type === "select") {
        control = (
            <select {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Select…</option>
                {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        );
    } else {
        control = <input {...common} type={field.type ?? "text"} min={field.min} max={field.max} step={field.step}
            maxLength={field.maxLength} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    }

    return (
        <div className={`adm-field ${field.full ? "full" : ""}`}>
            <label htmlFor={id}>{field.label}{field.required && <span className="req" aria-hidden="true"> *</span>}</label>
            {control}
            {field.type === "url" && value && <img className="adm-preview" src={value} alt="Preview" onError={(e) => { e.currentTarget.style.display = "none"; }} onLoad={(e) => { e.currentTarget.style.display = ""; }} />}
            {field.help && <small>{field.help}</small>}
        </div>
    );
}

export const Thumb = ({ src }) => src
    ? <img className="adm-thumb" src={src} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
    : <span className="adm-thumb" />;

export const Badge = ({ tone, children }) => <span className={`adm-badge ${tone}`}>{children}</span>;
