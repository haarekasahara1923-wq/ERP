'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth, useApi } from '@/contexts/AuthContext'
import html2pdf from 'html2pdf.js'

export default function GenerateTCPage() {
    const { tenant, token, handleUnauthorized } = useAuth()

    const [courses, setCourses] = useState<any[]>([])
    const [batches, setBatches] = useState<any[]>([])
    const [students, setStudents] = useState<any[]>([])

    const [selectedCourseId, setSelectedCourseId] = useState('')
    const [selectedBatchId, setSelectedBatchId] = useState('')
    const [selectedSubjectGroup, setSelectedSubjectGroup] = useState('')
    const [selectedStudentId, setSelectedStudentId] = useState('')
    
    const [studentData, setStudentData] = useState<any>(null)
    const [tcDetails, setTcDetails] = useState({
        attendance: 'Whole',
        accountsClearance: 'Clear',
        issueDate: new Date().toISOString().split('T')[0],
        tcNumber: `TC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
        reason: 'Passed highest class',
        character: 'Good',
        promotedTo: 'Higher Class'
    })

    const tcRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!token) return;
        Promise.all([
            fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/batches', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([c, b]) => {
            if (c.success) setCourses(c.data)
            if (b.success) setBatches(b.data)
        }).catch(console.error)
    }, [token])

    useEffect(() => {
        if (selectedCourseId && selectedBatchId && token) {
            fetch(`/api/students?courseId=${selectedCourseId}&batchId=${selectedBatchId}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json()).then(res => {
                if (res.success) {
                    let filtered = res.data;
                    const course = courses.find(c => c.id === selectedCourseId)
                    const isHigherSec = course && (course.classGroup === 'Higher Sec' || course.classGroup === 'Seinor Hr Secondary' || course.name.includes('11') || course.name.includes('12'))
                    if (isHigherSec && selectedSubjectGroup) {
                        filtered = filtered.filter((s: any) => s.subjectGroup === selectedSubjectGroup)
                    }
                    setStudents(filtered)
                    setSelectedStudentId('')
                    setStudentData(null)
                }
            }).catch(console.error)
        }
    }, [selectedCourseId, selectedBatchId, selectedSubjectGroup, token, courses])

    useEffect(() => {
        if (selectedStudentId) {
            const student = students.find(s => s.id === selectedStudentId)
            setStudentData(student || null)
        }
    }, [selectedStudentId])

    const selectedCourse = courses.find(c => c.id === selectedCourseId)
    const isHigherSec = selectedCourse && (selectedCourse.classGroup === 'Higher Sec' || selectedCourse.classGroup === 'Seinor Hr Secondary' || selectedCourse.name.includes('11') || selectedCourse.name.includes('12'))

    const generatePDF = () => {
        if (!tcRef.current) return
        const element = tcRef.current
        const opt = {
            margin: 10,
            filename: `TC_${studentData?.fullName || 'Student'}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
        }
        html2pdf().set(opt).from(element).save()
    }

    const generateDOCX = () => {
        if (!tcRef.current) return
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + tcRef.current.innerHTML + footer;
        
        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = `TC_${studentData?.fullName || 'Student'}.doc`;
        fileDownload.click();
        document.body.removeChild(fileDownload);
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: '600' }}>Generate Transfer Certificate (TC)</h1>
            
            <div className="card" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                        <label className="form-label">Class</label>
                        <select className="form-select" value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}>
                            <option value="">Select Class</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Batch</label>
                        <select className="form-select" value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}>
                            <option value="">Select Batch</option>
                            {batches.filter(b => b.courseId === selectedCourseId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    {isHigherSec && (
                        <div>
                            <label className="form-label">Subject Group</label>
                            <select className="form-select" value={selectedSubjectGroup} onChange={e => setSelectedSubjectGroup(e.target.value)}>
                                <option value="">Select Group (Optional)</option>
                                <option value="Science Maths">Science Maths</option>
                                <option value="Science Bio">Science Bio</option>
                                <option value="Arts">Arts</option>
                                <option value="Commerce">Commerce</option>
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="form-label">Scholar No.</label>
                        <select className="form-select" value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} disabled={!students.length}>
                            <option value="">{students.length ? 'Select Scholar No.' : 'No Students Found'}</option>
                            {students.map(s => <option key={s.id} value={s.id}>{s.fullName} ({s.scholarNo || 'N/A'})</option>)}
                        </select>
                    </div>
                </div>

                {studentData && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                        <div>
                            <label className="form-label">Attendance</label>
                            <select className="form-select" value={tcDetails.attendance} onChange={e => setTcDetails({...tcDetails, attendance: e.target.value})}>
                                <option value="Whole">Whole</option>
                                <option value="Compulsory">Compulsory</option>
                                <option value="Short">Short</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Accounts Clearance</label>
                            <select className="form-select" value={tcDetails.accountsClearance} onChange={e => setTcDetails({...tcDetails, accountsClearance: e.target.value})}>
                                <option value="Clear">Clear</option>
                                <option value="Dues">Dues</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Date of Issue</label>
                            <input type="date" className="form-input" value={tcDetails.issueDate} onChange={e => setTcDetails({...tcDetails, issueDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="form-label">Reason for Leaving</label>
                            <input type="text" className="form-input" value={tcDetails.reason} onChange={e => setTcDetails({...tcDetails, reason: e.target.value})} />
                        </div>
                        <div>
                            <label className="form-label">Character</label>
                            <input type="text" className="form-input" value={tcDetails.character} onChange={e => setTcDetails({...tcDetails, character: e.target.value})} />
                        </div>
                        <div>
                            <label className="form-label">Promoted To</label>
                            <input type="text" className="form-input" value={tcDetails.promotedTo} onChange={e => setTcDetails({...tcDetails, promotedTo: e.target.value})} />
                        </div>
                    </div>
                )}
            </div>

            {studentData && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginBottom: '24px' }}>
                    <button className="btn btn-secondary" onClick={generateDOCX} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📄 Download DOCX
                    </button>
                    <button className="btn btn-primary" onClick={generatePDF} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📥 Download PDF
                    </button>
                </div>
            )}

            {/* TC PREVIEW */}
            {studentData && (
                <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', overflowX: 'auto', border: '1px solid var(--border)' }}>
                    <div ref={tcRef} style={{ width: '210mm', minHeight: '297mm', padding: '20mm', margin: '0 auto', background: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', boxSizing: 'border-box', position: 'relative', color: '#000', fontFamily: 'Arial, sans-serif' }}>
                        
                        {/* Header Section */}
                        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '20px' }}>
                            {tenant?.logo && (
                                <img src={tenant.logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
                            )}
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <h1 style={{ margin: '0', fontSize: '28px', color: tenant?.themeColor || '#000', textTransform: 'uppercase' }}>{tenant?.name}</h1>
                                <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>{tenant?.address}</p>
                                <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Phone: {tenant?.phone} | Email: {tenant?.email}</p>
                                {tenant?.schoolCode && <p style={{ margin: '5px 0 0 0', fontSize: '14px', fontWeight: 'bold' }}>School Code: {tenant.schoolCode}</p>}
                            </div>
                        </div>

                        <h2 style={{ textAlign: 'center', margin: '0 0 30px 0', fontSize: '22px', textDecoration: 'underline' }}>TRANSFER CERTIFICATE</h2>

                        {/* Top Info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '14px' }}>
                            <div><strong>TC No:</strong> {tcDetails.tcNumber}</div>
                            <div><strong>Scholar No:</strong> {studentData.scholarNo || 'N/A'}</div>
                            <div><strong>Date of Issue:</strong> {new Date(tcDetails.issueDate).toLocaleDateString('en-IN')}</div>
                        </div>

                        {/* Student Details Table format */}
                        <div style={{ marginBottom: '40px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: '8px 0', width: '50%' }}><strong>1. Name of Pupil:</strong></td>
                                        <td style={{ padding: '8px 0' }}>{studentData.fullName}</td>
                                        <td rowSpan={5} style={{ verticalAlign: 'top', textAlign: 'right' }}>
                                            <div style={{ width: '100px', height: '120px', border: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>
                                                {studentData.photo ? <img src={studentData.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '12px', color: '#666' }}>Photo</span>}
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>2. Father's/Guardian's Name:</strong></td>
                                        <td style={{ padding: '8px 0' }}>{studentData.fatherName || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>3. Mother's Name:</strong></td>
                                        <td style={{ padding: '8px 0' }}>{studentData.motherName || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>4. Nationality:</strong></td>
                                        <td style={{ padding: '8px 0' }}>Indian</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>5. Caste / Category:</strong></td>
                                        <td style={{ padding: '8px 0' }}>{studentData.caste || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>6. Date of First Admission & Class:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>
                                            {studentData.firstAdmissionDate ? new Date(studentData.firstAdmissionDate).toLocaleDateString('en-IN') : 'N/A'} in Class {studentData.firstAdmissionClass || 'N/A'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>7. Date of Birth (in Figures):</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>{studentData.dob ? new Date(studentData.dob).toLocaleDateString('en-IN') : 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>8. Date of Birth (in Words):</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>{studentData.dobInWords || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>9. Class in which pupil last studied:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>{studentData.courseName}</td>
                                    </tr>
                                    {isHigherSec && (
                                        <tr>
                                            <td style={{ padding: '8px 0' }}><strong>10. Subject Group:</strong></td>
                                            <td style={{ padding: '8px 0' }} colSpan={2}>{studentData.subjectGroup || 'N/A'}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>{isHigherSec ? '11' : '10'}. Medium of Instruction:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>{studentData.medium || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>{isHigherSec ? '12' : '11'}. Whether failed, if so once/twice:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>No</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>{isHigherSec ? '13' : '12'}. Whether qualified for promotion:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>{tcDetails.promotedTo}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>{isHigherSec ? '14' : '13'}. Month upto which dues paid:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>{tcDetails.accountsClearance}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>{isHigherSec ? '15' : '14'}. Attendance:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>{tcDetails.attendance}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>{isHigherSec ? '16' : '15'}. General Character:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>{tcDetails.character}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>{isHigherSec ? '17' : '16'}. Reason for leaving the school:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>{tcDetails.reason}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '8px 0' }}><strong>{isHigherSec ? '18' : '17'}. Any other remarks:</strong></td>
                                        <td style={{ padding: '8px 0' }} colSpan={2}>N/A</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Signatures */}
                        <div style={{ position: 'absolute', bottom: '40mm', left: '20mm', right: '20mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderBottom: '1px solid #000', width: '150px', marginBottom: '5px' }}></div>
                                <div>Prepared By</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderBottom: '1px solid #000', width: '150px', marginBottom: '5px' }}></div>
                                <div>Checked By</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                    {tenant?.directorSign ? (
                                        <img src={tenant.directorSign} alt="Sign" style={{ maxHeight: '50px', maxWidth: '150px' }} />
                                    ) : (
                                        <div style={{ borderBottom: '1px solid #000', width: '150px' }}></div>
                                    )}
                                </div>
                                <div style={{ marginTop: '5px' }}>Authorized Signatory</div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    )
}
