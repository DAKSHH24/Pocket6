import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Square, Plus, Minus, Clock, X, Utensils, Bell, AlertTriangle, Trash2, ShoppingBag, User, MoreVertical } from 'lucide-react';
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
    // Due flow: 'checkout' | 'name_input'
    const [checkoutStep, setCheckoutStep] = useState('checkout');
    const [dueName, setDueName] = useState('');
    const [showAlerts, setShowAlerts] = useState(false);
    const alertBtnRef = useRef(null);
    const alertDropRef = useRef(null);
    const [addTableError, setAddTableError] = useState('');

    // Walk-in Order State
    const [showWalkIn, setShowWalkIn] = useState(false);
    const [walkInName, setWalkInName] = useState('');
    const [walkInOrders, setWalkInOrders] = useState([]); // [{...item, qty}]
    const [walkInTab, setWalkInTab] = useState('Snacks');

    // PS Player Count Modal
    const [showPsStartModal, setShowPsStartModal] = useState(null); // table object

    // ── New: shared header 3-dot menu (table deletion) ──
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const headerMenuRef = useRef(null);
    const [deleteConfirmFor, setDeleteConfirmFor] = useState(null); // { id, name }

    // ── New: Custom Start Time modal ──
    // 'none' | table object waiting for start mode choice
    const [showStartModal, setShowStartModal] = useState(null);
    const [customStartTime, setCustomStartTime] = useState(''); // HH:MM string (24hr, for internal use)
    const [startHour, setStartHour] = useState('12');
    const [startMinute, setStartMinute] = useState('00');
    const [startAmPm, setStartAmPm] = useState('AM');
    const [startTimeError, setStartTimeError] = useState('');

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
    useEffect(() => {
        if (!clubId) return;
        let cancelled = false;
        const COLLECTIONS = ['tables', 'inventory', 'session_history', 'expenses', 'bills'];

        async function migrateUntaggedDocs() {
            for (const colName of COLLECTIONS) {
                try {
                    const snap = await getDocs(collection(db, colName));
                    const untagged = snap.docs.filter(d => !d.data().clubId);
                    if (untagged.length === 0 || cancelled) continue;
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
    }, [clubId]);
    // ───────────────────────────────────────────────────────────────────────

    // 1-second clock tick
    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timerId);
    }, []);

    // Close alert dropdown on outside click
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

    // Close header 3-dot menu on outside click
    useEffect(() => {
        if (!showHeaderMenu) return;
        function handleOutside(e) {
            if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
                setShowHeaderMenu(false);
            }
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [showHeaderMenu]);

    // Lock body scroll when any modal is open
    useEffect(() => {
        const anyOpen = showAddModal || showCanteenFor || showCheckoutFor || showWalkIn
            || showStartModal || deleteConfirmFor || showPsStartModal;
        document.body.style.overflow = anyOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [showAddModal, showCanteenFor, showCheckoutFor, showWalkIn, showStartModal, deleteConfirmFor, showPsStartModal]);

    // Fetch this club's tables
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

    // Fetch this club's inventory
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

    // ── Start session helpers ──
    // Called when Start Session button is clicked — shows choice modal (non-PS)
    const handleStartClick = (table) => {
        const defaultTime = new Date();
        const rawHours = defaultTime.getHours();
        const mins = String(defaultTime.getMinutes()).padStart(2, '0');
        const ampm = rawHours >= 12 ? 'PM' : 'AM';
        const h12 = rawHours % 12 || 12;
        setStartHour(String(h12));
        setStartMinute(mins);
        setStartAmPm(ampm);
        // also keep 24hr string for internal commit
        setCustomStartTime(`${String(rawHours).padStart(2,'0')}:${mins}`);
        setStartTimeError('');
        setShowStartModal(table);
    };

    // Commit a start with a given timestamp
    const commitStart = async (table, startTs) => {
        try {
            await updateDoc(doc(db, 'tables', table.id), {
                status: 'occupied',
                startTime: startTs,
                pausedTime: 0,
                orders: []
            });
            setShowStartModal(null);
        } catch (error) {
            console.error('Error starting table:', error);
        }
    };

    // "Start Now"
    const handleStartNow = () => {
        if (!showStartModal) return;
        commitStart(showStartModal, Date.now());
    };

    // "Custom Time" — parse the 12hr inputs and apply today's date
    const handleStartCustomTime = () => {
        if (!showStartModal) return;
        const h = parseInt(startHour, 10);
        const m = parseInt(startMinute, 10);
        if (isNaN(h) || isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) {
            setStartTimeError('Invalid time. Use 1–12 for hour and 00–59 for minutes.');
            return;
        }
        let hours24 = h % 12;
        if (startAmPm === 'PM') hours24 += 12;
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours24, m, 0, 0);
        if (start.getTime() > Date.now()) {
            setStartTimeError('Start time cannot be in the future.');
            return;
        }
        commitStart(showStartModal, start.getTime());
    };

    // PS-specific start: still shows choice modal first, then picks players
    const handlePsStartConfirm = async (table, playerCount, startTs) => {
        const rate = table.controllerRates?.[playerCount] ?? table.rate;
        try {
            await updateDoc(doc(db, 'tables', table.id), {
                status: 'occupied',
                startTime: startTs,
                pausedTime: 0,
                orders: [],
                activeControllers: parseInt(playerCount),
                rate
            });
            setShowPsStartModal(null);
            setShowStartModal(null);
        } catch (error) {
            console.error('Error starting PS table:', error);
        }
    };

    // ── In-app delete confirmation ──
    const handleDeleteTable = async () => {
        if (!deleteConfirmFor) return;
        try {
            await deleteDoc(doc(db, 'tables', deleteConfirmFor.id));
        } catch (error) {
            console.error('Error deleting table:', error);
        }
        setDeleteConfirmFor(null);
    };

    const handleOpenCheckout = (table) => {
        setShowCheckoutFor(table);
        setCheckoutStep('checkout');
        setDueName('');
    };

    const MIN_PLAY_COST = 50;

    const finalizeCheckout = async () => {
        if (!showCheckoutFor) return;
        const tableInfo = showCheckoutFor;
        const elapsedMs = Math.max(0, currentTime - tableInfo.startTime);
        const cappedMs = Math.min(elapsedMs, 60 * 60000);
        const minsElapsed = cappedMs / 60000;
        const rawPlayedCost = parseFloat((minsElapsed * tableInfo.rate).toFixed(2));
        const playedCost = Math.max(rawPlayedCost, MIN_PLAY_COST);
        const foodCost = (tableInfo.orders || []).reduce((sum, o) => sum + (o.price * o.qty), 0);

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
            paymentStatus: 'paid',
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
            console.error('Error finalizing checkout:', error);
        }
    };

    const finalizeCheckoutDue = async (name) => {
        if (!showCheckoutFor || !name.trim()) return;
        const tableInfo = showCheckoutFor;
        const elapsedMs = Math.max(0, currentTime - tableInfo.startTime);
        const cappedMs = Math.min(elapsedMs, 60 * 60000);
        const minsElapsed = cappedMs / 60000;
        const rawPlayedCost = parseFloat((minsElapsed * tableInfo.rate).toFixed(2));
        const playedCost = Math.max(rawPlayedCost, MIN_PLAY_COST);
        const foodCost = (tableInfo.orders || []).reduce((sum, o) => sum + (o.price * o.qty), 0);
        const totalAmount = playedCost + foodCost;
        const dateStr = new Date().toLocaleString();

        try {
            await addDoc(collection(db, 'session_history'), {
                clubId,
                tableName: tableInfo.name,
                type: tableInfo.type,
                playedCost,
                foodCost,
                totalCost: totalAmount,
                date: dateStr,
                orders: tableInfo.orders || [],
                durationMins: parseFloat(minsElapsed.toFixed(1)),
                activeControllers: tableInfo.activeControllers || null,
                paymentStatus: 'due',
                personName: name.trim(),
                createdAt: Date.now()
            });

            await addDoc(collection(db, 'bills'), {
                clubId,
                personName: name.trim(),
                type: 'session',
                tableName: tableInfo.name,
                playedCost,
                foodCost,
                totalAmount,
                orders: tableInfo.orders || [],
                status: 'due',
                date: dateStr,
                paidAt: null,
                paidAtDate: null,
                createdAt: Date.now()
            });

            await updateDoc(doc(db, 'tables', tableInfo.id), {
                status: 'free',
                startTime: null,
                customer: '',
                note: '',
                pausedTime: 0,
                orders: []
            });

            setShowCheckoutFor(null);
            setDueName('');
            setCheckoutStep('checkout');
        } catch (error) {
            console.error('Error finalizing due checkout:', error);
        }
    };

    // Walk-in canteen order helpers
    const addWalkInItem = (item) => {
        setWalkInOrders(prev => {
            const existing = prev.find(o => o.id === item.id);
            if (existing) return prev.map(o => o.id === item.id ? { ...o, qty: o.qty + 1 } : o);
            return [...prev, { ...item, qty: 1 }];
        });
    };

    const removeWalkInItem = (item) => {
        setWalkInOrders(prev => {
            const existing = prev.find(o => o.id === item.id);
            if (!existing) return prev;
            if (existing.qty <= 1) return prev.filter(o => o.id !== item.id);
            return prev.map(o => o.id === item.id ? { ...o, qty: o.qty - 1 } : o);
        });
    };

    const finalizeWalkIn = async (paymentStatus) => {
        if (!walkInName.trim() || walkInOrders.length === 0) return;
        const foodCost = walkInOrders.reduce((s, o) => s + o.price * o.qty, 0);
        const dateStr = new Date().toLocaleString();

        try {
            const batch = writeBatch(db);
            walkInOrders.forEach(o => {
                batch.update(doc(db, 'inventory', String(o.id)), {
                    stock: Math.max(0, o.stock - o.qty)
                });
            });
            await batch.commit();

            if (paymentStatus === 'due') {
                await addDoc(collection(db, 'bills'), {
                    clubId,
                    personName: walkInName.trim(),
                    type: 'canteen_only',
                    tableName: null,
                    playedCost: 0,
                    foodCost,
                    totalAmount: foodCost,
                    orders: walkInOrders,
                    status: 'due',
                    date: dateStr,
                    paidAt: null,
                    paidAtDate: null,
                    createdAt: Date.now()
                });
            }

            await addDoc(collection(db, 'session_history'), {
                clubId,
                tableName: 'Walk-in',
                type: 'Walk-in',
                playedCost: 0,
                foodCost,
                totalCost: foodCost,
                date: dateStr,
                orders: walkInOrders,
                durationMins: 0,
                paymentStatus,
                personName: walkInName.trim(),
                createdAt: Date.now()
            });

            setShowWalkIn(false);
            setWalkInName('');
            setWalkInOrders([]);
            setWalkInTab('Snacks');
        } catch (err) {
            console.error('Error finalizing walk-in order:', err);
        }
    };

    const handleAddTable = async (e) => {
        e.preventDefault();
        setAddTableError('');
        const type = newTableType === 'Other' ? customType : newTableType;

        if (newTableType === 'Play Station') {
            const hasAnyRate = Object.values(psRates).some(v => v !== '');
            if (!type || !newTableName || !hasAnyRate) {
                setAddTableError('Please fill in the table name and at least one controller rate.');
                return;
            }

            const newId = Date.now().toString();
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
                console.error('Error adding table:', error);
            }
        } else {
            if (!type || !newTableName || !newTableRate) {
                setAddTableError('Please fill in all fields before creating the table.');
                return;
            }
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
                console.error('Error adding table:', error);
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
            console.error('Error adding food to table:', error);
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
                console.error('Error removing food from table:', error);
            }
        }
    };

    const formatCountdown = (ms) => {
        const defaultTime = 60 * 60000;
        let remaining = defaultTime - ms;
        if (remaining < 0) remaining = 0;
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

    // ── Checkout receipt helpers ──
    const getCheckoutCosts = (tableInfo) => {
        if (!tableInfo) return { minsElapsed: 0, playedCost: 0, foodCost: 0, total: 0, minimumApplied: false };
        const elapsedMs = Math.max(0, currentTime - tableInfo.startTime);
        const cappedMs = Math.min(elapsedMs, 60 * 60000);
        const minsElapsed = cappedMs / 60000;
        const rawPlayedCost = parseFloat((minsElapsed * tableInfo.rate).toFixed(2));
        const minimumApplied = rawPlayedCost < MIN_PLAY_COST;
        const playedCost = Math.max(rawPlayedCost, MIN_PLAY_COST);
        const foodCost = (tableInfo.orders || []).reduce((sum, o) => sum + (o.price * o.qty), 0);
        return { minsElapsed, playedCost, foodCost, total: playedCost + foodCost, minimumApplied };
    };

    return (
        <div className="tables-container">
            <div className="page-header">
                <div>
                    <h2>Tables &amp; Sessions</h2>
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
                    <button
                        className="walkin-btn"
                        onClick={() => { setShowWalkIn(true); setWalkInName(''); setWalkInOrders([]); }}
                        title="Walk-in canteen order (no table)"
                    >
                        <ShoppingBag size={16} /> Walk-in Order
                    </button>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                        <button className="primary-button" onClick={() => setShowAddModal(true)}>+ Add New Table</button>
                        {/* Shared ⋮ menu for table deletion — at extreme right */}
                        {tables.some(t => t.status !== 'occupied') && (
                            <div className="tc-three-dot-wrap" ref={headerMenuRef}>
                                <button
                                    className="tc-three-dot-btn"
                                    onClick={() => setShowHeaderMenu(v => !v)}
                                    title="Table options"
                                >
                                    <MoreVertical size={18} />
                                </button>
                                {showHeaderMenu && (
                                    <div className="tc-dot-dropdown glass-panel" style={{ right: 0, minWidth: 200 }}>
                                        <div style={{ padding: '0.4rem 0.75rem 0.25rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                            Delete a Table
                                        </div>
                                        {tables
                                            .filter(t => t.status !== 'occupied')
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(t => (
                                                <button
                                                    key={t.id}
                                                    className="tc-dot-item tc-dot-danger"
                                                    onClick={() => {
                                                        setShowHeaderMenu(false);
                                                        setDeleteConfirmFor({ id: t.id, name: t.name });
                                                    }}
                                                >
                                                    <Trash2 size={13} /> {t.name}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
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
                                                // PS: show start modal first, then player count
                                                const now = new Date();
                                                const rawH = now.getHours();
                                                const mins = String(now.getMinutes()).padStart(2, '0');
                                                setStartHour(String(rawH % 12 || 12));
                                                setStartMinute(mins);
                                                setStartAmPm(rawH >= 12 ? 'PM' : 'AM');
                                                setCustomStartTime(`${String(rawH).padStart(2,'0')}:${mins}`);
                                                setStartTimeError('');
                                                setShowStartModal(table);
                                            } else {
                                                handleStartClick(table);
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

            {/* ── IN-APP DELETE CONFIRMATION MODAL ── */}
            {deleteConfirmFor && createPortal(
                <div className="overlay" onClick={() => setDeleteConfirmFor(null)}>
                    <div className="modal modal-relative modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-block" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗑️</div>
                            <h3 className="text-xl font-bold text-glow-red">Delete Table?</h3>
                            <p className="text-muted text-sm" style={{ marginTop: '0.5rem' }}>
                                Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>"{deleteConfirmFor.name}"</strong>?
                                <br />This action cannot be undone.
                            </p>
                        </div>
                        <div className="checkout-action-row" style={{ paddingTop: '0.5rem' }}>
                            <button className="glass-button modal-action-btn" onClick={() => setDeleteConfirmFor(null)}>
                                Cancel
                            </button>
                            <button
                                className="modal-action-btn"
                                style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                                onClick={handleDeleteTable}
                            >
                                <Trash2 size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── START SESSION MODAL (Now / Custom Time) ── */}
            {showStartModal && !showPsStartModal && createPortal(
                <div className="overlay" onClick={() => { setShowStartModal(null); setStartTimeError(''); }}>
                    <div className="modal modal-relative modal-sm" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => { setShowStartModal(null); setStartTimeError(''); }}><X size={18} /></button>
                        <div className="modal-header-block">
                            <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>🕐</div>
                            <h3 className="text-xl font-bold">Start Session</h3>
                            <p className="text-muted text-sm">{showStartModal.name}</p>
                        </div>

                        {/* Start Now — green (TOP) */}
                        <div style={{ padding: '0 1.5rem 1rem' }}>
                            <button
                                className="tc-action-circle bg-green"
                                style={{ width: '100%', borderRadius: '10px', padding: '0.85rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                onClick={() => {
                                    if (showStartModal.type === 'Play Station' && showStartModal.controllerRates) {
                                        setShowPsStartModal(showStartModal);
                                    } else {
                                        handleStartNow();
                                    }
                                }}
                            >
                                <Play size={18} fill="#fff" />
                                Start Now
                            </button>
                        </div>

                        {/* Divider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 1.5rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                            or set custom start time
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                        </div>

                        {/* Custom Time — 12hr with AM/PM (BOTTOM) */}
                        <div style={{ padding: '0 1.5rem 1.5rem' }}>
                            <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>
                                When did the session actually start?
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {/* Hour */}
                                <input
                                    type="number"
                                    min="1" max="12"
                                    className="glass-input"
                                    style={{ width: '4rem', textAlign: 'center', padding: '0.65rem 0.4rem' }}
                                    value={startHour}
                                    onChange={e => { setStartHour(e.target.value); setStartTimeError(''); }}
                                    placeholder="12"
                                />
                                <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '1.1rem' }}>:</span>
                                {/* Minute */}
                                <input
                                    type="number"
                                    min="0" max="59"
                                    className="glass-input"
                                    style={{ width: '4rem', textAlign: 'center', padding: '0.65rem 0.4rem' }}
                                    value={startMinute}
                                    onChange={e => { setStartMinute(e.target.value.padStart(2,'0')); setStartTimeError(''); }}
                                    placeholder="00"
                                />
                                {/* AM / PM toggle */}
                                <button
                                    type="button"
                                    onClick={() => setStartAmPm(p => p === 'AM' ? 'PM' : 'AM')}
                                    style={{
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        background: startAmPm === 'AM' ? 'rgba(59,130,246,0.18)' : 'rgba(239,68,68,0.15)',
                                        color: startAmPm === 'AM' ? '#63b3ed' : '#f87171',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        letterSpacing: '0.04em',
                                        transition: 'all 0.18s'
                                    }}
                                >
                                    {startAmPm}
                                </button>
                                {/* Set Time button — pure white bg, black text */}
                                <button
                                    type="button"
                                    className="modal-action-btn"
                                    style={{ flex: 1, padding: '0.65rem 0.8rem', background: '#ffffff', color: '#111111', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    onClick={() => {
                                        if (showStartModal.type === 'Play Station' && showStartModal.controllerRates) {
                                            setStartTimeError('');
                                            setShowPsStartModal(showStartModal);
                                        } else {
                                            handleStartCustomTime();
                                        }
                                    }}
                                >
                                    Set Time
                                </button>
                            </div>
                            {startTimeError && (
                                <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.4rem' }}>⚠ {startTimeError}</div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── PS PLAYER COUNT MODAL ── */}
            {showPsStartModal && createPortal(
                <div className="overlay" onClick={() => { setShowPsStartModal(null); setShowStartModal(null); }}>
                    <div className="modal modal-relative modal-sm" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => { setShowPsStartModal(null); setShowStartModal(null); }}><X size={18} /></button>
                        <div className="modal-header-block">
                            <h3 className="text-xl font-bold">Controllers</h3>
                            <p className="text-muted text-sm">How many players for {showPsStartModal.name}?</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '0 1.5rem 1.5rem' }}>
                            {[1, 2, 3, 4].map(count => {
                                const ratePerMin = showPsStartModal.controllerRates?.[count];
                                if (!ratePerMin) return null;
                                const hourlyRate = (ratePerMin * 60).toFixed(0);
                                return (
                                    <button
                                        key={count}
                                        className="ps-player-btn glass-panel"
                                        onClick={() => {
                                            // Determine start timestamp
                                            let startTs = Date.now();
                                            if (customStartTime && showStartModal) {
                                                const [hh, mm] = customStartTime.split(':').map(Number);
                                                const now = new Date();
                                                const parsed = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
                                                if (parsed.getTime() <= Date.now()) startTs = parsed.getTime();
                                            }
                                            handlePsStartConfirm(showPsStartModal, count, startTs);
                                        }}
                                    >
                                        <div style={{ fontSize: '1.6rem' }}>🎮</div>
                                        <div className="font-bold">{count} Player{count > 1 ? 's' : ''}</div>
                                        <div className="text-sm text-muted">₹{hourlyRate}/hr</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* CANTEEN MODAL */}
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
                            <div className="modal-action-row" style={{ padding: '1rem 1.5rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <button className="primary-button modal-action-btn" onClick={() => setShowCanteenFor(null)}>Done</button>
                            </div>
                        </div>
                    </div>
                );
            })(), document.body)}

            {/* CHECKOUT MODAL */}
            {showCheckoutFor && createPortal((() => {
                const tableInfo = showCheckoutFor;
                const { minsElapsed, playedCost, foodCost, total, minimumApplied } = getCheckoutCosts(tableInfo);

                return (
                    <div className="overlay" onClick={() => setShowCheckoutFor(null)}>
                        <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowCheckoutFor(null)}><X size={18} /></button>
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

                            {checkoutStep === 'checkout' && (
                                <div className="checkout-action-row">
                                    <button
                                        className="glass-button modal-action-btn"
                                        onClick={() => setShowCheckoutFor(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="modal-action-btn checkout-due-btn"
                                        onClick={() => setCheckoutStep('name_input')}
                                    >
                                        ⏳ Due
                                    </button>
                                    <button
                                        className="modal-action-btn checkout-paid-btn"
                                        onClick={finalizeCheckout}
                                    >
                                        ✓ Paid
                                    </button>
                                </div>
                            )}

                            {checkoutStep === 'name_input' && (
                                <div className="checkout-due-step">
                                    <div className="due-step-title">
                                        <User size={16} /> Who is leaving without paying?
                                    </div>
                                    <input
                                        className="glass-input"
                                        placeholder="Enter customer name for Due"
                                        value={dueName}
                                        onChange={e => setDueName(e.target.value)}
                                        autoFocus
                                        onKeyDown={e => { if (e.key === 'Enter' && dueName.trim()) finalizeCheckoutDue(dueName); }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                                        <button className="glass-button modal-action-btn" style={{ flex: 1 }} onClick={() => setCheckoutStep('checkout')}>← Back</button>
                                        <button
                                            className="modal-action-btn checkout-due-btn"
                                            style={{ flex: 2 }}
                                            disabled={!dueName.trim()}
                                            onClick={() => finalizeCheckoutDue(dueName)}
                                        >
                                            Confirm Due
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })(), document.body)}

            {/* WALK-IN MODAL */}
            {showWalkIn && createPortal((() => {
                const drinksFilter = (item) => item.category === 'Drinks';
                const tobaccoFilter = (item) => item.category === 'Tobacco/Lounge';
                const snacksFilter = (item) => item.category !== 'Drinks' && item.category !== 'Tobacco/Lounge';
                const filteredInv = [...inventory]
                    .filter(
                        walkInTab === 'Drinks' ? drinksFilter :
                            walkInTab === 'Tobacco' ? tobaccoFilter :
                                snacksFilter
                    )
                    .sort((a, b) => a.name.localeCompare(b.name));
                const walkInTotal = walkInOrders.reduce((s, o) => s + o.price * o.qty, 0);
                return (
                    <div className="overlay" onClick={() => setShowWalkIn(false)}>
                        <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setShowWalkIn(false)}><X size={18} /></button>
                            <div className="modal-header-block">
                                <h3 className="text-xl font-bold">Walk-in Order</h3>
                                <p className="text-sm text-muted">Canteen order without a table</p>
                            </div>

                            <div style={{ padding: '0 1.5rem 0.75rem' }}>
                                <div className="walkin-name-row">
                                    <User size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <input
                                        className="glass-input"
                                        placeholder="Customer name (optional)"
                                        value={walkInName}
                                        onChange={e => setWalkInName(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </div>

                            <div className="canteen-seg-control" style={{ margin: '0 1.5rem 0.5rem' }}>
                                <button className={`seg-btn${walkInTab === 'Snacks' ? ' seg-active' : ''}`} onClick={() => setWalkInTab('Snacks')}>Snacks</button>
                                <button className={`seg-btn${walkInTab === 'Drinks' ? ' seg-active' : ''}`} onClick={() => setWalkInTab('Drinks')}>Drinks</button>
                                <button className={`seg-btn${walkInTab === 'Tobacco' ? ' seg-active' : ''}`} onClick={() => setWalkInTab('Tobacco')}>Tobacco</button>
                            </div>

                            <div className="canteen-items-list">
                                {filteredInv.length === 0 ? <p className="text-muted text-center p-4">No items.</p> : null}
                                {filteredInv.map(item => {
                                    const orderItem = walkInOrders.find(o => o.id === item.id);
                                    const qty = orderItem ? orderItem.qty : 0;
                                    return (
                                        <div key={item.id} className="canteen-modal-item glass-panel">
                                            <div className="cmi-info">
                                                <div className="font-bold">{item.name}</div>
                                                <div className="text-glow-green text-sm">₹{item.price.toFixed(2)}</div>
                                            </div>
                                            <div className="cmi-controls">
                                                <button className="qty-btn" onClick={() => removeWalkInItem(item)} disabled={qty === 0}><Minus size={16} color="#000" strokeWidth={3} /></button>
                                                <span className="qty-display">{qty}</span>
                                                <button className="qty-btn" onClick={() => addWalkInItem(item)} disabled={item.stock <= 0}><Plus size={16} color="#000" strokeWidth={3} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {walkInOrders.length > 0 && (
                                <div style={{ padding: '0 1.5rem' }}>
                                    <div className="walkin-total-row">
                                        <span className="text-sm text-muted">Total</span>
                                        <span className="walkin-total-val">₹{walkInTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="checkout-action-row">
                                <button className="glass-button modal-action-btn" onClick={() => setShowWalkIn(false)}>Cancel</button>
                                <button
                                    className="modal-action-btn checkout-due-btn"
                                    disabled={walkInOrders.length === 0}
                                    onClick={() => finalizeWalkIn('due')}
                                >
                                    ⏳ Due
                                </button>
                                <button
                                    className="modal-action-btn checkout-paid-btn"
                                    disabled={walkInOrders.length === 0}
                                    onClick={() => finalizeWalkIn('paid')}
                                >
                                    ✓ Paid
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })(), document.body)}

            {/* ADD TABLE MODAL */}
            {showAddModal && createPortal(
                <div className="overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
                        <div className="modal-header-block">
                            <h3 className="text-xl font-bold">Add New Table</h3>
                        </div>
                        <form onSubmit={handleAddTable} className="flex-col gap-4" noValidate>
                            <div className="form-group">
                                <label className="text-sm text-muted">Table Type</label>
                                <select
                                    className="glass-input"
                                    value={newTableType}
                                    onChange={e => setNewTableType(e.target.value)}
                                >
                                    <option>Snooker</option>
                                    <option>Pool</option>
                                    <option>Play Station</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            {newTableType === 'Other' && (
                                <div className="form-group">
                                    <label className="text-sm text-muted">Custom Type Name</label>
                                    <input
                                        type="text"
                                        className="glass-input"
                                        placeholder="e.g. Carrom, Chess…"
                                        value={customType}
                                        onChange={e => setCustomType(e.target.value)}
                                        required
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label className="text-sm text-muted">Table Name</label>
                                <input
                                    type="text"
                                    className="glass-input"
                                    placeholder="e.g. Snooker 1"
                                    value={newTableName}
                                    onChange={e => setNewTableName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            {newTableType !== 'Play Station' && (
                                <div className="form-group">
                                    <label className="text-sm text-muted">Hourly Rate (₹/hr)</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        className="glass-input"
                                        placeholder="e.g. 300"
                                        value={newTableRate}
                                        onChange={e => setNewTableRate(e.target.value)}
                                        required
                                    />
                                    {newTableRate && !isNaN(parseFloat(newTableRate)) && (
                                        <div className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>
                                            ₹{(parseFloat(newTableRate) / 60).toFixed(2)}/min
                                        </div>
                                    )}
                                </div>
                            )}

                            {newTableType === 'Play Station' && (
                                <div className="form-group">
                                    <label className="text-sm text-muted">Controller Rates (₹/hr) — fill at least one</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.5rem' }}>
                                        {[1, 2, 3, 4].map(n => (
                                            <div key={n}>
                                                <label className="text-xs text-muted">{n} Controller{n > 1 ? 's' : ''}</label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    className="glass-input"
                                                    placeholder="₹/hr"
                                                    value={psRates[n]}
                                                    onChange={e => setPsRates(prev => ({ ...prev, [n]: e.target.value }))}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {addTableError && (
                                <div style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.5rem 0.8rem' }}>
                                    ⚠ {addTableError}
                                </div>
                            )}
                            <div className="modal-action-row">
                                <button type="button" className="glass-button modal-action-btn" onClick={() => { setShowAddModal(false); setAddTableError(''); }}>Cancel</button>
                                <button type="submit" className="primary-button modal-action-btn">Create Table</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
