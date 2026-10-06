'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Script from 'next/script'

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
        <label className="label">{label}</label>
        {children}
    </div>
)

const GOVT_DOC_DEFS = [
    { label: 'Aadhaar Card (Front)', key: 'aadhaarFront' },
    { label: 'Aadhaar Card (Back)', key: 'aadhaarBack' },
    { label: 'Samagra ID', key: 'samagraDoc' },
    { label: 'APAR ID', key: 'aparDoc' },
    { label: 'PEN ID', key: 'penDoc' },
    { label: 'Bank Passbook (First Page)', key: 'bankPassbook' },
]

export default function AddStudentPage() {
    const { token, tenant, handleUnauthorized } = useAuth()
    const router = useRouter()
    const [courses, setCourses] = useState<any[]>([])
    const [batches, setBatches] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [toast, setToast] = useState('')
    const [metadataLoading, setMetadataLoading] = useState(true)
    const [pdfLibReady, setPdfLibReady] = useState(false)
    const [showGovtModal, setShowGovtModal] = useState(false)
    const [govtDocs, setGovtDocs] = useState<Record<string, {name:string;data:string;type:string}[]>>({})

    const [form, setForm] = useState({
        scholarNo: '', fullName: '', fatherName: '', motherName: '', phone: '', parentPhone: '',
        email: '', address: '', gender: 'MALE', dob: '', dobInWords: '', caste: 'General', medium: 'Hindi',
        courseId: '', batchId: '',
        admissionDate: new Date().toISOString().split('T')[0],
        firstAdmissionClass: '', firstAdmissionDate: '', scholarshipScheme: '',
        feePlan: 'Annual', totalFee: '', feeWaiver: '', notes: '',
        aadhaarNo: '', penId: '', aparId: '', samagraId: '',
        bankName: '', bankAccountNo: '', ifsc: '', subjectGroup: '', photo: ''
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
        }).catch(() => { setToast('Failed to load data. Please refresh.'); setMetadataLoading(false) })
    }, [token])

    const filteredBatches = batches.filter((b: any) => !form.courseId || b.courseId === form.courseId)
    const selectedCourse = courses.find((c: any) => c.id === form.courseId)

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
            setSuccess(true); setToast('Student added successfully!')
            setTimeout(() => router.push('/dashboard/students'), 1500)
        } else if (res.status === 401 || data?.error === 'Unauthorized') {
            handleUnauthorized()
        } else {
            setToast(data.error || 'Failed to add student')
        }
    }

    const handlePhotoChange = (type: string) => {
        const input = document.createElement('input')
        input.type = 'file'; input.accept = 'image/*'
        if (type === 'Camera') input.capture = 'environment' as any
        input.onchange = (ev: any) => {
            const file = ev.target.files[0]; if (!file) return
            const reader = new FileReader()
            reader.onload = (re: any) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')
                    const maxSize = 300; let w = img.width, h = img.height
                    if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize } } else { if (h > maxSize) { w *= maxSize / h; h = maxSize } }
                    canvas.width = w; canvas.height = h; ctx?.drawImage(img, 0, 0, w, h)
                    setForm(prev => ({ ...prev, photo: canvas.toDataURL('image/jpeg', 0.8) }))
                }
                img.src = re.target.result
            }
            reader.readAsDataURL(file)
        }
        input.click()
    }

    const handleGovtDocUpload = (key: string, type: string) => {
        const input = document.createElement('input')
        input.type = 'file'; input.accept = 'image/*,application/pdf'
        if (type === 'camera') input.capture = 'environment' as any
        input.onchange = (ev: any) => {
            const file = ev.target.files[0]; if (!file) return
            const reader = new FileReader()
            reader.onload = (re: any) => {
                setGovtDocs(prev => ({ ...prev, [key]: [...(prev[key] || []), { name: file.name, data: re.target.result, type: file.type }] }))
            }
            reader.readAsDataURL(file)
        }
        input.click()
    }

    const removeGovtDoc = (key: string, idx: number) =>
        setGovtDocs(prev => ({ ...prev, [key]: (prev[key] || []).filter((_: any, i: number) => i !== idx) }))

    const totalGovtDocs = Object.values(govtDocs).reduce((sum, arr) => sum + arr.length, 0)

    const downloadPDF = () => {
        const el = document.getElementById('student-admission-print')
        if (!el) return
        const opt = {
            margin: [8, 8, 8, 8],
            filename: `${form.fullName || 'Student'}_Admission_Form.pdf`,
            image: { type: 'jpeg', quality: 0.97 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }
        ;(window as any).html2pdf().set(opt).from(el).save()
    }

    const downloadDOCX = () => {
        const rows: [string, string][] = [
            ['Scholar No.', form.scholarNo || '--'], ['Full Name', form.fullName || '--'],
            ["Father's Name", form.fatherName || '--'], ["Mother's Name", form.motherName || '--'],
            ['Phone', form.phone || '--'], ['Parent Phone', form.parentPhone || '--'],
            ['Email', form.email || '--'], ['Gender', form.gender || '--'],
            ['Date of Birth', form.dob ? new Date(form.dob).toLocaleDateString('en-IN') : '--'],
            ['DOB (in words)', form.dobInWords || '--'], ['Caste', form.caste || '--'], ['Medium', form.medium || '--'],
            ['Address', form.address || '--'], ['Class', (selectedCourse as any)?.name || '--'],
            ['Admission Date', form.admissionDate ? new Date(form.admissionDate).toLocaleDateString('en-IN') : '--'],
            ['First Admission Class', form.firstAdmissionClass || '--'],
            ['First Admission Date', form.firstAdmissionDate ? new Date(form.firstAdmissionDate).toLocaleDateString('en-IN') : '--'],
            ['Scholarship Scheme', form.scholarshipScheme || '--'], ['Fee Plan', form.feePlan || '--'],
            ['Total Fee (Rs.)', form.totalFee || '--'], ['Fee Waiver (Rs.)', form.feeWaiver || '0'],
            ['Aadhaar No.', form.aadhaarNo || '--'], ['PEN ID', form.penId || '--'],
            ['APAR ID', form.aparId || '--'], ['Samagra ID', form.samagraId || '--'],
            ['Bank Name', form.bankName || '--'], ['Bank Account No.', form.bankAccountNo || '--'],
            ['IFSC Code', form.ifsc || '--'], ['Notes', form.notes || '--'],
        ]
        const tableRows = rows.map(([k, v]) =>
            `<tr><td style="border:1px solid #000;padding:5px 8px;width:38%;font-weight:bold;background:#f5f5f5;">${k}</td><td style="border:1px solid #000;padding:5px 8px;">${v}</td></tr>`
        ).join('')
        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:12pt;margin:20mm 20mm;}h1{text-align:center;font-size:18pt;}h2{text-align:center;font-size:13pt;text-decoration:underline;margin-bottom:16px;}p{text-align:center;margin:2px 0;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}.sig{display:flex;justify-content:space-between;margin-top:50px;}.sig div{text-align:center;width:42%;border-top:1px solid #000;padding-top:6px;}</style></head><body><h1>${tenant?.name || 'School'}</h1><p>${tenant?.address || ''}</p><p>Ph: ${tenant?.phone || ''} | Email: ${tenant?.email || ''}</p>${tenant?.registrationCode ? `<p><b>School Code: ${tenant.registrationCode}</b></p>` : ''}${tenant?.diseCode ? `<p><b>DISE Code: ${tenant.diseCode}</b></p>` : ''}<h2>STUDENT ADMISSION FORM</h2><table>${tableRows}</table><p style="font-size:10pt;color:#333;">I hereby declare that the information provided above is true and correct.</p><div class="sig"><div>Parent / Guardian Signature<br/><small>Name: ____________________</small><br/><small>Date: ____________________</small></div><div>Authorised Signatory<br/><small>${tenant?.name || 'School Authority'}</small><br/><small>Date: ____________________</small></div></div></body></html>`
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${form.fullName || 'Student'}_Admission_Form.doc`; a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div>
            <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" onLoad={() => setPdfLibReady(true)} />

            <div className="page-header">
                <div>
                    <h1 className="page-title">&#x2795; Add New Student</h1>
                    <p className="page-subtitle">Fill in the student details below</p>
                </div>
            </div>

            {toast && (
                <div className={`toast ${success ? 'toast-success' : 'toast-error'}`} style={{ position: 'relative', marginBottom: '16px', maxWidth: '100%' }}>
                    {success ? '&#x2713;' : '&#x26A0;&#xFE0F;'} {toast}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Personal Info */}
                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '16px', color: 'var(--primary-light)' }}>&#x1F464; Personal Information</h3>
                    <div style={{ marginBottom: '16px' }}>
                        <Field label="Student Photo">
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                {form.photo ? (
                                    <div style={{ position: 'relative' }}>
                                        <img src={form.photo} alt="Preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                                        <button type="button" onClick={() => setForm({ ...form, photo: '' })} style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: 20, height: 20, border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#x2715;</button>
                                    </div>
                                ) : (
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '24px', border: '2px dashed var(--border)' }}>&#x1F464;</div>
                                )}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => handlePhotoChange('Camera')}>&#x1F4F7; Camera</button>
                                    <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => handlePhotoChange('Gallery')}>&#x1F4C1; Gallery</button>
                                </div>
                            </div>
                        </Field>
                    </div>
                    <div className="grid-cols-2">
                        <Field label="Scholar No. *"><input className="input" placeholder="1001" value={form.scholarNo} onChange={e => setForm({ ...form, scholarNo: e.target.value })} required /></Field>
                        <Field label="Full Name *"><input className="input" placeholder="Arjun Sharma" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required /></Field>
                        <Field label="Phone Number *"><input className="input" type="tel" placeholder="9876543210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required /></Field>
                        <Field label="Father's Name"><input className="input" placeholder="Ramesh Sharma" value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} /></Field>
                        <Field label="Mother's Name"><input className="input" placeholder="Sunita Sharma" value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} /></Field>
                        <Field label="Parent Phone"><input className="input" type="tel" placeholder="9876543211" value={form.parentPhone} onChange={e => setForm({ ...form, parentPhone: e.target.value })} /></Field>
                        <Field label="Email"><input className="input" type="email" placeholder="student@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
                        <Field label="Gender">
                            <select className="input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                            </select>
                        </Field>
                        <Field label="Date of Birth"><input className="input" type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></Field>
                        <Field label="Date of Birth (in words)"><input className="input" placeholder="First January Two Thousand" value={form.dobInWords} onChange={e => setForm({ ...form, dobInWords: e.target.value })} /></Field>
                        <Field label="Caste">
                            <select className="input" value={form.caste} onChange={e => setForm({ ...form, caste: e.target.value })}>
                                <option value="General">General</option><option value="SC">SC</option><option value="ST">ST</option><option value="OBC">OBC</option><option value="OTHER">OTHER</option>
                            </select>
                        </Field>
                        <Field label="Medium">
                            <select className="input" value={form.medium} onChange={e => setForm({ ...form, medium: e.target.value })}>
                                <option value="Hindi">Hindi</option><option value="English">English</option>
                            </select>
                        </Field>
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        <Field label="Address"><textarea className="input" placeholder="Full address with city and pin code" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} style={{ resize: 'none' }} /></Field>
                    </div>
                </div>

                {/* Government IDs */}
                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '16px', color: 'var(--primary-light)' }}>&#x1FAA6; Government IDs</h3>
                    <div className="grid-cols-2">
                        <Field label="Aadhaar Number"><input className="input" placeholder="1234 5678 9012" value={form.aadhaarNo} onChange={e => setForm({ ...form, aadhaarNo: e.target.value })} /></Field>
                        <Field label="PEN ID No."><input className="input" placeholder="PEN ID" value={form.penId} onChange={e => setForm({ ...form, penId: e.target.value })} /></Field>
                        <Field label="APAR ID No."><input className="input" placeholder="APAR ID" value={form.aparId} onChange={e => setForm({ ...form, aparId: e.target.value })} /></Field>
                        <Field label="Samagra ID No."><input className="input" placeholder="Samagra ID" value={form.samagraId} onChange={e => setForm({ ...form, samagraId: e.target.value })} /></Field>
                        <Field label="Bank Name"><input className="input" placeholder="State Bank of India" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} /></Field>
                        <Field label="Bank Account No."><input className="input" placeholder="Account Number" value={form.bankAccountNo} onChange={e => setForm({ ...form, bankAccountNo: e.target.value })} /></Field>
                        <Field label="IFSC Code"><input className="input" placeholder="IFSC Code" value={form.ifsc} onChange={e => setForm({ ...form, ifsc: e.target.value })} /></Field>
                    </div>
                </div>

                {/* Academic Info */}
                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '16px', color: 'var(--primary-light)' }}>&#x1F4DA; Academic Details</h3>
                    <div className="grid-cols-2">
                        <Field label="Class *">
                            <select className="input" value={form.courseId} onChange={e => {
                                const courseId = e.target.value
                                const sel = courses.find((c: any) => c.id === courseId)
                                const classFee = sel ? (sel as any).fees : 0
                                let waiver = parseFloat(form.feeWaiver) || 0
                                let newFeeWaiver = form.feeWaiver
                                if (form.scholarshipScheme.toUpperCase() === 'RT') { waiver = classFee; newFeeWaiver = classFee.toString() }
                                setForm({ ...form, courseId, batchId: '', feeWaiver: newFeeWaiver, totalFee: sel ? Math.max(0, classFee - waiver).toString() : '' })
                            }} required disabled={metadataLoading}>
                                <option value="">{metadataLoading ? 'Loading classes...' : 'Select Class'}</option>
                                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.installmentCount} Installments)</option>)}
                            </select>
                            {form.courseId && selectedCourse && (<div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px', fontWeight: 'bold' }}>Fees will be split into {(selectedCourse as any).installmentCount} installments automatically.</div>)}
                        </Field>
                        <Field label="Section *">
                            <select className="input" value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value })} required disabled={metadataLoading}>
                                <option value="">{metadataLoading ? 'Loading sections...' : 'Select Section'}</option>
                                {filteredBatches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Admission Date"><input className="input" type="date" value={form.admissionDate} onChange={e => setForm({ ...form, admissionDate: e.target.value })} /></Field>
                        <Field label="First Admission Class"><input className="input" placeholder="e.g. 1st Grade" value={form.firstAdmissionClass} onChange={e => setForm({ ...form, firstAdmissionClass: e.target.value })} /></Field>
                        <Field label="First Admission Date"><input className="input" type="date" value={form.firstAdmissionDate} onChange={e => setForm({ ...form, firstAdmissionDate: e.target.value })} /></Field>
                        <Field label="Scholarship Scheme"><input className="input" placeholder="e.g. RT" value={form.scholarshipScheme} onChange={e => {
                            const val = e.target.value
                            if (val.toUpperCase() === 'RT') { const sel = courses.find((c: any) => c.id === form.courseId); const classFee = sel ? (sel as any).fees : 0; setForm({ ...form, scholarshipScheme: val, feeWaiver: classFee.toString(), totalFee: '0' }) }
                            else { setForm({ ...form, scholarshipScheme: val }) }
                        }} /></Field>
                        <Field label="Fee Plan">
                            <select className="input" value={form.feePlan} onChange={e => setForm({ ...form, feePlan: e.target.value })}>
                                <option>Annual</option><option>Quarterly</option><option>Monthly</option><option>Custom</option>
                            </select>
                        </Field>
                        <Field label="Fee Waiver (Rs.)"><input className="input" type="number" placeholder="0" value={form.feeWaiver} onChange={e => {
                            const waiverStr = e.target.value; const waiver = parseFloat(waiverStr) || 0
                            const sel = courses.find((c: any) => c.id === form.courseId)
                            const classFee = sel ? (sel as any).fees : (parseFloat(form.totalFee) + (parseFloat(form.feeWaiver) || 0))
                            setForm({ ...form, feeWaiver: waiverStr, totalFee: sel ? Math.max(0, classFee - waiver).toString() : form.totalFee })
                        }} /></Field>
                        <Field label="Subject Group">
                            {(() => {
                                const isSenior = (selectedCourse as any)?.classGroup === 'Senior Hr Secondary'
                                return (<select className="input" value={form.subjectGroup} onChange={e => setForm({ ...form, subjectGroup: e.target.value })} disabled={!isSenior} style={{ opacity: isSenior ? 1 : 0.5, cursor: isSenior ? 'pointer' : 'not-allowed' }}>
                                    <option value="">{isSenior ? 'Select Subject Group' : 'Only for Class 11 & 12'}</option>
                                    <option value="Science Bio">Science Bio</option><option value="Science Maths">Science Maths</option>
                                    <option value="Arts">Arts</option><option value="Commerce">Commerce</option>
                                </select>)
                            })()}
                        </Field>
                        <Field label="Total Course Fee (Rs.) [After Waiver]"><input className="input" type="number" placeholder="45000" value={form.totalFee} onChange={e => setForm({ ...form, totalFee: e.target.value })} /></Field>
                    </div>
                </div>

                {/* Notes */}
                <div className="card" style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontWeight: '700', marginBottom: '16px', fontSize: '16px', color: 'var(--primary-light)' }}>&#x1F4DD; Additional Notes</h3>
                    <textarea className="input" placeholder="Any important notes about this student..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ resize: 'none' }} />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button>
                    <button type="button" className="btn btn-secondary" onClick={downloadPDF}
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
                        &#x1F4C4; Download PDF
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={downloadDOCX}
                        style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa' }}>
                        &#x1F4DD; Download DOC
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowGovtModal(true)}
                        style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', position: 'relative' }}>
                        &#x1FAA6; Upload Govt IDs
                        {totalGovtDocs > 0 && (<span style={{ position: 'absolute', top: -6, right: -6, background: '#10b981', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalGovtDocs}</span>)}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Saving...</> : '&#x1F4BE; Add Student'}
                    </button>
                </div>
            </form>

            {/* Govt ID Upload Modal */}
            {showGovtModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: 'var(--surface)', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflow: 'auto', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
                            <div>
                                <h2 style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>&#x1FAA6; Upload Government Documents</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>Upload from Gallery or take photo. Supports: Images &amp; PDF</p>
                            </div>
                            <button onClick={() => setShowGovtModal(false)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 14px', color: 'var(--text)', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>&#x2715; Close</button>
                        </div>
                        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                            {GOVT_DOC_DEFS.map(({ label, key }) => (
                                <div key={key} style={{ background: 'var(--surface-2)', borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (govtDocs[key] || []).length > 0 ? '10px' : '0' }}>
                                        <span style={{ fontWeight: '700', fontSize: '14px' }}>{label}</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button type="button" onClick={() => handleGovtDocUpload(key, 'camera')} style={{ padding: '5px 12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px', color: '#a5b4fc', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>&#x1F4F7; Camera</button>
                                            <button type="button" onClick={() => handleGovtDocUpload(key, 'gallery')} style={{ padding: '5px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', color: '#34d399', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>&#x1F4C1; Gallery</button>
                                        </div>
                                    </div>
                                    {(govtDocs[key] || []).length === 0 ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', marginTop: '6px' }}>No documents uploaded yet</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                            {(govtDocs[key] || []).map((doc: any, idx: number) => (
                                                <div key={idx} style={{ position: 'relative', width: '88px' }}>
                                                    {doc.type.startsWith('image/') ? (
                                                        <img src={doc.data} alt={doc.name} style={{ width: '88px', height: '68px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                                    ) : (
                                                        <div style={{ width: '88px', height: '68px', background: 'var(--surface)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', fontSize: '20px' }}>
                                                            &#x1F4C4;<span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center', padding: '0 4px', wordBreak: 'break-all' }}>{doc.name.substring(0, 14)}</span>
                                                        </div>
                                                    )}
                                                    <button type="button" onClick={() => removeGovtDoc(key, idx)} style={{ position: 'absolute', top: -5, right: -5, background: 'rgba(239,68,68,0.9)', color: 'white', borderRadius: '50%', width: 18, height: 18, border: 'none', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>&#x2715;</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{totalGovtDocs} document{totalGovtDocs !== 1 ? 's' : ''} uploaded</span>
                            <button onClick={() => setShowGovtModal(false)} className="btn btn-primary">&#x2705; Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden A4 PDF Print Template */}
            <div id="student-admission-print" style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, width: '210mm', background: 'white', color: '#000', fontFamily: 'Arial,Helvetica,sans-serif', fontSize: '10.5pt', padding: '12mm 14mm' }}>
                <div style={{ borderBottom: '2.5px solid #000', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                        {tenant?.logo && (<img src={tenant.logo} alt="Logo" style={{ height: '55px', objectFit: 'contain' }} crossOrigin="anonymous" />)}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '17pt', fontWeight: '900', textTransform: 'uppercase', color: tenant?.themeColor || '#000' }}>{tenant?.name || 'School Name'}</div>
                            {tenant?.address && <div style={{ fontSize: '9pt', marginTop: '2px' }}>{tenant.address}</div>}
                            <div style={{ fontSize: '9pt' }}>{tenant?.phone && `Ph: ${tenant.phone}`}{tenant?.phone && tenant?.email && '  |  '}{tenant?.email && `Email: ${tenant.email}`}</div>
                            {(tenant?.registrationCode || tenant?.diseCode) && (<div style={{ fontSize: '9pt', fontWeight: '700', marginTop: '2px' }}>{tenant?.registrationCode && `School Code: ${tenant.registrationCode}`}{tenant?.registrationCode && tenant?.diseCode && '   |   '}{tenant?.diseCode && `DISE Code: ${tenant.diseCode}`}</div>)}
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '13pt', fontWeight: '900', textDecoration: 'underline', marginBottom: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Student Admission Form</div>
                <div style={{ display: 'flex', gap: '14px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <table style={{ flex: 1, borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                        <tbody>
                            {[['Scholar No.', form.scholarNo || '--'], ['Full Name', form.fullName || '--'], ["Father's Name", form.fatherName || '--'], ["Mother's Name", form.motherName || '--'], ['Phone', form.phone || '--'], ['Parent Phone', form.parentPhone || '--']].map(([k, v]) => (
                                <tr key={k}><td style={{ border: '1px solid #666', padding: '3px 6px', fontWeight: '700', width: '38%', background: '#f2f2f2' }}>{k}</td><td style={{ border: '1px solid #666', padding: '3px 6px' }}>{v}</td></tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ width: '88px', flexShrink: 0, textAlign: 'center' }}>
                        <div style={{ width: '88px', height: '108px', border: '2px solid #333', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
                            {form.photo ? <img src={form.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : <span style={{ fontSize: '9px', color: '#888', textAlign: 'center', padding: '4px' }}>Paste Photo Here</span>}
                        </div>
                        <div style={{ fontSize: '8pt', marginTop: '3px', color: '#555', fontWeight: '600' }}>Student Photo</div>
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '7px' }}>
                    <tbody>
                        {[['Email', form.email || '--'], ['Gender', form.gender || '--'], ['Date of Birth', form.dob ? new Date(form.dob).toLocaleDateString('en-IN') : '--'], ['DOB (in words)', form.dobInWords || '--'], ['Caste', form.caste || '--'], ['Medium', form.medium || '--'], ['Address', form.address || '--']].map(([k, v]) => (
                            <tr key={k}><td style={{ border: '1px solid #666', padding: '3px 6px', fontWeight: '700', width: '33%', background: '#f2f2f2' }}>{k}</td><td style={{ border: '1px solid #666', padding: '3px 6px' }}>{v}</td></tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ fontWeight: '800', fontSize: '10pt', background: '#dde4f5', padding: '3px 8px', marginBottom: '3px', borderLeft: '4px solid #3f51b5' }}>Academic Details</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '7px' }}>
                    <tbody>
                        {[['Class', (selectedCourse as any)?.name || '--'], ['Admission Date', form.admissionDate ? new Date(form.admissionDate).toLocaleDateString('en-IN') : '--'], ['First Admission Class', form.firstAdmissionClass || '--'], ['First Admission Date', form.firstAdmissionDate ? new Date(form.firstAdmissionDate).toLocaleDateString('en-IN') : '--'], ['Scholarship Scheme', form.scholarshipScheme || '--'], ['Fee Plan', form.feePlan || '--'], ['Total Course Fee (Rs.)', form.totalFee || '--'], ['Fee Waiver (Rs.)', form.feeWaiver || '0'], ['Subject Group', form.subjectGroup || '--']].map(([k, v]) => (
                            <tr key={k}><td style={{ border: '1px solid #666', padding: '3px 6px', fontWeight: '700', width: '33%', background: '#f2f2f2' }}>{k}</td><td style={{ border: '1px solid #666', padding: '3px 6px' }}>{v}</td></tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ fontWeight: '800', fontSize: '10pt', background: '#e8f5e9', padding: '3px 8px', marginBottom: '3px', borderLeft: '4px solid #4caf50' }}>Government IDs &amp; Bank Details</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '7px' }}>
                    <tbody>
                        {[['Aadhaar Number', form.aadhaarNo || '--'], ['PEN ID', form.penId || '--'], ['APAR ID', form.aparId || '--'], ['Samagra ID', form.samagraId || '--'], ['Bank Name', form.bankName || '--'], ['Bank Account No.', form.bankAccountNo || '--'], ['IFSC Code', form.ifsc || '--']].map(([k, v]) => (
                            <tr key={k}><td style={{ border: '1px solid #666', padding: '3px 6px', fontWeight: '700', width: '33%', background: '#f2f2f2' }}>{k}</td><td style={{ border: '1px solid #666', padding: '3px 6px' }}>{v}</td></tr>
                        ))}
                    </tbody>
                </table>
                {form.notes && (<><div style={{ fontWeight: '800', fontSize: '10pt', background: '#fff8e1', padding: '3px 8px', marginBottom: '3px', borderLeft: '4px solid #ffc107' }}>Additional Notes</div><div style={{ border: '1px solid #999', padding: '5px 8px', fontSize: '9.5pt', marginBottom: '8px' }}>{form.notes}</div></>)}
                <div style={{ border: '1px solid #ccc', borderRadius: '3px', padding: '6px 8px', fontSize: '8.5pt', color: '#333', marginBottom: '14px', background: '#fafafa' }}>I hereby declare that the information provided above is true and correct to the best of my knowledge. I agree to abide by all rules and regulations of the institution.</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px' }}>
                    <div style={{ textAlign: 'center', width: '40%' }}>
                        <div style={{ height: '36px' }}></div>
                        <div style={{ borderTop: '1px solid #000', paddingTop: '5px', fontWeight: '700', fontSize: '9.5pt' }}>Parent / Guardian Signature</div>
                        <div style={{ fontSize: '8.5pt', color: '#444', marginTop: '2px' }}>Name: ______________________</div>
                        <div style={{ fontSize: '8.5pt', color: '#444' }}>Date: _______________________</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '40%' }}>
                        {tenant?.directorSign ? <img src={tenant.directorSign} alt="Sign" style={{ height: '36px', objectFit: 'contain' }} crossOrigin="anonymous" /> : <div style={{ height: '36px' }}></div>}
                        <div style={{ borderTop: '1px solid #000', paddingTop: '5px', fontWeight: '700', fontSize: '9.5pt' }}>Authorised Signatory</div>
                        <div style={{ fontSize: '8.5pt', color: '#444', marginTop: '2px' }}>{tenant?.name || 'School Authority'}</div>
                        <div style={{ fontSize: '8.5pt', color: '#444' }}>Date: _______________________</div>
                    </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '7.5pt', color: '#aaa', borderTop: '1px dashed #ddd', paddingTop: '5px' }}>{tenant?.name} - Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
        </div>
    )
}
