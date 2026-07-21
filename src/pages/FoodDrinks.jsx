import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus, Trash2, PackageOpen, AlertTriangle, X,
    Lock, KeyRound, RotateCcw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import './FoodDrinks.css';

// ─────────────────────────────────────────────────────────────────
// Shared PIN key — same as Analytics so one code works for both
// ─────────────────────────────────────────────────────────────────
const PIN_KEY = 'pocket6_analytics_pin';
function getPin() { return localStorage.getItem(PIN_KEY) || '123456'; }

// ─────────────────────────────────────────────────────────────────
// INLINE PIN MODAL — shown when user tries to edit a locked field
// ─────────────────────────────────────────────────────────────────
function InlinePinModal({ onClose, onUnlock }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [showReset, setShowReset] = useState(false);
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [resetMsg, setResetMsg] = useState('');

    function handleUnlock(e) {
        e.preventDefault();
        if (pin === getPin()) {
            onUnlock();
        } else {
            setError('Incorrect passcode. Please try again.');
            setPin('');
        }
    }

    function handleResetPin(e) {
        e.preventDefault();
        setResetMsg('');
        if (oldPin !== getPin()) { setResetMsg('error:Current code is incorrect.'); return; }
        if (newPin.length < 4) { setResetMsg('error:New code must be at least 4 digits.'); return; }
        if (newPin !== confirmPin) { setResetMsg('error:New codes do not match.'); return; }
        localStorage.setItem(PIN_KEY, newPin);
        setResetMsg('success:Code updated successfully!');
        setTimeout(() => {
            setShowReset(false);
            setOldPin(''); setNewPin(''); setConfirmPin(''); setResetMsg('');
        }, 1500);
    }

    return createPortal(
        <div className="overlay" onClick={onClose}>
            <div className="modal modal-relative modal-sm" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
                {showReset ? (
                    <>
                        <div className="modal-header-block" style={{ textAlign: 'center' }}>
                            <div className="pin-icon-wrap" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', margin: '0 auto 0.75rem' }}>
                                <KeyRound size={24} />
                            </div>
                            <h3 className="text-xl font-bold">Change Access Code</h3>
                            <p className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>Enter your current code then set a new one.</p>
                        </div>
                        <form onSubmit={handleResetPin} style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {resetMsg && (
                                <div className={resetMsg.startsWith('error:') ? 'pin-msg pin-msg-err' : 'pin-msg pin-msg-ok'}>
                                    {resetMsg.startsWith('error:') ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>}
                                    {resetMsg.replace(/^(error|success):/, '')}
                                </div>
                            )}
                            <input type="password" className="glass-input text-center" placeholder="Current code" maxLength="10" value={oldPin} onChange={e => setOldPin(e.target.value)} autoFocus />
                            <input type="password" className="glass-input text-center" placeholder="New code" maxLength="10" value={newPin} onChange={e => setNewPin(e.target.value)} />
                            <input type="password" className="glass-input text-center" placeholder="Confirm new code" maxLength="10" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} />
                            <button type="submit" className="primary-button" style={{ width: '100%', padding: '0.75rem', marginTop: '0.25rem' }}>Update Code</button>
                            <button type="button" className="pin-back-link" onClick={() => setShowReset(false)}>← Back to unlock</button>
                        </form>
                    </>
                ) : (
                    <>
                        <div className="modal-header-block" style={{ textAlign: 'center' }}>
                            <div className="pin-icon-wrap" style={{ margin: '0 auto 0.75rem' }}>
                                <Lock size={28} />
                            </div>
                            <h3 className="text-xl font-bold">Owner Access Required</h3>
                            <p className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>Enter the owner code to edit prices & stock.</p>
                        </div>
                        <form onSubmit={handleUnlock} style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <input
                                type="password"
                                maxLength="10"
                                className="glass-input text-center"
                                style={{ fontSize: '1.5rem', letterSpacing: '0.25em', padding: '0.85rem' }}
                                placeholder="••••••"
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                autoFocus
                            />
                            {error && <div className="text-glow-red text-center text-sm">{error}</div>}
                            <button type="submit" className="primary-button" style={{ width: '100%', padding: '0.75rem', marginTop: '0.25rem' }}>Unlock Editing</button>
                            <button type="button" className="pin-back-link" onClick={() => { setShowReset(true); setError(''); setPin(''); }}>
                                <RotateCcw size={13} /> Change access code
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function FoodDrinks() {
    const { clubId } = useAuth();
    const [inventory, setInventory] = useState([]);
    const [activeTab, setActiveTab] = useState('Snacks');
    const [showAddModal, setShowAddModal] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [newItem, setNewItem] = useState({ name: '', category: 'Snacks', price: '', cost: '', stock: '' });

    // Fields unlocked after PIN
    const [fieldsUnlocked, setFieldsUnlocked] = useState(false);
    // Show inline PIN modal
    const [showPinModal, setShowPinModal] = useState(false);

    // Delete modal
    const [deleteConfirmFor, setDeleteConfirmFor] = useState(null);

    useEffect(() => {
        if (!clubId) return;
        const q = query(collection(db, 'inventory'), where('clubId', '==', clubId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = [];
            snapshot.forEach(doc => {
                fetched.push({ id: doc.id, ...doc.data() });
            });
            const cleaned = fetched.map(item =>
                item.category === 'Food' ? { ...item, category: 'Snacks' } : item
            );
            setInventory(cleaned);
        });
        return () => unsubscribe();
    }, [clubId]);

    // Lock body scroll when modal open
    useEffect(() => {
        const anyOpen = showAddModal || deleteConfirmFor || showPinModal;
        document.body.style.overflow = anyOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [showAddModal, deleteConfirmFor, showPinModal]);

    const handleAddItem = async (e) => {
        e.preventDefault();
        setSaveError('');
        if (!newItem.name || !newItem.price) return;

        try {
            const newItemId = Date.now().toString();
            await setDoc(doc(db, 'inventory', newItemId), {
                clubId,
                name: newItem.name,
                category: newItem.category,
                price: parseFloat(newItem.price),
                cost: parseFloat(newItem.cost || 0),
                stock: parseInt(newItem.stock || 0)
            });
            setNewItem({ name: '', category: 'Snacks', price: '', cost: '', stock: '' });
            setShowAddModal(false);
        } catch (error) {
            console.error('Error adding item:', error);
            setSaveError(`Failed to save: ${error.message}`);
        }
    };

    const handleDeleteConfirmed = async () => {
        if (!deleteConfirmFor) return;
        try {
            await deleteDoc(doc(db, 'inventory', deleteConfirmFor.id));
        } catch (error) {
            console.error('Error deleting item:', error);
        }
        setDeleteConfirmFor(null);
    };

    const updateStock = async (id, val) => {
        try {
            await updateDoc(doc(db, 'inventory', id), { stock: parseInt(val) || 0 });
        } catch (error) {
            console.error('Error updating stock:', error);
        }
    };

    const updatePrice = async (id, val) => {
        try {
            await updateDoc(doc(db, 'inventory', id), { price: parseFloat(val) || 0 });
        } catch (error) {
            console.error('Error updating price:', error);
        }
    };

    const updateCost = async (id, val) => {
        try {
            await updateDoc(doc(db, 'inventory', id), { cost: parseFloat(val) || 0 });
        } catch (error) {
            console.error('Error updating cost:', error);
        }
    };

    // When a locked field is clicked, prompt PIN
    const handleLockedFieldClick = () => {
        if (!fieldsUnlocked) {
            setShowPinModal(true);
        }
    };

    const filteredItems = inventory
        .filter(item =>
            activeTab === 'Snacks' ? item.category === 'Snacks' :
                activeTab === 'Drinks' ? item.category === 'Drinks' :
                    item.category === 'Tobacco/Lounge'
        )
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="inventory-container">
            <div className="page-header mb-6">
                <div>
                    <h2>Food &amp; Drinks Menu</h2>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* Lock / unlock indicator — only show lock icon if unlocked so owner can re-lock */}
                    {fieldsUnlocked && (
                        <button
                            className="stock-lock-btn unlocked"
                            onClick={() => setFieldsUnlocked(false)}
                            title="Lock Price & Stock Editing"
                        >
                            <Lock size={15} />
                            Lock Editing
                        </button>
                    )}
                    <button className="primary-button" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} className="mr-2" /> Add Menu Item
                    </button>
                </div>
            </div>

            <div className="glass-panel p-6">
                {/* Segmented control */}
                <div className="canteen-seg-control" style={{ marginBottom: '1.5rem' }}>
                    <button className={`seg-btn${activeTab === 'Snacks' ? ' seg-active' : ''}`} onClick={() => setActiveTab('Snacks')}>Snacks</button>
                    <button className={`seg-btn${activeTab === 'Drinks' ? ' seg-active' : ''}`} onClick={() => setActiveTab('Drinks')}>Drinks</button>
                    <button className={`seg-btn${activeTab === 'Tobacco' ? ' seg-active' : ''}`} onClick={() => setActiveTab('Tobacco')}>Tobacco</button>
                </div>

                {/* Column headers */}
                <div className="inv-header-row">
                    <div className="inv-col-name">Item Name</div>
                    <div className="inv-col-price">
                        Cost Price (₹)
                        {!fieldsUnlocked && <Lock size={11} style={{ marginLeft: '0.3rem', opacity: 0.5 }} />}
                    </div>
                    <div className="inv-col-price">
                        Selling Price (₹)
                        {!fieldsUnlocked && <Lock size={11} style={{ marginLeft: '0.3rem', opacity: 0.5 }} />}
                    </div>
                    <div className="inv-col-stock">
                        Available Stock
                        {!fieldsUnlocked && <Lock size={11} style={{ marginLeft: '0.3rem', opacity: 0.5 }} />}
                    </div>
                    <div className="inv-col-action">Actions</div>
                </div>

                {filteredItems.length === 0 ? (
                    <div className="text-center p-10 text-muted flex flex-col items-center">
                        <PackageOpen size={48} className="mb-4 opacity-50" />
                        <p>No items in this category.</p>
                    </div>
                ) : (
                    <div className="inv-list">
                        {filteredItems.map(item => {
                            const isLowStock = item.stock <= 5;
                            return (
                                <div key={item.id} className="inv-card glass-panel">
                                    <div className="inv-col-name">
                                        <div className="inv-item-name">
                                            {item.name}
                                            {isLowStock && (
                                                <span className="low-stock-badge" title="Low Stock">
                                                    <AlertTriangle size={14} />
                                                    Low Stock
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Cost Price */}
                                    <div className="inv-col-price">
                                        {fieldsUnlocked ? (
                                            <div className="inv-input-wrap">
                                                <span className="inv-currency">₹</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    className="inv-plain-input"
                                                    value={item.cost || 0}
                                                    onChange={e => updateCost(item.id, e.target.value)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="inv-stock-locked" onClick={handleLockedFieldClick} title="Click to unlock editing">
                                                <Lock size={13} />
                                                <span>₹{item.cost || 0}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Selling Price */}
                                    <div className="inv-col-price">
                                        {fieldsUnlocked ? (
                                            <div className="inv-input-wrap">
                                                <span className="inv-currency">₹</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    className="inv-plain-input"
                                                    value={item.price}
                                                    onChange={e => updatePrice(item.id, e.target.value)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="inv-stock-locked" onClick={handleLockedFieldClick} title="Click to unlock editing">
                                                <Lock size={13} />
                                                <span>₹{item.price}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Available Stock */}
                                    <div className="inv-col-stock">
                                        {fieldsUnlocked ? (
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                className={`inv-plain-input${isLowStock ? ' inv-stock-low' : ''}`}
                                                value={item.stock}
                                                onChange={e => updateStock(item.id, e.target.value)}
                                            />
                                        ) : (
                                            <div className={`inv-stock-locked${isLowStock ? ' inv-stock-low' : ''}`} onClick={handleLockedFieldClick} title="Click to unlock editing">
                                                <Lock size={13} />
                                                <span>{item.stock}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="inv-col-action">
                                        <button className="danger-button icon-button small" onClick={() => setDeleteConfirmFor({ id: item.id, name: item.name })}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── INLINE PIN MODAL ── */}
            {showPinModal && (
                <InlinePinModal
                    onClose={() => setShowPinModal(false)}
                    onUnlock={() => { setFieldsUnlocked(true); setShowPinModal(false); }}
                />
            )}

            {/* ── DELETE CONFIRMATION MODAL ── */}
            {deleteConfirmFor && createPortal(
                <div className="overlay" onClick={() => setDeleteConfirmFor(null)}>
                    <div className="modal modal-relative modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-block" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🗑️</div>
                            <h3 className="text-xl font-bold text-glow-red">Delete Item?</h3>
                            <p className="text-muted text-sm" style={{ marginTop: '0.4rem' }}>
                                Remove <strong style={{ color: 'var(--text-primary)' }}>"{deleteConfirmFor.name}"</strong> from the menu?
                                <br />This cannot be undone.
                            </p>
                        </div>
                        <div className="checkout-action-row" style={{ paddingTop: '0.5rem' }}>
                            <button className="glass-button modal-action-btn" onClick={() => setDeleteConfirmFor(null)}>Cancel</button>
                            <button
                                className="modal-action-btn"
                                style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                                onClick={handleDeleteConfirmed}
                            >
                                <Trash2 size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ADD MODAL */}
            {showAddModal && createPortal(
                <div className="overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
                        <div className="modal-header-block">
                            <h3 className="text-xl font-bold">Add New Menu Item</h3>
                        </div>
                        <form onSubmit={handleAddItem} className="flex-col gap-4" noValidate>
                            <div className="form-group">
                                <label className="text-sm text-muted">Item Name</label>
                                <input
                                    type="text"
                                    className="glass-input"
                                    required
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    placeholder="e.g. Red Bull"
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label className="text-sm text-muted">Category</label>
                                <select
                                    className="glass-input"
                                    value={newItem.category}
                                    onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                >
                                    <option>Snacks</option>
                                    <option>Drinks</option>
                                    <option value="Tobacco/Lounge">Tobacco/Lounge</option>
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="form-group flex-1">
                                    <label className="text-sm text-muted">Cost Price (₹)</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        className="glass-input"
                                        value={newItem.cost}
                                        onChange={e => setNewItem({ ...newItem, cost: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="form-group flex-1">
                                    <label className="text-sm text-muted">Selling Price (₹)</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        className="glass-input"
                                        required
                                        value={newItem.price}
                                        onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="form-group flex-1">
                                    <label className="text-sm text-muted">Current Stock</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className="glass-input"
                                        value={newItem.stock}
                                        onChange={e => setNewItem({ ...newItem, stock: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            {saveError && (
                                <div style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.5rem 0.8rem' }}>
                                    ⚠ {saveError}
                                </div>
                            )}
                            <div className="modal-action-row">
                                <button type="button" className="glass-button modal-action-btn" onClick={() => { setShowAddModal(false); setSaveError(''); }}>Cancel</button>
                                <button type="submit" className="primary-button modal-action-btn">Save Item</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
