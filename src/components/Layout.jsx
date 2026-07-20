import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Gamepad2, Coffee, LineChart, Menu, X, LogOut, Receipt } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const { userProfile, currentUser, logout, clubId } = useAuth();
    const [dueBillsCount, setDueBillsCount] = useState(0);

    // Derive display initials from profile or email
    const displayName = userProfile?.ownerName || currentUser?.email || 'Owner';
    const clubName    = userProfile?.clubName   || 'My Venue';
    const initials    = displayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    // Live count of unpaid bills for sidebar badge
    useEffect(() => {
        if (!clubId) return;
        const q = query(
            collection(db, 'bills'),
            where('clubId', '==', clubId),
            where('status', '==', 'due')
        );
        const unsub = onSnapshot(q, (snap) => {
            setDueBillsCount(snap.size);
        });
        return () => unsub();
    }, [clubId]);

    async function handleLogout() {
        await logout();
    }

    const navItems = [
        { name: 'Tables & Sessions',   path: '/tables',    icon: Gamepad2 },
        { name: 'Bills & Dues',        path: '/bills',     icon: Receipt,  badge: dueBillsCount },
        { name: 'Food & Drinks',       path: '/food',      icon: Coffee },
        { name: 'Financial Analytics', path: '/analytics', icon: LineChart },
    ];

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className={`sidebar glass-panel ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="brand">
                        <span className="brand-icon">8</span>
                        <h1 className="text-glow-green">POCKET 6</h1>
                    </div>
                    <button className="close-btn" onClick={toggleSidebar}>
                        <X size={24} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                className={`nav-link ${isActive ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <Icon size={20} className="nav-icon" />
                                <span>{item.name}</span>
                                {item.badge > 0 && (
                                    <span className="nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                                )}
                                {isActive && <div className="active-indicator" />}
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-profile">
                        <div className="avatar">{initials}</div>
                        <div className="user-info">
                            <p className="user-name">{displayName}</p>
                            <p className="user-role">{clubName}</p>
                        </div>
                        <button
                            className="logout-btn"
                            onClick={handleLogout}
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="main-wrapper">
                {/* Mobile Menu Button */}
                <button className="menu-btn mobile-menu-btn" onClick={toggleSidebar}>
                    <Menu size={24} />
                </button>

                {/* Page Content */}
                <main className="content-area animate-fade-in">
                    <Outlet />
                </main>
            </div>

            {sidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
        </div>
    );
}
