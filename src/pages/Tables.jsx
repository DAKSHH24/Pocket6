import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Square, Plus, Minus, Clock, X, Utensils, Bell, AlertTriangle, Trash2 } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc, writeBatch, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import './Tables.css';

export default function Tables() {
    const { clubId } = useAuth();
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
    const alertDropRef = useRef(null);
    const [addTableError, setAddTableError] = useState('');

    // PS Player Count Modal
    const [showPsStartModal, setShowPsStartModal] = useState(null); // table object

    // New Table Form
    const [newTableType, setNewTableType] = useState('Snooker');
    const [customType, setCustomType] = useState('');
    const [newTableName, setNewTableName] = useState('');
    const [newTableRate, setNewTableRate] = useState('');
    // PlayStation controller rates (1–4 controllers), stored as hourly
    const [psRates, setPsRates] = useState({ 1: '', 2: '', 3: '', 4: '' });

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // ── One-time migration ──────────────────────────────────────────────────
    // Existing Firestore docs were created before multi-tenancy was added and
    // have no clubId field. This effect runs once per login, finds every doc
    // across all 4 collections that is missing clubId, and stamps them in a
    // batch update. Safe to re-run — it only touches untagged documents.
    useEffect(() => {
        if (!clubId) return;
        let cancelled = false;
        const COLLECTIONS = ['tables', 'inventory', 'session_history', 'expenses'];

        async function migrateUntaggedDocs() {
            for (const colName of COLLECTIONS) {
                try {
                    const snap = await getDocs(collection(db, colName));
                    const untagged = snap.docs.filter(d => !d.data().clubId);
                    if (untagged.length === 0 || cancelled) continue;

                    // Batch in groups of 500 (Firestore limit)
                    for (let i = 0; i < untagged.length; i += 500) {
                        const batch = writeBatch(db);
                        untagged.slice(i, i + 500).forEach(d =>
                            batch.update(doc(db, colName, d.id), { clubId })
                        );
                        await batch.commit();
                    }
                    console.log(`[Migration] Stamped ${untagged.length} docs in '${colName}'`);
                } catch (err) {
                    console.error(`[Migration] Error in '${colName}':`, err);
                }
            }
        }

        migrateUntaggedDocs();
        return () => { cancelled = true; };
    }, [clubId]); // runs once per session
    // ───────────────────────────────────────────────────────────────────────

    // 1-second clock tick (drives live elapsed time display)
    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timerId);
    }, []);

    // Close inventory alert dropdown when clicking anywhere outside
    useEffect(() => {
        if (!showAlerts) return;
        function handleOutsideClick(e) {
            if (
                alertBtnRef.current && !alertBtnRef.current.contains(e.target) &&
                alertDropRef.current && !alertDropRef.current.contains(e.target)
            ) {
                setShowAlerts(false);
            }
        }
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showAlerts]);

    // Lock body scroll when any modal is open so background doesn't shift
    useEffect(() => {
        const anyOpen = showAddModal || showCanteenFor || showCheckoutFor;
        if (anyOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showAddModal, showCanteenFor, showCheckoutFor]);

    // Fetch only THIS club's tables
    useEffect(() => {
        if (!clubId) return;
        const q = query(collection(db, 'tables'), where('clubId', '==', clubId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedTables = [];
            snapshot.forEach(doc => {
                fetchedTables.push({ id: doc.id, ...doc.data() });
            });
            setTables(fetchedTables);
        });
        return () => unsubscribe();
    }, [clubId]);

    // Fetch only THIS club's inventory
    useEffect(() => {
        if (!clubId) return;
        const q = query(collection(db, 'inventory'), where('clubId', '==', clubId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedInventory = [];
            snapshot.forEach(doc => {
                fetchedInventory.push({ id: doc.id, ...doc.data() });
            });
            setInventory(fetchedInventory);
        });
        return () => unsubscribe();
    }, [clubId]);

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

    // PS-specific start: pick player count first
    const handlePsStartConfirm = async (table, playerCount) => {
        const rate = table.controllerRates?.[playerCount] ?? table.rate;
        try {
            await updateDoc(doc(db, 'tables', table.id), {
                status: 'occupied',
                startTime: Date.now(),
                pausedTime: 0,
                orders: [],
                activeControllers: parseInt(playerCount),
                rate
            });
            setShowPsStartModal(null);
        } catch (error) {
            console.error("Error starting PS table:", error);
        }
    };

    const handleDeleteTable = async (tableId, tableName) => {
        if (!window.confirm(`Are you sure you want to delete "${tableName}"? This action cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, 'tables', tableId));
        } catch (error) {
            console.error('Error deleting table:', error);
        }
    };

    const handleOpenCheckout = (table) => {
        setShowCheckoutFor(table);
    };

    const MIN_PLAY_COST = 50; // Minimum billing for playing time

    const finalizeCheckout = async () => {
        if (!showCheckoutFor) return;
        const tableInfo = showCheckoutFor;
        const elapsedMs = Math.max(0, currentTime - tableInfo.startTime);
        // Cap at 60 minutes
        const cappedMs = Math.min(elapsedMs, 60 * 60000);
        const minsElapsed = cappedMs / 60000;
        const rawPlayedCost = parseFloat((minsElapsed * tableInfo.rate).toFixed(2));
        // Enforce minimum ₹50 for playing time
        const playedCost = Math.max(rawPlayedCost, MIN_PLAY_COST);
        const foodCost = (tableInfo.orders || []).reduce((sum, o) => sum + (o.price * o.qty), 0);

        // Save to history — scoped to this club
        const historyItem = {
            clubId,
            tableName: tableInfo.name,
            type: tableInfo.type,
            playedCost,
            foodCost,
            totalCost: playedCost + foodCost,
            date: new Date().toLocaleString(),
            orders: tableInfo.orders || [],
            durationMins: parseFloat(minsElapsed.toFixed(1)),
            activeControllers: tableInfo.activeControllers || null,
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
        setAddTableError('');
        const type = newTableType === 'Other' ? customType : newTableType;

        if (newTableType === 'Play Station') {
            // At least one controller rate must be filled
            const hasAnyRate = Object.values(psRates).some(v => v !== '');
            if (!type || !newTableName || !hasAnyRate) {
                setAddTableError('Please fill in the table name and at least one controller rate.');
                return;
            }

            const newId = Date.now().toString();
            // Convert hourly rates to per-minute
            const controllerRates = {};
            Object.entries(psRates).forEach(([controllers, hourlyRate]) => {
                if (hourlyRate !== '') {
                    controllerRates[controllers] = parseFloat((parseFloat(hourlyRate) / 60).toFixed(4));
                }
            });
            const newTable = {
                clubId,
                type,
                name: newTableName,
                status: 'free',
                startTime: null,
                rate: controllerRates['1'] || 0,
                controllerRates,
                activeControllers: 1,
                customer: '',
                note: '',
                pausedTime: 0,
                orders: []
            };
            try {
                await setDoc(doc(db, 'tables', newId), newTable);
                setNewTableName('');
                setPsRates({ 1: '', 2: '', 3: '', 4: '' });
                setShowAddModal(false);
            } catch (error) {
                console.error("Error adding table:", error);
            }
        } else {
            if (!type || !newTableName || !newTableRate) {
                setAddTableError('Please fill in all fields before creating the table.');
                return;
            }
            // Convert hourly rate to per-minute
            const ratePerMinute = parseFloat((parseFloat(newTableRate) / 60).toFixed(4));
            const newId = Date.now().toString();
            const newTable = {
                clubId,
                type,
                name: newTableName,
                status: 'free',
                startTime: null,
                rate: ratePerMinute,
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

    const baseFiltered = activeFilter === 'All' ? tables : tables.filter(t => t.type === activeFilter);
    const filteredTables = searchQuery.trim()
        ? baseFiltered.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : baseFiltered;
    const categories = ['All', ...new Set(tables.map(t => t.type))];

    return (
        <div className="tables-container">
            <div className="page-header">
                <div>
                    <h2>Tables & Sessions</h2>
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
                                    <div className="notif-dropdown glass-panel" ref={alertDropRef}>
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

            <div className="search-bar-wrapper">
                <span className="search-icon-inner">🔍</span>
                <input
                    type="text"
                    className="glass-input search-input"
                    placeholder="Search tables by name…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="search-clear-btn" onClick={() => setSearchQuery('')} title="Clear search">✕</button>
                )}
            </div>

            <div className="tables-grid">
                {filteredTables.length === 0 && (
                    <div style={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4rem 2rem',
                        gap: '1rem',
                        color: 'var(--text-muted)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '3rem', opacity: 0.4 }}>🎱</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {tables.length === 0 ? 'No tables yet' : 'No tables match your search'}
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                            {tables.length === 0
                                ? 'Click "+ Add New Table" to set up your first table.'
                                : 'Try a different search or filter.'}
                        </div>
                    </div>
                )}
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
                                    {!isOccupied && (
                                        <button className="tc-delete-btn-top" onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id, table.name); }} title="Delete Table">
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                    <span className="tc-type-pill">{table.type}</span>
                                </div>
                            </div>

                            <div className="tc-main-status">
                                <div className="tc-timer-col">
                                    {isOccupied ? (
                                        <>
                                            <div className={`tc-big-timer${elapsedMs >= 3600000 ? ' tc-timer-expired' : ''}`}>{formatCountdown(elapsedMs)}</div>
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

                            {/* Order display list — sorted alphabetically */}
                            {table.orders && table.orders.length > 0 && (
                                <div className="canteen-orders-block">
                                    {[...table.orders]
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((o, idx) => (
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
                                    <button
                                        className="tc-action-circle bg-green tooltip-container"
                                        onClick={() => {
                                            if (table.type === 'Play Station' && table.controllerRates) {
                                                setShowPsStartModal(table);
                                            } else {
                                                handleStart(table.id);
                                            }
                                        }}
                                        title="Start Session"
                                        style={{ width: '100%', borderRadius: '8px' }}
                                    >
                                        <Play size={20} fill="#fff" className="mr-2" /> Start Session
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* CANTEEN MODAL — portal so it's always viewport-centered */}
            {showCanteenFor && createPortal((() => {
                const drinksFilter = (item) => item.category === 'Drinks';
                const tobaccoFilter = (item) => item.category === 'Tobacco/Lounge';
                const snacksFilter = (item) => item.category !== 'Drinks' && item.category !== 'Tobacco/Lounge';
                const filteredInventory = [...inventory]
                    .filter(
                        canteenTab === 'Drinks' ? drinksFilter :
                            canteenTab === 'Tobacco' ? tobaccoFilter :
                                snacksFilter
                    )
                    .sort((a, b) => a.name.localeCompare(b.name));
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
            })(), document.body)}

            {/* PS PLAYER COUNT MODAL */}
            {showPsStartModal && createPortal((() => {
                const psTable = showPsStartModal;
                const availableRates = psTable.controllerRates || {};
                const availableCounts = Object.keys(availableRates).map(Number).sort((a,b) => a-b);
                return (
                    <div className="overlay" onClick={() => setShowPsStartModal(null)}>
                        <div className="modal modal-relative ps-start-modal" onClick={e => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowPsStartModal(null)}>
                                <X size={18} />
                            </button>
                            <div className="ps-start-header">
                                <div className="ps-start-icon">🎮</div>
                                <h3 className="text-xl font-bold">How many people are playing?</h3>
                                <p className="text-muted text-sm">Select the number of players to apply the correct rate.</p>
                            </div>
                            <div className="ps-player-grid">
                                {availableCounts.map(count => {
                                    const hourlyRate = (availableRates[count] * 60).toFixed(0);
                                    return (
                                        <button
                                            key={count}
                                            className="ps-player-btn"
                                            onClick={() => handlePsStartConfirm(psTable, count)}
                                        >
                                            <span className="ps-player-emoji">{count === 1 ? '👤' : count === 2 ? '👥' : '👥'}</span>
                                            <span className="ps-player-count">{count} {count === 1 ? 'Player' : 'Players'}</span>
                                            <span className="ps-player-rate">₹{hourlyRate}/hr</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })(), document.body)}

            {/* CHECKOUT MODAL — portal */}
            {showCheckoutFor && createPortal((() => {
                const tableInfo = showCheckoutFor;
                const elapsedMs = Math.max(0, currentTime - tableInfo.startTime);
                const cappedMs = Math.min(elapsedMs, 60 * 60000);
                const minsElapsed = cappedMs / 60000;
                const rawPlayedCost = parseFloat((minsElapsed * tableInfo.rate).toFixed(2));
                const playedCost = Math.max(rawPlayedCost, 50);
                const minimumApplied = rawPlayedCost < 50;
                const foodCost = (tableInfo.orders || []).reduce((sum, o) => sum + (o.price * o.qty), 0);
                const total = playedCost + foodCost;

                return (
                    <div className="overlay" onClick={() => setShowCheckoutFor(null)}>
                        <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowCheckoutFor(null)}>
                                <X size={18} />
                            </button>

                            <div className="checkout-header">
                                <h3 className="text-2xl font-bold text-glow-red">Checkout Session</h3>
                                <p className="text-muted text-sm">{tableInfo.name}</p>
                            </div>

                            <div className="checkout-receipt">
                                <div className="receipt-row">
                                    <span className="receipt-label">Table ({minsElapsed.toFixed(0)} min × ₹{tableInfo.rate.toFixed(2)}/min)</span>
                                    <span className="receipt-value">₹{playedCost.toFixed(2)}</span>
                                </div>
                                {minimumApplied && (
                                    <div className="receipt-minimum-note">
                                        ⚠️ Minimum charge of ₹50 applied
                                    </div>
                                )}

                                {(tableInfo.orders || []).length > 0 && (
                                    <>
                                        <div className="receipt-section-title">Canteen Orders</div>
                                        {[...tableInfo.orders]
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map((o, i) => (
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
            })(), document.body)}

            {/* ADD TABLE MODAL — portal */}
            {showAddModal && createPortal(
                <div className="overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                            <X size={18} />
                        </button>
                        <div className="modal-header-block">
                            <h3 className="text-xl font-bold">Create New Table/Room</h3>
                        </div>

                        <form onSubmit={handleAddTable} className="flex-col gap-4" noValidate>
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

                            {newTableType === 'Play Station' ? (
                                <div className="form-group flex-col gap-2">
                                    <label className="text-sm text-muted">Hourly Rate per Controller Count (₹/hr)</label>
                                    <div className="ps-rates-grid">
                                        {[1, 2, 3, 4].map(n => (
                                            <div key={n} className="ps-rate-row">
                                                <span className="ps-rate-label">🎮 {n} Controller{n > 1 ? 's' : ''}</span>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    className="glass-input ps-rate-input"
                                                    placeholder={`₹ / hr`}
                                                    value={psRates[n]}
                                                    onChange={e => setPsRates(prev => ({ ...prev, [n]: e.target.value }))}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="ps-rate-hint">Rates will be automatically converted to per-minute billing.</p>
                                </div>
                            ) : (
                                <div className="form-group flex-col gap-2">
                                    <label className="text-sm text-muted">Rate Per Hour (₹)</label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        className="glass-input text-lg font-bold"
                                        placeholder="150"
                                        value={newTableRate}
                                        onChange={e => setNewTableRate(e.target.value)}
                                        required
                                    />
                                    <p className="ps-rate-hint">Will be billed at ₹{newTableRate ? (parseFloat(newTableRate) / 60).toFixed(2) : '0.00'}/min</p>
                                </div>
                            )}

                            {addTableError && (
                                <div style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.5rem 0.8rem' }}>
                                    {addTableError}
                                </div>
                            )}
                            <div className="modal-action-row">
                                <button type="button" className="glass-button modal-action-btn" onClick={() => { setShowAddModal(false); setAddTableError(''); }}>Cancel</button>
                                <button type="submit" className="primary-button modal-action-btn">Create Table</button>
                            </div>
                        </form>
                    </div>
                </div>
                , document.body)}
        </div>
    );
}
