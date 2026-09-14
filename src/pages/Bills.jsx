import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Receipt, CheckCircle2, Trash2, Clock, Utensils,
    Gamepad2, X, AlertCircle, ShoppingBag, ChevronDown, ChevronUp
} from 'lucide-react';
import {
    collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import './Bills.css';

export default function Bills() {
    const { clubId } = useAuth();
    const [bills, setBills] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [expandedCustomer, setExpandedCustomer] = useState(null);

    useEffect(() => {
        if (!clubId) return;
        const q = query(collection(db, 'bills'), where('clubId', '==', clubId));
        const unsub = onSnapshot(q, (snap) => {
            const data = [];
            snap.forEach(d => data.push({ id: d.id, ...d.data() }));
            data.sort((a, b) => {
                if (a.status === 'due' && b.status !== 'due') return -1;
                if (a.status !== 'due' && b.status === 'due') return 1;
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
            setBills(data);
        });
        return () => unsub();
    }, [clubId]);

    const markAsPaid = async (billId) => {
        try {
            await updateDoc(doc(db, 'bills', billId), {
                status: 'paid',
                paidAt: Date.now(),
                paidAtDate: new Date().toLocaleString()
            });
        } catch (err) {
            console.error('Error marking bill as paid:', err);
        }
    };

    const markAllAsPaid = async (customerBills) => {
        try {
            const batch = writeBatch(db);
            const now = Date.now();
            const nowStr = new Date().toLocaleString();
            customerBills.forEach(bill => {
                batch.update(doc(db, 'bills', bill.id), {
                    status: 'paid',
                    paidAt: now,
                    paidAtDate: nowStr
                });
            });
            await batch.commit();
            setExpandedCustomer(null);
        } catch (err) {
            console.error('Error marking all bills as paid:', err);
        }
    };

    const handleDelete = async (billId) => {
        try {
            await deleteDoc(doc(db, 'bills', billId));
            setDeleteConfirmId(null);
        } catch (err) {
            console.error('Error deleting bill:', err);
        }
    };

    const todayStr = new Date().toDateString();
    const dueBills = bills.filter(b => b.status === 'due');
    const totalDue = dueBills.reduce((s, b) => s + (b.totalAmount || 0), 0);

    // Filtered dues based on active tab
    const filtered = dueBills.filter(b => {
        if (activeTab === 'today') return b.createdAt && new Date(b.createdAt).toDateString() === todayStr;
        if (activeTab === 'session') return b.type === 'session';
        if (activeTab === 'canteen_only') return b.type === 'canteen_only';
        return true; // 'all'
    });

    // Tab counts
    const todayCount = dueBills.filter(b => b.createdAt && new Date(b.createdAt).toDateString() === todayStr).length;
    const sessionCount = bills.filter(b => b.type === 'session' && b.status === 'due').length;
    const canteenCount = bills.filter(b => b.type === 'canteen_only' && b.status === 'due').length;

    // Group filtered dues by customer name
    const customerGroupsMap = {};
    filtered.forEach(bill => {
        const name = bill.personName || 'Unknown';
        if (!customerGroupsMap[name]) {
            customerGroupsMap[name] = { name, bills: [], totalAmount: 0, lastDate: 0 };
        }
        customerGroupsMap[name].bills.push(bill);
        customerGroupsMap[name].totalAmount += (bill.totalAmount || 0);
        const ts = bill.createdAt || 0;
        if (ts > customerGroupsMap[name].lastDate) customerGroupsMap[name].lastDate = ts;
    });

    const sortedGroups = Object.values(customerGroupsMap).sort((a, b) => b.totalAmount - a.totalAmount);

    const formatDate = (ts) => {
        if (!ts) return '—';
        return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bills-container">
            <div className="page-header">
                <div>
                    <h2>Bills &amp; Dues</h2>
                    <p className="bills-subtitle">Track unpaid sessions and canteen orders</p>
                </div>
            </div>

            {/* Summary — only Outstanding Dues */}
            <div className="bills-stat-card glass-panel due" style={{ maxWidth: 420 }}>
                <div className="bsc-icon"><AlertCircle size={22} /></div>
                <div className="bsc-info">
                    <div className="bsc-label">Outstanding Dues</div>
                    <div className="bsc-value">₹{totalDue.toFixed(2)}</div>
                    <div className="bsc-count">
                        {dueBills.length} unpaid bill{dueBills.length !== 1 ? 's' : ''} · {Object.keys(customerGroupsMap).length} customer{Object.keys(customerGroupsMap).length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Tab filter — Today first */}
            <div className="bills-tabs glass-panel">
                <button className={`bills-tab-btn${activeTab === 'today' ? ' active' : ''}`} onClick={() => setActiveTab('today')}>
                    <Clock size={14} /> Today
                    {todayCount > 0 && <span className="bills-tab-badge">{todayCount}</span>}
                </button>
                <button className={`bills-tab-btn${activeTab === 'all' ? ' active' : ''}`} onClick={() => setActiveTab('all')}>
                    All Dues
                    {dueBills.length > 0 && <span className="bills-tab-badge">{dueBills.length}</span>}
                </button>
                <button className={`bills-tab-btn${activeTab === 'session' ? ' active' : ''}`} onClick={() => setActiveTab('session')}>
                    <Gamepad2 size={14} /> Session
                    {sessionCount > 0 && <span className="bills-tab-badge red">{sessionCount}</span>}
                </button>
                <button className={`bills-tab-btn${activeTab === 'canteen_only' ? ' active' : ''}`} onClick={() => setActiveTab('canteen_only')}>
                    <ShoppingBag size={14} /> Canteen
                    {canteenCount > 0 && <span className="bills-tab-badge red">{canteenCount}</span>}
                </button>
            </div>

            {/* ── Customer-grouped Bills — Masonry layout ── */}
            {sortedGroups.length === 0 ? (
                <div className="bills-empty glass-panel">
                    <Receipt size={48} className="bills-empty-icon" />
                    <div className="bills-empty-title">No bills here</div>
                    <div className="bills-empty-sub">
                        {activeTab === 'today'
                            ? "No dues created today. Switch to 'All Dues' to see older ones."
                            : activeTab === 'all'
                            ? 'All outstanding dues appear here. Once paid, they move to Financial Analytics.'
                            : 'No unpaid bills in this category.'}
                    </div>
                </div>
            ) : (
                <div className="bills-masonry">
                    {sortedGroups.map(group => {
                        const isExpanded = expandedCustomer === group.name;
                        const hasMultiple = group.bills.length > 1;

                        return (
                            <div key={group.name} className={`customer-bill-card glass-panel${isExpanded ? ' expanded' : ''}`}>

                                {/* ── Customer Header ── */}
                                <div className="cbk-header" onClick={() => setExpandedCustomer(isExpanded ? null : group.name)}>
                                    <div className="bill-person-info">
                                        <div className="bill-avatar">
                                            {group.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="bill-person-name">{group.name}</div>
                                            <div className="bill-meta">
                                                <Clock size={12} />
                                                {group.bills.length} bill{group.bills.length !== 1 ? 's' : ''}
                                                <span className="bill-dot">·</span>
                                                {group.lastDate ? new Date(group.lastDate).toLocaleDateString('en-IN') : '—'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="cbk-right">
                                        <div className="cbk-total">₹{group.totalAmount.toFixed(2)}</div>
                                        <div className="cbk-expand-icon">
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Expanded: individual due rows ── */}
                                {isExpanded && (
                                    <div className="cbk-entries">
                                        {[...group.bills]
                                            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                                            .map(bill => (
                                                <div key={bill.id} className="cde-row">
                                                    {/* Left: details */}
                                                    <div className="cde-left">
                                                        <div className="cde-type-badge">
                                                            {bill.type === 'session'
                                                                ? <><Gamepad2 size={11} /> {bill.tableName || 'Table'}</>
                                                                : <><ShoppingBag size={11} /> Walk-in Canteen</>
                                                            }
                                                        </div>
                                                        <div className="cde-date">
                                                            <Clock size={11} />
                                                            {bill.createdAt ? formatDate(bill.createdAt) : (bill.date || '—')}
                                                        </div>

                                                        {/* Cost breakdown lines */}
                                                        {/* {bill.type === 'session' && bill.playedCost > 0 && (
                                                            <div className="cde-breakdown-line">
                                                                <Gamepad2 size={11} />
                                                                Table Time — ₹{(bill.playedCost || 0).toFixed(2)}
                                                            </div>
                                                        )} */}

                                                        {/* Canteen items with individual prices */}
                                                        {(bill.orders || []).length > 0 && (
                                                            <div className="cde-canteen-block">
                                                                <div className="cde-canteen-header">
                                                                    <Utensils size={11} /> Canteen — ₹{(bill.foodCost || 0).toFixed(2)}
                                                                </div>
                                                                {[...bill.orders]
                                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                                    .map((o, i) => (
                                                                        <div key={i} className="cde-item-row">
                                                                            <span className="cde-item-name">{o.name} ×{o.qty}</span>
                                                                            <span className="cde-item-price">₹{(o.qty * o.price).toFixed(2)}</span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right: amount + actions on one row */}
                                                    <div className="cde-right">
                                                        <div className="cde-amount">₹{(bill.totalAmount || 0).toFixed(2)}</div>
                                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                            <button className="cde-pay-btn" onClick={() => markAsPaid(bill.id)}>
                                                                <CheckCircle2 size={13} /> Paid
                                                            </button>
                                                            <button className="cde-del-btn" onClick={() => setDeleteConfirmId(bill.id)}>
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                        {/* Mark All Paid */}
                                        {hasMultiple && (
                                            <div className="cbk-mark-all-row">
                                                <button className="cbk-mark-all-btn" onClick={() => markAllAsPaid(group.bills)}>
                                                    <CheckCircle2 size={14} />
                                                    Mark All Paid — ₹{group.totalAmount.toFixed(2)}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Collapsed quick actions ── */}
                                {!isExpanded && !hasMultiple && (
                                    <div className="bill-actions">
                                        <button className="bill-pay-btn" onClick={() => markAsPaid(group.bills[0].id)}>
                                            <CheckCircle2 size={15} /> Mark as Paid
                                        </button>
                                        <button className="bill-delete-btn" onClick={() => setDeleteConfirmId(group.bills[0].id)}>
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                )}
                                {!isExpanded && hasMultiple && (
                                    <div className="cbk-multi-hint" onClick={() => setExpandedCustomer(group.name)}>
                                        {group.bills.length} dues · tap to expand &amp; manage
                                        <ChevronDown size={12} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Delete Confirm Modal ── */}
            {deleteConfirmId && createPortal(
                <div className="overlay" onClick={() => setDeleteConfirmId(null)}>
                    <div className="modal modal-relative" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setDeleteConfirmId(null)}>
                            <X size={18} />
                        </button>
                        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                            <Trash2 size={36} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
                            <h3 className="text-xl font-bold" style={{ marginBottom: '0.5rem' }}>Delete Bill?</h3>
                            <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
                                This will permanently remove the bill record. This cannot be undone.
                            </p>
                        </div>
                        <div className="modal-action-row">
                            <button className="glass-button modal-action-btn" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                            <button
                                className="modal-action-btn"
                                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', padding: '0.75rem 1.5rem' }}
                                onClick={() => handleDelete(deleteConfirmId)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
