'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Payment {
    id: string
    studentName: string
    amount: number
    mode: string
    reference: string
    notes: string
    createdAt: string
    studentId: string
}

interface Student {
    id: string
    fullName: string
    phone: string
    totalFee: number
    paidFee: number
}

const modeColors: Record<string, string> = {
    UPI: '#8b5cf6',
    CASH: '#10b981',
    BANK_TRANSFER: '#06b6d4',
    CHEQUE: '#f59e0b',
    CARD: '#ec4899',
    ONLINE: '#6366f1',
}

export default function PaymentsPage() {
    const { token } = useAuth()
    const [payments, setPayments] = useState<Payment[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [form, setForm] = useState({ studentId: '', amount: '', mode: 'CASH', reference: '', notes: '' })
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState('')
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
    const [isEditing, setIsEditing] = useState(false)

    const fetchData = async () => {
        if (!token) return
        setLoading(true)
        const [p, s] = await Promise.all([
            fetch('/api/payments', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/students', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ])
        if (p.success) setPayments(p.data)
        if (s.success) setStudents(s.data)
        setLoading(false)
    }

    useEffect(() => { fetchData() }, [token])

    const totalCollection = payments.reduce((s, p) => s + p.amount, 0)
    const modeBreakdown = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE'].map(mode => ({
        mode, amount: payments.filter(p => p.mode === mode).reduce((s, p) => s + p.amount, 0),
        count: payments.filter(p => p.mode === mode).length,
    })).filter(m => m.count > 0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const url = '/api/payments'
            const method = isEditing ? 'PATCH' : 'POST'
            const payload = isEditing ? { ...form, id: selectedPayment?.id } : form

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (data.success) {
                setToast(isEditing ? 'Payment updated successfully!' : 'Payment recorded successfully!')
                setShowAdd(false)
                setIsEditing(false)
                setForm({ studentId: '', amount: '', mode: 'CASH', reference: '', notes: '' })
                fetchData()
                setTimeout(() => setToast(''), 3000)
            } else {
                alert(data.error || 'Failed to save payment')
            }
        } catch (err) {
            alert('Error saving payment')
        }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this payment record? The student\'s paid balance will be adjusted.')) return
        try {
            const res = await fetch(`/api/payments?id=${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                setToast('Payment deleted successfully!')
                fetchData()
                setTimeout(() => setToast(''), 3000)
            } else {
                alert(data.error || 'Failed to delete payment')
            }
        } catch (err) {
            alert('Error deleting payment')
        }
    }

    const startEdit = (p: Payment) => {
        setIsEditing(true)
        setSelectedPayment(p)
        setForm({
            studentId: p.studentId,
            amount: p.amount.toString(),
            mode: p.mode,
            reference: p.reference,
            notes: p.notes
        })
        setShowAdd(true)
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">💳 Fee Payments</h1>
                    <p className="page-subtitle">Total collected: {formatCurrency(totalCollection)}</p>
                </div>
                <button onClick={() => { setIsEditing(false); setForm({ studentId: '', amount: '', mode: 'CASH', reference: '', notes: '' }); setShowAdd(true); }} className="btn btn-primary">➕ Record Payment</button>
            </div>

            {toast && <div className="toast toast-success" style={{ position: 'relative', marginBottom: '16px', maxWidth: '100%' }}>✓ {toast}</div>}

            {/* Mode Breakdown */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {modeBreakdown.map(m => (
                    <div key={m.mode} style={{ padding: '12px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', borderLeft: `3px solid ${modeColors[m.mode] || '#6366f1'}` }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>{formatCurrency(m.amount)}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.mode} • {m.count} txns</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                    {loading && !payments.length ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Amount</th>
                                    <th>Mode</th>
                                    <th>Reference</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{p.studentName.charAt(0)}</div>
                                                <span style={{ fontWeight: '600', fontSize: '14px' }}>{p.studentName}</span>
                                            </div>
                                        </td>
                                        <td><span style={{ fontWeight: '700', color: '#10b981', fontSize: '15px' }}>+{formatCurrency(p.amount)}</span></td>
                                        <td>
                                            <span className="badge" style={{ background: `${modeColors[p.mode] || '#6366f1'}20`, color: modeColors[p.mode] || '#818cf8' }}>{p.mode}</span>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{p.reference || '—'}</td>
                                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(p.createdAt)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button onClick={() => startEdit(p)} className="btn btn-secondary btn-sm" title="Edit">✏️</button>
                                                <button onClick={() => handleDelete(p.id)} className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} title="Delete">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add/Edit Payment Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ fontWeight: '700' }}>{isEditing ? '✏️ Edit Payment' : '💳 Record Payment'}</h3>
                            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label className="label">Student *</label>
                                    <select className="input" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} required disabled={isEditing}>
                                        <option value="">Select Student</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id}>{s.fullName} — Due: {formatCurrency(s.totalFee - s.paidFee)}</option>
                                        ))}
                                    </select>
                                    {isEditing && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Student cannot be changed for existing records.</p>}
                                </div>
                                <div className="grid-cols-2">
                                    <div>
                                        <label className="label">Amount (₹) *</label>
                                        <input className="input" type="number" placeholder="5000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label className="label">Payment Mode</label>
                                        <select className="input" value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}>
                                            <option value="CASH">💵 Cash</option>
                                            <option value="UPI">📱 UPI</option>
                                            <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                                            <option value="CHEQUE">📄 Cheque</option>
                                            <option value="CARD">💳 Card</option>
                                            <option value="ONLINE">🌐 Online</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Reference / Transaction ID</label>
                                    <input className="input" placeholder="UPI123456 / NEFT789012" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">Notes</label>
                                    <input className="input" placeholder="Additional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? '⏳ Saving...' : isEditing ? '💾 Update Payment' : '✅ Record Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
