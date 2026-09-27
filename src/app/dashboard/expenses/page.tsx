'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { downloadCSV, generateAndPrintPDF } from '@/lib/reportExport'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface Expense {
    id: string
    category: string
    amount: number
    date: string
    description: string
    paidTo: string
}

const CATEGORIES = ['Rent', 'Salary', 'Electricity', 'Marketing', 'Internet', 'Office Supplies', 'Maintenance', 'Misc']
const COLORS = { Rent: '#6366f1', Salary: '#ec4899', Electricity: '#f59e0b', Marketing: '#06b6d4', Misc: '#94a3b8', Internet: '#10b981', 'Office Supplies': '#8b5cf6', Maintenance: '#ef4444' }

export default function ExpensesPage() {
    const { token, tenant } = useAuth()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [form, setForm] = useState({ category: 'Rent', amount: '', date: new Date().toISOString().split('T')[0], description: '', paidTo: '' })
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState('')

    const fetchExpenses = async () => {
        if (!token) return
        const res = await fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (data.success) setExpenses(data.data)
        setLoading(false)
    }

    useEffect(() => { fetchExpenses() }, [token])

    const total = expenses.reduce((s, e) => s + e.amount, 0)
    const byCat = CATEGORIES.map(cat => ({
        name: cat, amount: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
    })).filter(c => c.amount > 0)

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        setSaving(false)
        if (data.success) {
            setToast('Expense added!')
            setShowAdd(false)
            setForm({ category: 'Rent', amount: '', date: new Date().toISOString().split('T')[0], description: '', paidTo: '' })
            fetchExpenses()
            setTimeout(() => setToast(''), 3000)
        }
    }

    const handleExportCSV = () => {
        const timestamp = new Date().toISOString().split('T')[0]
        const rows = [
            ['UNIVERSAL DAY BOARDING ACADEMY - EXPENSES REPORT'],
            ['Generated On', new Date().toLocaleString('en-IN')],
            ['Total Expenses', formatCurrency(total)],
            ['Total Expense Records', expenses.length],
            [''],
            ['Category', 'Amount (INR)', 'Paid To', 'Date', 'Description']
        ]
        expenses.forEach(e => {
            rows.push([
                e.category,
                e.amount,
                e.paidTo || '-',
                e.date,
                e.description || '-'
            ])
        })
        downloadCSV(`udba-expenses-report-${timestamp}.csv`, rows)
    }

    const handleExportPDF = () => {
        generateAndPrintPDF({
            title: 'Institute Operating Expenses Report',
            subtitle: `Consolidated Expenditure Summary - Generated on ${new Date().toLocaleDateString('en-IN')}`,
            schoolName: tenant?.name || 'Universal Day Boarding Academy',
            schoolAddress: '📍 Pinto Park, Gwalior (MP) • Ph: +91 7879337770',
            stats: [
                { label: 'Total Expenses', value: formatCurrency(total), subtext: 'All-time expenditures', color: '#ef4444' },
                { label: 'Total Entries', value: expenses.length, subtext: 'Recorded items', color: '#6366f1' },
                { label: 'Top Category', value: byCat[0]?.name || 'Rent', subtext: `${formatCurrency(byCat[0]?.amount || 0)}`, color: '#f59e0b' },
            ],
            tables: [
                {
                    title: 'Expense Category Breakdown',
                    headers: ['Category', 'Total Spent (₹)', 'Share (%)'],
                    rows: byCat.map(c => [
                        c.name,
                        `₹${c.amount.toLocaleString('en-IN')}`,
                        total > 0 ? `${((c.amount / total) * 100).toFixed(1)}%` : '0%'
                    ])
                },
                {
                    title: 'Detailed Expense Records',
                    headers: ['Date', 'Category', 'Paid To / Vendor', 'Amount (₹)', 'Description'],
                    rows: expenses.map(e => [
                        formatDate(e.date),
                        e.category,
                        e.paidTo || '-',
                        `₹${e.amount.toLocaleString('en-IN')}`,
                        e.description || '-'
                    ])
                }
            ]
        })
    }

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 className="page-title">📉 Expense Management</h1>
                    <p className="page-subtitle">Total expenses: {formatCurrency(total)}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleExportCSV}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '9px 14px' }}
                        title="Download expenses in CSV format"
                    >
                        <span>⬇️</span> Download CSV
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '9px 14px', background: 'linear-gradient(135deg, #1a5c38, #0f3d26)' }}
                        title="Print or Save expense report as PDF"
                    >
                        <span>🖨️</span> Download PDF
                    </button>
                    <button onClick={() => setShowAdd(true)} className="btn btn-primary">➕ Add Expense</button>
                </div>
            </div>

            {toast && <div className="toast toast-success" style={{ position: 'relative', marginBottom: '16px', maxWidth: '100%' }}>✓ {toast}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="card">
                    <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '15px' }}>📊 Category Breakdown</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={byCat}>
                            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v: any) => `₹${(Number(v) / 1000).toFixed(0)}K`} />
                            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} formatter={(v: any) => formatCurrency(Number(v ?? 0))} />
                            <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '15px' }}>🔄 Distribution</h3>
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie data={byCat} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                                {byCat.map((entry, i) => <Cell key={i} fill={COLORS[entry.name as keyof typeof COLORS] || '#6366f1'} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} formatter={(v: any) => formatCurrency(Number(v ?? 0))} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {byCat.map(c => (
                            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: COLORS[c.name as keyof typeof COLORS] || '#6366f1', display: 'inline-block' }} />
                                {c.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Paid To</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                            ) : expenses.map(e => (
                                <tr key={e.id}>
                                    <td>
                                        <span style={{
                                            padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                                            background: `${COLORS[e.category as keyof typeof COLORS] || '#6366f1'}20`,
                                            color: COLORS[e.category as keyof typeof COLORS] || '#818cf8'
                                        }}>{e.category}</span>
                                    </td>
                                    <td><span style={{ fontWeight: '700', color: '#ef4444' }}>{formatCurrency(e.amount)}</span></td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(e.date)}</td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{e.description || '—'}</td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{e.paidTo || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAdd && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 style={{ fontWeight: '700' }}>📉 Add Expense</h3>
                            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form onSubmit={handleAdd}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="grid-cols-2">
                                    <div><label className="label">Category</label>
                                        <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                        </select></div>
                                    <div><label className="label">Amount (₹) *</label>
                                        <input className="input" type="number" placeholder="5000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
                                </div>
                                <div><label className="label">Date</label>
                                    <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                                <div><label className="label">Description</label>
                                    <input className="input" placeholder="Details about the expense" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                                <div><label className="label">Paid To</label>
                                    <input className="input" placeholder="Vendor / Person name" value={form.paidTo} onChange={e => setForm({ ...form, paidTo: e.target.value })} /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '⏳' : '💾 Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
