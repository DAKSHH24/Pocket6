import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Receipt, CheckCircle2, Trash2, Clock, Utensils,
    Gamepad2, X, IndianRupee, AlertCircle, ShoppingBag
} from 'lucide-react';
import {
    collection, onSnapshot, doc, updateDoc, deleteDoc, query, where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import './Bills.css';

export default function Bills() {
    const { clubId } = useAuth();
    const [bills, setBills] = useState([]);
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'session' | 'canteen_only'
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    useEffect(() => {
        if (!clubId) return;
        const q = query(collection(db, 'bills'), where('clubId', '==', clubId));
        const unsub = onSnapshot(q, (snap) => {
            const data = [];
            snap.forEach(d => data.push({ id: d.id, ...d.data() }));
            // Sort: dues first, then by createdAt descending
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

    const handleDelete = async (billId) => {
        try {
            await deleteDoc(doc(db, 'bills', billId));
            setDeleteConfirmId(null);
        } catch (err) {
            console.error('Error deleting bill:', err);
        }
    };

    const filtered = bills.filter(b => {
        if (activeTab === 'all') return true;
        return b.type === activeTab;
    });

    const dueBills = bills.filter(b => b.status === 'due');
    const totalDue = dueBills.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const paidBills = bills.filter(b => b.status === 'paid');

    const formatDate = (dateStr) => dateStr || '—';

    return (
        <div className="bills-container">
            <div className="page-header">
                <div>
                    <h2>Bills &amp; Dues</h2>
                    <p className="bills-subtitle">Track unpaid sessions and canteen orders</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="bills-summary-row">
                <div className="bills-stat-card glass-panel due">
                    <div className="bsc-icon"><AlertCircle size={22} /></div>
                    <div className="bsc-info">
                        <div className="bsc-label">Outstanding Dues</div>
                        <div className="bsc-value">₹{totalDue.toFixed(2)}</div>
                        <div className="bsc-count">{dueBills.length} unpaid bill{dueBills.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                <div className="bills-stat-card glass-panel paid">
                    <div className="bsc-icon"><CheckCircle2 size={22} /></div>
                    <div className="bsc-info">
                        <div className="bsc-label">Recovered Today</div>
                        <div className="bsc-value">
                            ₹{paidBills
                                .filter(b => {
                                    const today = new Date().toDateString();
                                    return b.paidAt && new Date(b.paidAt).toDateString() === today;
                                })
                                .reduce((s, b) => s + (b.totalAmount || 0), 0)
                                .toFixed(2)}
                        </div>
                        <div className="bsc-count">{paidBills.length} cleared total</div>
                    </div>
                </div>
            </div>

            {/* Tab filter */}
            <div className="bills-tabs glass-panel">
                <button
                    className={`bills-tab-btn${activeTab === 'all' ? ' active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    All Bills
                    {bills.length > 0 && <span className="bills-tab-badge">{bills.length}</span>}
                </button>
                <button
                    className={`bills-tab-btn${activeTab === 'session' ? ' active' : ''}`}
                    onClick={() => setActiveTab('session')}
                >
                    <Gamepad2 size={14} /> Session Dues
                    {bills.filter(b => b.type === 'session' && b.status === 'due').length > 0 && (
                        <span className="bills-tab-badge red">
                            {bills.filter(b => b.type === 'session' && b.status === 'due').length}
                        </span>
                    )}
                </button>
                <button
                    className={`bills-tab-btn${activeTab === 'canteen_only' ? ' active' : ''}`}
                    onClick={() => setActiveTab('canteen_only')}
                >
                    <ShoppingBag size={14} /> Canteen Only
                    {bills.filter(b => b.type === 'canteen_only' && b.status === 'due').length > 0 && (
                        <span className="bills-tab-badge red">
                            {bills.filter(b => b.type === 'canteen_only' && b.status === 'due').length}
                        </span>
                    )}
                </button>
            </div>

            {/* Bills List */}
            {filtered.length === 0 ? (
                <div className="bills-empty glass-panel">
                    <Receipt size={48} className="bills-empty-icon" />
                    <div className="bills-empty-title">No bills here</div>
                    <div className="bills-empty-sub">
                        {activeTab === 'all'
                            ? 'All dues will appear here when sessions or walk-in orders are marked as unpaid.'
                            : 'No bills in this category.'}
                    </div>
                </div>
            ) : (
                <div className="bills-list">
                    {filtered.map(bill => (
                        <div
                            key={bill.id}
                            className={`bill-card glass-panel ${bill.status}`}
                        >
                            {/* Card Header */}
                            <div className="bill-card-header">
                                <div className="bill-person-info">
                                    <div className="bill-avatar">
                                        {bill.personName?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <div className="bill-person-name">{bill.personName || 'Unknown'}</div>
                                        <div className="bill-meta">
                                            {bill.type === 'session' ? (
                                                <><Gamepad2 size={12} /> {bill.tableName}</>
                                            ) : (
                                                <><ShoppingBag size={12} /> Walk-in Order</>
                                            )}
                                            <span className="bill-dot">·</span>
                                            <Clock size={12} /> {formatDate(bill.date)}
                                        </div>
                                    </div>
                                </div>
                                <div className="bill-right">
                                    <div className={`bill-status-badge ${bill.status}`}>
                                        {bill.status === 'due' ? '⚠ Due' : '✓ Paid'}
                                    </div>
                                    <div className="bill-total-amount">
                                        ₹{(bill.totalAmount || 0).toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown */}
                            <div className="bill-breakdown">
                                {bill.type === 'session' && bill.playedCost > 0 && (
                                    <div className="bill-line">
                                        <span className="bill-line-label">
                                            <Gamepad2 size={13} /> Table Time
                                        </span>
                                        <span className="bill-line-val">₹{(bill.playedCost || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                {bill.foodCost > 0 && (
                                    <div className="bill-line">
                                        <span className="bill-line-label">
                                            <Utensils size={13} /> Canteen
                                        </span>
                                        <span className="bill-line-val">₹{(bill.foodCost || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                {(bill.orders || []).length > 0 && (
                                    <div className="bill-orders-list">
                                        {[...bill.orders]
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map((o, i) => (
                                                <span key={i} className="bill-order-chip">
                                                    {o.name} ×{o.qty}
                                                </span>
                                            ))}
                                    </div>
                                )}
                                {bill.status === 'paid' && bill.paidAtDate && (
                                    <div className="bill-paid-note">
                                        <CheckCircle2 size={12} /> Paid on {bill.paidAtDate}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="bill-actions">
                                {bill.status === 'due' && (
                                    <button
                                        className="bill-pay-btn"
                                        onClick={() => markAsPaid(bill.id)}
                                    >
                                        <CheckCircle2 size={15} /> Mark as Paid
                                    </button>
                                )}
                                <button
                                    className="bill-delete-btn"
                                    onClick={() => setDeleteConfirmId(bill.id)}
                                    title="Delete bill"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirm Modal */}
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
                            <button className="glass-button modal-action-btn" onClick={() => setDeleteConfirmId(null)}>
                                Cancel
                            </button>
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
