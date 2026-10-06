'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface LeaveApplication {
    id: string
    teacherId: string
    startDate: string
    endDate: string
    reason: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    createdAt: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
    PENDING: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'Pending Review', icon: '⏳' },
    APPROVED: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)', label: 'Approved', icon: '✅' },
    REJECTED: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.3)', label: 'Rejected', icon: '❌' },
}

export default function TeacherLeavesPage() {
    const { token } = useAuth()
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [leaves, setLeaves] = useState<LeaveApplication[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
    const [toast, setToast] = useState({ text: '', type: 'success' as 'success' | 'error' })

    const today = new Date().toISOString().split('T')[0]
    const [form, setForm] = useState({ startDate: today, endDate: today, reason: '' })

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToast({ text, type })
        setTimeout(() => setToast({ text: '', type: 'success' }), 3500)
    }

    const apiFetch = useCallback(async (url: string, opts?: RequestInit) => {
        const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } })
        return res.json()
    }, [token])

    const loadProfile = useCallback(async () => {
        if (!token) return
        const d = await apiFetch('/api/teachers/me')
        if (d.success) setTeacherId(d.data.id)
    }, [token, apiFetch])

    const fetchLeaves = useCallback(async (tid?: string) => {
        const id = tid || teacherId
        if (!id) return
        setLoading(true)
        const d = await apiFetch(`/api/teachers/leaves?teacherId=${id}`)
        if (d.success) setLeaves(d.data)
        setLoading(false)
    }, [teacherId, apiFetch])

    useEffect(() => { loadProfile() }, [loadProfile])
    useEffect(() => { if (teacherId) fetchLeaves() }, [teacherId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.reason.trim()) { showToast('Please provide a reason for leave', 'error'); return }
        if (form.startDate > form.endDate) { showToast('End date cannot be before start date', 'error'); return }
        setSubmitting(true)
        const d = await apiFetch('/api/teachers/leaves', {
            method: 'POST',
            body: JSON.stringify(form)
        })
        setSubmitting(false)
        if (d.success) {
            showToast('✅ Leave application submitted! Awaiting admin approval.')
            setShowForm(false)
            setForm({ startDate: today, endDate: today, reason: '' })
            fetchLeaves()
        } else {
            showToast(d.error || 'Failed to submit leave', 'error')
        }
    }

    const filtered = leaves.filter(l => filterStatus === 'ALL' || l.status === filterStatus)
    const pending = leaves.filter(l => l.status === 'PENDING').length
    const approved = leaves.filter(l => l.status === 'APPROVED').length
    const rejected = leaves.filter(l => l.status === 'REJECTED').length

    return (
        <div>
            <style>{`
                @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
                .slide-down { animation: slideDown 0.3s ease; }
                @keyframes formSlide { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }
                .form-slide { animation: formSlide 0.3s ease; }
                .leave-row:hover td { background: var(--surface-2) !important; }
            `}</style>

            {toast.text && (
                <div className="slide-down" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 99999, maxWidth: '420px', padding: '14px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', background: toast.type === 'success' ? '#052e22' : '#3b0d0d', border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'}`, color: toast.type === 'success' ? '#34d399' : '#fca5a5', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    {toast.text}
                </div>
            )}

            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">📋 Leave Applications</h1>
                    <p className="page-subtitle">Apply for leave · Track approval status</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
                    {showForm ? '✕ Cancel' : '➕ Apply for Leave'}
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                {[
                    { label: 'Pending', value: pending, color: '#f59e0b' },
                    { label: 'Approved', value: approved, color: '#10b981' },
                    { label: 'Rejected', value: rejected, color: '#ef4444' },
                    { label: 'Total Applied', value: leaves.length, color: 'var(--primary-light)' },
                ].map(s => (
                    <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '900', color: s.color }}>{s.value}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Leave Application Form */}
            {showForm && (
                <div className="form-slide card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
                    <h3 style={{ fontWeight: '700', fontSize: '16px', marginBottom: '20px', color: 'var(--primary-light)' }}>📝 New Leave Application</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Start Date *
                                </label>
                                <input
                                    type="date"
                                    value={form.startDate}
                                    min={today}
                                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                    className="input"
                                    style={{ margin: 0 }}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    End Date *
                                </label>
                                <input
                                    type="date"
                                    value={form.endDate}
                                    min={form.startDate}
                                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                    className="input"
                                    style={{ margin: 0 }}
                                    required
                                />
                            </div>
                        </div>

                        {form.startDate && form.endDate && (
                            <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: 'var(--primary-light)' }}>
                                📅 Duration: <strong>{Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1} day(s)</strong>
                                &nbsp;·&nbsp;{new Date(form.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} to {new Date(form.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Reason for Leave *
                            </label>
                            <textarea
                                value={form.reason}
                                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                placeholder="Please provide a brief reason for your leave request…"
                                rows={4}
                                className="input"
                                style={{ margin: 0, resize: 'vertical', minHeight: '90px' }}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                            <button type="submit" disabled={submitting} className="btn btn-primary">
                                {submitting ? '⏳ Submitting…' : '📤 Submit Leave Application'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilterStatus(f)}
                        style={{
                            padding: '7px 16px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            border: '1.5px solid',
                            transition: 'all 0.2s',
                            background: filterStatus === f ? 'linear-gradient(135deg, var(--primary), #6d28d9)' : 'var(--surface-2)',
                            borderColor: filterStatus === f ? 'transparent' : 'var(--border)',
                            color: filterStatus === f ? 'white' : 'var(--text-muted)',
                        }}>
                        {f === 'PENDING' ? `⏳ Pending (${pending})` : f === 'APPROVED' ? `✅ Approved (${approved})` : f === 'REJECTED' ? `❌ Rejected (${rejected})` : `📋 All (${leaves.length})`}
                    </button>
                ))}
            </div>

            {/* Leave List */}
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                        <tr>
                            {['#', 'Duration', 'Days', 'Reason', 'Applied On', 'Status'].map(h => (
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
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📋</div>
                                <div style={{ fontWeight: '600', marginBottom: '6px' }}>No {filterStatus !== 'ALL' ? filterStatus.toLowerCase() : ''} leave applications</div>
                                <div style={{ fontSize: '13px' }}>Click &quot;Apply for Leave&quot; to submit a new request</div>
                            </td></tr>
                        ) : (
                            filtered.map((l, i) => {
                                const days = Math.round((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / 86400000) + 1
                                const sc = STATUS_STYLE[l.status]
                                return (
                                    <tr key={l.id} className="leave-row" style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                                        <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '13px' }}>{i + 1}</td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontWeight: '700', fontSize: '13px' }}>
                                                {new Date(l.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                → {new Date(l.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)', border: '1px solid rgba(99,102,241,0.25)', padding: '3px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: '700' }}>
                                                {days}d
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', maxWidth: '220px' }}>
                                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason}</div>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {new Date(l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                {sc.icon} {sc.label}
                                            </span>
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
