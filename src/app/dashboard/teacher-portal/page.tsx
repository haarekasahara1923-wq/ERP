'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface TeacherProfile {
    id: string
    name: string
    email: string | null
    phone: string
    subject: string[]
    salary: number
    joinDate: string
    photo: string | null
    isActive: boolean
}

interface AttendanceRecord {
    id: string
    teacherId: string
    date: string
    status: string
    inTime: string | null
    outTime: string | null
    notes: string | null
}

interface LeaveApplication {
    id: string
    teacherId: string
    startDate: string
    endDate: string
    reason: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    createdAt: string
}

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
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

function StatCard({ icon, label, value, color, sub }: { icon: string; label: string; value: string | number; color: string; sub?: string }) {
    return (
        <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
        }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}>
            <div style={{ fontSize: '26px', marginBottom: '2px' }}>{icon}</div>
            <div style={{ fontSize: '26px', fontWeight: '900', color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>}
        </div>
    )
}

function QuickAction({ href, icon, label, desc, color }: { href: string; icon: string; label: string; desc: string; color: string }) {
    return (
        <Link href={href} style={{ textDecoration: 'none' }}>
            <div style={{
                background: 'var(--surface)',
                border: `1px solid ${color}30`,
                borderRadius: '14px',
                padding: '18px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
            }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; (e.currentTarget as HTMLDivElement).style.background = `${color}08` }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}30`; (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    {icon}
                </div>
                <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>
                </div>
            </div>
        </Link>
    )
}

export default function TeacherPortalDashboard() {
    const { token } = useAuth()
    const [profile, setProfile] = useState<TeacherProfile | null>(null)
    const [todayAtt, setTodayAtt] = useState<AttendanceRecord | null>(null)
    const [recentLeaves, setRecentLeaves] = useState<LeaveApplication[]>([])
    const [recentSalary, setRecentSalary] = useState<SalaryLedger | null>(null)
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState({ text: '', type: 'success' as 'success' | 'error' })
    const [markingIn, setMarkingIn] = useState(false)
    const [markingOut, setMarkingOut] = useState(false)

    const today = new Date().toISOString().split('T')[0]
    const now = new Date()

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToast({ text, type })
        setTimeout(() => setToast({ text: '', type: 'success' }), 3500)
    }

    const apiFetch = useCallback(async (url: string, opts?: RequestInit) => {
        const res = await fetch(url, {
            ...opts,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers || {}) }
        })
        return res.json()
    }, [token])

    const loadDashboard = useCallback(async () => {
        if (!token) return
        setLoading(true)
        try {
            const profileRes = await apiFetch('/api/teachers/me')
            if (!profileRes.success) { setLoading(false); return }
            setProfile(profileRes.data)
            const teacherId = profileRes.data.id

            const [attRes, leavesRes, salaryRes] = await Promise.all([
                apiFetch(`/api/teachers/attendance?date=${today}&teacherId=${teacherId}`),
                apiFetch(`/api/teachers/leaves?teacherId=${teacherId}`),
                apiFetch(`/api/teachers/ledger?teacherId=${teacherId}&month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
            ])

            if (attRes.success && attRes.data.length > 0) setTodayAtt(attRes.data[0])
            if (leavesRes.success) setRecentLeaves(leavesRes.data.slice(0, 3))
            if (salaryRes.success && salaryRes.data.length > 0) setRecentSalary(salaryRes.data[0])
        } catch (e) { console.error(e) }
        setLoading(false)
    }, [token, apiFetch, today])

    useEffect(() => { loadDashboard() }, [loadDashboard])

    const markInTime = async () => {
        setMarkingIn(true)
        const timeNow = new Date().toTimeString().slice(0, 5)
        const d = await apiFetch('/api/teachers/attendance', {
            method: 'POST',
            body: JSON.stringify({ date: today, status: 'PRESENT', inTime: timeNow })
        })
        setMarkingIn(false)
        if (d.success) { showToast(`✅ In-time marked: ${timeNow}`); loadDashboard() }
        else showToast(d.error || 'Failed to mark in-time', 'error')
    }

    const markOutTime = async () => {
        setMarkingOut(true)
        const timeNow = new Date().toTimeString().slice(0, 5)
        const d = await apiFetch('/api/teachers/attendance', {
            method: 'POST',
            body: JSON.stringify({ date: today, status: 'PRESENT', outTime: timeNow })
        })
        setMarkingOut(false)
        if (d.success) { showToast(`🚪 Out-time marked: ${timeNow}`); loadDashboard() }
        else showToast(d.error || 'Failed to mark out-time', 'error')
    }

    const statusColor: Record<string, string> = {
        PRESENT: '#10b981', ABSENT: '#ef4444', LATE: '#f59e0b',
        HALF_DAY: '#6366f1', LEAVE: '#8b5cf6',
        PENDING: '#f59e0b', APPROVED: '#10b981', REJECTED: '#ef4444',
        PAID: '#10b981', UNPAID: '#f59e0b'
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '16px' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading your dashboard…</p>
            </div>
        )
    }

    if (!profile) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Profile Not Linked</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                    Your teacher account is not yet linked to a teacher profile. Please contact your administrator.
                </p>
            </div>
        )
    }

    return (
        <div>
            <style>{`
                @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
                .slide-down { animation: slideDown 0.3s ease; }
                @keyframes pulse-ring { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
                .live-pulse { animation: pulse-ring 2s ease infinite; }
            `}</style>

            {toast.text && (
                <div className="slide-down" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 99999, maxWidth: '400px', padding: '14px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', background: toast.type === 'success' ? '#052e22' : '#3b0d0d', border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'}`, color: toast.type === 'success' ? '#34d399' : '#fca5a5', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    {toast.text}
                </div>
            )}

            {/* Header */}
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0, overflow: 'hidden' }}>
                        {profile.photo ? <img src={profile.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👩‍🏫'}
                    </div>
                    <div>
                        <h1 className="page-title" style={{ marginBottom: '2px' }}>Welcome, {profile.name}!</h1>
                        <p className="page-subtitle">
                            {profile.subject.join(', ')} &nbsp;·&nbsp;
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Today Attendance Card */}
            <div style={{ background: 'linear-gradient(135deg, #1a1a3e 0%, #0f0f2e 100%)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <div className="live-pulse" style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '1px' }}>Today&apos;s Attendance</span>
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: 'white', marginBottom: '8px' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}
                        </div>
                        {todayAtt ? (
                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ background: `${statusColor[todayAtt.status]}20`, color: statusColor[todayAtt.status], padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: `1px solid ${statusColor[todayAtt.status]}40` }}>
                                    ● {todayAtt.status}
                                </span>
                                {todayAtt.inTime && <span style={{ fontSize: '13px', color: '#a5b4fc' }}>🕐 In: <strong style={{ color: 'white' }}>{todayAtt.inTime}</strong></span>}
                                {todayAtt.outTime && <span style={{ fontSize: '13px', color: '#a5b4fc' }}>🏁 Out: <strong style={{ color: 'white' }}>{todayAtt.outTime}</strong></span>}
                            </div>
                        ) : (
                            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Not marked yet — click to mark your arrival</div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {!todayAtt?.inTime && (
                            <button onClick={markInTime} disabled={markingIn}
                                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 22px', fontWeight: '700', fontSize: '14px', cursor: markingIn ? 'not-allowed' : 'pointer', opacity: markingIn ? 0.7 : 1, transition: 'all 0.2s' }}>
                                {markingIn ? '⏳ Marking…' : '🟢 Mark In-Time'}
                            </button>
                        )}
                        {todayAtt?.inTime && !todayAtt?.outTime && (
                            <button onClick={markOutTime} disabled={markingOut}
                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 22px', fontWeight: '700', fontSize: '14px', cursor: markingOut ? 'not-allowed' : 'pointer', opacity: markingOut ? 0.7 : 1, transition: 'all 0.2s' }}>
                                {markingOut ? '⏳ Marking…' : '🔴 Mark Out-Time'}
                            </button>
                        )}
                        {todayAtt?.inTime && todayAtt?.outTime && (
                            <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '12px', padding: '12px 20px', color: '#34d399', fontWeight: '700', fontSize: '14px' }}>
                                ✅ Attendance Complete
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                <StatCard icon="💰" label="Monthly Salary" value={`₹${profile.salary.toLocaleString('en-IN')}`} color="#10b981" sub="Base salary" />
                <StatCard icon="📋" label="Pending Leaves" value={recentLeaves.filter(l => l.status === 'PENDING').length} color="#f59e0b" />
                <StatCard icon="💸" label="Net This Month" value={recentSalary ? `₹${recentSalary.netPayable.toLocaleString('en-IN')}` : '—'} color={recentSalary?.status === 'PAID' ? '#10b981' : '#6366f1'} sub={recentSalary?.status || 'Not Generated'} />
                <StatCard icon="📚" label="Subjects" value={profile.subject.length} color="#8b5cf6" sub={profile.subject.slice(0, 2).join(', ')} />
            </div>

            {/* Quick Actions */}
            <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>⚡ Quick Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                <QuickAction href="/dashboard/teacher-portal/attendance" icon="✅" label="My Attendance" desc="Date-wise attendance history" color="#10b981" />
                <QuickAction href="/dashboard/teacher-portal/leaves" icon="📋" label="Apply for Leave" desc="Submit & track leave requests" color="#f59e0b" />
                <QuickAction href="/dashboard/teacher-portal/timetable" icon="📅" label="Teaching Schedule" desc="Create & submit for approval" color="#6366f1" />
                <QuickAction href="/dashboard/teacher-portal/salary" icon="💰" label="Salary Ledger" desc="View monthly salary breakdown" color="#8b5cf6" />
            </div>

            {/* Bottom two cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Recent Leaves */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontWeight: '700', fontSize: '14px' }}>📋 Leave Applications</h3>
                        <Link href="/dashboard/teacher-portal/leaves" style={{ fontSize: '12px', color: 'var(--primary-light)', textDecoration: 'none', fontWeight: '600' }}>View All →</Link>
                    </div>
                    {recentLeaves.length === 0 ? (
                        <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No leave applications yet</div>
                    ) : (
                        <div>
                            {recentLeaves.map(l => {
                                const sc = statusColor[l.status]
                                return (
                                    <div key={l.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600' }}>
                                                {new Date(l.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(l.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{l.reason.slice(0, 38)}{l.reason.length > 38 ? '…' : ''}</div>
                                        </div>
                                        <span style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}40`, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                            {l.status}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Salary Card */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontWeight: '700', fontSize: '14px' }}>💰 {MONTHS[now.getMonth() + 1]} {now.getFullYear()} Salary</h3>
                        <Link href="/dashboard/teacher-portal/salary" style={{ fontSize: '12px', color: 'var(--primary-light)', textDecoration: 'none', fontWeight: '600' }}>Full Ledger →</Link>
                    </div>
                    <div style={{ padding: '20px' }}>
                        {recentSalary ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Base Salary</span>
                                    <span style={{ fontWeight: '700', fontSize: '13px' }}>₹{recentSalary.baseSalary.toLocaleString('en-IN')}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Deductions</span>
                                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#ef4444' }}>- ₹{recentSalary.deductions.toLocaleString('en-IN')}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.25)' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>Net Payable</span>
                                    <span style={{ fontWeight: '900', fontSize: '18px', color: '#10b981' }}>₹{recentSalary.netPayable.toLocaleString('en-IN')}</span>
                                </div>
                                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                                    <span style={{ background: recentSalary.status === 'PAID' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: recentSalary.status === 'PAID' ? '#10b981' : '#f59e0b', border: `1px solid ${recentSalary.status === 'PAID' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>
                                        {recentSalary.status === 'PAID' ? `✅ Paid on ${new Date(recentSalary.paidDate!).toLocaleDateString('en-IN')}` : '⏳ Pending Payment'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                                Salary not yet calculated for {MONTHS[now.getMonth() + 1]} {now.getFullYear()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
