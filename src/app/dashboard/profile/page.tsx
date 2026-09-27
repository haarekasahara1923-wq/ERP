'use client'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'

export default function ProfilePage() {
    const { tenant, user } = useAuth()
    const [form, setForm] = useState({
        name: tenant?.name || '',
        phone: tenant?.phone || '',
        email: tenant?.email || '',
        address: tenant?.address || '',
        themeColor: tenant?.themeColor || '#6366f1',
    })
    const [saved, setSaved] = useState(false)

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault()
        // In production, call API to save
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">🏢 Coaching Profile</h1>
                    <p className="page-subtitle">Manage your institute details and branding</p>
                </div>
            </div>

            {saved && <div className="toast toast-success" style={{ position: 'relative', marginBottom: '16px', maxWidth: '100%' }}>✓ Profile updated successfully!</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '16px', color: 'var(--primary-light)' }}>🏫 Institute Details</h3>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label className="label">Coaching Name</label>
                                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Phone Number</label>
                                <input className="input" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Email</label>
                                <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Address</label>
                                <textarea className="input" rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={{ resize: 'none' }} />
                            </div>
                            <div>
                                <label className="label">Brand Color</label>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <input type="color" value={form.themeColor} onChange={e => setForm({ ...form, themeColor: e.target.value })} style={{ width: '48px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none', padding: '2px' }} />
                                    <input className="input" style={{ flex: 1 }} value={form.themeColor} onChange={e => setForm({ ...form, themeColor: e.target.value })} />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary">💾 Save Changes</button>
                        </form>
                    </div>
                </div>

                <div>
                    {/* Preview Card */}
                    <div className="card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(236,72,153,0.05))' }}>
                        <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '15px' }}>👁️ Preview</h3>
                        <div style={{ padding: '20px', background: 'var(--surface)', borderRadius: '12px', border: `2px solid ${form.themeColor}40` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div style={{ width: '48px', height: '48px', background: `linear-gradient(135deg, ${form.themeColor}, ${form.themeColor}88)`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🎓</div>
                                <div>
                                    <div style={{ fontWeight: '800', fontSize: '16px', color: 'white' }}>{form.name || 'Your Coaching Name'}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{form.phone}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{form.address || 'Your institute address...'}</div>
                        </div>
                    </div>

                    {/* Admin Info */}
                    <div className="card">
                        <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '15px' }}>👤 Admin Account</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                            <div className="avatar" style={{ width: '56px', height: '56px', fontSize: '24px' }}>{user?.name?.charAt(0) || 'A'}</div>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '16px' }}>{user?.name}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{user?.email}</div>
                                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)', marginTop: '4px', display: 'inline-block' }}>{user?.role?.replace('_', ' ')}</span>
                            </div>
                        </div>

                        {/* Quick Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { label: 'Tenant ID', value: user?.tenantId?.slice(0, 12) + '...' || '' },
                                { label: 'Platform', value: 'UDBA v2.0' },
                                { label: 'Region', value: 'India (Asia-South)' },
                            ].map(i => (
                                <div key={i.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{i.label}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'monospace' }}>{i.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
