'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { hasFeature, NAV_FEATURE_MAP, PlanFeatures } from '@/lib/planLimits'
import AIGeneratorModal from '@/components/AIGeneratorModal'

const navItems = [
    {
        group: 'OVERVIEW', items: [
            { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
            { href: '/dashboard/analytics', icon: '📊', label: 'Analytics' },
            { href: '/dashboard/reports', icon: '📑', label: 'Reports' },
        ]
    },
    {
        group: 'STUDENTS', items: [
            { href: '/dashboard/courses', icon: '🏫', label: 'Classes & Batches' },
            { href: '/dashboard/students', icon: '👨‍🎓', label: 'All Students' },
            { href: '/dashboard/students/add', icon: '➕', label: 'Add Student' },
            { href: '/dashboard/attendance', icon: '✅', label: 'Attendance' },
        ]
    },
    {
        group: 'ACADEMICS', items: [
            { href: '/dashboard/mock-tests', icon: '📝', label: 'Mock Tests' },
            { href: '/dashboard/exams', icon: '📑', label: 'Exams & Marks' },
            { href: '/dashboard/ai-tools', icon: '🤖', label: 'AI Tools' },
        ]
    },
    {
        group: 'FINANCE', items: [
            { href: '/dashboard/fees', icon: '💰', label: 'Fee Management' },
            { href: '/dashboard/reports/fee-ledger', icon: '📒', label: 'Fee Ledger' },
            { href: '/dashboard/payments', icon: '💳', label: 'Payments' },
            { href: '/dashboard/expenses', icon: '📉', label: 'Expenses' },
        ]
    },
    {
        group: 'MANAGEMENT', items: [
            { href: '/dashboard/teachers', icon: '👩‍🏫', label: 'Teachers & Staff' },
            { href: '/dashboard/leads', icon: '📈', label: 'Enquiry / Leads' },
            { href: '/dashboard/transport', icon: '🚌', label: 'Transport' },
            { href: '/dashboard/whatsapp', icon: '💬', label: 'WhatsApp' },
            { href: '/dashboard/notices', icon: '📢', label: 'Notices' },
        ]
    },
    {
        group: 'SETTINGS', items: [
            { href: '/dashboard/profile', icon: '🏢', label: 'School Profile' },
        ]
    },
]

// Navigation items allowed for sub-admin roles
const adminOperationNav = [
    {
        group: 'STUDENTS', items: [
            { href: '/dashboard/courses', icon: '🏫', label: 'Classes & Batches' },
            { href: '/dashboard/students', icon: '👨‍🎓', label: 'All Students' },
            { href: '/dashboard/students/add', icon: '➕', label: 'Add Student' },
            { href: '/dashboard/attendance', icon: '✅', label: 'Attendance' },
        ]
    },
    {
        group: 'FINANCE', items: [
            { href: '/dashboard/fees', icon: '💰', label: 'Fee Management' },
            { href: '/dashboard/reports/fee-ledger', icon: '📒', label: 'Fee Ledger' },
            { href: '/dashboard/payments', icon: '💳', label: 'Payments' },
        ]
    },
    {
        group: 'MANAGEMENT', items: [
            { href: '/dashboard/teachers', icon: '👩‍🏫', label: 'Teachers & Staff' },
        ]
    },
]

const adminLibraryNav = [
    {
        group: 'LIBRARY', items: [
            { href: '/dashboard/library', icon: '📚', label: 'Library' },
        ]
    },
]

const adminSportsNav = [
    {
        group: 'SPORTS', items: [
            { href: '/dashboard/sports', icon: '🏆', label: 'Sports' },
        ]
    },
]

const adminTransportNav = [
    {
        group: 'TRANSPORT', items: [
            { href: '/dashboard/transport', icon: '🚌', label: 'Transport' },
        ]
    },
]

const getNavForRole = (role: string) => {
    if (role === 'SUPER_ADMIN' || role === 'COACHING_ADMIN') {
        const nav = JSON.parse(JSON.stringify(navItems))
        const mgmtGroup = nav.find((g: any) => g.group === 'MANAGEMENT')
        if (mgmtGroup) {
            mgmtGroup.items.push({ href: '/dashboard/super-admin/manage-admins', icon: '👥', label: 'Manage Admins' })
        }
        return nav
    }
    if (role === 'ADMIN_OPERATION') return adminOperationNav
    if (role === 'ADMIN_LIBRARY') return adminLibraryNav
    if (role === 'ADMIN_SPORTS') return adminSportsNav
    if (role === 'ADMIN_TRANSPORT') return adminTransportNav
    return navItems
}

function DashboardSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
    const pathname = usePathname()
    const { user, tenant, logout } = useAuth()
    const isSuperAdmin = user?.role === 'SUPER_ADMIN'
    const allNavItems = getNavForRole(user?.role || 'COACHING_ADMIN')

    return (
        <>
            {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1049 }} className="hide-desktop" />}
            <aside className={`sidebar ${open ? 'open' : ''}`}>
                {/* Logo */}
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {isSuperAdmin ? '👑' : <img src="/logo.png" alt="UDBA Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>Scalevo</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {isSuperAdmin ? 'Super Admin' : (tenant?.name || 'School ERP')}
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="sidebar-nav">
                    {allNavItems.map((group: any) => (
                        <div key={group.group}>
                            <div className="sidebar-section-title">{group.group}</div>
                            {group.items.map((item: any) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                                    onClick={onClose}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                        <span style={{ fontSize: '16px' }}>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ))}

                    {/* User info + Logout */}
                    <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{user?.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{user?.role?.replace('_', ' ')}</div>
                            </div>
                        </div>
                        <button onClick={logout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '8px', fontSize: '13px' }}>
                            🚪 Logout
                        </button>
                    </div>
                </nav>
            </aside>
        </>
    )
}

function DashboardHeader({ onMenuClick }: { onMenuClick: () => void }) {
    const pathname = usePathname()
    const { tenant } = useAuth()
    const [aiModalOpen, setAiModalOpen] = useState(false)
    const [qrModalOpen, setQrModalOpen] = useState(false)

    const getPageTitle = () => {
        const map: Record<string, string> = {
            '/dashboard': 'Dashboard',
            '/dashboard/analytics': 'Analytics',
            '/dashboard/students': 'Students',
            '/dashboard/students/add': 'Add Student',
            '/dashboard/attendance': 'Attendance',
            '/dashboard/courses': 'Classes & Batches',
            '/dashboard/mock-tests': 'Mock Tests',
            '/dashboard/ai-tools': 'AI Tools',
            '/dashboard/fees': 'Fee Management',
            '/dashboard/payments': 'Payments',
            '/dashboard/expenses': 'Expenses',
            '/dashboard/teachers': 'Teachers & Staff',
            '/dashboard/leads': 'Enquiry / Leads',
            '/dashboard/whatsapp': 'WhatsApp Automation',
            '/dashboard/notices': 'Notices',
            '/dashboard/transport': 'Transport',
            '/dashboard/profile': 'School Profile',
            '/dashboard/reports': 'Reports',
            '/dashboard/super-admin': 'Platform Overview',
            '/dashboard/super-admin/tenants': 'Schools',
            '/dashboard/super-admin/subscriptions': 'System Config',
        }
        return map[pathname] || 'Dashboard'
    }

    return (
        <header className="header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={onMenuClick} className="hide-desktop" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px', padding: '4px' }} id="mobile-menu-btn">
                    ☰
                </button>
                <div className="header-title-container">
                    <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{getPageTitle()}</h2>
                </div>
            </div>

            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'flex-end', padding: '0 16px' }}>
                <button
                    onClick={() => setAiModalOpen(true)}
                    className="btn btn-primary ai-btn"
                    style={{ background: 'linear-gradient(135deg, #1a5c38 0%, #0f3d26 100%)', border: 'none', gap: '6px', padding: '8px 16px', fontSize: '14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                >
                    ✨ <span className="hide-mobile">AI Assistant</span>
                </button>
                {/* Global Student Search Bar */}
                <div
                    className="search-input-container"
                    style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)', padding: '6px 14px', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '300px', width: '100%', gap: '8px', cursor: 'pointer' }}
                    onClick={() => {
                        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                            window.location.href = '/dashboard/students';
                        }
                    }}
                >
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search student..."
                        style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', width: '100%', cursor: 'text' }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = e.currentTarget.value;
                                if (val) {
                                    window.location.href = `/dashboard/students?search=${encodeURIComponent(val)}`;
                                }
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>

            <div className="header-user-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="hide-mobile" style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                    Live
                </div>

                <div style={{ position: 'relative' }}>
                    <button onClick={() => setQrModalOpen(!qrModalOpen)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', fontSize: '20px' }}>
                        📱
                    </button>
                    {qrModalOpen && (
                        <div style={{
                            position: 'absolute', top: '40px', right: '-80px', width: '220px',
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.7)', zIndex: 200
                        }}>
                            <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 'bold' }}>Download Android App</div>
                            <img src="/downloads/UDBA-app-qrcode.png" alt="App QR Code" style={{ width: '150px', height: '150px', borderRadius: '8px', background: 'white', padding: '8px' }} />
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Scan to install on Android</div>
                            <a href="/downloads/UDBA-app-qrcode.png" download="UDBA-app-qrcode.png" style={{ 
                                background: 'linear-gradient(135deg, #6366f1, #ec4899)', color: 'white', textDecoration: 'none',
                                padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                                width: '100%', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: 'none'
                            }}>
                                ⬇️ Download QR Code
                            </a>
                        </div>
                    )}
                </div>

                <Link href="/dashboard/leads" style={{ position: 'relative', textDecoration: 'none' }}>
                    <div className="bell-icon" style={{ padding: '8px', background: 'var(--surface-2)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px' }}>🔔</div>
                </Link>
                <Link href="/dashboard/profile">
                    <div className="avatar header-avatar">
                        {tenant?.name?.charAt(0) || 'U'}
                    </div>
                </Link>
            </div>

            <AIGeneratorModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} />
        </header>
    )
}

function DashboardShell({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login')
        }
    }, [user, isLoading, router, pathname])

    useEffect(() => {
        if (sidebarOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [sidebarOpen])

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading Scalevo...</p>
                </div>
            </div>
        )
    }

    if (!user) return null

    const bottomNavItems = [
        { href: '/dashboard', label: 'Home', icon: '🏠' },
        { href: '/dashboard/students', label: 'Students', icon: '👨‍🎓' },
        { href: '/dashboard/fees', label: 'Fees', icon: '💰' },
        { href: '/dashboard/reports', label: 'Reports', icon: '📊' },
    ]

    const { logout } = useAuth()

    return (
        <div>
            <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
            <main className="main-content" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="page-content fade-in" style={{ paddingBottom: '80px' }}>
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <nav style={{
                display: 'none',
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                width: '100%',
                zIndex: 1000,
                background: 'var(--surface)',
                borderTop: '1px solid var(--border)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
            }} className="dashboard-bottom-nav">
                {bottomNavItems.map(item => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    return (
                        <Link key={item.href} href={item.href} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1,
                            padding: '8px 4px',
                            textDecoration: 'none',
                            color: isActive ? 'var(--primary-light)' : 'var(--text-muted)',
                            gap: '3px',
                            transition: 'color 0.2s',
                        }}>
                            <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.icon}</span>
                            <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400, letterSpacing: '0.3px' }}>{item.label}</span>
                            {isActive && (
                                <span style={{
                                    position: 'absolute',
                                    top: 0,
                                    width: '24px',
                                    height: '2px',
                                    background: 'var(--primary)',
                                    borderRadius: '0 0 2px 2px',
                                }} />
                            )}
                        </Link>
                    )
                })}
                {/* Logout Button in Bottom Nav */}
                <button onClick={logout} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    padding: '8px 4px',
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    gap: '3px',
                    cursor: 'pointer',
                }}>
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>🚪</span>
                    <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px' }}>Logout</span>
                </button>
            </nav>
        </div>
    )
}

export function FeatureGate({ feature, children }: { feature: keyof PlanFeatures, children: React.ReactNode }) {
    // Feature gating disabled for UDBA
    return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <DashboardShell>{children}</DashboardShell>
        </AuthProvider>
    )
}
