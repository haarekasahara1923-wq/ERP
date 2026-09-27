'use client'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SubscriptionsPage() {
    const { user, token } = useAuth()
    const router = useRouter()
    const [tenants, setTenants] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('ALL')

    const authHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') router.push('/dashboard')
        if (user && user.role === 'SUPER_ADMIN') fetchData()
    }, [user, router])

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/super-admin/tenants', { headers: authHeaders })
            const data = await res.json()
            if (!data.error) setTenants(data.tenants || [])
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const handleMarkPaid = async (tenantId: string, plan: string) => {
        if (!window.confirm(`Activate ${plan} plan for 1 month?`)) return
        try {
            const res = await fetch('/api/super-admin/tenants', {
                method: 'PUT', headers: authHeaders,
                body: JSON.stringify({ tenantId, action: 'mark_paid', plan })
            })
            const data = await res.json()
            if (data.success) { alert(data.message); fetchData() }
            else alert(data.error || 'Failed')
        } catch (e) { console.error(e) }
    }

    if (!user || user.role !== 'SUPER_ADMIN') return null

    const planColors: Record<string, string> = { BASIC: '#6366f1', PRO: '#ec4899', ELITE: '#f59e0b' }
    const filtered = filter === 'ALL' ? tenants : tenants.filter(t => t.plan === filter || t.subscriptionStatus === filter)

    const basicCount = tenants.filter(t => t.plan === 'BASIC').length
    const proCount = tenants.filter(t => t.plan === 'PRO').length
    const eliteCount = tenants.filter(t => t.plan === 'ELITE').length
    const activeCount = tenants.filter(t => t.subscriptionStatus === 'ACTIVE').length
    const trialCount = tenants.filter(t => t.subscriptionStatus === 'TRIAL' || t.subscriptionStatus === 'TRIALING').length
    const totalMRR = tenants.reduce((s, t) => s + (t.plan === 'BASIC' ? 999 : t.plan === 'PRO' ? 2999 : t.plan === 'ELITE' ? 5999 : 0), 0)

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">💎 Subscription Management</h1>
                    <p className="page-subtitle">Track and manage all coaching subscriptions</p>
                </div>
            </div>

            {/* Revenue Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Monthly Recurring Revenue', value: `₹${totalMRR.toLocaleString('en-IN')}`, icon: '💰', color: '#10b981' },
                    { label: 'Active Subscriptions', value: activeCount, icon: '✅', color: '#6366f1' },
                    { label: 'On Trial', value: trialCount, icon: '🕐', color: '#f59e0b' },
                    { label: 'Basic Plans', value: basicCount, icon: '📘', color: '#6366f1' },
                    { label: 'Pro Plans', value: proCount, icon: '💜', color: '#ec4899' },
                    { label: 'Elite Plans', value: eliteCount, icon: '👑', color: '#f59e0b' },
                ].map(s => (
                    <div key={s.label} className="stat-card" style={{ '--card-accent': s.color } as React.CSSProperties}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>{s.label}</p>
                                <p style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>{s.value}</p>
                            </div>
                            <div style={{ fontSize: '28px' }}>{s.icon}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {['ALL', 'BASIC', 'PRO', 'ELITE', 'ACTIVE', 'TRIAL'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer',
                        background: filter === f ? 'var(--primary)' : 'var(--surface)', color: filter === f ? 'white' : 'var(--text-secondary)'
                    }}>{f}</button>
                ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Coaching Center</th>
                                    <th>Current Plan</th>
                                    <th>Status</th>
                                    <th>Amount</th>
                                    <th>Students</th>
                                    <th>Trial Ends</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(t => {
                                    const pc = planColors[t.plan] || '#6366f1'
                                    return (
                                        <tr key={t.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '14px' }}>{t.name.charAt(0)}</div>
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{t.name}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.email || t.slug}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: `${pc}20`, color: pc }}>{t.plan}</span></td>
                                            <td>
                                                <span className={`badge ${t.subscriptionStatus === 'ACTIVE' ? 'badge-success' : t.subscriptionStatus === 'TRIAL' || t.subscriptionStatus === 'TRIALING' ? 'badge-info' : 'badge-warning'}`}>
                                                    {t.subscriptionStatus}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: '600' }}>₹{t.plan === 'BASIC' ? '999' : t.plan === 'PRO' ? '2,999' : '5,999'}/mo</td>
                                            <td>{t.studentCount}</td>
                                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <select className="input" style={{ padding: '4px 6px', fontSize: '11px', width: '80px' }} id={`sub-${t.id}`} defaultValue={t.plan}>
                                                        <option value="BASIC">BASIC</option>
                                                        <option value="PRO">PRO</option>
                                                        <option value="ELITE">ELITE</option>
                                                    </select>
                                                    <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: '11px', padding: '4px 8px' }}
                                                        onClick={() => { const sel = document.getElementById(`sub-${t.id}`) as HTMLSelectElement; handleMarkPaid(t.id, sel.value) }}>
                                                        ✅ Mark Paid
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No subscriptions match this filter.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
