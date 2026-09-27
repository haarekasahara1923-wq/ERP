'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'

interface Student {
    id: string
    studentId: string
    fullName: string
    phone: string
    email: string
    gender: string
    courseName: string
    batchName: string
    totalFee: number
    paidFee: number
    status: string
    admissionDate: string
    fatherName: string
    parentPhone: string
    aadhaarNo?: string
    penId?: string
    aparId?: string
    samagraId?: string
}

const statusColors: Record<string, string> = {
    ACTIVE: 'badge-success',
    INACTIVE: 'badge-gray',
    DROPOUT: 'badge-danger',
    PASSED: 'badge-info',
}

export default function StudentsPage() {
    const { token, user } = useAuth()
    const canEditOrDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'COACHING_ADMIN'
    const [students, setStudents] = useState<Student[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState<any>({})
    const [actionLoading, setActionLoading] = useState(false)

    const fetchStudents = async () => {
        if (!token) return
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        const res = await fetch(`/api/students?${params}`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (data.success) setStudents(data.data)
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this student?')) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/students?id=${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                alert('Student deleted successfully')
                fetchStudents()
            } else {
                alert(data.error || 'Failed to delete student')
            }
        } catch (err) {
            alert('Error deleting student')
        }
        setActionLoading(false)
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setActionLoading(true)
        try {
            const res = await fetch('/api/students', {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify(editForm)
            })
            const data = await res.json()
            if (data.success) {
                alert('Student updated successfully')
                setIsEditing(false)
                setSelectedStudent(data.data)
                fetchStudents()
            } else {
                alert(data.error || 'Failed to update student')
            }
        } catch (err) {
            alert('Error updating student')
        }
        setActionLoading(false)
    }

    const toggleBlock = async (student: Student) => {
        const newStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
        if (!confirm(`Are you sure you want to ${newStatus === 'ACTIVE' ? 'unblock' : 'block'} this student?`)) return
        
        setActionLoading(true)
        try {
            const res = await fetch('/api/students', {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ id: student.id, status: newStatus })
            })
            const data = await res.json()
            if (data.success) {
                alert(`Student ${newStatus === 'ACTIVE' ? 'unblocked' : 'blocked'} successfully`)
                if (selectedStudent?.id === student.id) setSelectedStudent(data.data)
                fetchStudents()
            }
        } catch (err) {
            alert('Error updating status')
        }
        setActionLoading(false)
    }

    useEffect(() => { fetchStudents() }, [token, search])

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">👨‍🎓 Students</h1>
                    <p className="page-subtitle">{students.length} students registered</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Link href="/dashboard/students/add" className="btn btn-primary">➕ Add Student</Link>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '8px' }}>
                        <input
                            className="input"
                            style={{ flex: 1 }}
                            placeholder="🔍 Search by student name or mobile no..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchStudents()}
                        />
                        <button className="btn btn-primary" onClick={fetchStudents} style={{ whiteSpace: 'nowrap' }}>
                            🔍 Search
                        </button>
                    </div>
                    <button className="btn btn-secondary" onClick={() => { setSearch(''); setTimeout(fetchStudents, 0); }}>🔄 Refresh</button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                    { label: 'Total', value: students.length, color: '#6366f1' },
                    { label: 'Active', value: students.filter(s => s.status === 'ACTIVE').length, color: '#10b981' },
                    { label: 'Dropout', value: students.filter(s => s.status === 'DROPOUT').length, color: '#ef4444' },
                    { label: 'With Dues', value: students.filter(s => s.totalFee > s.paidFee).length, color: '#f59e0b' },
                ].map(s => (
                    <div key={s.label} style={{ padding: '14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <div className="spinner" style={{ margin: '0 auto 12px', width: '32px', height: '32px' }} />
                            <p style={{ color: 'var(--text-muted)' }}>Loading students...</p>
                        </div>
                    ) : students.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👨‍🎓</div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '16px' }}>No students found</p>
                            <Link href="/dashboard/students/add" className="btn btn-primary">Add First Student</Link>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Class / Section</th>
                                    <th>Phone</th>
                                    <th>Fee Status</th>
                                    <th>Status</th>
                                    <th>Admission</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(s => {
                                    const owing = s.totalFee - s.paidFee
                                    const pct = s.totalFee > 0 ? Math.round((s.paidFee / s.totalFee) * 100) : 0
                                    return (
                                        <tr key={s.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div className="avatar">
                                                        {s.fullName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{s.fullName}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.studentId}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '13px', fontWeight: '600' }}>{s.courseName}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.batchName}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '13px' }}>{s.phone}</div>
                                                {s.parentPhone && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>P: {s.parentPhone}</div>}
                                            </td>
                                            <td>
                                                <div style={{ marginBottom: '4px' }}>
                                                    <div className="progress-bar" style={{ height: '4px' }}>
                                                        <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444' }} />
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '11px', color: owing > 0 ? '#f59e0b' : '#10b981', fontWeight: '600' }}>
                                                    {pct}% paid {owing > 0 ? `• Due: ${formatCurrency(owing)}` : '✓'}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${statusColors[s.status] || 'badge-gray'}`}>{s.status}</span>
                                            </td>
                                            <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                {s.admissionDate ? formatDate(s.admissionDate) : '-'}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button onClick={() => setSelectedStudent(s)} className="btn btn-secondary btn-sm" title="View">👁️</button>
                                                    {canEditOrDelete && (
                                                        <>
                                                            <button onClick={() => { setSelectedStudent(s); setEditForm(s); setIsEditing(true); }} className="btn btn-secondary btn-sm" title="Edit">✏️</button>
                                                            <button onClick={() => toggleBlock(s)} className={`btn btn-sm ${s.status === 'ACTIVE' ? 'btn-secondary' : 'btn-success'}`} title={s.status === 'ACTIVE' ? 'Block' : 'Unblock'}>
                                                                {s.status === 'ACTIVE' ? '🚫' : '✅'}
                                                            </button>
                                                            <button onClick={() => handleDelete(s.id)} className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} title="Delete">🗑️</button>
                                                        </>
                                                    )}
                                                    <a href={`https://wa.me/${s.parentPhone?.replace(/\D/g, '') || s.phone?.replace(/\D/g, '')}`} target="_blank" className="btn btn-sm" style={{ background: '#25d366', color: 'white', textDecoration: 'none' }} title="WhatsApp">💬</a>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Student Detail / Edit Modal */}
            {selectedStudent && (
                <div className="modal-overlay" onClick={() => { setSelectedStudent(null); setIsEditing(false); }}>
                    <div className="modal" style={{ maxWidth: isEditing ? '600px' : '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '20px' }}>{selectedStudent.fullName.charAt(0)}</div>
                                <div>
                                    <h3 style={{ fontWeight: '700', fontSize: '18px' }}>{isEditing ? 'Edit Student' : selectedStudent.fullName}</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{selectedStudent.studentId}</p>
                                </div>
                            </div>
                            <button onClick={() => { setSelectedStudent(null); setIsEditing(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div className="modal-body">
                            {isEditing ? (
                                <form onSubmit={handleUpdate} className="grid-cols-2" style={{ gap: '16px' }}>
                                    <div className="col-span-2">
                                        <label className="label">Full Name</label>
                                        <input className="input" value={editForm.fullName} onChange={e => setEditForm({...editForm, fullName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="label">Phone Number</label>
                                        <input className="input" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="label">Parent Phone</label>
                                        <input className="input" value={editForm.parentPhone} onChange={e => setEditForm({...editForm, parentPhone: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="label">Father's Name</label>
                                        <input className="input" value={editForm.fatherName} onChange={e => setEditForm({...editForm, fatherName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="label">Total Fee</label>
                                        <input type="number" className="input" value={editForm.totalFee} onChange={e => setEditForm({...editForm, totalFee: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="label">Status</label>
                                        <select className="input" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="INACTIVE">INACTIVE</option>
                                            <option value="DROPOUT">DROPOUT</option>
                                            <option value="PASSED">PASSED</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <button type="submit" className="btn btn-primary" disabled={actionLoading} style={{ flex: 1 }}>
                                            {actionLoading ? 'Saving...' : '💾 Save Changes'}
                                        </button>
                                        <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary">Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <div className="grid-cols-2">
                                    {[
                                        ['📱 Phone', selectedStudent.phone],
                                        ['👨 Father', selectedStudent.fatherName || 'N/A'],
                                        ['📧 Email', selectedStudent.email || 'N/A'],
                                        ['📞 Parent Phone', selectedStudent.parentPhone || 'N/A'],
                                        ['📚 Class', selectedStudent.courseName],
                                        ['🕐 Section', selectedStudent.batchName],
                                        ['💰 Total Fee', formatCurrency(selectedStudent.totalFee)],
                                        ['✅ Paid', formatCurrency(selectedStudent.paidFee)],
                                        ['⚠️ Pending', formatCurrency(selectedStudent.totalFee - selectedStudent.paidFee)],
                                        ['📅 Admission', selectedStudent.admissionDate ? formatDate(selectedStudent.admissionDate) : 'N/A'],
                                        ['🚩 Status', selectedStudent.status],
                                        ['🪪 Aadhaar No.', selectedStudent.aadhaarNo || 'N/A'],
                                        ['🆔 PEN ID', selectedStudent.penId || 'N/A'],
                                        ['🆔 APAR ID', selectedStudent.aparId || 'N/A'],
                                        ['🆔 Samagra ID', selectedStudent.samagraId || 'N/A'],
                                    ].map(([label, value]) => (
                                        <div key={label} style={{ padding: '10px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
                                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {!isEditing && (
                            <div className="modal-footer">
                                {canEditOrDelete && (
                                    <button onClick={() => { setEditForm(selectedStudent); setIsEditing(true); }} className="btn btn-secondary">✏️ Edit Details</button>
                                )}
                                <a href={`https://wa.me/${(selectedStudent.parentPhone || selectedStudent.phone)?.replace(/\D/g, '')}?text=Dear Parent, This is regarding ${selectedStudent.fullName} from our coaching institute.`} target="_blank" className="btn btn-success">💬 WhatsApp Parent</a>
                                <button onClick={() => setSelectedStudent(null)} className="btn btn-secondary">Close</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
