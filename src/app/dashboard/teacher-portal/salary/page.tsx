'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface SalaryLedger {
    id: string
    teacherId: string
    month: number
    year: number
    baseSalary: number
    deductions: number
    netPayable: number
    status: 'PAID' | 'UNPAID'
    paidDate: string | null
    teacher: { id: string; name: string; salary: number }
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

export default function TeacherSalaryPage() {
    const { token } = useAuth()
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [baseSalary, setBaseSalary] = useState(0)
    const [ledgers, setLedgers] = useState<SalaryLedger[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

    const apiFetch = useCallback(async (url: string, opts?: RequestInit) => {
        const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } })
        return res.json()
    }, [token])

    const loadProfile = useCallback(async () => {
        if (!token) return
        const d = await apiFetch('/api/teachers/me')
        if (d.success) {
            setTeacherId(d.data.id)
            setBaseSalary(d.data.salary || 0)
        }
    }, [token, apiFetch])

    const fetchLedgers = useCallback(async (tid?: string) => {
        const id = tid || teacherId
        if (!id) return
        setLoading(true)
        const d = await apiFetch(`/api/teachers/ledger?teacherId=${id}&year=${selectedYear}`)
        if (d.success) setLedgers(d.data)
        setLoading(false)
    }, [teacherId, apiFetch, selectedYear])

    useEffect(() => { loadProfile() }, [loadProfile])
    useEffect(() => { if (teacherId) fetchLedgers() }, [teacherId, selectedYear])

    const totalPaid = ledgers.filter(l => l.status === 'PAID').reduce((s, l) => s + l.netPayable, 0)
    const totalUnpaid = ledgers.filter(l => l.status === 'UNPAID').reduce((s, l) => s + l.netPayable, 0)
    const totalDeductions = ledgers.reduce((s, l) => s + l.deductions, 0)

    const currentMonth = new Date().getMonth() + 1
    const currentMonthLedger = ledgers.find(l => l.month === currentMonth)

    const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i)

    return (
        <div>
            <style>{`
                @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
                .slide-down { animation: slideDown 0.3s ease; }
            `}</style>

            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">💰 Salary Ledger</h1>
                    <p className="page-subtitle">View your monthly salary, deductions & payment history</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="input" style={{ margin: 0, width: 'auto' }}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Base Salary + Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[
                    { label: 'Base Monthly Salary', value: `₹${baseSalary.toLocaleString('en-IN')}`, color: '#6366f1', icon: '📋', sub: 'Your CTC per month' },
                    { label: 'Total Paid', value: `₹${totalPaid.toLocaleString('en-IN')}`, color: '#10b981', icon: '✅', sub: `${ledgers.filter(l => l.status === 'PAID').length} months paid` },
                    { label: 'Pending Payment', value: `₹${totalUnpaid.toLocaleString('en-IN')}`, color: '#f59e0b', icon: '⏳', sub: `${ledgers.filter(l => l.status === 'UNPAID').length} months pending` },
                    { label: 'Total Deductions', value: `₹${totalDeductions.toLocaleString('en-IN')}`, color: '#ef4444', icon: '📉', sub: 'For absences this year' },
                ].map(s => (
                    <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}>
                        <div style={{ fontSize: '22px', marginBottom: '4px' }}>{s.icon}</div>
                        <div style={{ fontSize: '22px', fontWeight: '900', color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            {/* Current Month highlight */}
            {currentMonthLedger && (
                <div style={{ background: 'linear-gradient(135deg, #0f2027, #203a43)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '18px', padding: '22px 26px', marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                        📅 {MONTHS[currentMonth]} {selectedYear} — Current Month
                    </div>
                    <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Base Salary</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: 'white' }}>₹{currentMonthLedger.baseSalary.toLocaleString('en-IN')}</div>
                        </div>
                        <div style={{ color: '#475569', fontSize: '20px' }}>−</div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Deductions</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#ef4444' }}>₹{currentMonthLedger.deductions.toLocaleString('en-IN')}</div>
                        </div>
                        <div style={{ color: '#475569', fontSize: '20px' }}>=</div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Net Payable</div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>₹{currentMonthLedger.netPayable.toLocaleString('en-IN')}</div>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <span style={{
                                background: currentMonthLedger.status === 'PAID' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                color: currentMonthLedger.status === 'PAID' ? '#10b981' : '#f59e0b',
                                border: `1px solid ${currentMonthLedger.status === 'PAID' ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`,
                                padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '14px'
                            }}>
                                {currentMonthLedger.status === 'PAID'
                                    ? `✅ Paid on ${new Date(currentMonthLedger.paidDate!).toLocaleDateString('en-IN')}`
                                    : '⏳ Payment Pending'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Ledger Table */}
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontWeight: '700', fontSize: '15px' }}>📊 Full Ledger — {selectedYear}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ledgers.length} month(s) recorded</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                        <tr>
                            {['Month', 'Base Salary', 'Deductions', 'Net Payable', 'Status', 'Payment Date'].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 8px' }} />
                                Loading…
                            </td></tr>
                        ) : ledgers.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '40px', marginBottom: '10px' }}>💰</div>
                                <div style={{ fontWeight: '600', marginBottom: '6px' }}>No salary records for {selectedYear}</div>
                                <div style={{ fontSize: '13px' }}>Your admin generates monthly salaries based on attendance</div>
                            </td></tr>
                        ) : (
                            ledgers.map(l => {
                                const isCurrent = l.month === currentMonth && l.year === new Date().getFullYear()
                                return (
                                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)', background: isCurrent ? 'rgba(99,102,241,0.05)' : '', transition: 'background 0.15s' }}
                                        onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)' }}
                                        onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLTableRowElement).style.background = '' }}>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontWeight: '700', fontSize: '14px', color: isCurrent ? 'var(--primary-light)' : 'var(--text-primary)' }}>
                                                {MONTHS[l.month]}
                                                {isCurrent && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '700', color: '#6366f1', background: 'rgba(99,102,241,0.15)', padding: '1px 6px', borderRadius: '4px' }}>CURRENT</span>}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.year}</div>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontWeight: '600', fontSize: '14px' }}>
                                            ₹{l.baseSalary.toLocaleString('en-IN')}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontWeight: '700', fontSize: '14px', color: l.deductions > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                            {l.deductions > 0 ? `- ₹${l.deductions.toLocaleString('en-IN')}` : '—'}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontWeight: '900', fontSize: '16px', color: '#10b981' }}>
                                            ₹{l.netPayable.toLocaleString('en-IN')}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                background: l.status === 'PAID' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                                color: l.status === 'PAID' ? '#10b981' : '#f59e0b',
                                                border: `1px solid ${l.status === 'PAID' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                                padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700'
                                            }}>
                                                {l.status === 'PAID' ? '✅ Paid' : '⏳ Pending'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                            {l.paidDate ? new Date(l.paidDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
