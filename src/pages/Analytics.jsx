import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Target, TrendingUp, Table, CupSoda, Lock, FileClock, Trash2 } from 'lucide-react';
import './Analytics.css';

const earningsData = [
    { name: 'Mon', revenue: 40000, expense: 24000 },
    { name: 'Tue', revenue: 30000, expense: 13980 },
    { name: 'Wed', revenue: 20000, expense: 98000 },
    { name: 'Thu', revenue: 27800, expense: 39080 },
    { name: 'Fri', revenue: 88900, expense: 48000 },
    { name: 'Sat', revenue: 123900, expense: 38000 },
    { name: 'Sun', revenue: 94900, expense: 43000 },
];

const peakHoursData = [
    { name: '12pm', players: 10 },
    { name: '2pm', players: 25 },
    { name: '4pm', players: 45 },
    { name: '6pm', players: 75 },
    { name: '8pm', players: 110 },
    { name: '10pm', players: 95 },
    { name: '12am', players: 40 },
];

const tableUsageData = [
    { name: 'Snooker 1', hours: 42 },
    { name: 'Pool 4', hours: 38 },
    { name: 'PS5 Room 1', hours: 55 },
    { name: 'Snooker 3', hours: 25 },
    { name: 'VIP PS', hours: 60 }
];

export default function Analytics() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [history, setHistory] = useState([]);

    // Require pin every time page is mounted
    useEffect(() => {
        setIsAuthenticated(false);
        setPin('');
        setError(false);
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            const hist = localStorage.getItem('session_history');
            if (hist) setHistory(JSON.parse(hist));
        }
    }, [isAuthenticated]);

    const handlePinSubmit = (e) => {
        e.preventDefault();
        if (pin === '123456') {
            setIsAuthenticated(true);
            setError(false);
        } else {
            setError(true);
            setPin('');
        }
    };

    const clearHistory = () => {
        if (window.confirm("Are you sure you want to clear all completed sessions history? This cannot be undone.")) {
            localStorage.removeItem('session_history');
            setHistory([]);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="analytics-container flex-col gap-6 p-2 h-full justify-center items-center" style={{ minHeight: '80vh' }}>
                <div className="glass-panel p-8 flex-col gap-6 w-full max-w-md mx-auto" style={{ marginTop: '10vh' }}>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-10 text-blue rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock size={32} />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Restricted Access</h2>
                        <p className="text-muted">Please enter the 6-digit owner code to view Financial Analytics.</p>
                    </div>
                    <form onSubmit={handlePinSubmit} className="flex-col gap-4">
                        <input
                            type="password"
                            maxLength="6"
                            className="glass-input text-center text-3xl tracking-widest py-4"
                            placeholder="••••••"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            autoFocus
                        />
                        {error && <div className="text-glow-red text-center mt-2 text-sm">Incorrect passcode. (Hint: 123456)</div>}
                        <button type="submit" className="primary-button w-full mt-6 py-3 text-lg">Unlock Dashboard</button>
                    </form>
                </div>
            </div>
        );
    }

    const calculatedRev = history.reduce((sum, h) => sum + h.totalCost, 0);

    return (
        <div className="analytics-container flex-col gap-6 p-2">
            <div className="page-header mb-2">
                <div>
                    <h2>Financial Analytics & Reports</h2>
                    <p className="text-muted">In-depth insights into your club's performance.</p>
                </div>
                <div className="flex gap-2">
                    <button className="glass-button" onClick={() => alert('Changing date range...')}>This Week</button>
                    <button className="primary-button pr-6 pl-6" onClick={() => alert('Downloading report CSV...')}>Export Report</button>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid md:grid-cols-4 gap-4">
                {[
                    { title: "Today's Tracked Profit", val: `₹${calculatedRev.toFixed(0)}`, icon: TrendingUp, color: "green" },
                    { title: "Peak Hour", val: "8:00 PM", icon: Target, color: "blue" },
                    { title: "Top Table", val: "VIP PS5", icon: Table, color: "purple" },
                    { title: "Top Drink", val: "Red Bull", icon: CupSoda, color: "red" },
                ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <div key={i} className="glass-panel p-5 flex items-center justify-between hover-card">
                            <div>
                                <div className="text-muted text-sm">{stat.title}</div>
                                <div className={`text-2xl font-bold font-heading text-glow-${stat.color} mt-1`}>{stat.val}</div>
                            </div>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-${stat.color}-10 text-${stat.color}`}>
                                <Icon size={24} />
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-2">
                {/* Revenue vs Expenses */}
                <div className="glass-panel p-6 h-96">
                    <h3 className="mb-6 font-medium text-lg">Revenue vs Expenses</h3>
                    <ResponsiveContainer width="100%" height="80%">
                        <AreaChart data={earningsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--neon-green)" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="var(--neon-green)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-red)" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="var(--accent-red)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                            <YAxis stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--bg-darker)', borderColor: 'var(--border-glass)', borderRadius: '8px' }}
                                itemStyle={{ fontWeight: 'bold' }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="var(--neon-green)" fillOpacity={1} fill="url(#colorRev)" />
                            <Area type="monotone" dataKey="expense" stroke="var(--accent-red)" fillOpacity={1} fill="url(#colorExp)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Real Session History Table */}
                <div className="glass-panel p-6 h-96 flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-medium text-lg flex items-center gap-2 text-glow-blue"><FileClock size={20} /> Completed Sessions History</h3>
                        <button className="glass-button icon-button small text-red-400" onClick={clearHistory} title="Clear History">
                            <Trash2 size={16} />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 pr-2">
                        {history.length === 0 ? (
                            <p className="text-muted text-center mt-12">No completed sessions tracked yet. Finalize a table order to see profits here.</p>
                        ) : (
                            <div className="flex-col gap-3">
                                {history.map(item => (
                                    <div key={item.id} className="bg-white-5 p-3 rounded border border-glass flex flex-col gap-2">
                                        <div className="flex justify-between items-center border-b border-glass pb-2">
                                            <div className="font-bold">{item.tableName} <span className="text-xs font-normal text-muted ml-2">{item.date}</span></div>
                                            <div className="font-bold text-glow-green">₹{(item.totalCost || 0).toFixed(2)}</div>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <div className="text-muted">Table Time Cost:</div>
                                            <div>₹{(item.playedCost || 0).toFixed(2)}</div>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <div className="text-muted">Canteen Ordered:</div>
                                            <div>₹{(item.foodCost || 0).toFixed(2)}</div>
                                        </div>
                                        {item.orders && item.orders.length > 0 && (
                                            <div className="text-xs text-muted mt-1 italic">
                                                Includes: {item.orders.map(o => `${o.qty}x ${o.name}`).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
