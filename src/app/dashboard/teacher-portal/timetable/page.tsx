'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Timetable {
    id: string
    teacherId: string
    courseId: string | null
    batchId: string | null
    subject: string
    dayOfWeek: number
    startTime: string
    endTime: string
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED'
    teacher: { id: string; name: string }
    course: { id: string; name: string } | null
    batch: { id: string; name: string } | null
}

interface Batch { id: string; name: string }
interface Course { id: string; name: string }

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
    PENDING_APPROVAL: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)', label: 'Pending Approval', icon: '⏳' },
    PUBLISHED: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)', label: 'Published', icon: '✅' },
    DRAFT: { bg: 'var(--surface-2)', color: 'var(--text-muted)', border: 'var(--border)', label: 'Draft', icon: '📝' },
}

export default function TeacherTimetablePage() {
    const { token } = useAuth()
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [timetables, setTimetables] = useState<Timetable[]>([])
    const [batches, setBatches] = useState<Batch[]>([])
    const [courses, setCourses] = useState<Course[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [toast, setToast] = useState({ text: '', type: 'success' as 'success' | 'error' })

    const [form, setForm] = useState({
        courseId: '',
        batchId: '',
        subject: '',
        dayOfWeek: '1',
        startTime: '09:00',
        endTime: '10:00',
    })

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

    const fetchTimetables = useCallback(async (tid?: string) => {
        const id = tid || teacherId
        if (!id) return
        setLoading(true)
        const d = await apiFetch(`/api/teachers/timetable?teacherId=${id}`)
        if (d.success) setTimetables(d.data)
        setLoading(false)
    }, [teacherId, apiFetch])

    const fetchBatchesCourses = useCallback(async () => {
        const [bd, cd] = await Promise.all([apiFetch('/api/batches'), apiFetch('/api/courses')])
        if (bd.success) setBatches(bd.data || [])
        if (cd.success) setCourses(cd.data || [])
    }, [apiFetch])

    useEffect(() => { loadProfile() }, [loadProfile])
    useEffect(() => { if (teacherId) { fetchTimetables(); fetchBatchesCourses() } }, [teacherId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.subject.trim()) { showToast('Please enter a subject', 'error'); return }
        setSubmitting(true)
        const d = await apiFetch('/api/teachers/timetable', {
            method: 'POST',
            body: JSON.stringify(form)
        })
        setSubmitting(false)
        if (d.success) {
            showToast('📅 Schedule submitted for admin approval!')
            setShowForm(false)
            setForm({ courseId: '', batchId: '', subject: '', dayOfWeek: '1', startTime: '09:00', endTime: '10:00' })
            fetchTimetables()
        } else {
            showToast(d.error || 'Failed to submit schedule', 'error')
        }
    }

    const deleteEntry = async (id: string) => {
        if (!confirm('Delete this schedule entry?')) return
        const d = await apiFetch(`/api/teachers/timetable?id=${id}`, { method: 'DELETE' })
        if (d.success) { showToast('Deleted'); fetchTimetables() }
        else showToast(d.error || 'Failed', 'error')
    }

    const pending = timetables.filter(t => t.status === 'PENDING_APPROVAL').length
    const published = timetables.filter(t => t.status === 'PUBLISHED').length

    // Group by day
    const byDay = DAYS.slice(1).map((day, i) => ({
        day,
        dayNum: i + 1,
        entries: timetables.filter(t => t.dayOfWeek === i + 1)
    })).filter(d => d.entries.length > 0)

    return (
        <div>
            <style>{`
                @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
                .slide-down { animation: slideDown 0.3s ease; }
                @keyframes formSlide { from { opacity:0; transform:translateY(-16px); } to { opacity:1; transform:translateY(0); } }
                .form-slide { animation: formSlide 0.3s ease; }
            `}</style>

            {toast.text && (
                <div className="slide-down" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 99999, maxWidth: '420px', padding: '14px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', background: toast.type === 'success' ? '#052e22' : '#3b0d0d', border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'}`, color: toast.type === 'success' ? '#34d399' : '#fca5a5', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    {toast.text}
                </div>
            )}

            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">📅 Teaching Schedule</h1>
                    <p className="page-subtitle">Create & submit your teaching schedule · Admin approval required to publish</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
                    {showForm ? '✕ Cancel' : '➕ Add Schedule'}
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                {[
                    { label: 'Total Entries', value: timetables.length, color: 'var(--primary-light)' },
                    { label: 'Pending Approval', value: pending, color: '#f59e0b' },
                    { label: 'Published', value: published, color: '#10b981' },
                ].map(s => (
                    <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '900', color: s.color }}>{s.value}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Info banner */}
            {pending > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#f59e0b', fontWeight: '600' }}>
                    ⏳ {pending} schedule entr{pending > 1 ? 'ies are' : 'y is'} awaiting admin approval. You will be notified once approved.
                </div>
            )}

            {/* Add Schedule Form */}
            {showForm && (
                <div className="form-slide card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
                    <h3 style={{ fontWeight: '700', fontSize: '16px', marginBottom: '20px', color: 'var(--primary-light)' }}>📝 New Teaching Schedule Entry</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Class / Course</label>
                                <select value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))} className="input" style={{ margin: 0 }}>
                                    <option value="">— Select Course —</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Batch / Section</label>
                                <select value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))} className="input" style={{ margin: 0 }}>
                                    <option value="">— Select Batch —</option>
                                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject *</label>
                            <input
                                type="text"
                                value={form.subject}
                                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                                placeholder="e.g., Mathematics, Physics, English…"
                                className="input"
                                style={{ margin: 0 }}
                                required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Day *</label>
                                <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))} className="input" style={{ margin: 0 }} required>
                                    {DAYS.slice(1).map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start Time *</label>
                                <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="input" style={{ margin: 0 }} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>End Time *</label>
                                <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input" style={{ margin: 0 }} required />
                            </div>
                        </div>

                        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            ℹ️ Your schedule will be submitted as <strong style={{ color: '#f59e0b' }}>Pending Approval</strong>. Admin will review and publish it to the batch.
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                            <button type="submit" disabled={submitting} className="btn btn-primary">
                                {submitting ? '⏳ Submitting…' : '📤 Submit for Approval'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Timetable — flat table */}
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ fontWeight: '700', fontSize: '15px' }}>📋 My Schedule Entries</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                    <thead>
                        <tr>
                            {['#', 'Day', 'Time', 'Class / Batch', 'Subject', 'Status', 'Actions'].map(h => (
                                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 8px' }} />
                                Loading…
                            </td></tr>
                        ) : timetables.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📅</div>
                                <div style={{ fontWeight: '600', marginBottom: '6px' }}>No schedule entries yet</div>
                                <div style={{ fontSize: '13px' }}>Click &quot;Add Schedule&quot; to submit your teaching schedule for approval</div>
                            </td></tr>
                        ) : (
                            timetables.map((tt, i) => {
                                const sc = STATUS_STYLE[tt.status] || STATUS_STYLE.DRAFT
                                return (
                                    <tr key={tt.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                                        <td style={{ padding: '13px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '13px' }}>{i + 1}</td>
                                        <td style={{ padding: '13px 16px', fontWeight: '700', fontSize: '13px', color: 'var(--primary-light)' }}>{DAYS[tt.dayOfWeek]}</td>
                                        <td style={{ padding: '13px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{tt.startTime} – {tt.endTime}</td>
                                        <td style={{ padding: '13px 16px', fontSize: '12px' }}>
                                            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{tt.course?.name || '—'}</div>
                                            <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{tt.batch?.name || '—'}</div>
                                        </td>
                                        <td style={{ padding: '13px 16px' }}>
                                            <span style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)', border: '1px solid rgba(99,102,241,0.25)', padding: '3px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: '700' }}>
                                                {tt.subject}
                                            </span>
                                        </td>
                                        <td style={{ padding: '13px 16px' }}>
                                            <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, padding: '4px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                {sc.icon} {sc.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '13px 16px' }}>
                                            {tt.status !== 'PUBLISHED' && (
                                                <button onClick={() => deleteEntry(tt.id)}
                                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                                                    🗑️ Delete
                                                </button>
                                            )}
                                            {tt.status === 'PUBLISHED' && (
                                                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>Live in batch</span>
                                            )}
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
