'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'

const ADMIN_SUB_ROLES = [
  { key: 'ADMIN_OPERATION', label: 'Admin Operation', icon: '⚙️' },
  { key: 'ADMIN_LIBRARY', label: 'Admin Library', icon: '📚' },
  { key: 'ADMIN_SPORTS', label: 'Admin Sports', icon: '🏆' },
  { key: 'ADMIN_TRANSPORT', label: 'Admin Transport', icon: '🚌' },
]

// Roles available for self-registration (admins are created by super admin)
const REGISTRABLE_ROLES = [
  { key: 'SUPER_ADMIN', label: 'Super Admin', icon: '👑' },
  { key: 'TEACHER', label: 'Teacher', icon: '👩‍🏫' },
  { key: 'PARENT', label: 'Parent', icon: '👨‍👩‍👧' },
  { key: 'STUDENT', label: 'Student', icon: '👨‍🎓' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [role, setRole] = useState('STUDENT')
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('') // email or phone
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Determine if identifier is email or phone
    const isEmail = identifier.includes('@')
    const email = isEmail ? identifier : `${identifier}@udba.local`
    const phone = isEmail ? undefined : identifier

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, role }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Registration failed')
        setLoading(false)
        return
      }

      localStorage.setItem('scalevo_token', data.accessToken)
      localStorage.setItem('scalevo_user', JSON.stringify(data.user))
      localStorage.setItem('scalevo_tenant', JSON.stringify(data.tenant))
      localStorage.setItem('scalevo_refresh', data.refreshToken)

      if (role === 'STUDENT') router.push('/portal/student')
      else if (role === 'PARENT') router.push('/portal/parent')
      else if (role === 'TEACHER') router.push('/portal/staff')
      else router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Network error occurred')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a1208', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at center, rgba(26,92,56,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #1a5c38, #f97316)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 14px', boxShadow: '0 8px 30px rgba(26,92,56,0.4)' }}>🏫</div>
          <h1 style={{ fontSize: '22px', fontWeight: '900', color: 'white' }}>Create Scalevo Account</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>School ERP — Powered by Scalevo</p>
        </div>

        <div style={{ background: '#111a0e', border: '1px solid rgba(26,92,56,0.25)', borderRadius: '20px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          {/* Info banner for admin */}
          <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
            ℹ️ <strong style={{ color: '#f97316' }}>Admin portals</strong> (Operation/Library/Sports/Transport) are created by the Super Admin. Use the Login page to access those.
          </div>

          {/* Role Selector */}
          <div style={{ display: 'flex', gap: '6px', background: '#172014', padding: '4px', borderRadius: '12px', marginBottom: '18px' }}>
            {REGISTRABLE_ROLES.map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                  background: role === r.key ? 'linear-gradient(135deg, #1a5c38, #0f3d26)' : 'transparent',
                  color: role === r.key ? 'white' : 'rgba(255,255,255,0.4)',
                  fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                }}
              >
                <span style={{ fontSize: '14px' }}>{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Full Name *</label>
              <input
                type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="Enter full name"
                style={{ width: '100%', padding: '10px 14px', background: '#172014', border: '1px solid rgba(26,92,56,0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Email / Mobile No. *</label>
              <input
                type="text" required value={identifier} onChange={e => setIdentifier(e.target.value)}
                placeholder="name@example.com or 9876543210"
                style={{ width: '100%', padding: '10px 14px', background: '#172014', border: '1px solid rgba(26,92,56,0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  style={{ width: '100%', padding: '10px 48px 10px 14px', background: '#172014', border: '1px solid rgba(26,92,56,0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '4px', top: 0, bottom: 0, width: '42px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'} required value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  style={{ width: '100%', padding: '10px 48px 10px 14px', background: '#172014', border: '1px solid rgba(26,92,56,0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none' }}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: '4px', top: 0, bottom: 0, width: '42px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px', marginBottom: '14px', fontSize: '13px', color: '#fca5a5' }}>⚠️ {error}</div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px', background: loading ? '#1a5c38' : 'linear-gradient(135deg, #1a5c38, #0f3d26)', color: 'white', border: '1px solid rgba(45,138,87,0.4)', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(26,92,56,0.35)' }}>
              {loading ? 'Creating Account...' : '✨ Create Account & Login'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#4ade80', fontWeight: '700', textDecoration: 'none' }}>Sign In here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
