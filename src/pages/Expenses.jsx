import React, { useState } from 'react';
import { Plus, Receipt, Wrench, Users, Box, Zap, DollarSign } from 'lucide-react';
import './Expenses.css';

const CATEGORIES = [
    { id: 'salaries', name: 'Staff Salaries', icon: Users, color: 'blue' },
    { id: 'inventory', name: 'Inventory & Stock', icon: Box, color: 'purple' },
    { id: 'maintenance', name: 'Maintenance', icon: Wrench, color: 'red' },
    { id: 'utilities', name: 'Utilities', icon: Zap, color: 'green' },
    { id: 'other', name: 'Other Expenses', icon: Receipt, color: 'muted' }
];

const INITIAL_EXPENSES = [
    { id: 1, date: 'Today, 10:30 AM', category: 'inventory', description: 'Restocked Red Bull & Snacks', amount: 3500.00 },
    { id: 2, date: 'Yesterday', category: 'maintenance', description: 'Pool Table 2 Felt Cleaning', amount: 1200.00 },
    { id: 3, date: '2 days ago', category: 'utilities', description: 'Monthly Electricity Bill', amount: 8500.00 },
    { id: 4, date: 'Last week', category: 'salaries', description: 'Staff Weekly Payout', amount: 25000.00 },
];

export default function Expenses() {
    const [expenses, setExpenses] = useState(INITIAL_EXPENSES);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('inventory');
    const [desc, setDesc] = useState('');

    const handleAddExpense = (e) => {
        e.preventDefault();
        if (!amount || !desc) return;

        setExpenses([
            {
                id: Date.now(),
                date: 'Just now',
                category,
                description: desc,
                amount: parseFloat(amount)
            },
            ...expenses
        ]);

        setAmount('');
        setDesc('');
        setShowForm(false);
    };

    const getCategoryIcon = (catId) => CATEGORIES.find(c => c.id === catId)?.icon || Receipt;
    const getCategoryColor = (catId) => CATEGORIES.find(c => c.id === catId)?.color || 'muted';
    const getCategoryName = (catId) => CATEGORIES.find(c => c.id === catId)?.name || 'Other';

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return (
        <div className="expenses-container">
            <div className="page-header mb-6">
                <div>
                    <h2>Daily Expenses</h2>
                    <p className="text-muted">Track all daily outings, maintenance, and operational costs.</p>
                </div>
                <button className="primary-button" onClick={() => setShowForm(!showForm)}>
                    <Plus size={18} className="mr-2" /> Add Expense
                </button>
            </div>

            <div className="content-grid flex-col md:flex-row gap-6">
                <div className="flex-1 flex-col gap-6">
                    <div className="glass-panel stats-card">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-muted">Total Recorded Expenses</span>
                            <div className="icon-wrapper bg-red text-red">
                                <DollarSign size={20} />
                            </div>
                        </div>
                        <div className="text-3xl font-bold text-glow-red font-heading">₹{totalExpenses.toFixed(2)}</div>
                        <p className="text-sm text-muted mt-2">Across {expenses.length} records this month.</p>
                    </div>

                    <div className="glass-panel p-6 flex-1">
                        <h3 className="mb-4 text-glow-blue border-b pb-4 border-glass text-lg font-medium">Recent Expenses</h3>
                        <div className="flex-col gap-4">
                            {expenses.map(exp => {
                                const Icon = getCategoryIcon(exp.category);
                                const colorClass = getCategoryColor(exp.category);

                                return (
                                    <div key={exp.id} className="expense-item flex items-center justify-between p-3 rounded bg-white-5 hover:bg-white-10 transition">
                                        <div className="flex items-center gap-4">
                                            <div className={`expense-icon bg-${colorClass}-10 text-${colorClass}`}>
                                                <Icon size={20} />
                                            </div>
                                            <div>
                                                <div className="font-medium">{exp.description}</div>
                                                <div className="text-xs text-muted mt-1">{getCategoryName(exp.category)} • {exp.date}</div>
                                            </div>
                                        </div>
                                        <div className="font-bold text-red-400">-₹{exp.amount.toFixed(2)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {showForm && (
                    <div className="glass-panel p-6 expense-form-wrapper animate-fade-in w-full md:w-96">
                        <h3 className="mb-6 font-medium text-lg">Record New Expense</h3>
                        <form onSubmit={handleAddExpense} className="flex-col gap-4">

                            <div className="form-group flex-col gap-2">
                                <label className="text-sm text-muted">Amount (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    className="glass-input text-lg font-bold"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                />
                            </div>

                            <div className="form-group flex-col gap-2">
                                <label className="text-sm text-muted">Category</label>
                                <select
                                    className="glass-input"
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group flex-col gap-2">
                                <label className="text-sm text-muted">Description</label>
                                <textarea
                                    className="glass-input min-h-24"
                                    required
                                    placeholder="What was this expense for?"
                                    value={desc}
                                    onChange={e => setDesc(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="flex gap-4 mt-4">
                                <button type="button" className="glass-button flex-1" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="danger-button flex-1 border-none shadow-red box-shadow" onClick={(e) => {
                                    if (!amount || !desc) {
                                        e.preventDefault();
                                        alert("Please fill in the amount and description.");
                                    }
                                }}>Save Expense</button>
                            </div>

                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
