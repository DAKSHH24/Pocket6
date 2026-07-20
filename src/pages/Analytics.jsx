import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts';
import {
    TrendingUp, Table, CupSoda, Lock, FileClock, Trash2, Plus, Receipt, Box, Wrench, X, Tag, ShoppingCart, DollarSign, Calendar, ChevronDown, KeyRound, RotateCcw, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
    collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import './Analytics.css';

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
    { id: 'inventory_purchase', name: 'Snacks Purchases', icon: Box, color: 'blue' },
    { id: 'beverage_purchase', name: 'Beverage Purchases', icon: CupSoda, color: 'green' },
    { id: 'tobacco_purchase', name: 'Tobacco/Hookah Purchases', icon: Tag, color: 'purple' },
    { id: 'table_maintenance', name: 'Table Maintenance Costs', icon: Wrench, color: 'orange' },
    { id: 'cue_chalk', name: 'Cue/Chalk/Ball Replacement', icon: Table, color: 'red' },
    { id: 'misc_ops', name: 'Misc Operational Expenses', icon: Receipt, color: 'muted' },
];

const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

// Quick-select presets
const QUICK_PRESETS = [
    { label: 'All Time', value: 'all' },
    { label: 'Last 15 Days', value: '15d' },
    { label: 'Last 30 Days', value: '30d' },
];

// Stored PIN key
const PIN_KEY = 'pocket6_analytics_pin';

function getStoredPin() {
    return localStorage.getItem(PIN_KEY) || '123456';
}

// Compute date range from quick preset
function getRangeFromPreset(preset) {
    const now = new Date();
    const end = now.getTime();
    if (preset === 'all') return { start: 0, end: Infinity };
    if (preset === '15d') {
        const s = new Date(); s.setDate(s.getDate() - 15); s.setHours(0, 0, 0, 0);
        return { start: s.getTime(), end: Infinity };
    }
    if (preset === '30d') {
        const s = new Date(); s.setDate(s.getDate() - 30); s.setHours(0, 0, 0, 0);
        return { start: s.getTime(), end: Infinity };
    }
    if (preset === 'month') {
        const s = new Date(); s.setDate(1); s.setHours(0, 0, 0, 0);
        return { start: s.getTime(), end: Infinity };
    }
    if (preset === 'year') {
        const s = new Date(); s.setMonth(0, 1); s.setHours(0, 0, 0, 0);
        return { start: s.getTime(), end: Infinity };
    }
    return { start: 0, end: Infinity };
}

// Format date to YYYY-MM-DD for <input type="date">
function toInputDate(ts) {
    if (!ts || ts === 0 || ts === Infinity) return '';
    const d = new Date(ts);
    return d.toISOString().split('T')[0];
}

// Parse YYYY-MM-DD to start-of-day timestamp
function fromInputDate(str, endOfDay = false) {
    if (!str) return endOfDay ? Infinity : 0;
    const d = new Date(str);
    if (endOfDay) { d.setHours(23, 59, 59, 999); }
    else { d.setHours(0, 0, 0, 0); }
    return d.getTime();
}

// ─────────────────────────────────────────────────────────────────
// PIN SCREEN
// ─────────────────────────────────────────────────────────────────
function PinScreen({ onUnlock }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [showReset, setShowReset] = useState(false);
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [resetMsg, setResetMsg] = useState('');

    function handleUnlock(e) {
        e.preventDefault();
        if (pin === getStoredPin()) {
            onUnlock();
        } else {
            setError('Incorrect passcode. Please try again.');
            setPin('');
        }
    }

    function handleResetPin(e) {
        e.preventDefault();
        setResetMsg('');
        if (oldPin !== getStoredPin()) {
            setResetMsg('error:Current code is incorrect.');
            return;
        }
        if (newPin.length < 4) {
            setResetMsg('error:New code must be at least 4 digits.');
            return;
        }
        if (newPin !== confirmPin) {
            setResetMsg('error:New codes do not match.');
            return;
        }
        localStorage.setItem(PIN_KEY, newPin);
        setResetMsg('success:Code updated successfully!');
        setTimeout(() => {
            setShowReset(false);
            setOldPin(''); setNewPin(''); setConfirmPin(''); setResetMsg('');
        }, 1500);
    }

    if (showReset) {
        const isErr = resetMsg.startsWith('error:');
        const isOk  = resetMsg.startsWith('success:');
        return (
            <div className="analytics-container pin-screen">
                <div className="glass-panel pin-card">
                    <div className="pin-icon-wrap" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                        <KeyRound size={28} />
                    </div>
                    <h2 className="text-2xl font-bold text-center">Change Access Code</h2>
                    <p className="text-muted text-center pin-subtitle">Enter your current code then set a new one.</p>
                    <form onSubmit={handleResetPin} className="pin-form">
                        {resetMsg && (
                            <div className={isErr ? 'pin-msg pin-msg-err' : 'pin-msg pin-msg-ok'}>
                                {isErr ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>}
                                {resetMsg.replace(/^(error|success):/, '')}
                            </div>
                        )}
                        <input type="password" className="glass-input text-center pin-input" placeholder="Current code" maxLength="10" value={oldPin} onChange={e => setOldPin(e.target.value)} autoFocus />
                        <input type="password" className="glass-input text-center pin-input" placeholder="New code" maxLength="10" value={newPin} onChange={e => setNewPin(e.target.value)} />
                        <input type="password" className="glass-input text-center pin-input" placeholder="Confirm new code" maxLength="10" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} />
                        <button type="submit" className="primary-button pin-submit-btn">Update Code</button>
                        <button type="button" className="pin-back-link" onClick={() => setShowReset(false)}>← Back to sign in</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="analytics-container pin-screen">
            <div className="glass-panel pin-card">
                <div className="pin-icon-wrap">
                    <Lock size={32} />
                </div>
                <h2 className="text-2xl font-bold text-center">Restricted Access</h2>
                <p className="text-muted text-center pin-subtitle">Enter the owner code to unlock Financial Analytics.</p>
                <form onSubmit={handleUnlock} className="pin-form">
                    <input
                        type="password"
                        maxLength="10"
                        className="glass-input text-center pin-input"
                        placeholder="••••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        autoFocus
                    />
                    {error && <div className="text-glow-red text-center text-sm">{error}</div>}
                    <button type="submit" className="primary-button pin-submit-btn">Unlock Dashboard</button>
                    <button type="button" className="pin-back-link" onClick={() => { setShowReset(true); setError(''); setPin(''); }}>
                        <RotateCcw size={13} /> Change access code
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// PERIOD FILTER BAR (new dynamic one)
// ─────────────────────────────────────────────────────────────────
function PeriodFilterBar({ dateStart, dateEnd, preset, tableFilter, allTableNames, onPreset, onDateStart, onDateEnd, onTableFilter }) {
    return (
        <div className="period-filter-bar glass-panel">
            {/* Quick select presets */}
            <div className="period-section">
                <span className="period-label">Quick Select</span>
                <div className="period-presets">
                    {QUICK_PRESETS.map(p => (
                        <button
                            key={p.value}
                            className={`period-preset-btn${preset === p.value ? ' active' : ''}`}
                            onClick={() => onPreset(p.value)}
                        >{p.label}</button>
                    ))}
                </div>
            </div>

            {/* Calendar date range */}
            <div className="period-section">
                <span className="period-label">Date Range</span>
                <div className="period-date-row">
                    <div className="period-date-wrap">
                        <Calendar size={14} className="period-cal-icon" />
                        <input
                            type="date"
                            className="period-date-input"
                            value={dateStart}
                            onChange={e => onDateStart(e.target.value)}
                        />
                    </div>
                    <span className="period-date-sep">→</span>
                    <div className="period-date-wrap">
                        <Calendar size={14} className="period-cal-icon" />
                        <input
                            type="date"
                            className="period-date-input"
                            value={dateEnd}
                            onChange={e => onDateEnd(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// MAIN ANALYTICS COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function Analytics() {
    const { clubId } = useAuth();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeTab, setActiveTab] = useState('Overview');

    // Data collections
    const [history, setHistory] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [tables, setTables] = useState([]);

    // ── Period filter state ──
    const [preset, setPreset] = useState('all');
    const [dateStart, setDateStartStr] = useState('');   // YYYY-MM-DD string
    const [dateEnd,   setDateEndStr]   = useState('');
    // Session History table-name filter (separate from the table type filter)
    const [tableNameFilter, setTableNameFilter] = useState('All');
    // Session History table TYPE filter
    const [typeFilter, setTypeFilter] = useState('All');

    // Expense form
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expAmount, setExpAmount] = useState('');
    const [expCategory, setExpCategory] = useState('inventory_purchase');
    const [expDesc, setExpDesc] = useState('');

    useEffect(() => { setIsAuthenticated(false); }, []);

    useEffect(() => {
        if (!isAuthenticated || !clubId) return;
        const unsubHistory = onSnapshot(
            query(collection(db, 'session_history'), where('clubId', '==', clubId), orderBy('createdAt', 'desc')),
            (snap) => { const d = []; snap.forEach(x => d.push({ id: x.id, ...x.data() })); setHistory(d); }
        );
        const unsubInventory = onSnapshot(
            query(collection(db, 'inventory'), where('clubId', '==', clubId)),
            (snap) => { const d = []; snap.forEach(x => d.push({ id: x.id, ...x.data() })); setInventory(d); }
        );
        const unsubExpenses = onSnapshot(
            query(collection(db, 'expenses'), where('clubId', '==', clubId), orderBy('createdAt', 'desc')),
            (snap) => { const d = []; snap.forEach(x => d.push({ id: x.id, ...x.data() })); setExpenses(d); }
        );
        const unsubTables = onSnapshot(
            query(collection(db, 'tables'), where('clubId', '==', clubId)),
            (snap) => { const d = []; snap.forEach(x => d.push({ id: x.id, ...x.data() })); setTables(d); }
        );
        return () => { unsubHistory(); unsubInventory(); unsubExpenses(); unsubTables(); };
    }, [isAuthenticated, clubId]);

    useEffect(() => {
        if (showExpenseModal) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [showExpenseModal]);

    // ── Handle preset selection → update calendar dates ──
    function handlePreset(val) {
        setPreset(val);
        const { start, end } = getRangeFromPreset(val);
        setDateStartStr(start === 0 ? '' : toInputDate(start));
        setDateEndStr('');
    }

    // ── Handle calendar change → clear preset ──
    function handleDateStart(val) {
        setDateStartStr(val);
        setPreset('custom');
    }
    function handleDateEnd(val) {
        setDateEndStr(val);
        setPreset('custom');
    }

    // ── Compute actual timestamp range ──
    const tsStart = dateStart ? fromInputDate(dateStart, false) : (preset === 'custom' ? 0 : getRangeFromPreset(preset).start);
    const tsEnd   = dateEnd   ? fromInputDate(dateEnd, true)   : Infinity;

    // ── All unique table names from history ──
    const allTableNames = [...new Set(history.map(h => h.tableName).filter(Boolean))].sort();

    if (!isAuthenticated) {
        return <PinScreen onUnlock={() => setIsAuthenticated(true)} />;
    }

    // ─────────────────────────────────────────────
    // CALCULATIONS (filtered)
    // ─────────────────────────────────────────────
    const filteredHistory = history.filter(h => {
        const ts = h.createdAt || 0;
        if (ts < tsStart || ts > tsEnd) return false;
        if (tableNameFilter !== 'All' && h.tableName !== tableNameFilter) return false;
        if (typeFilter !== 'All') {
            const t = (h.type || '').toLowerCase();
            const f = typeFilter.toLowerCase();
            if (!t.includes(f)) return false;
        }
        return true;
    });

    // Only sessions that were actually paid count toward revenue
    const paidHistory = filteredHistory.filter(h => h.paymentStatus !== 'due');
    const dueHistory  = filteredHistory.filter(h => h.paymentStatus === 'due');

    const filteredExpenses = expenses.filter(e => {
        const ts = e.createdAt || 0;
        return ts >= tsStart && ts <= tsEnd;
    });

    const totalRev   = paidHistory.reduce((s, h) => s + (h.totalCost  || 0), 0);
    const tableRev   = paidHistory.reduce((s, h) => s + (h.playedCost || 0), 0);
    const canteenRev = paidHistory.reduce((s, h) => s + (h.foodCost   || 0), 0);
    const totalDueAmt = dueHistory.reduce((s, h) => s + (h.totalCost  || 0), 0);

    const liveSessions = tables.filter(t => t.status === 'occupied');
    const liveRev = liveSessions.reduce((sum, t) => {
        const elapsed = Math.max(0, Date.now() - t.startTime);
        const capped  = Math.min(elapsed, 60 * 60000);
        return sum + (capped / 60000 * t.rate);
    }, 0);

    let snacksRev = 0, drinksRev = 0, tobaccoRev = 0;
    paidHistory.forEach(h => {
        if (h.categoryBreakdown) {
            snacksRev  += h.categoryBreakdown['Snacks']          || 0;
            drinksRev  += h.categoryBreakdown['Drinks']          || 0;
            tobaccoRev += h.categoryBreakdown['Tobacco/Lounge']  || 0;
        } else {
            (h.orders || []).forEach(o => {
                const cat = o.category || 'Snacks';
                if (cat === 'Drinks') drinksRev += o.price * o.qty;
                else if (cat === 'Tobacco/Lounge') tobaccoRev += o.price * o.qty;
                else snacksRev += o.price * o.qty;
            });
        }
    });

    const uniqueDays = new Set(paidHistory.map(h => h.createdAt ? new Date(h.createdAt).toLocaleDateString() : '')).size || 1;
    const avgDailyRev = totalRev / uniqueDays;

    const dayRevenueMap = {};
    filteredHistory.forEach(h => {
        if (!h.createdAt) return;
        const d = new Date(h.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
        dayRevenueMap[d] = (dayRevenueMap[d] || 0) + (h.totalCost || 0);
    });
    let peakDay = 'N/A', peakDayRev = 0;
    Object.entries(dayRevenueMap).forEach(([day, rev]) => { if (rev > peakDayRev) { peakDayRev = rev; peakDay = day; } });

    // Table stats map — only paid sessions
    const tableSessionsMap = {};
    paidHistory.forEach(h => {
        const name = h.tableName || 'Unknown';
        if (!tableSessionsMap[name]) tableSessionsMap[name] = { sessions: 0, revenue: 0, foodRevenue: 0 };
        tableSessionsMap[name].sessions++;
        tableSessionsMap[name].revenue     += h.playedCost || 0;
        tableSessionsMap[name].foodRevenue += h.foodCost   || 0;
    });
    const tableRevData = Object.entries(tableSessionsMap)
        .map(([name, stat]) => ({ name, revenue: Math.round(stat.revenue), sessions: stat.sessions, foodRev: Math.round(stat.foodRevenue) }))
        .sort((a, b) => b.revenue - a.revenue);

    // F&B — only paid sessions
    const fbStats = {};
    let totalInvConsumptionCost = 0;
    paidHistory.forEach(h => {
        (h.orders || []).forEach(o => {
            if (!fbStats[o.name]) fbStats[o.name] = { qty: 0, revenue: 0, cost: 0, category: o.category || 'Snacks' };
            fbStats[o.name].qty     += o.qty;
            fbStats[o.name].revenue += o.qty * o.price;
            const liveItem = inventory.find(i => i.name === o.name);
            const unitCost = liveItem ? (liveItem.cost || 0) : (o.price * 0.45);
            fbStats[o.name].cost += o.qty * unitCost;
            totalInvConsumptionCost += o.qty * unitCost;
        });
    });
    const topSellingItems = Object.entries(fbStats)
        .map(([name, stat]) => ({ name, ...stat, profit: stat.revenue - stat.cost }))
        .sort((a, b) => b.qty - a.qty);

    const invPurchasedCost  = inventory.reduce((s, i) => s + (i.cost  || 0) * (i.stock || 0), 0);
    const remainingInvValue = inventory.reduce((s, i) => s + (i.price || 0) * (i.stock || 0), 0);
    const totalExp          = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    const expenseBreakdown = { inventory_purchase: 0, beverage_purchase: 0, tobacco_purchase: 0, table_maintenance: 0, cue_chalk: 0, misc_ops: 0 };
    filteredExpenses.forEach(e => {
        const cat = e.category || 'misc_ops';
        if (expenseBreakdown[cat] !== undefined) expenseBreakdown[cat] += e.amount;
        else expenseBreakdown.misc_ops += e.amount;
    });

    const totalFBSoldRevenue = snacksRev + drinksRev + tobaccoRev;
    const fbProfitMargin     = totalFBSoldRevenue - totalInvConsumptionCost;

    // 7-day trend — paid sessions only
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dayLabel  = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dateString = d.toLocaleDateString();
        const rev = history
            .filter(h => h.date && h.date.includes(dateString) && h.paymentStatus !== 'due')
            .reduce((s, h) => s + (h.totalCost || 0), 0);
        const exp = expenses.filter(e => e.date && e.date.includes(dateString)).reduce((s, e) => s + (e.amount || 0), 0);
        trendData.push({ name: dayLabel, revenue: Math.round(rev), expense: Math.round(exp) });
    }

    const mixData = [
        { name: 'Tables',         value: tableRev   },
        { name: 'Snacks',         value: snacksRev  },
        { name: 'Drinks',         value: drinksRev  },
        { name: 'Tobacco/Hookah', value: tobaccoRev },
    ].filter(d => d.value > 0);

    const getCatIcon  = (id) => EXPENSE_CATEGORIES.find(c => c.id === id)?.icon  || Receipt;
    const getCatColor = (id) => EXPENSE_CATEGORIES.find(c => c.id === id)?.color || 'muted';
    const getCatName  = (id) => EXPENSE_CATEGORIES.find(c => c.id === id)?.name  || 'Other';

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!expAmount || !expDesc) return;
        try {
            await addDoc(collection(db, 'expenses'), {
                clubId,
                amount: parseFloat(expAmount), category: expCategory,
                description: expDesc, date: new Date().toLocaleDateString(), createdAt: Date.now()
            });
            setExpAmount(''); setExpDesc(''); setExpCategory('inventory_purchase'); setShowExpenseModal(false);
        } catch (err) { console.error(err); }
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Delete this expense record?')) return;
        try { await deleteDoc(doc(db, 'expenses', id)); } catch (err) { console.error(err); }
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="analytics-container">
            {/* Header */}
            <div className="page-header mb-4">
                <div>
                    <h2>Financial Analytics & Reports</h2>
                </div>
            </div>

            {/* Nav Tabs */}
            <div className="analytics-tab-bar glass-panel mb-6">
                {['Overview', 'F&B Financials', 'Session History', 'Expenses'].map(tab => (
                    <button
                        key={tab}
                        className={`analytics-tab-btn${activeTab === tab ? ' active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >{tab}</button>
                ))}
            </div>

            {/* ─── OVERVIEW TAB ─── */}
            {activeTab === 'Overview' && (
                <div className="analytics-section">
                    {/* KPI Cards */}
                    <div className="analytics-kpi-grid cols-3">
                        <div className="glass-panel kpi-card">
                            <div className="kpi-label">Total Revenue (Paid)</div>
                            <div className="kpi-value text-glow-green">₹{totalRev.toFixed(0)}</div>
                            <div className="kpi-sub">{paidHistory.length} sessions paid</div>
                        </div>
                        <div className="glass-panel kpi-card">
                            <div className="kpi-label">Net Profit / Margin</div>
                            <div className={`kpi-value ${totalRev - totalExp >= 0 ? 'text-glow-green' : 'text-glow-red'}`}>
                                ₹{(totalRev - totalExp).toFixed(0)}
                            </div>
                            <div className="kpi-sub">Revenue minus Expenses</div>
                        </div>
                        <div className="glass-panel kpi-card">
                            <div className="kpi-label">Average Daily Revenue</div>
                            <div className="kpi-value text-glow-purple">₹{avgDailyRev.toFixed(0)}</div>
                            <div className="kpi-sub">Peak Day: {peakDay}</div>
                        </div>
                        {totalDueAmt > 0 && (
                            <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid #f59e0b', background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, transparent 70%)' }}>
                                <div className="kpi-label" style={{ color: '#f59e0b' }}>⚠ Outstanding Dues</div>
                                <div className="kpi-value" style={{ color: '#f59e0b' }}>₹{totalDueAmt.toFixed(0)}</div>
                                <div className="kpi-sub">{dueHistory.length} session{dueHistory.length !== 1 ? 's' : ''} unpaid — not counted in revenue</div>
                            </div>
                        )}
                    </div>

                    {/* Revenue breakdown strip */}
                    <div className="glass-panel p-6">
                        <h3 className="chart-title mb-4">Revenue Stream Breakdown</h3>
                        <div className="revenue-breakdown-grid">
                            <div className="revenue-breakdown-card">
                                <div className="rbc-label">Table Play Revenue</div>
                                <div className="rbc-value text-glow-blue">₹{tableRev.toFixed(0)}</div>
                                <div className="rbc-share">{(tableRev / (totalRev || 1) * 100).toFixed(1)}% of total</div>
                            </div>
                            <div className="revenue-breakdown-card">
                                <div className="rbc-label">Snacks Revenue</div>
                                <div className="rbc-value text-glow-green">₹{snacksRev.toFixed(0)}</div>
                                <div className="rbc-share">{(snacksRev / (totalRev || 1) * 100).toFixed(1)}% of total</div>
                            </div>
                            <div className="revenue-breakdown-card">
                                <div className="rbc-label">Drinks Revenue</div>
                                <div className="rbc-value text-glow-purple">₹{drinksRev.toFixed(0)}</div>
                                <div className="rbc-share">{(drinksRev / (totalRev || 1) * 100).toFixed(1)}% of total</div>
                            </div>
                            <div className="revenue-breakdown-card">
                                <div className="rbc-label">Tobacco/Hookah Revenue</div>
                                <div className="rbc-value text-glow-orange">₹{tobaccoRev.toFixed(0)}</div>
                                <div className="rbc-share">{(tobaccoRev / (totalRev || 1) * 100).toFixed(1)}% of total</div>
                            </div>
                        </div>
                    </div>

                    {/* Trend + Pie */}
                    <div className="analytics-grid-2">
                        <div className="glass-panel chart-panel">
                            <h3 className="chart-title">Revenue & Expenses Trend (7-Day Overview)</h3>
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                                    <YAxis stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-darker)', borderColor: 'var(--border-glass)', borderRadius: '8px' }} />
                                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                                    <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" name="Expense" />
                                    <Legend verticalAlign="top" height={36} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="glass-panel chart-panel">
                            <h3 className="chart-title">Revenue Contribution Mix</h3>
                            {mixData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie data={mixData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value"
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                            {mixData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => `₹${value.toFixed(0)}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center p-10 text-muted">No session checkout data to display distribution.</div>
                            )}
                        </div>
                    </div>

                    {/* ── Table Statistics (full width, expanded) ── */}
                    <div className="glass-panel chart-panel">
                        <h3 className="chart-title">Play Revenue by Specific Table</h3>
                        {tableRevData.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={tableRevData} margin={{ top: 10, right: 20, left: -10, bottom: 30 }} style={{ background: 'transparent' }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis
                                            dataKey="name"
                                            stroke="var(--text-muted)"
                                            axisLine={false}
                                            tickLine={false}
                                            interval={0}
                                            height={50}
                                            tick={({ x, y, payload }) => {
                                                const words = payload.value.split(' ');
                                                return (
                                                    <text
                                                        x={x}
                                                        y={y + 4}
                                                        fill="var(--text-muted)"
                                                        textAnchor="middle"
                                                        fontSize={12}
                                                        dominantBaseline="hanging"
                                                    >
                                                        {words.map((word, i) => (
                                                            <tspan key={i} x={x} dy={i === 0 ? 0 : 15}>{word}</tspan>
                                                        ))}
                                                    </text>
                                                );
                                            }}
                                        />
                                        <YAxis stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                            content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null;
                                                const d = payload[0].payload;
                                                return (
                                                    <div style={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                                        <div style={{ fontWeight: 700, fontSize: 13, color: '#f3f4f6' }}>{d.name}</div>
                                                        <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>Play Revenue : ₹{d.revenue}</div>
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Play Revenue" maxBarSize={48} />
                                    </BarChart>
                                </ResponsiveContainer>

                                {/* Expanded per-table stats grid */}
                                <div className="table-stats-grid">
                                    {tableRevData.map((row, idx) => (
                                        <div key={row.name} className="table-stat-card">
                                            <div className="tsc-rank">#{idx + 1}</div>
                                            <div className="tsc-name">{row.name}</div>
                                            <div className="tsc-row">
                                                <span className="tsc-label">Sessions</span>
                                                <span className="tsc-val">{row.sessions}</span>
                                            </div>
                                            <div className="tsc-row">
                                                <span className="tsc-label">Play Rev</span>
                                                <span className="tsc-val text-glow-blue">₹{row.revenue}</span>
                                            </div>
                                            <div className="tsc-row">
                                                <span className="tsc-label">Canteen</span>
                                                <span className="tsc-val text-glow-green">₹{row.foodRev}</span>
                                            </div>
                                            <div className="tsc-row">
                                                <span className="tsc-label">Total</span>
                                                <span className="tsc-val font-bold">₹{row.revenue + row.foodRev}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="text-center p-10 text-muted">No individual table data yet.</div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── F&B FINANCIALS TAB ─── */}
            {activeTab === 'F&B Financials' && (
                <div className="analytics-section">
                    <div className="analytics-kpi-grid">
                        <div className="glass-panel kpi-card">
                            <div className="kpi-label">F&B Total Revenue</div>
                            <div className="kpi-value text-glow-green">₹{totalFBSoldRevenue.toFixed(0)}</div>
                            <div className="kpi-sub">Snacks, Drinks, Tobacco Hookah</div>
                        </div>
                        <div className="glass-panel kpi-card">
                            <div className="kpi-label">F&B Consumption Cost</div>
                            <div className="kpi-value text-glow-red">₹{totalInvConsumptionCost.toFixed(0)}</div>
                            <div className="kpi-sub">Actual purchase cost of items sold</div>
                        </div>
                        <div className="glass-panel kpi-card">
                            <div className="kpi-label">F&B Net Profit Margin</div>
                            <div className={`kpi-value ${fbProfitMargin >= 0 ? 'text-glow-green' : 'text-glow-red'}`}>
                                ₹{fbProfitMargin.toFixed(0)}
                            </div>
                            <div className="kpi-sub">Revenue minus Purchase cost</div>
                        </div>
                        <div className="glass-panel kpi-card">
                            <div className="kpi-label">Remaining Inventory Value</div>
                            <div className="kpi-value text-glow-purple">₹{remainingInvValue.toFixed(0)}</div>
                            <div className="kpi-sub">Stock purchase cost: ₹{invPurchasedCost.toFixed(0)}</div>
                        </div>
                    </div>

                    {/* Top Selling Items — full width, taller chart, wider labels */}
                    <div className="glass-panel chart-panel">
                        <h3 className="chart-title">Top Selling Items by Quantity</h3>
                        {topSellingItems.length > 0 ? (
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart
                                    data={topSellingItems.slice(0, 8)}
                                    layout="vertical"
                                    margin={{ top: 10, right: 60, left: 20, bottom: 10 }}
                                    barCategoryGap="30%"
                                    style={{ background: 'transparent' }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        stroke="var(--text-muted)"
                                        axisLine={false}
                                        tickLine={false}
                                        width={140}
                                        tick={{ fontSize: 13, fill: 'var(--text-muted)' }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                        content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null;
                                            const d = payload[0].payload;
                                            return (
                                                <div style={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#f3f4f6' }}>{d.name}</div>
                                                    <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>{d.qty} units</div>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Bar dataKey="qty" fill="#10b981" radius={[0, 6, 6, 0]} name="Units Sold" maxBarSize={22}
                                        label={{ position: 'right', fill: '#9ca3af', fontSize: 12, formatter: v => v }} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center p-10 text-muted">No canteen items sold yet.</div>
                        )}
                    </div>

                    {/* Inventory valuation */}
                    <div className="glass-panel valuation-panel">
                        <h3 className="chart-title mb-4">Inventory Cost vs Revenue Valuation</h3>
                        <div className="valuation-list">
                            <div className="valuation-row">
                                <div className="valuation-row-left">
                                    <div className="text-sm text-muted">Estimated Revenue Value of Current Stock</div>
                                    <div className="text-lg font-bold text-glow-green">₹{remainingInvValue.toFixed(0)}</div>
                                </div>
                                <div className="valuation-row-right">
                                    <div className="text-xs text-muted">Purchase cost to restock</div>
                                    <div className="text-sm font-semibold">₹{invPurchasedCost.toFixed(0)}</div>
                                </div>
                            </div>
                            <div className="valuation-row">
                                <div className="valuation-row-left">
                                    <div className="text-sm text-muted">F&B Return on Investment (ROI)</div>
                                    <div className="text-lg font-bold text-glow-blue">
                                        {totalInvConsumptionCost > 0 ? `${((totalFBSoldRevenue / totalInvConsumptionCost) * 100).toFixed(0)}%` : 'N/A'}
                                    </div>
                                </div>
                                <div className="valuation-row-right">
                                    <div className="text-xs text-muted">Fast Moving Item</div>
                                    <div className="text-sm font-semibold text-glow-green">
                                        {topSellingItems[0] ? topSellingItems[0].name : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Item-wise table */}
                    <div className="glass-panel p-6">
                        <h3 className="chart-title mb-4">Item-wise Revenue & Cost Analysis</h3>
                        {topSellingItems.length === 0 ? (
                            <div className="empty-state"><p>No items sold.</p></div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="analytics-data-table">
                                    <thead>
                                        <tr>
                                            <th>Item Name</th>
                                            <th>Category</th>
                                            <th className="text-right">Qty Sold</th>
                                            <th className="text-right">Revenue</th>
                                            <th className="text-right">Item Cost</th>
                                            <th className="text-right">Net Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topSellingItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="font-semibold">{item.name}</td>
                                                <td className="text-muted text-sm">{item.category}</td>
                                                <td className="text-right">{item.qty}</td>
                                                <td className="text-right text-glow-green font-bold">₹{item.revenue.toFixed(0)}</td>
                                                <td className="text-right text-muted">₹{item.cost.toFixed(0)}</td>
                                                <td className={`text-right font-bold ${item.profit >= 0 ? 'text-glow-green' : 'text-glow-red'}`}>
                                                    ₹{item.profit.toFixed(0)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── SESSION HISTORY TAB ─── */}
            {activeTab === 'Session History' && (
                <div className="analytics-section">
                    {/* Dynamic Period Filter */}
                    <PeriodFilterBar
                        dateStart={dateStart}
                        dateEnd={dateEnd}
                        preset={preset}
                        tableFilter={tableNameFilter}
                        allTableNames={allTableNames}
                        onPreset={handlePreset}
                        onDateStart={handleDateStart}
                        onDateEnd={handleDateEnd}
                        onTableFilter={setTableNameFilter}
                    />

                    {/* Table TYPE filter (Snooker / Pool / PS etc.) */}
                    <div className="history-filter-group">
                        <span className="filter-group-label">Table Type</span>
                        <div className="canteen-seg-control">
                            {['All', 'Snooker', 'Pool', 'Play Station', 'Other'].map(t => (
                                <button key={t} className={`seg-btn${typeFilter === t ? ' seg-active' : ''}`} onClick={() => setTypeFilter(t)}>{t}</button>
                            ))}
                        </div>
                    </div>

                    {/* Summary Strip */}
                    <div className="history-summary-strip">
                        <div className="hs-item">
                            <span className="hs-label">Sessions</span>
                            <span className="hs-value">{filteredHistory.length}</span>
                        </div>
                        <div className="hs-divider" />
                        <div className="hs-item">
                            <span className="hs-label">Table Revenue</span>
                            <span className="hs-value text-glow-green">₹{tableRev.toFixed(0)}</span>
                        </div>
                        <div className="hs-divider" />
                        <div className="hs-item">
                            <span className="hs-label">Canteen Revenue</span>
                            <span className="hs-value text-glow-purple">₹{canteenRev.toFixed(0)}</span>
                        </div>
                        <div className="hs-divider" />
                        <div className="hs-item">
                            <span className="hs-label">Total</span>
                            <span className="hs-value text-glow-green">₹{totalRev.toFixed(0)}</span>
                        </div>
                    </div>

                    {/* History Cards */}
                    {filteredHistory.length === 0 ? (
                        <div className="glass-panel empty-state">
                            <FileClock size={40} className="empty-icon" />
                            <p>No checkout sessions found for the chosen filters.</p>
                        </div>
                    ) : (
                        <div className="history-list">
                            {filteredHistory.map(item => (
                                <div key={item.id} className="history-card glass-panel">
                                    <div className="history-card-top">
                                        <div className="history-card-left">
                                            <div className="history-table-name">{item.tableName}</div>
                                            <div className="history-meta">
                                                <span className="history-type-badge">{item.type || 'Table'}</span>
                                                {item.personName && <span className="history-type-badge" style={{ background: 'rgba(99,179,237,0.12)', color: '#63b3ed', border: '1px solid rgba(99,179,237,0.25)' }}>👤 {item.personName}</span>}
                                                {item.paymentStatus === 'due'
                                                    ? <span className="history-type-badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>⚠ Due</span>
                                                    : <span className="history-type-badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>✓ Paid</span>
                                                }
                                                <span className="history-date">{item.date}</span>
                                            </div>
                                        </div>
                                        <div className={`history-total ${item.paymentStatus === 'due' ? '' : 'text-glow-green'}`} style={item.paymentStatus === 'due' ? { color: '#f59e0b' } : {}}>
                                            ₹{(item.totalCost || 0).toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="history-card-breakdown">
                                        <span>🎱 Table playing: ₹{(item.playedCost || 0).toFixed(2)}</span>
                                        {(item.foodCost || 0) > 0 && <span>🍔 Food orders: ₹{(item.foodCost || 0).toFixed(2)}</span>}
                                        {item.orders && item.orders.length > 0 && (
                                            <span className="history-orders">{item.orders.map(o => `${o.qty}× ${o.name}`).join(', ')}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── EXPENSES TAB ─── */}
            {activeTab === 'Expenses' && (
                <div className="analytics-section">
                    <div className="expenses-tab-header mb-6">
                        <div className="expense-summary-card glass-panel">
                            <div className="expense-summary-label">Total Recorded Expenses</div>
                            <div className="expense-summary-value text-glow-red">₹{totalExp.toFixed(2)}</div>
                            <div className="expense-summary-sub">{filteredExpenses.length} operational logs</div>
                        </div>
                        <button className="primary-button" onClick={() => setShowExpenseModal(true)}>
                            <Plus size={16} className="mr-2" /> Add Log
                        </button>
                    </div>

                    <div className="glass-panel p-6">
                        <h3 className="chart-title mb-4">Operational Category Breakdown</h3>
                        <div className="expense-cat-grid">
                            {EXPENSE_CATEGORIES.map(cat => {
                                const Icon = cat.icon;
                                const amt = expenseBreakdown[cat.id] || 0;
                                return (
                                    <div key={cat.id} className="expense-cat-card">
                                        <div className={`expense-cat-card-icon bg-${cat.color}-10 text-${cat.color}`}><Icon size={20} /></div>
                                        <div className="expense-cat-card-info">
                                            <div className="text-sm text-muted">{cat.name}</div>
                                            <div className="text-xl font-bold text-glow-red">₹{amt.toFixed(0)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {filteredExpenses.length === 0 ? (
                        <div className="glass-panel empty-state">
                            <Receipt size={40} className="empty-icon" />
                            <p>No operational expense records logged for this range.</p>
                        </div>
                    ) : (
                        <div className="expense-list">
                            {filteredExpenses.map(exp => {
                                const Icon = getCatIcon(exp.category);
                                const color = getCatColor(exp.category);
                                return (
                                    <div key={exp.id} className="expense-row glass-panel">
                                        <div className={`expense-cat-icon bg-${color}-10 text-${color}`}><Icon size={18} /></div>
                                        <div className="expense-info">
                                            <div className="expense-desc">{exp.description}</div>
                                            <div className="expense-meta">{getCatName(exp.category)} • {exp.date}</div>
                                        </div>
                                        <div className="expense-amount">-₹{(exp.amount || 0).toFixed(2)}</div>
                                        <button className="expense-delete-btn" onClick={() => handleDeleteExpense(exp.id)} title="Delete">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ─── EXPENSE MODAL ─── */}
            {showExpenseModal && createPortal(
                <div className="overlay" onClick={() => setShowExpenseModal(false)}>
                    <div className="modal modal-relative" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setShowExpenseModal(false)}><X size={18} /></button>
                        <div className="modal-header-block"><h3 className="text-xl font-bold">Log Operational Expense</h3></div>
                        <form onSubmit={handleAddExpense} className="flex-col gap-4">
                            <div className="form-group">
                                <label className="text-sm text-muted">Amount (₹)</label>
                                <input type="number" step="0.01" min="0" required className="glass-input text-lg font-bold" placeholder="0.00" value={expAmount} onChange={e => setExpAmount(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="text-sm text-muted">Expense Type / Category</label>
                                <select className="glass-input" value={expCategory} onChange={e => setExpCategory(e.target.value)}>
                                    {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="text-sm text-muted">Description / Log details</label>
                                <textarea className="glass-input min-h-20" required placeholder="e.g. Purchased 2 packs of Cue Chalk and 1 pool table cover replacement." value={expDesc} onChange={e => setExpDesc(e.target.value)} />
                            </div>
                            <div className="modal-action-row">
                                <button type="button" className="glass-button modal-action-btn" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                                <button type="submit" className="primary-button modal-action-btn" style={{ background: '#ef4444', color: 'white' }}>Save Operational Log</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}