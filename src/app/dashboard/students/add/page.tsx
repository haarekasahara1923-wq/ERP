'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
        <label className="label">{label}</label>
        {children}
    </div>
)

export default function AddStudentPage() {
    const { token } = useAuth()
    const router = useRouter()
    const [courses, setCourses] = useState<{ id: string; name: string; fees: number; installmentCount: number }[]>([])
    const [batches, setBatches] = useState<{ id: string; name: string; courseId: string }[]>([])
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [toast, setToast] = useState('')
    const [metadataLoading, setMetadataLoading] = useState(true)

    const [form, setForm] = useState({
        fullName: '', fatherName: '', motherName: '', phone: '', parentPhone: '',
        email: '', address: '', gender: 'MALE', dob: '', courseId: '', batchId: '',
        admissionDate: new Date().toISOString().split('T')[0],
        feePlan: 'Annual', totalFee: '', notes: '',
        aadhaarNo: '', penId: '', aparId: '', samagraId: ''
    })

    useEffect(() => {
        if (!token) return
        setMetadataLoading(true)
        Promise.all([
            fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/batches', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([c, b]) => {
            if (c.success) setCourses(c.data)
            if (b.success) setBatches(b.data)
            setMetadataLoading(false)
        }).catch(err => {
            console.error('Failed to fetch metadata:', err)
            setToast('Failed to load courses and batches. Please refresh.')
            setMetadataLoading(false)
        })
    }, [token])

    const filteredBatches = batches.filter(b => !form.courseId || b.courseId === form.courseId)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        setLoading(false)
        if (data.success) {
            setSuccess(true)
            setToast('Student added successfully!')
            setTimeout(() => router.push('/dashboard/students'), 1500)
        } else {
            setToast(data.error || 'Failed to add student')
        }
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">➕ Add New Student</h1>
                    <p className="page-subtitle">Fill in the student details below</p>
                </div>
            </div>

            {toast && (
                <div className={`toast ${success ? 'toast-success' : 'toast-error'}`} style={{ position: 'relative', marginBottom: '16px', maxWidth: '100%' }}>
                    {success ? '✓' : '⚠️'} {toast}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Personal Info */}
                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '16px', color: 'var(--primary-light)' }}>👤 Personal Information</h3>
                    <div className="grid-cols-2">
                        <Field label="Full Name *">
                            <input className="input" placeholder="Arjun Sharma" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />
                        </Field>
                        <Field label="Phone Number *">
                            <input className="input" type="tel" placeholder="917879337770" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                        </Field>
                        <Field label="Father's Name">
                            <input className="input" placeholder="Ramesh Sharma" value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} />
                        </Field>
                        <Field label="Mother's Name">
                            <input className="input" placeholder="Sunita Sharma" value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} />
                        </Field>
                        <Field label="Parent Phone">
                            <input className="input" type="tel" placeholder="9876543211" value={form.parentPhone} onChange={e => setForm({ ...form, parentPhone: e.target.value })} />
                        </Field>
                        <Field label="Email">
                            <input className="input" type="email" placeholder="student@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                        </Field>
                        <Field label="Gender">
                            <select className="input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </Field>
                        <Field label="Date of Birth">
                            <input className="input" type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
                        </Field>
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        <Field label="Address">
                            <textarea className="input" placeholder="Full address with city and pin code" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} style={{ resize: 'none' }} />
                        </Field>
                    </div>
                </div>

                {/* Government IDs */}
                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '16px', color: 'var(--primary-light)' }}>🪪 Government IDs</h3>
                    <div className="grid-cols-2">
                        <Field label="Aadhaar Number">
                            <input className="input" placeholder="1234 5678 9012" value={form.aadhaarNo} onChange={e => setForm({ ...form, aadhaarNo: e.target.value })} />
                        </Field>
                        <Field label="PEN ID No.">
                            <input className="input" placeholder="PEN ID" value={form.penId} onChange={e => setForm({ ...form, penId: e.target.value })} />
                        </Field>
                        <Field label="APAR ID No.">
                            <input className="input" placeholder="APAR ID" value={form.aparId} onChange={e => setForm({ ...form, aparId: e.target.value })} />
                        </Field>
                        <Field label="Samagra ID No.">
                            <input className="input" placeholder="Samagra ID" value={form.samagraId} onChange={e => setForm({ ...form, samagraId: e.target.value })} />
                        </Field>
                    </div>
                </div>

                {/* Academic Info */}
                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '16px', color: 'var(--primary-light)' }}>📚 Academic Details</h3>
                    <div className="grid-cols-2">
                        <Field label="Class *">
                            <select 
                                className="input" 
                                value={form.courseId} 
                                onChange={e => {
                                    const courseId = e.target.value;
                                    const selectedCourse = courses.find(c => c.id === courseId);
                                    setForm({ 
                                        ...form, 
                                        courseId, 
                                        batchId: '', 
                                        totalFee: selectedCourse ? selectedCourse.fees.toString() : '' 
                                    });
                                }} 
                                required 
                                disabled={metadataLoading}
                            >
                                <option value="">{metadataLoading ? '⌛ Loading classes...' : 'Select Class'}</option>
                                {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.installmentCount} Installments)</option>)}
                            </select>
                            {form.courseId && courses.find(c => c.id === form.courseId) && (
                                <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px', fontWeight: 'bold' }}>
                                    Fees will be split into {courses.find(c => c.id === form.courseId)?.installmentCount} installments automatically.
                                </div>
                            )}
                        </Field>
                        <Field label="Section *">
                            <select className="input" value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value })} required disabled={metadataLoading}>
                                <option value="">{metadataLoading ? '⌛ Loading sections...' : 'Select Section'}</option>
                                {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Admission Date">
                            <input className="input" type="date" value={form.admissionDate} onChange={e => setForm({ ...form, admissionDate: e.target.value })} />
                        </Field>
                        <Field label="Fee Plan">
                            <select className="input" value={form.feePlan} onChange={e => setForm({ ...form, feePlan: e.target.value })}>
                                <option>Annual</option>
                                <option>Quarterly</option>
                                <option>Monthly</option>
                                <option>Custom</option>
                            </select>
                        </Field>
                        <Field label="Total Course Fee (₹)">
                            <input className="input" type="number" placeholder="45000" value={form.totalFee} onChange={e => setForm({ ...form, totalFee: e.target.value })} />
                        </Field>
                    </div>
                </div>

                {/* Notes */}
                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '16px', color: 'var(--primary-light)' }}>📝 Additional Notes</h3>
                    <textarea className="input" placeholder="Any important notes about this student..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ resize: 'none' }} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Saving...</> : '💾 Add Student'}
                    </button>
                </div>
            </form>
        </div>
    )
}
