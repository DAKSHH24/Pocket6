import React from 'react';
import { Search, Filter, MoreVertical, Star, History, DollarSign } from 'lucide-react';
import './Customers.css';

const CUSTOMERS = [
    { id: 'C001', name: 'Michael Rossi', phone: '+1 (555) 123-4567', visits: 42, spent: 1250.00, favGame: 'Snooker', isVIP: true, lastVisit: 'Today' },
    { id: 'C002', name: 'Sarah Jenkins', phone: '+1 (555) 987-6543', visits: 15, spent: 340.50, favGame: 'Pool', isVIP: false, lastVisit: '2 days ago' },
    { id: 'C003', name: 'David Chen', phone: '+1 (555) 456-7890', visits: 89, spent: 3400.00, favGame: 'PS5', isVIP: true, lastVisit: 'Yesterday' },
    { id: 'C004', name: 'Emily Davis', phone: '+1 (555) 234-5678', visits: 4, spent: 45.00, favGame: 'Pool', isVIP: false, lastVisit: '1 week ago' },
    { id: 'C005', name: 'James Wilson', phone: '+1 (555) 345-6789', visits: 28, spent: 890.00, favGame: 'Snooker', isVIP: true, lastVisit: '3 days ago' },
];

export default function Customers() {
    return (
        <div className="customers-container flex-col h-full gap-4">
            <div className="page-header">
                <div>
                    <h2>Customers</h2>
                    <p className="text-muted">Manage your club members and view their activity.</p>
                </div>
                <button className="primary-button">+ Add Customer</button>
            </div>

            <div className="table-controls glass-panel">
                <div className="search-bar glass-input-container">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Search by name or phone..." className="glass-input header-search" />
                </div>
                <div className="filter-actions">
                    <button className="glass-button"><Filter size={16} /> Filters</button>
                    <button className="glass-button"><Star size={16} className="text-glow-purple" /> VIP Only</button>
                </div>
            </div>

            <div className="customers-table-wrapper glass-panel">
                <table className="customers-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Contact Info</th>
                            <th>Favorite Game</th>
                            <th>Total Visits</th>
                            <th>Total Spent</th>
                            <th>Last Visit</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {CUSTOMERS.map(user => (
                            <tr key={user.id}>
                                <td>
                                    <div className="customer-cell">
                                        <div className="avatar small">{user.name.charAt(0)}</div>
                                        <div>
                                            <div className="font-medium align-center gap-2 flex">
                                                {user.name}
                                                {user.isVIP && <span className="badge badge-purple tooltip-container" title="VIP Member"><Star size={10} fill="currentColor" /> VIP</span>}
                                            </div>
                                            <div className="text-xs text-muted">{user.id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="text-muted">{user.phone}</td>
                                <td>
                                    <span className={`badge ${user.favGame === 'Snooker' ? 'badge-green' :
                                            user.favGame === 'Pool' ? 'badge-blue' : 'badge-purple'
                                        }`}>
                                        {user.favGame}
                                    </span>
                                </td>
                                <td>
                                    <div className="flex align-center gap-2">
                                        <History size={14} className="text-muted" />
                                        {user.visits}
                                    </div>
                                </td>
                                <td className="font-semibold text-glow-green">
                                    ${user.spent.toFixed(2)}
                                </td>
                                <td className="text-muted">{user.lastVisit}</td>
                                <td>
                                    <button className="glass-button icon-button small">
                                        <MoreVertical size={16} className="text-muted" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
