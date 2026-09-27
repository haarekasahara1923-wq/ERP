'use client'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SuperAdminPage() {
    const { user, token } = useAuth()
    const router = useRouter()
    const [tenants, setTenants] = useState<any[]>([])
    const [stats, setStats] = useState<any>({})
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

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
            if (!data.error) {
                setTenants(data.tenants || [])
                setStats(data.stats || {})
            }
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const handleAction = async (tenantId: string, action: string, plan?: string) => {
        const confirmation = action === 'block'
            ? window.confirm('Are you sure you want to BLOCK this coaching center?')
            : action === 'mark_paid'
                ? window.confirm('Mark this coaching subscription as PAID for 1 month?')
                : true
        if (!confirmation) return
        try {
            const res = await fetch('/api/super-admin/tenants', {
                method: 'PUT', headers: authHeaders,
                body: JSON.stringify({ tenantId, action, plan })
            })
            const data = await res.json()
            if (data.success) { alert(data.message); fetchData() }
            else alert(data.error || 'Failed')
        } catch (e) { console.error(e) }
    }

    if (!user || user.role !== 'SUPER_ADMIN') return null

    const filteredTenants = tenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(search.toLowerCase())
    )

    const planColors: Record<string, string> = { BASIC: '#6366f1', PRO: '#ec4899', ELITE: '#f59e0b' }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">👑 Super Admin Panel</h1>
                    <p className="page-subtitle">Platform overview — Real-time data from DB</p>
                </div>
                <div style={{ padding: '8px 16px', background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '10px', color: '#f9a8d4', fontSize: '13px', fontWeight: '700' }}>
                    🔴 Super Admin Mode
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Coaching Centers', value: stats.totalTenants || 0, icon: '🏫', color: '#6366f1' },
                    { label: 'Active Tenants', value: stats.activeTenants || 0, icon: '✅', color: '#10b981' },
                    { label: 'Total Students', value: stats.totalStudents || 0, icon: '👨‍🎓', color: '#f59e0b' },
                    { label: 'Gyankosh Revenue', value: `₹${(stats.totalGyankoshRevenue || 0).toLocaleString('en-IN')}`, icon: '💰', color: '#ec4899' },
                    { label: 'Commission Paid', value: `₹${(stats.totalCommissionPaid || 0).toLocaleString('en-IN')}`, icon: '🤝', color: '#06b6d4' },
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

            {/* Plan Distribution */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {['BASIC', 'PRO', 'ELITE'].map(plan => {
                    const count = tenants.filter(t => t.plan === plan).length
                    const pc = planColors[plan] || '#6366f1'
                    return (
                        <div key={plan} style={{ padding: '16px 24px', background: 'var(--surface)', border: `1px solid ${pc}30`, borderRadius: '12px', borderLeft: `4px solid ${pc}`, minWidth: '140px' }}>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: pc }}>{count}</div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>{plan}</div>
                        </div>
                    )
                })}
            </div>

            {/* Tenants Table */}
            <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontWeight: '700', fontSize: '16px' }}>🏫 All Coaching Centers ({filteredTenants.length})</h3>
                    <input className="input" placeholder="Search by name or email..." style={{ width: '250px', padding: '8px 12px' }} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Coaching Center</th>
                                    <th>Plan</th>
                                    <th>Students</th>
                                    <th>Affiliate Earnings</th>
                                    <th>Balance</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTenants.map(t => {
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
                                            <td>
                                                <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: `${pc}20`, color: pc }}>{t.plan}</span>
                                            </td>
                                            <td style={{ fontWeight: '600' }}>{t.studentCount}</td>
                                            <td style={{ fontWeight: '700', color: '#10b981' }}>₹{t.affiliateEarnings || 0}</td>
                                            <td style={{ fontWeight: '600' }}>₹{t.availableBalance || 0}</td>
                                            <td>
                                                <span className={`badge ${t.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                    {t.isActive ? 'ACTIVE' : 'BLOCKED'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    <select className="input" style={{ padding: '4px 6px', fontSize: '12px', width: '90px' }} id={`plan-${t.id}`} defaultValue={t.plan}>
                                                        <option value="BASIC">BASIC</option>
                                                        <option value="PRO">PRO</option>
                                                        <option value="ELITE">ELITE</option>
                                                    </select>
                                                    <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: '12px', padding: '4px 8px' }}
                                                        onClick={() => {
                                                            const sel = document.getElementById(`plan-${t.id}`) as HTMLSelectElement
                                                            handleAction(t.id, 'mark_paid', sel.value)
                                                        }}>✅ Mark Paid</button>
                                                    {t.isActive ? (
                                                        <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '12px', padding: '4px 8px' }}
                                                            onClick={() => handleAction(t.id, 'block')}>⛔ Block</button>
                                                    ) : (
                                                        <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: '12px', padding: '4px 8px' }}
                                                            onClick={() => handleAction(t.id, 'unblock')}>🟢 Unblock</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
