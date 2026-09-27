'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Teacher {
    id: string
    name: string
    email: string
    phone: string
    subject: string[]
    salary: number
    joinDate: string
    isActive: boolean
}

export default function TeachersPage() {
    const { token } = useAuth()
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', salary: '', joinDate: new Date().toISOString().split('T')[0] })
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState('')

    const fetchTeachers = async () => {
        if (!token) return
        const res = await fetch('/api/teachers', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (data.success) setTeachers(data.data)
        setLoading(false)
    }

    useEffect(() => { fetchTeachers() }, [token])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        const res = await fetch('/api/teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...form, subject: form.subject.split(',').map(s => s.trim()) }),
        })
        const data = await res.json()
        setSaving(false)
        if (data.success) {
            setToast('Teacher added!')
            setShowAdd(false)
            fetchTeachers()
            setTimeout(() => setToast(''), 3000)
        }
    }

    const totalSalary = teachers.reduce((s, t) => s + t.salary, 0)

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">👩‍🏫 Teacher Management</h1>
                    <p className="page-subtitle">{teachers.length} teachers • Monthly outflow: ₹{totalSalary.toLocaleString('en-IN')}</p>
                </div>
                <button onClick={() => setShowAdd(true)} className="btn btn-primary">➕ Add Teacher</button>
            </div>

            {toast && <div className="toast toast-success" style={{ position: 'relative', marginBottom: '16px', maxWidth: '100%' }}>✓ {toast}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                ) : teachers.map(t => (
                    <div key={t.id} className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '20px' }}>{t.name.charAt(0)}</div>
                            <div>
                                <h3 style={{ fontWeight: '700', fontSize: '15px' }}>{t.name}</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t.email}</p>
                            </div>
                            <div style={{ marginLeft: 'auto' }}>
                                <span className={`badge ${t.isActive ? 'badge-success' : 'badge-gray'}`}>{t.isActive ? 'Active' : 'Inactive'}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📱 Phone</span>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>{t.phone}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>💰 Salary</span>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#10b981' }}>₹{t.salary.toLocaleString('en-IN')}/mo</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📅 Joined</span>
                                <span style={{ fontSize: '13px', fontWeight: '600' }}>{new Date(t.joinDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase' }}>Subjects</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {t.subject.map(s => (
                                    <span key={s} style={{ padding: '3px 10px', background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{s}</span>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <a href={`https://wa.me/91${t.phone.replace(/\D/g, '')}`} target="_blank" style={{ flex: 1, padding: '8px', background: '#25d36615', border: '1px solid #25d36630', borderRadius: '8px', color: '#25d366', fontSize: '13px', textDecoration: 'none', textAlign: 'center', fontWeight: '600' }}>💬 WhatsApp</a>
                            <button onClick={() => alert("Teacher Performance Analytics module is currently under development.")} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>📊 Performance</button>
                        </div>
                    </div>
                ))}
            </div>

            {showAdd && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 style={{ fontWeight: '700' }}>👩‍🏫 Add Teacher</h3>
                            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <form onSubmit={handleAdd}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div><label className="label">Full Name *</label><input className="input" placeholder="Dr. Rajesh Kumar" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                <div className="grid-cols-2">
                                    <div><label className="label">Phone *</label><input className="input" type="tel" placeholder="917879337770" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required /></div>
                                    <div><label className="label">Email</label><input className="input" type="email" placeholder="teacher@coaching.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                                </div>
                                <div><label className="label">Subjects (comma separated)</label><input className="input" placeholder="Physics, Maths" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
                                <div className="grid-cols-2">
                                    <div><label className="label">Monthly Salary (₹)</label><input className="input" type="number" placeholder="35000" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} /></div>
                                    <div><label className="label">Join Date</label><input className="input" type="date" value={form.joinDate} onChange={e => setForm({ ...form, joinDate: e.target.value })} /></div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '⏳' : '✅ Add Teacher'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
