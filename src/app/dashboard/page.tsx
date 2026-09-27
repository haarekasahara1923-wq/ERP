'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

export default function AdminDashboard() {
  const { token, tenant } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data.overview); setLoading(false) })
  }, [token])

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const quickStats = stats ? [
    { label: 'Total Students', value: stats.totalStudents, icon: '👨‍🎓', color: '#6366f1' },
    { label: 'Total Revenue', value: fmt(stats.totalRevenue || 0), icon: '💰', color: '#10b981' },
    { label: "Today's Collection", value: fmt(stats.thisMonthRevenue || 0), icon: '📈', color: '#f59e0b' },
    { label: 'Outstanding', value: fmt(stats.totalOutstanding || 0), icon: '⚠️', color: '#ef4444' },
    { label: 'Teachers', value: stats.totalTeachers, icon: '👩‍🏫', color: '#8b5cf6' },
    { label: 'Active Students', value: stats.activeStudents, icon: '✅', color: '#06b6d4' },
  ] : []

  const actionButtons = [
    { href: '/dashboard/students', icon: '👨‍🎓', label: 'All Students', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { href: '/dashboard/students/add', icon: '➕', label: 'Add Student', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { href: '/dashboard/fees', icon: '💰', label: 'Fee Management', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { href: '/dashboard/attendance', icon: '✅', label: 'Attendance', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
    { href: '/dashboard/courses', icon: '🏫', label: 'Classes & Batches', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    { href: '/dashboard/teachers', icon: '👩‍🏫', label: 'Teachers', color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
    { href: '/dashboard/notices', icon: '📢', label: 'Publish Notice', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { href: '/dashboard/reports', icon: '📊', label: 'Reports', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { href: '/dashboard/expenses', icon: '📉', label: 'Expenses', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    { href: '/dashboard/leads', icon: '📋', label: 'Leads', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { href: '/dashboard/analytics', icon: '📈', label: 'Analytics', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    { href: '/dashboard/profile', icon: '🏢', label: 'School Profile', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: 'white' }}>{tenant?.name || 'School'} Dashboard 🏫</div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div style={{ fontSize: '48px' }}>🎓</div>
      </div>

      {/* Quick Stats */}
      {!loading && quickStats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {quickStats.map(s => (
            <div key={s.label} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>{s.icon}</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '600' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons Grid */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {actionButtons.map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: a.bg, border: `1px solid ${a.color}30`, borderRadius: '14px', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px', cursor: 'pointer', transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                <div style={{ fontSize: '26px' }}>{a.icon}</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: a.color, lineHeight: '1.3' }}>{a.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
