import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Gamepad2, Coffee, Receipt, LineChart, Menu, X } from 'lucide-react';
import './Layout.css';

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    const navItems = [
        { name: 'Tables & Sessions', path: '/tables', icon: Gamepad2 },
        { name: 'Food & Drinks', path: '/food', icon: Coffee },
        { name: 'Expenses', path: '/expenses', icon: Receipt },
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
                                {isActive && <div className="active-indicator" />}
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-profile">
                        <div className="avatar">AD</div>
                        <div className="user-info">
                            <p className="user-name">Admin User</p>
                            <p className="user-role">Club Owner</p>
                        </div>
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
