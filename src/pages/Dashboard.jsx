import React, { useState } from 'react';
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
import './Dashboard.css';

const data = [
    { time: '10:00', revenue: 120 },
    { time: '12:00', revenue: 250 },
    { time: '14:00', revenue: 180 },
    { time: '16:00', revenue: 450 },
    { time: '18:00', revenue: 800 },
    { time: '20:00', revenue: 1200 },
    { time: '22:00', revenue: 950 },
];

export default function Dashboard() {
    return (
        <div className="dashboard-container">
            <div className="dashboard-header mb-6">
                <div>
                    <h2>Today's Overview</h2>
                    <p className="text-muted">Welcome back, here's what's happening at Pocket 6.</p>
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
                        <span className="stat-title">Total Earnings</span>
                        <div className="stat-icon bg-green">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <div className="stat-value text-glow-green">₹1,45,200</div>
                    <div className="stat-change positive">
                        <ArrowUpRight size={14} />
                        <span>+15% from yesterday</span>
                    </div>
                </div>

                <div className="stat-card glass-panel">
                    <div className="stat-header">
                        <span className="stat-title">Customers Today</span>
                        <div className="stat-icon bg-blue">
                            <Users size={20} />
                        </div>
                    </div>
                    <div className="stat-value text-glow-blue">142</div>
                    <div className="stat-change positive">
                        <ArrowUpRight size={14} />
                        <span>+8% from yesterday</span>
                    </div>
                </div>

                <div className="stat-card glass-panel">
                    <div className="stat-header">
                        <span className="stat-title">F&B Revenue</span>
                        <div className="stat-icon bg-purple">
                            <Coffee size={20} />
                        </div>
                    </div>
                    <div className="stat-value">₹24,500</div>
                    <div className="stat-change negative">
                        <ArrowDownRight size={14} />
                        <span>-2% from yesterday</span>
                    </div>
                </div>

                <div className="stat-card glass-panel">
                    <div className="stat-header">
                        <span className="stat-title">Daily Expenses</span>
                        <div className="stat-icon bg-red">
                            <Receipt size={20} />
                        </div>
                    </div>
                    <div className="stat-value">₹12,400</div>
                    <div className="stat-change">
                        <span className="text-muted">Standard ongoing usage</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-main-grid">
                {/* Chart Section */}
                <div className="chart-section glass-panel flex-col">
                    <div className="section-header">
                        <h3>Revenue Overview</h3>
                        <button className="glass-button text-sm" onClick={() => alert('Opening full report module...')}>View Full Report</button>
                    </div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--neon-green)" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="var(--neon-green)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                                <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--bg-darker)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--neon-green)' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="var(--neon-green)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Live Activity Section */}
                <div className="activity-section glass-panel flex-col">
                    <div className="section-header">
                        <h3>Live Activity</h3>
                        <span className="badge badge-green pulse-active">Live</span>
                    </div>
                    <div className="activity-list">
                        <div className="activity-item">
                            <div className="activity-icon snooker">
                                <div className="status-indicator status-active"></div>
                            </div>
                            <div className="activity-info">
                                <h4>Snooker Table 1</h4>
                                <p>Started 45 mins ago • John Doe</p>
                            </div>
                            <div className="activity-amount text-glow-green">₹1,200</div>
                        </div>

                        <div className="activity-item">
                            <div className="activity-icon pool">
                                <div className="status-indicator status-active"></div>
                            </div>
                            <div className="activity-info">
                                <h4>Pool Table 4</h4>
                                <p>Started 12 mins ago • Walk-in</p>
                            </div>
                            <div className="activity-amount text-glow-blue">₹320</div>
                        </div>

                        <div className="activity-item">
                            <div className="activity-icon ps5">
                                <div className="status-indicator status-active"></div>
                            </div>
                            <div className="activity-info">
                                <h4>VIP PS5 Room</h4>
                                <p>Started 2 hrs ago • Mike R.</p>
                            </div>
                            <div className="activity-amount text-glow-purple">₹2,400</div>
                        </div>

                        <div className="activity-item">
                            <div className="activity-icon fnB">
                                <Coffee size={16} />
                            </div>
                            <div className="activity-info">
                                <h4>New Order</h4>
                                <p>2x Red Bull, 1x Nachos • Table 1</p>
                            </div>
                            <div className="activity-amount">₹450</div>
                        </div>
                    </div>
                    <button className="glass-button w-full mt-4" onClick={() => alert('Routing to Tables section...')}>View All Tables</button>
                </div>
            </div>
        </div>
    );
}
