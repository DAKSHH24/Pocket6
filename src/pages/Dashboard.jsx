import React, { useState, useEffect } from 'react';
import {
    DollarSign,
    Users,
    Coffee,
    Receipt,
    TrendingUp,
    Gamepad2,
    Clock,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import './Dashboard.css';

export default function Dashboard() {
    const [history, setHistory]     = useState([]);
    const [tables, setTables]       = useState([]);
    const [expenses, setExpenses]   = useState([]);
    const [inventory, setInventory] = useState([]);

    // ── Firestore listeners ──
    useEffect(() => {
        const unsubHistory   = onSnapshot(query(collection(db, 'session_history'), orderBy('createdAt', 'desc')), snap => {
            const d = []; snap.forEach(x => d.push({ id: x.id, ...x.data() })); setHistory(d);
        });
        const unsubTables    = onSnapshot(collection(db, 'tables'),    snap => { const d = []; snap.forEach(x => d.push({ id: x.id, ...x.data() })); setTables(d); });
        const unsubExpenses  = onSnapshot(collection(db, 'expenses'),  snap => { const d = []; snap.forEach(x => d.push({ id: x.id, ...x.data() })); setExpenses(d); });
        const unsubInventory = onSnapshot(collection(db, 'inventory'), snap => { const d = []; snap.forEach(x => d.push({ id: x.id, ...x.data() })); setInventory(d); });
        return () => { unsubHistory(); unsubTables(); unsubExpenses(); unsubInventory(); };
    }, []);

    // ── Derived stats ──
    const today = new Date().toLocaleDateString();

    const todayHistory = history.filter(h => h.date && h.date.includes(today));
    const todayRev     = todayHistory.reduce((s, h) => s + (h.totalCost  || 0), 0);
    const todayFBRev   = todayHistory.reduce((s, h) => s + (h.foodCost   || 0), 0);
    const todaySessions = todayHistory.length;

    const totalExpenses = expenses
        .filter(e => e.date && e.date.includes(today))
        .reduce((s, e) => s + (e.amount || 0), 0);

    const liveSessions = tables.filter(t => t.status === 'occupied');

    // Yesterday's revenue for % change
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const ydayStr = yesterday.toLocaleDateString();
    const ydayRev = history.filter(h => h.date && h.date.includes(ydayStr)).reduce((s, h) => s + (h.totalCost || 0), 0);
    const revChange = ydayRev > 0 ? (((todayRev - ydayRev) / ydayRev) * 100).toFixed(1) : null;

    // 7-day revenue trend for chart
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayStr = d.toLocaleDateString();
        const rev = history.filter(h => h.date && h.date.includes(dayStr)).reduce((s, h) => s + (h.totalCost || 0), 0);
        trendData.push({ time: label, revenue: Math.round(rev) });
    }

    // Low stock items
    const lowStockItems = inventory.filter(i => i.stock <= 5);

    return (
        <div className="dashboard-container">
            <div className="dashboard-header mb-6">
                <div>
                    <h2>Today's Overview</h2>
                </div>
                <div className="current-date glass-panel">
                    <Clock size={16} className="text-glow-blue" />
                    <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>

            {/* KPI Stats Grid */}
            <div className="stats-grid mb-8">
                <div className="stat-card glass-panel">
                    <div className="stat-header">
                        <span className="stat-title">Today's Revenue</span>
                        <div className="stat-icon bg-green">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <div className="stat-value text-glow-green">₹{todayRev.toFixed(0)}</div>
                    <div className={`stat-change ${revChange !== null ? (parseFloat(revChange) >= 0 ? 'positive' : 'negative') : ''}`}>
                        {revChange !== null ? (
                            <>
                                {parseFloat(revChange) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                <span>{Math.abs(revChange)}% vs yesterday</span>
                            </>
                        ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No data for yesterday</span>
                        )}
                    </div>
                </div>

                <div className="stat-card glass-panel">
                    <div className="stat-header">
                        <span className="stat-title">Active Sessions</span>
                        <div className="stat-icon bg-blue">
                            <Gamepad2 size={20} />
                        </div>
                    </div>
                    <div className="stat-value text-glow-blue">{liveSessions.length}</div>
                    <div className="stat-change positive">
                        <TrendingUp size={14} />
                        <span>{todaySessions} completed today</span>
                    </div>
                </div>

                <div className="stat-card glass-panel">
                    <div className="stat-header">
                        <span className="stat-title">F&amp;B Revenue</span>
                        <div className="stat-icon bg-purple">
                            <Coffee size={20} />
                        </div>
                    </div>
                    <div className="stat-value text-glow-purple">₹{todayFBRev.toFixed(0)}</div>
                    <div className="stat-change">
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {lowStockItems.length > 0 ? `⚠ ${lowStockItems.length} item(s) low stock` : 'Stock levels OK'}
                        </span>
                    </div>
                </div>

                <div className="stat-card glass-panel">
                    <div className="stat-header">
                        <span className="stat-title">Today's Expenses</span>
                        <div className="stat-icon bg-red">
                            <Receipt size={20} />
                        </div>
                    </div>
                    <div className="stat-value text-glow-red">₹{totalExpenses.toFixed(0)}</div>
                    <div className="stat-change">
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>Net: ₹{(todayRev - totalExpenses).toFixed(0)}</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-main-grid">
                {/* Chart Section */}
                <div className="chart-section glass-panel flex-col">
                    <div className="section-header">
                        <h3>7-Day Revenue Trend</h3>
                    </div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="var(--neon-green)" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="var(--neon-green)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                                <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                                    contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10 }}
                                    itemStyle={{ color: 'var(--neon-green)' }}
                                    formatter={(v) => [`₹${v}`, 'Revenue']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="var(--neon-green)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Live Activity Section */}
                <div className="activity-section glass-panel flex-col">
                    <div className="section-header">
                        <h3>Live Tables</h3>
                        <span className="badge badge-green pulse-active">Live</span>
                    </div>
                    <div className="activity-list">
                        {liveSessions.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem', fontSize: '0.9rem' }}>
                                No active sessions right now.
                            </div>
                        ) : (
                            liveSessions.map(t => {
                                const elapsedMs = Math.max(0, Date.now() - t.startTime);
                                const capped    = Math.min(elapsedMs, 60 * 60000);
                                const earned    = (capped / 60000 * t.rate).toFixed(0);
                                const mins      = Math.floor(elapsedMs / 60000);
                                return (
                                    <div key={t.id} className="activity-item">
                                        <div className={`activity-icon ${t.type?.toLowerCase().includes('snooker') ? 'snooker' : t.type?.toLowerCase().includes('pool') ? 'pool' : 'ps5'}`}>
                                            <div className="status-indicator status-active" />
                                        </div>
                                        <div className="activity-info">
                                            <h4>{t.name}</h4>
                                            <p>{mins} min elapsed • {t.type}</p>
                                        </div>
                                        <div className="activity-amount text-glow-green">₹{earned}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
