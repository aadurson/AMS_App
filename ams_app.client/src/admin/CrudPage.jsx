import { useEffect, useMemo, useState } from 'react';
import { Modal, ConfirmDialog, Field } from './ui';
import { PlusIcon, SearchIcon, TrashIcon } from '../components/icons';

const ALL_TAB = [{ label: "All", test: () => true }];

/**
 * Generic list + add/edit/delete screen for one admin resource.
 *
 * config: {
 *   title, singular, resource (adminApi.x), columns: [{ label, render(item), className }],
 *   fields(context) => field defs, emptyForm, toForm(item), toInput(form),
 *   searchText(item), tabs?: [{ label, test(item) }], rowActions?(item, { save }), deleteWarning?(item)
 * }
 * context: extra data the form needs (e.g. categories for a select).
 */
export default function CrudPage({ config, context, onError, notify, onChanged, refreshKey }) {
    const [items, setItems] = useState([]);
    const [status, setStatus] = useState("loading");
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState(0);
    const [editing, setEditing] = useState(null);   // { id?, form }
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null); // item
    const [busy, setBusy] = useState(false);

    const { resource, singular } = config;

    const reload = () => resource.list()
        .then(data => { setItems(data); setStatus("ready"); })
        .catch(err => { setStatus("error"); onError(err); });

    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per resource
    useEffect(() => { reload(); }, [resource, refreshKey]);

    const tabs = config.tabs ?? ALL_TAB;
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter(i => tabs[tab].test(i) && (!q || config.searchText(i).toLowerCase().includes(q)));
    }, [items, query, tab, tabs, config]);

    const openNew = () => { setFormError(""); setEditing({ form: { ...config.emptyForm } }); };
    const openEdit = (item) => { setFormError(""); setEditing({ id: item.id, form: config.toForm(item) }); };
    const setField = (name, value) => setEditing(e => ({ ...e, form: { ...e.form, [name]: value } }));

    // Saves a full item (used by the form and by quick row actions such as approve / hide).
    const save = async (id, payload, successMessage) => {
        if (id) await resource.update(id, payload);
        else await resource.create(payload);
        await reload();
        onChanged?.();
        notify(successMessage);
    };

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError("");
        try {
            await save(editing.id, config.toInput(editing.form), editing.id ? `${singular} updated` : `${singular} added`);
            setEditing(null);
        } catch (err) {
            if (err.status === 401) onError(err);
            else setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        setBusy(true);
        try {
            await resource.remove(deleting.id);
            setDeleting(null);
            await reload();
            onChanged?.();
            notify(`${singular} deleted`);
        } catch (err) {
            setDeleting(null);
            onError(err);
        } finally {
            setBusy(false);
        }
    };

    const quickSave = (item, payload, message) => save(item.id, payload, message).catch(onError);

    return (
        <section>
            <div className="adm-page-head">
                <div>
                    <h1>{config.title}</h1>
                    <p>{items.length} total</p>
                </div>
                {config.toInput && <button className="adm-btn primary" onClick={openNew}><PlusIcon size={16} /> Add {singular.toLowerCase()}</button>}
            </div>

            <div className="adm-toolbar">
                {tabs.length > 1 && (
                    <div className="adm-tabs" role="tablist">
                        {tabs.map((t, i) => (
                            <button key={t.label} role="tab" aria-selected={tab === i} className={tab === i ? "active" : ""} onClick={() => setTab(i)}>
                                {t.label} <span>{items.filter(t.test).length}</span>
                            </button>
                        ))}
                    </div>
                )}
                <label className="adm-search">
                    <SearchIcon size={16} />
                    <input type="search" placeholder={`Search ${config.title.toLowerCase()}…`} value={query}
                        onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${config.title}`} />
                </label>
                {config.toolbarExtra?.(visible)}
            </div>

            <div className="adm-card adm-table-wrap">
                {status === "loading" ? <p className="adm-empty">Loading…</p>
                    : status === "error" ? <p className="adm-empty">Couldn't load data. <button className="adm-link" onClick={reload}>Try again</button></p>
                    : visible.length === 0 ? (
                        <p className="adm-empty">
                            {items.length === 0 ? `No ${config.title.toLowerCase()} yet.` : "Nothing matches your search."}
                            {items.length === 0 && config.toInput && <> <button className="adm-link" onClick={openNew}>Add the first one</button></>}
                        </p>
                    ) : (
                        <table className="adm-table">
                            <thead>
                                <tr>
                                    {config.columns.map(c => <th key={c.label} className={c.className}>{c.label}</th>)}
                                    <th className="actions"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(item => (
                                    <tr key={item.id}>
                                        {config.columns.map(c => <td key={c.label} className={c.className} data-label={c.label}>{c.render(item)}</td>)}
                                        <td className="actions">
                                            <div className="adm-actions">
                                                {config.rowActions?.(item, quickSave)}
                                                {config.toInput && <button className="adm-btn small ghost" onClick={() => openEdit(item)}>Edit</button>}
                                                {config.canDelete !== false && <button className="adm-icon-btn danger" aria-label={`Delete ${singular.toLowerCase()}`} title="Delete" onClick={() => setDeleting(item)}>
                                                    <TrashIcon size={16} />
                                                </button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
            </div>

            {editing && (
                <Modal title={editing.id ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`} wide onClose={() => setEditing(null)}
                    footer={<>
                        <button type="button" className="adm-btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                        <button type="submit" form="crud-form" className="adm-btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                    </>}>
                    <form id="crud-form" className="adm-form" onSubmit={submit}>
                        {formError && <p className="adm-alert full" role="alert">{formError}</p>}
                        {config.fields({ ...context, isNew: !editing.id }).map(f => (
                            <Field key={f.name} field={f} value={editing.form[f.name]} onChange={(v) => setField(f.name, v)} />
                        ))}
                    </form>
                </Modal>
            )}

            {deleting && (
                <ConfirmDialog title={`Delete ${singular.toLowerCase()}?`} busy={busy} onCancel={() => setDeleting(null)} onConfirm={confirmDelete}
                    message={config.deleteWarning?.(deleting) ?? "This can't be undone."} />
            )}
        </section>
    );
}
