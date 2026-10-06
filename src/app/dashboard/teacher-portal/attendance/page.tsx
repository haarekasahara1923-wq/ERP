'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface AttendanceRecord {
    id: string
    date: string
    status: string
    inTime: string | null
    outTime: string | null
    notes: string | null
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    PRESENT: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
    ABSENT: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    LATE: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    HALF_DAY: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', border: 'rgba(99,102,241,0.3)' },
    LEAVE: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
}

const STATUS_ICONS: Record<string, string> = {
    PRESENT: '✅', ABSENT: '❌', LATE: '⏰', HALF_DAY: '🌓', LEAVE: '🏖'
}

export default function TeacherAttendancePage() {
    const { token } = useAuth()
    const [teacherId, setTeacherId] = useState<string | null>(null)
    const [attendances, setAttendances] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [markingIn, setMarkingIn] = useState(false)
    const [markingOut, setMarkingOut] = useState(false)
    const [toast, setToast] = useState({ text: '', type: 'success' as 'success' | 'error' })

    const today = new Date().toISOString().split('T')[0]
    const [todayAtt, setTodayAtt] = useState<AttendanceRecord | null>(null)

    // Stats
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
    const [filterYear, setFilterYear] = useState(new Date().getFullYear())

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

    const fetchAttendances = useCallback(async (tid?: string) => {
        const id = tid || teacherId
        if (!id) return
        setLoading(true)
        // Fetch all attendance for this teacher for the filtered month/year
        const startDate = new Date(filterYear, filterMonth - 1, 1).toISOString().split('T')[0]
        const endDate = new Date(filterYear, filterMonth, 0).toISOString().split('T')[0]
        const d = await apiFetch(`/api/teachers/attendance?teacherId=${id}`)
        if (d.success) {
            // Filter client-side for the selected month
            const filtered = d.data.filter((a: any) => {
                const dt = new Date(a.date)
                return dt.getFullYear() === filterYear && (dt.getMonth() + 1) === filterMonth
            })
            setAttendances(filtered)

            // Find today's record
            const td = d.data.find((a: any) => {
                const dt = new Date(a.date)
                return dt.toISOString().split('T')[0] === today
            })
            setTodayAtt(td || null)
        }
        setLoading(false)
    }, [teacherId, apiFetch, filterMonth, filterYear, today])

    useEffect(() => { loadProfile() }, [loadProfile])
    useEffect(() => { if (teacherId) fetchAttendances() }, [teacherId, filterMonth, filterYear])

    const markInTime = async () => {
        setMarkingIn(true)
        const timeNow = new Date().toTimeString().slice(0, 5)
        const d = await apiFetch('/api/teachers/attendance', {
            method: 'POST',
            body: JSON.stringify({ date: today, status: 'PRESENT', inTime: timeNow })
        })
        setMarkingIn(false)
        if (d.success) { showToast(`✅ In-time marked: ${timeNow}`); fetchAttendances() }
        else showToast(d.error || 'Failed', 'error')
    }

    const markOutTime = async () => {
        setMarkingOut(true)
        const timeNow = new Date().toTimeString().slice(0, 5)
        const d = await apiFetch('/api/teachers/attendance', {
            method: 'POST',
            body: JSON.stringify({ date: today, status: 'PRESENT', outTime: timeNow })
        })
        setMarkingOut(false)
        if (d.success) { showToast(`🚪 Out-time marked: ${timeNow}`); fetchAttendances() }
        else showToast(d.error || 'Failed', 'error')
    }

    const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    // Stats
    const presentDays = attendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length
    const absentDays = attendances.filter(a => a.status === 'ABSENT').length
    const leaveDays = attendances.filter(a => a.status === 'LEAVE').length
    const halfDays = attendances.filter(a => a.status === 'HALF_DAY').length
    const totalWorking = presentDays + absentDays + leaveDays + halfDays

    return (
        <div>
            <style>{`
                @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
                .slide-down { animation: slideDown 0.3s ease; }
                @keyframes pulse-ring { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
                .live-pulse { animation: pulse-ring 2s ease infinite; }
                .att-row:hover { background: var(--surface-2) !important; }
            `}</style>

            {toast.text && (
                <div className="slide-down" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 99999, maxWidth: '400px', padding: '14px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', background: toast.type === 'success' ? '#052e22' : '#3b0d0d', border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'}`, color: toast.type === 'success' ? '#34d399' : '#fca5a5', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    {toast.text}
                </div>
            )}

            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">✅ My Attendance</h1>
                    <p className="page-subtitle">Mark your arrival & departure · View date-wise attendance history</p>
                </div>
            </div>

            {/* Today's Quick Mark */}
            <div style={{ background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div className="live-pulse" style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981' }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '1px' }}>Today — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                        </div>
                        {todayAtt ? (
                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {(() => { const sc = STATUS_COLORS[todayAtt.status] || STATUS_COLORS.PRESENT; return (
                                    <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, padding: '5px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}>
                                        {STATUS_ICONS[todayAtt.status]} {todayAtt.status}
                                    </span>
                                )})()}
                                {todayAtt.inTime && <span style={{ fontSize: '14px', color: '#cbd5e1' }}>🕐 In: <strong style={{ color: 'white' }}>{todayAtt.inTime}</strong></span>}
                                {todayAtt.outTime && <span style={{ fontSize: '14px', color: '#cbd5e1' }}>🏁 Out: <strong style={{ color: 'white' }}>{todayAtt.outTime}</strong></span>}
                                {!todayAtt.outTime && todayAtt.inTime && (
                                    <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '600' }}>⚠️ Out-time not marked</span>
                                )}
                            </div>
                        ) : (
                            <div style={{ color: '#94a3b8', fontSize: '14px' }}>No attendance marked yet today</div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {!todayAtt?.inTime && (
                            <button onClick={markInTime} disabled={markingIn}
                                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: '700', fontSize: '14px', cursor: markingIn ? 'not-allowed' : 'pointer', opacity: markingIn ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                                {markingIn ? '⏳ Marking…' : '🟢 Mark In-Time'}
                            </button>
                        )}
                        {todayAtt?.inTime && !todayAtt?.outTime && (
                            <button onClick={markOutTime} disabled={markingOut}
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: '700', fontSize: '14px', cursor: markingOut ? 'not-allowed' : 'pointer', opacity: markingOut ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                                {markingOut ? '⏳ Marking…' : '🔴 Mark Out-Time'}
                            </button>
                        )}
                        {todayAtt?.inTime && todayAtt?.outTime && (
                            <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '12px', padding: '12px 22px', color: '#34d399', fontWeight: '700', fontSize: '14px' }}>
                                ✅ Complete for Today
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Month Filter + Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>📅 {MONTHS[filterMonth]} {filterYear} — Attendance History</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="input" style={{ margin: 0, width: 'auto' }}>
                        {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                    </select>
                    <input type="number" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="input" style={{ margin: 0, width: '90px' }} />
                </div>
            </div>

            {/* Stats chips */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {[
                    { label: 'Present', value: presentDays, color: '#10b981' },
                    { label: 'Absent', value: absentDays, color: '#ef4444' },
                    { label: 'Leave', value: leaveDays, color: '#8b5cf6' },
                    { label: 'Half Day', value: halfDays, color: '#6366f1' },
                    { label: 'Total Marked', value: totalWorking, color: 'var(--text-muted)' },
                ].map(s => (
                    <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px', fontWeight: '900', color: s.color }}>{s.value}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Attendance Table */}
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                        <tr>
                            {['Date', 'Day', 'Status', 'In-Time', 'Out-Time', 'Notes'].map(h => (
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
                        ) : attendances.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '36px', marginBottom: '8px' }}>📅</div>
                                No attendance records for {MONTHS[filterMonth]} {filterYear}
                            </td></tr>
                        ) : (
                            attendances.map(a => {
                                const sc = STATUS_COLORS[a.status] || STATUS_COLORS.PRESENT
                                const dt = new Date(a.date)
                                const isToday = dt.toISOString().split('T')[0] === today
                                return (
                                    <tr key={a.id} className="att-row" style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s', background: isToday ? 'rgba(99,102,241,0.05)' : '' }}>
                                        <td style={{ padding: '13px 16px', fontWeight: '700', fontSize: '13px', color: isToday ? 'var(--primary-light)' : 'var(--text-primary)' }}>
                                            {dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            {isToday && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '700', color: '#6366f1', background: 'rgba(99,102,241,0.15)', padding: '1px 6px', borderRadius: '4px' }}>TODAY</span>}
                                        </td>
                                        <td style={{ padding: '13px 16px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                            {dt.toLocaleDateString('en-IN', { weekday: 'short' })}
                                        </td>
                                        <td style={{ padding: '13px 16px' }}>
                                            <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, padding: '3px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: '700' }}>
                                                {STATUS_ICONS[a.status]} {a.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '13px 16px', fontSize: '13px', color: a.inTime ? '#10b981' : 'var(--text-muted)', fontWeight: a.inTime ? '700' : '400' }}>
                                            {a.inTime || '—'}
                                        </td>
                                        <td style={{ padding: '13px 16px', fontSize: '13px', color: a.outTime ? '#f59e0b' : 'var(--text-muted)', fontWeight: a.outTime ? '700' : '400' }}>
                                            {a.outTime || '—'}
                                        </td>
                                        <td style={{ padding: '13px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {a.notes || '—'}
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
