'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Script from 'next/script'

interface Student {
    id: string
    fullName: string
    studentId: string
    scholarNo?: string
    fatherName?: string
    photo?: string
    courseName?: string
    batchName?: string
}
interface Course { id: string; name: string }
interface Batch { id: string; name: string; courseId: string }

export default function ExamsPage() {
    const { token, tenant } = useAuth()
    const [activeTab, setActiveTab] = useState<'marks' | 'admit_card'>('marks')
    const [step, setStep] = useState<1 | 2>(1)
    const [courses, setCourses] = useState<Course[]>([])
    const [batches, setBatches] = useState<Batch[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState({ msg: '', type: '' })
    const [marks, setMarks] = useState<Record<string, string>>({})

    const [form, setForm] = useState({
        title: '',
        subject: '',
        date: new Date().toISOString().split('T')[0],
        maxMarks: '100',
        courseId: '',
        batchId: '',
    })

    // Admit Card states
    const [admitCourseId, setAdmitCourseId] = useState('')
    const [admitBatchId, setAdmitBatchId] = useState('')
    const [admitExamTitle, setAdmitExamTitle] = useState('Annual Examination 2026')
    const [admitExamCenter, setAdmitExamCenter] = useState('School Main Examination Hall')
    const [admitReportingTime, setAdmitReportingTime] = useState('08:30 AM')
    const [admitExamDate, setAdmitExamDate] = useState(new Date().toISOString().split('T')[0])
    const [admitStudents, setAdmitStudents] = useState<Student[]>([])
    const [loadingAdmitStudents, setLoadingAdmitStudents] = useState(false)
    const [selectedAdmitStudent, setSelectedAdmitStudent] = useState<Student | null>(null)

    useEffect(() => {
        if (!token) return
        Promise.all([
            fetch('/api/courses', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
            fetch('/api/batches', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        ]).then(([c, b]) => {
            if (c.success) setCourses(c.data)
            if (b.success) setBatches(b.data)
        })
    }, [token])

    const filteredBatches = batches.filter(b => b.courseId === form.courseId)
    const admitFilteredBatches = batches.filter(b => b.courseId === admitCourseId)

    // Step 1 → Step 2: load students for marks
    const handleLoadStudents = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.courseId || !form.batchId) {
            setToast({ msg: 'Please select Class and Section first.', type: 'error' })
            return
        }
        setLoadingStudents(true)
        const res = await fetch(
            `/api/students?course=${form.courseId}&batch=${form.batchId}`,
            { headers: { Authorization: 'Bearer ' + token } }
        )
        const data = await res.json()
        setLoadingStudents(false)
        if (data.success && data.data.length > 0) {
            setStudents(data.data)
            const init: Record<string, string> = {}
            data.data.forEach((s: Student) => { init[s.id] = '' })
            setMarks(init)
            setStep(2)
        } else {
            setToast({ msg: 'No students found in this class/section.', type: 'error' })
        }
    }

    // Step 2: publish marks
    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        const results = students.map(s => ({
            studentId: s.id,
            marksObtained: parseFloat(marks[s.id] || '0'),
        }))
        const res = await fetch('/api/exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ ...form, maxMarks: parseFloat(form.maxMarks), results }),
        })
        const data = await res.json()
        setSaving(false)
        if (data.success) {
            setToast({ msg: '✅ Marks published successfully! Parents can now see them.', type: 'success' })
            setStep(1)
            setStudents([])
            setMarks({})
            setForm({ title: '', subject: '', date: new Date().toISOString().split('T')[0], maxMarks: '100', courseId: '', batchId: '' })
        } else {
            setToast({ msg: data.error || 'Failed to publish marks.', type: 'error' })
        }
    }

    // Load students for admit cards
    const handleLoadAdmitStudents = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!admitCourseId) {
            setToast({ msg: 'Please select a Class.', type: 'error' })
            return
        }
        setLoadingAdmitStudents(true)
        let url = `/api/students?course=${admitCourseId}`
        if (admitBatchId) url += `&batch=${admitBatchId}`

        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
        const data = await res.json()
        setLoadingAdmitStudents(false)
        if (data.success && data.data.length > 0) {
            setAdmitStudents(data.data)
            setToast({ msg: `Loaded ${data.data.length} students for Admit Cards!`, type: 'success' })
        } else {
            setAdmitStudents([])
            setToast({ msg: 'No students found for this class.', type: 'error' })
        }
    }

    const downloadAdmitCardPDF = (elementId: string, filename: string) => {
        const el = document.getElementById(elementId)
        if (!el) {
            alert('Admit Card element not found')
            return
        }
        if (typeof (window as any).html2pdf === 'undefined') {
            window.print()
            return
        }
        const opt = {
            margin: [8, 8, 8, 8],
            filename: `${filename}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }
        ;(window as any).html2pdf().set(opt).from(el).save()
    }

    return (
        <div>
            <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" />

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">📑 Examination &amp; Evaluation</h1>
                    <p className="page-subtitle">Monthly tests, marks evaluation, and digital admit card generation</p>
                </div>
            </div>

            {/* Toast */}
            {toast.msg && (
                <div
                    className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}
                    style={{ marginBottom: '16px', cursor: 'pointer' }}
                    onClick={() => setToast({ msg: '', type: '' })}
                >
                    {toast.msg}
                </div>
            )}

            {/* Tab navigation */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <button
                    onClick={() => setActiveTab('marks')}
                    className="btn"
                    style={{
                        background: activeTab === 'marks' ? 'var(--primary)' : 'var(--surface-2)',
                        color: activeTab === 'marks' ? 'white' : 'var(--text-muted)',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '13px'
                    }}
                >
                    ✏️ Enter Test Marks
                </button>
                <button
                    onClick={() => setActiveTab('admit_card')}
                    className="btn"
                    style={{
                        background: activeTab === 'admit_card' ? 'var(--primary)' : 'var(--surface-2)',
                        color: activeTab === 'admit_card' ? 'white' : 'var(--text-muted)',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '13px'
                    }}
                >
                    🎫 Generate Admit Cards
                </button>
            </div>

            {/* ═══════════ TAB 1: MARKS ═══════════ */}
            {activeTab === 'marks' && (
                <div>
                    {/* Step indicator */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                        {[
                            { n: 1, label: 'Test Details' },
                            { n: 2, label: 'Enter Marks' },
                        ].map(s => (
                            <div key={s.n} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 18px', borderRadius: '999px',
                                background: step === s.n ? 'var(--primary)' : 'var(--surface-2)',
                                color: step === s.n ? 'white' : 'var(--text-muted)',
                                fontWeight: step === s.n ? 700 : 400,
                                fontSize: '13px',
                                transition: 'all 0.2s',
                            }}>
                                <span style={{
                                    width: '22px', height: '22px', borderRadius: '50%',
                                    background: step === s.n ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, fontSize: '12px',
                                }}>{s.n}</span>
                                {s.label}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Test Details */}
                    {step === 1 && (
                        <form onSubmit={handleLoadStudents} className="card" style={{ maxWidth: '680px' }}>
                            <h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '16px', color: 'var(--primary-light)' }}>
                                📝 Test Information
                            </h3>
                            <div className="grid-cols-2">
                                <div>
                                    <label className="label">Test Title *</label>
                                    <input
                                        className="input"
                                        placeholder="e.g. August Monthly Test"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Subject *</label>
                                    <input
                                        className="input"
                                        placeholder="e.g. Mathematics"
                                        value={form.subject}
                                        onChange={e => setForm({ ...form, subject: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Test Date *</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Max Marks *</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="100"
                                        value={form.maxMarks}
                                        onChange={e => setForm({ ...form, maxMarks: e.target.value })}
                                        required min="1"
                                    />
                                </div>
                                <div>
                                    <label className="label">Class *</label>
                                    <select
                                        className="input"
                                        value={form.courseId}
                                        onChange={e => setForm({ ...form, courseId: e.target.value, batchId: '' })}
                                        required
                                    >
                                        <option value="">Select Class</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Section *</label>
                                    <select
                                        className="input"
                                        value={form.batchId}
                                        onChange={e => setForm({ ...form, batchId: e.target.value })}
                                        required
                                        disabled={!form.courseId}
                                    >
                                        <option value="">Select Section</option>
                                        {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                                <button type="submit" className="btn btn-primary" disabled={loadingStudents}>
                                    {loadingStudents
                                        ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Loading Students...</>
                                        : '➡️ Next: Load Students'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Step 2: Enter Marks */}
                    {step === 2 && (
                        <form onSubmit={handlePublish}>
                            <div className="card" style={{ marginBottom: '16px', padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)' }}>
                                <div><span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Test</span><div style={{ fontWeight: 700 }}>{form.title}</div></div>
                                <div><span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Subject</span><div style={{ fontWeight: 700 }}>{form.subject}</div></div>
                                <div><span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Date</span><div style={{ fontWeight: 700 }}>{form.date}</div></div>
                                <div><span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Max Marks</span><div style={{ fontWeight: 700 }}>{form.maxMarks}</div></div>
                                <div><span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Students</span><div style={{ fontWeight: 700 }}>{students.length}</div></div>
                                <button type="button" onClick={() => setStep(1)} className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: '12px' }}>
                                    ← Edit Details
                                </button>
                            </div>

                            <div className="card" style={{ padding: 0 }}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ fontWeight: 700, fontSize: '15px' }}>✏️ Enter Marks for Each Student</h3>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{students.length} students</span>
                                </div>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Student</th>
                                                <th>Roll No.</th>
                                                <th>Marks Obtained (out of {form.maxMarks})</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((s, i) => (
                                                <tr key={s.id}>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{i + 1}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
                                                                {s.fullName.charAt(0)}
                                                            </div>
                                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.fullName}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{s.studentId}</td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            className="input"
                                                            style={{ width: '120px' }}
                                                            placeholder="0"
                                                            value={marks[s.id]}
                                                            onChange={e => setMarks({ ...marks, [s.id]: e.target.value })}
                                                            min={0}
                                                            max={parseFloat(form.maxMarks)}
                                                            required
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
                                        ← Back
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: '160px', justifyContent: 'center' }}>
                                        {saving
                                            ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Publishing...</>
                                            : '🚀 Publish Marks'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* ═══════════ TAB 2: ADMIT CARDS ═══════════ */}
            {activeTab === 'admit_card' && (
                <div>
                    <form onSubmit={handleLoadAdmitStudents} className="card" style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '16px', color: 'var(--primary-light)' }}>
                            🎫 Admit Card Settings &amp; Student Selection
                        </h3>
                        <div className="grid-cols-2">
                            <div>
                                <label className="label">Examination Name *</label>
                                <input
                                    className="input"
                                    placeholder="e.g. Half Yearly Examination 2026"
                                    value={admitExamTitle}
                                    onChange={e => setAdmitExamTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Exam Center / Venue *</label>
                                <input
                                    className="input"
                                    placeholder="e.g. Main Campus Examination Hall"
                                    value={admitExamCenter}
                                    onChange={e => setAdmitExamCenter(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Class *</label>
                                <select
                                    className="input"
                                    value={admitCourseId}
                                    onChange={e => { setAdmitCourseId(e.target.value); setAdmitBatchId('') }}
                                    required
                                >
                                    <option value="">Select Class</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label">Section / Batch (Optional)</label>
                                <select
                                    className="input"
                                    value={admitBatchId}
                                    onChange={e => setAdmitBatchId(e.target.value)}
                                    disabled={!admitCourseId}
                                >
                                    <option value="">All Sections / Batches</option>
                                    {admitFilteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label">Commencement Date *</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={admitExamDate}
                                    onChange={e => setAdmitExamDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Reporting Time *</label>
                                <input
                                    className="input"
                                    placeholder="e.g. 08:30 AM"
                                    value={admitReportingTime}
                                    onChange={e => setAdmitReportingTime(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                            <button type="submit" className="btn btn-primary" disabled={loadingAdmitStudents}>
                                {loadingAdmitStudents
                                    ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Fetching Students...</>
                                    : '🔍 Load Students for Admit Cards'}
                            </button>
                        </div>
                    </form>

                    {admitStudents.length > 0 && (
                        <div className="card" style={{ padding: 0 }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontWeight: 700, fontSize: '15px' }}>
                                    👨‍🎓 Students List ({admitStudents.length}) • Click to View &amp; Download Admit Card
                                </h3>
                            </div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Scholar No.</th>
                                            <th>Student Name</th>
                                            <th>Father&apos;s Name</th>
                                            <th>Class / Section</th>
                                            <th>Student ID</th>
                                            <th style={{ textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {admitStudents.map((s, idx) => (
                                            <tr key={s.id}>
                                                <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                <td><span className="badge badge-info">{s.scholarNo || 'N/A'}</span></td>
                                                <td style={{ fontWeight: 600 }}>{s.fullName}</td>
                                                <td style={{ color: 'var(--text-muted)' }}>{s.fatherName || 'N/A'}</td>
                                                <td>{courses.find(c => c.id === admitCourseId)?.name || s.courseName || '-'}</td>
                                                <td>{s.studentId}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => setSelectedAdmitStudent(s)}
                                                        className="btn btn-sm btn-primary"
                                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                                    >
                                                        🎫 View / Print Admit Card
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ ADMIT CARD MODAL & PDF TEMPLATE ═══════════ */}
            {selectedAdmitStudent && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
                    <div style={{ background: 'var(--surface)', borderRadius: '16px', maxWidth: '780px', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>📄 Student Admit Card Preview</h3>
                            <button onClick={() => setSelectedAdmitStudent(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }}>✕ Close</button>
                        </div>

                        {/* Printable Admit Card Element */}
                        <div id="admit-card-element" style={{ background: '#ffffff', color: '#0f172a', padding: '24px', borderRadius: '10px', border: '2px solid #e2e8f0', fontFamily: 'Arial, sans-serif' }}>
                            {/* School Header */}
                            <div style={{ textAlign: 'center', borderBottom: '2.5px solid #1e293b', paddingBottom: '14px', marginBottom: '16px' }}>
                                {tenant?.logo && (
                                    <img src={tenant.logo} alt="Logo" style={{ height: '55px', maxWidth: '100px', objectFit: 'contain', margin: '0 auto 6px auto', display: 'block' }} crossOrigin="anonymous" />
                                )}
                                <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '900', color: tenant?.themeColor || '#1e293b', textTransform: 'uppercase' }}>
                                    {tenant?.name || 'School Name'}
                                </h1>
                                {tenant?.address && <p style={{ margin: '2px 0', fontSize: '11px', color: '#475569' }}>{tenant.address}</p>}
                                <p style={{ margin: '2px 0', fontSize: '11px', color: '#475569' }}>
                                    {tenant?.phone ? `Ph: ${tenant.phone}` : ''}{tenant?.phone && tenant?.email ? ' | ' : ''}{tenant?.email ? tenant.email : ''}
                                </p>
                                {((tenant?.registrationCode || tenant?.schoolCode) || tenant?.diseCode) && (
                                    <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: '800', color: '#4338ca', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        {(tenant?.registrationCode || tenant?.schoolCode) && <span>School ID: {tenant.registrationCode || tenant.schoolCode}</span>}
                                        {(tenant?.registrationCode || tenant?.schoolCode) && tenant?.diseCode && <span>•</span>}
                                        {tenant?.diseCode && <span>DISE Code: {tenant.diseCode}</span>}
                                    </div>
                                )}
                                <div style={{ display: 'inline-block', marginTop: '10px', padding: '4px 14px', background: '#1e293b', color: 'white', fontWeight: '800', fontSize: '13px', borderRadius: '4px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                                    EXAMINATION ADMIT CARD / प्रवेश पत्र
                                </div>
                            </div>

                            {/* Exam Banner */}
                            <div style={{ background: '#f8fafc', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Exam Title</div>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{admitExamTitle}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Date &amp; Time</div>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{new Date(admitExamDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • {admitReportingTime}</div>
                                </div>
                            </div>

                            {/* Student Details & Photo Box */}
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <table style={{ flex: 1, borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <tbody>
                                        {[
                                            ['Scholar No. (स्कॉलर नं.)', selectedAdmitStudent.scholarNo || 'N/A'],
                                            ['Candidate Name (छात्र का नाम)', selectedAdmitStudent.fullName],
                                            ["Father's Name (पिता का नाम)", selectedAdmitStudent.fatherName || 'N/A'],
                                            ['Class / Course', courses.find(c => c.id === admitCourseId)?.name || selectedAdmitStudent.courseName || 'N/A'],
                                            ['Section / Batch', batches.find(b => b.id === admitBatchId)?.name || selectedAdmitStudent.batchName || 'General'],
                                            ['Roll / Student ID', selectedAdmitStudent.studentId || 'N/A'],
                                            ['Exam Center', admitExamCenter],
                                        ].map(([k, v]) => (
                                            <tr key={k}>
                                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: '700', width: '42%', background: '#f8fafc', color: '#334155' }}>{k}</td>
                                                <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: '600', color: '#0f172a' }}>{v}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Photo */}
                                <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>
                                    <div style={{ width: '100px', height: '120px', border: '2px solid #64748b', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                                        {selectedAdmitStudent.photo ? (
                                            <img src={selectedAdmitStudent.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                                        ) : (
                                            <span style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', padding: '4px' }}>Affix Recent Photo</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '9px', marginTop: '4px', color: '#64748b', fontWeight: '700' }}>Candidate Photo</div>
                                </div>
                            </div>

                            {/* Rules & Instructions */}
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 12px', marginBottom: '24px', fontSize: '10.5px', color: '#78350f' }}>
                                <div style={{ fontWeight: '800', marginBottom: '4px' }}>📌 Important Instructions for Candidates / महत्वपूर्ण निर्देश:</div>
                                <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.4 }}>
                                    <li>Bring this Admit Card along with your School ID card to the exam hall daily.</li>
                                    <li>Candidates must report at least 15 minutes before the reporting time ({admitReportingTime}).</li>
                                    <li>Mobile phones, electronic gadgets, or study materials are strictly prohibited.</li>
                                    <li>Follow all instructions given by the exam invigilators strictly.</li>
                                </ul>
                            </div>

                            {/* Signatures */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '20px' }}>
                                <div style={{ textAlign: 'center', width: '180px' }}>
                                    <div style={{ height: '36px' }}></div>
                                    <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontSize: '11px', fontWeight: '700' }}>Candidate Signature</div>
                                </div>
                                <div style={{ textAlign: 'center', width: '180px' }}>
                                    {tenant?.directorSign ? (
                                        <img src={tenant.directorSign} alt="Principal Signature" style={{ height: '36px', objectFit: 'contain', marginBottom: '2px', display: 'block', margin: '0 auto 2px auto' }} crossOrigin="anonymous" />
                                    ) : (
                                        <div style={{ height: '36px' }}></div>
                                    )}
                                    <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontSize: '11px', fontWeight: '700' }}>Controller / Principal</div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedAdmitStudent(null)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => downloadAdmitCardPDF('admit-card-element', `${selectedAdmitStudent.fullName}_Admit_Card`)}
                                className="btn btn-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            >
                                📥 Download Admit Card (PDF)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
