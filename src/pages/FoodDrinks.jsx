import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, PackageOpen, AlertTriangle, X } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import './FoodDrinks.css';

export default function FoodDrinks() {
    const { clubId } = useAuth();
    const [inventory, setInventory] = useState([]);
    const [activeTab, setActiveTab] = useState('Snacks');
    const [showAddModal, setShowAddModal] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [newItem, setNewItem] = useState({ name: '', category: 'Snacks', price: '', cost: '', stock: '' });

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
            console.error("Error adding item:", error);
            setSaveError(`Failed to save: ${error.message}`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Delete this menu item?')) {
            try {
                await deleteDoc(doc(db, 'inventory', id));
            } catch (error) {
                console.error("Error deleting item:", error);
            }
        }
    };

    const updateStock = async (id, val) => {
        try {
            await updateDoc(doc(db, 'inventory', id), { stock: parseInt(val) || 0 });
        } catch (error) {
            console.error("Error updating stock:", error);
        }
    };

    const updatePrice = async (id, val) => {
        try {
            await updateDoc(doc(db, 'inventory', id), { price: parseFloat(val) || 0 });
        } catch (error) {
            console.error("Error updating price:", error);
        }
    };

    const updateCost = async (id, val) => {
        try {
            await updateDoc(doc(db, 'inventory', id), { cost: parseFloat(val) || 0 });
        } catch (error) {
            console.error("Error updating cost:", error);
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
                <button className="primary-button" onClick={() => setShowAddModal(true)}>
                    <Plus size={18} className="mr-2" /> Add Menu Item
                </button>
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
                    <div className="inv-col-price">Cost Price (₹)</div>
                    <div className="inv-col-price">Selling Price (₹)</div>
                    <div className="inv-col-stock">Available Stock</div>
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

                                    <div className="inv-col-price">
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
                                    </div>

                                    <div className="inv-col-price">
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
                                    </div>

                                    <div className="inv-col-stock">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className={`inv-plain-input${isLowStock ? ' inv-stock-low' : ''}`}
                                            value={item.stock}
                                            onChange={e => updateStock(item.id, e.target.value)}
                                        />
                                    </div>

                                    <div className="inv-col-action">
                                        <button className="danger-button icon-button small" onClick={() => handleDelete(item.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ADD MODAL — portal so it always renders at body level */}
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
