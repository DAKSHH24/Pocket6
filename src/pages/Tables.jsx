import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Plus, Minus, Clock, X, Utensils, Bell, AlertTriangle } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import './Tables.css';

export default function Tables() {
    const [tables, setTables] = useState([]);
    const [activeFilter, setActiveFilter] = useState('All');
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [showAddModal, setShowAddModal] = useState(false);

    // Canteen State
    const [showCanteenFor, setShowCanteenFor] = useState(null); // table id
    const [canteenTab, setCanteenTab] = useState('Snacks'); // 'Snacks' | 'Drinks' | 'Tobacco'
    const [inventory, setInventory] = useState([]);

    // Checkout State
    const [showCheckoutFor, setShowCheckoutFor] = useState(null);
    const [showAlerts, setShowAlerts] = useState(false);
    const alertBtnRef = useRef(null);

    // New Table Form
    const [newTableType, setNewTableType] = useState('Snooker');
    const [customType, setCustomType] = useState('');
    const [newTableName, setNewTableName] = useState('');
    const [newTableRate, setNewTableRate] = useState('');

    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timerId);
    }, []);

    // Fetch Tables from Firestore
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'tables'), (snapshot) => {
            const fetchedTables = [];
            snapshot.forEach(doc => {
                fetchedTables.push({ id: doc.id, ...doc.data() });
            });
            setTables(fetchedTables);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Inventory from Firestore
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'inventory'), (snapshot) => {
            const fetchedInventory = [];
            snapshot.forEach(doc => {
                fetchedInventory.push({ id: doc.id, ...doc.data() });
            });
            setInventory(fetchedInventory);
        });
        return () => unsubscribe();
    }, []);

    const handleStart = async (id) => {
        try {
            await updateDoc(doc(db, 'tables', id), {
                status: 'occupied',
                startTime: Date.now(),
                pausedTime: 0,
                orders: []
            });
        } catch (error) {
            console.error("Error starting table:", error);
        }
    };

    const handleOpenCheckout = (table) => {
        setShowCheckoutFor(table);
    };

    const finalizeCheckout = async () => {
        if (!showCheckoutFor) return;
        const tableInfo = showCheckoutFor;
        const elapsedMs = Math.max(0, currentTime - tableInfo.startTime);
        // Cap at 60 minutes
        const cappedMs = Math.min(elapsedMs, 60 * 60000);
        const minsElapsed = cappedMs / 60000;
        const playedCost = parseFloat((minsElapsed * tableInfo.rate).toFixed(2));
        const foodCost = (tableInfo.orders || []).reduce((sum, o) => sum + (o.price * o.qty), 0);

        // Save to history
        const historyItem = {
            tableName: tableInfo.name,
            type: tableInfo.type,
            playedCost,
            foodCost,
            totalCost: playedCost + foodCost,
            date: new Date().toLocaleString(),
            orders: tableInfo.orders || [],
            createdAt: Date.now()
        };

        try {
            await addDoc(collection(db, 'session_history'), historyItem);

            await updateDoc(doc(db, 'tables', tableInfo.id), {
                status: 'free',
                startTime: null,
                customer: '',
                note: '',
                pausedTime: 0,
                orders: []
            });
            setShowCheckoutFor(null);
        } catch (error) {
            console.error("Error finalizing checkout:", error);
        }
    };

    const handleAddTable = async (e) => {
        e.preventDefault();
        const type = newTableType === 'Other' ? customType : newTableType;
        if (!type || !newTableName || !newTableRate) return;

        const newId = Date.now().toString();
        const newTable = {
            type: type,
            name: newTableName,
            status: 'free',
            startTime: null,
            rate: parseFloat(newTableRate),
            customer: '',
            note: '',
            pausedTime: 0,
            orders: []
        };

        try {
            await setDoc(doc(db, 'tables', newId), newTable);
            setNewTableName('');
            setNewTableRate('');
            setCustomType('');
            setShowAddModal(false);
        } catch (error) {
            console.error("Error adding table:", error);
        }
    };

    const addFoodToTable = async (tableId, menuItem) => {
        const table = tables.find(t => t.id === tableId);
        if (!table) return;

        let updatedOrders = [...(table.orders || [])];
        const existing = updatedOrders.find(o => o.id === menuItem.id);
        if (existing) {
            existing.qty += 1;
        } else {
            updatedOrders.push({ ...menuItem, qty: 1 });
        }

        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'tables', tableId), { orders: updatedOrders });
            batch.update(doc(db, 'inventory', String(menuItem.id)), { stock: Math.max(0, menuItem.stock - 1) });
            await batch.commit();
        } catch (error) {
            console.error("Error adding food to table:", error);
        }
    };

    const removeFoodFromTable = async (tableId, menuItem) => {
        const table = tables.find(t => t.id === tableId);
        if (!table) return;

        let updatedOrders = [...(table.orders || [])];
        const existingIndex = updatedOrders.findIndex(o => o.id === menuItem.id);
        if (existingIndex !== -1) {
            const existing = updatedOrders[existingIndex];
            if (existing.qty > 1) {
                updatedOrders[existingIndex] = { ...existing, qty: existing.qty - 1 };
            } else {
                updatedOrders.splice(existingIndex, 1);
            }

            try {
                const batch = writeBatch(db);
                batch.update(doc(db, 'tables', tableId), { orders: updatedOrders });
                batch.update(doc(db, 'inventory', String(menuItem.id)), { stock: menuItem.stock + 1 });
                await batch.commit();
            } catch (error) {
                console.error("Error removing food from table:", error);
            }
        }
    };

    // Convert to countdown limit (60 mins)
    const formatCountdown = (ms) => {
        const defaultTime = 60 * 60000;
        let remaining = defaultTime - ms;
        if (remaining < 0) remaining = 0; // stop at 0

        const totalSeconds = Math.floor(remaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const formatAmPm = (ms) => {
        return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(ms));
    };

    const filteredTables = activeFilter === 'All' ? tables : tables.filter(t => t.type === activeFilter);
    const categories = ['All', ...new Set(tables.map(t => t.type))];

    return (
        <div className="tables-container">
            <div className="page-header">
                <div>
                    <h2>Tables & Sessions</h2>
                    <p className="text-muted">Manage active games. 60 min bounds apply.</p>
                </div>
                <div className="header-actions">
                    {(() => {
                        const lowStockItems = inventory.filter(item => item.stock <= 5);
                        return (
                            <div className="notif-wrapper">
                                <button
                                    className={`notif-btn${lowStockItems.length > 0 ? ' has-alerts' : ''}`}
                                    onClick={() => setShowAlerts(v => !v)}
                                    title="Inventory Alerts"
                                    ref={alertBtnRef}
                                >
                                    <Bell size={18} />
                                    {lowStockItems.length > 0 && (
                                        <span className="notif-badge">{lowStockItems.length}</span>
                                    )}
                                </button>
                                {showAlerts && (
                                    <div className="notif-dropdown glass-panel">
                                        <div className="notif-dropdown-title">
                                            <AlertTriangle size={14} /> Inventory Alerts
                                        </div>
                                        {lowStockItems.length === 0 ? (
                                            <p className="notif-empty">All items well stocked</p>
                                        ) : (
                                            lowStockItems.map(item => (
                                                <div key={item.id} className="notif-item">
                                                    <span className="notif-item-name">{item.name}</span>
                                                    <span className="notif-item-stock">{item.stock} left</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                    <button className="primary-button" onClick={() => setShowAddModal(true)}>+ Add New Table</button>
                </div>
            </div>

            <div className="filters-bar glass-panel">
                {categories.map(filter => (
                    <button
                        key={filter}
                        className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
                        onClick={() => setActiveFilter(filter)}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            <div className="tables-grid">
                {filteredTables.map(table => {
                    const isOccupied = table.status === 'occupied';
                    const elapsedMs = isOccupied ? Math.max(0, currentTime - table.startTime) : 0;
                    // Cap cost at 60 min — timer stops counting money after time is up
                    const cappedMs = Math.min(elapsedMs, 60 * 60000);
                    const timeCost = isOccupied ? (cappedMs / 60000 * table.rate).toFixed(2) : '0.00';
                    const foodCost = (table.orders || []).reduce((sum, o) => sum + (o.price * o.qty), 0);

                    return (
                        <div key={table.id} className={`table-card-v2 glass-panel ${isOccupied ? 'occupied' : 'free'}`}>
                            <div className="tc-top-row">
                                <div className="tc-title-area">
                                    <h3>{table.name}</h3>
                                </div>
                                <div className="tc-right-icons">
                                    <span className="tc-type-pill">{table.type}</span>
                                </div>
                            </div>

                            <div className="tc-main-status">
                                <div className="tc-timer-col">
                                    {isOccupied ? (
                                        <>
                                            <div className={`tc-big-timer${elapsedMs >= 3600000 ? ' tc-timer-expired' : ''}`}>{formatCountdown(elapsedMs)}</div>
                                            <div className="tc-running-dot"><span className="dot"></span> 60m Countdown</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="tc-big-timer">60:00</div>
                                            <div className="tc-running-dot text-muted">Ready</div>
                                        </>
                                    )}
                                </div>
                                {isOccupied && (
                                    <div className="tc-icon-btn canteen" onClick={() => setShowCanteenFor(table.id)} title="Canteen">
                                        <Utensils size={18} />
                                        <span>Canteen</span>
                                    </div>
                                )}
                            </div>

                            {isOccupied && (
                                <div className="tc-started-text">
                                    <Clock size={14} /> Started: {formatAmPm(table.startTime)}
                                </div>
                            )}

                            <div className="tc-amount">
                                ₹{timeCost}
                            </div>

                            {foodCost > 0 && (
                                <div className="text-glow-orange font-bold font-heading mb-3">
                                    ₹{foodCost.toFixed(2)} <span className="text-sm font-normal text-muted">(Canteen)</span>
                                </div>
                            )}

                            <div className="tc-rate-text">
                                Rate: ₹{table.rate.toFixed(2)}/min
                            </div>

                            {/* Order display list */}
                            {table.orders && table.orders.length > 0 && (
                                <div className="canteen-orders-block">
                                    {table.orders.map((o, idx) => (
                                        <div key={idx} className="canteen-order-line">
                                            <div className="canteen-order-info">
                                                <span className="co-name">{o.name}</span>
                                                <span className="co-qty">Qty: {o.qty}</span>
                                            </div>
                                            <div className="co-total">₹{(o.qty * o.price).toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="tc-bottom-actions">
                                {isOccupied ? (
                                    <button className="tc-action-circle bg-red border-none hover:bg-red-700" onClick={() => handleOpenCheckout(table)} title="End Session" style={{ width: '100%', borderRadius: '8px' }}>
                                        <Square size={20} fill="#fff" className="mr-2" /> End Session
                                    </button>
                                ) : (
                                    <button className="tc-action-circle bg-green tooltip-container" onClick={() => handleStart(table.id)} title="Play">
                                        <Play size={20} fill="#fff" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* CANTEEN MODAL */}
            {showCanteenFor && (() => {
                const drinksFilter = (item) => item.category === 'Drinks';
                const tobaccoFilter = (item) => item.category === 'Tobacco/Lounge';
                const snacksFilter = (item) => item.category !== 'Drinks' && item.category !== 'Tobacco/Lounge';
                const filteredInventory = inventory.filter(
                    canteenTab === 'Drinks' ? drinksFilter :
                        canteenTab === 'Tobacco' ? tobaccoFilter :
                            snacksFilter
                );
                return (
                    <div className="overlay" onClick={() => setShowCanteenFor(null)}>
                        <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowCanteenFor(null)}>
                                <X size={18} />
                            </button>
                            <div className="modal-header-block">
                                <h3 className="text-xl font-bold">Order to Table</h3>
                                <span className="text-sm font-normal text-muted">Add Items directly to the selected table.</span>
                            </div>
                            {/* Segmented control */}
                            <div className="canteen-seg-control">
                                <button className={`seg-btn${canteenTab === 'Snacks' ? ' seg-active' : ''}`} onClick={() => setCanteenTab('Snacks')}>Snacks</button>
                                <button className={`seg-btn${canteenTab === 'Drinks' ? ' seg-active' : ''}`} onClick={() => setCanteenTab('Drinks')}>Drinks</button>
                                <button className={`seg-btn${canteenTab === 'Tobacco' ? ' seg-active' : ''}`} onClick={() => setCanteenTab('Tobacco')}>Tobacco</button>
                            </div>
                            <div className="canteen-items-list">
                                {filteredInventory.length === 0 ? <p className="text-muted text-center p-4">No items in this category.</p> : null}
                                {filteredInventory.map(item => {
                                    const activeTable = tables.find(t => t.id === showCanteenFor);
                                    const orderItem = activeTable?.orders?.find(o => o.id === item.id);
                                    const currentQty = orderItem ? orderItem.qty : 0;

                                    return (
                                        <div key={item.id} className="canteen-modal-item glass-panel">
                                            <div className="cmi-info">
                                                <div className="font-bold">{item.name}</div>
                                                <div className="text-glow-green text-sm">₹{item.price.toFixed(2)}</div>
                                            </div>
                                            <div className="cmi-controls">
                                                <button
                                                    className="qty-btn"
                                                    onClick={() => removeFoodFromTable(showCanteenFor, item)}
                                                    disabled={currentQty === 0}
                                                    title="Decrease Qty"
                                                >
                                                    <Minus size={16} color="#000" strokeWidth={3} />
                                                </button>
                                                <span className="qty-display">{currentQty}</span>
                                                <button
                                                    className="qty-btn"
                                                    onClick={() => addFoodToTable(showCanteenFor, item)}
                                                    disabled={item.stock <= 0}
                                                    title="Increase Qty"
                                                >
                                                    <Plus size={16} color="#000" strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="modal-action-row">
                                <button className="glass-button modal-action-btn" onClick={() => setShowCanteenFor(null)}>Cancel</button>
                                <button className="primary-button modal-action-btn" onClick={() => setShowCanteenFor(null)}>Done</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* CHECKOUT MODAL */}
            {showCheckoutFor && (() => {
                const tableInfo = showCheckoutFor;
                const elapsedMs = Math.max(0, currentTime - tableInfo.startTime);
                // Cap at 60 minutes — billing stops after time is up
                const cappedMs = Math.min(elapsedMs, 60 * 60000);
                const minsElapsed = cappedMs / 60000;
                const playedCost = parseFloat((minsElapsed * tableInfo.rate).toFixed(2));
                const foodCost = (tableInfo.orders || []).reduce((sum, o) => sum + (o.price * o.qty), 0);
                const total = playedCost + foodCost;

                return (
                    <div className="overlay" onClick={() => setShowCheckoutFor(null)}>
                        <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowCheckoutFor(null)}>
                                <X size={18} />
                            </button>

                            {/* Header */}
                            <div className="checkout-header">
                                <h3 className="text-2xl font-bold text-glow-red">Checkout Session</h3>
                                <p className="text-muted text-sm">{tableInfo.name}</p>
                            </div>

                            {/* Receipt rows */}
                            <div className="checkout-receipt">
                                <div className="receipt-row">
                                    <span className="receipt-label">Table ({minsElapsed.toFixed(0)} min × ₹{tableInfo.rate}/min)</span>
                                    <span className="receipt-value">₹{playedCost.toFixed(2)}</span>
                                </div>

                                {(tableInfo.orders || []).length > 0 && (
                                    <>
                                        <div className="receipt-section-title">Canteen Orders</div>
                                        {tableInfo.orders.map((o, i) => (
                                            <div key={i} className="receipt-row receipt-sub">
                                                <span className="receipt-label">{o.name} × {o.qty}</span>
                                                <span className="receipt-value">₹{(o.qty * o.price).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        <div className="receipt-row receipt-sub receipt-subtotal">
                                            <span className="receipt-label">Canteen Subtotal</span>
                                            <span className="receipt-value">₹{foodCost.toFixed(2)}</span>
                                        </div>
                                    </>
                                )}

                                <div className="receipt-divider" />

                                <div className="receipt-row receipt-total">
                                    <span className="receipt-label">Total Payable</span>
                                    <span className="receipt-total-value text-glow-green">₹{total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="modal-action-row">
                                <button className="glass-button modal-action-btn" onClick={() => setShowCheckoutFor(null)}>Cancel</button>
                                <button className="primary-button modal-action-btn" style={{ background: '#10b981', color: 'white' }} onClick={finalizeCheckout}>
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ADD TABLE MODAL */}
            {showAddModal && (
                <div className="overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                            <X size={18} />
                        </button>
                        <div className="modal-header-block">
                            <h3 className="text-xl font-bold">Create New Table/Room</h3>
                        </div>

                        <form onSubmit={handleAddTable} className="flex-col gap-4">
                            <div className="form-group flex-col gap-2">
                                <label className="text-sm text-muted">What type of table is it?</label>
                                <select
                                    className="glass-input"
                                    value={newTableType}
                                    onChange={(e) => setNewTableType(e.target.value)}
                                >
                                    <option value="Snooker">Snooker Table</option>
                                    <option value="Pool">Pool Table</option>
                                    <option value="Play Station">Play Station</option>
                                    <option value="Other">Other (Custom)</option>
                                </select>
                                {newTableType === 'Other' && (
                                    <input
                                        type="text"
                                        className="glass-input mt-2"
                                        placeholder="Enter custom type..."
                                        value={customType}
                                        onChange={e => setCustomType(e.target.value)}
                                        required
                                    />
                                )}
                            </div>

                            <div className="form-group flex-col gap-2">
                                <label className="text-sm text-muted">Table Name</label>
                                <input
                                    type="text"
                                    className="glass-input"
                                    placeholder="e.g. VIP Pool 1"
                                    value={newTableName}
                                    onChange={e => setNewTableName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group flex-col gap-2">
                                <label className="text-sm text-muted">Rate Per Minute (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="glass-input text-lg font-bold"
                                    placeholder="2.50"
                                    value={newTableRate}
                                    onChange={e => setNewTableRate(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="modal-action-row">
                                <button type="button" className="glass-button modal-action-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="primary-button modal-action-btn">Create Table</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
