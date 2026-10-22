'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Course {
    id: string
    name: string
    subjects?: string[]
}

interface Batch {
    id: string
    name: string
    courseId: string
    courseName?: string
}

interface Student {
    id: string
    fullName: string
    studentId?: string
    scholarNo?: string
    phone?: string
    courseId: string
    batchId?: string
    batchName?: string
}

interface AttendanceState {
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE'
    notes?: string
}

const statusOptions = [
    { value: 'PRESENT', label: 'Present', shortLabel: 'P', icon: '✅', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' },
    { value: 'ABSENT', label: 'Absent', shortLabel: 'A', icon: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' },
    { value: 'LATE', label: 'Late', shortLabel: 'L', icon: '⏰', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' },
    { value: 'HALF_DAY', label: 'Half Day', shortLabel: 'HD', icon: '🌓', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.35)' },
    { value: 'LEAVE', label: 'Leave', shortLabel: 'LV', icon: '🏖️', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.35)' },
] as const

export default function AttendancePage() {
    const { token } = useAuth()
    const [courses, setCourses] = useState<Course[]>([])
    const [batches, setBatches] = useState<Batch[]>([])
    const [students, setStudents] = useState<Student[]>([])
    
    // Filters
    const [selectedCourse, setSelectedCourse] = useState<string>('')
    const [selectedBatch, setSelectedBatch] = useState<string>('')
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [searchQuery, setSearchQuery] = useState<string>('')

    // State
    const [attendance, setAttendance] = useState<Record<string, AttendanceState>>({})
    const [loadingMetadata, setLoadingMetadata] = useState(true)
    const [loadingData, setLoadingData] = useState(false)
    const [saving, setSaving] = useState(false)
    const [downloadingPdf, setDownloadingPdf] = useState(false)
    const [hasExistingRecords, setHasExistingRecords] = useState(false)
    const [toast, setToast] = useState<{ show: boolean; success: boolean; msg: string }>({ show: false, success: true, msg: '' })
    const [schoolProfile, setSchoolProfile] = useState<any>(null)

    const pdfRef = useRef<HTMLDivElement>(null)

    // Load initial metadata: Classes (Courses), Batches, and School Profile
    useEffect(() => {
        if (!token) return
        setLoadingMetadata(true)
        Promise.all([
            fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/batches', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/dashboard/profile', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
        ]).then(([coursesRes, batchesRes, profileRes]) => {
            if (coursesRes?.success && Array.isArray(coursesRes.data)) {
                setCourses(coursesRes.data)
                // If classes exist, preselect the first class for immediate visibility
                if (coursesRes.data.length > 0 && !selectedCourse) {
                    setSelectedCourse(coursesRes.data[0].id)
                }
            }
            if (batchesRes?.success && Array.isArray(batchesRes.data)) {
                setBatches(batchesRes.data)
            }
            if (profileRes?.success && profileRes.tenant) {
                setSchoolProfile(profileRes.tenant)
            }
        }).catch(err => {
            console.error('Failed to load metadata:', err)
        }).finally(() => {
            setLoadingMetadata(false)
        })
    }, [token])

    // Load Students and Attendance for Selected Class + (Optional) Batch + Date
    useEffect(() => {
        if (!token || !selectedCourse) {
            setStudents([])
            setAttendance({})
            setHasExistingRecords(false)
            return
        }

        setLoadingData(true)
        const stuUrl = selectedBatch
            ? `/api/students?courseId=${selectedCourse}&batchId=${selectedBatch}`
            : `/api/students?courseId=${selectedCourse}`

        const attUrl = selectedBatch
            ? `/api/attendance?courseId=${selectedCourse}&batchId=${selectedBatch}&date=${selectedDate}`
            : `/api/attendance?courseId=${selectedCourse}&date=${selectedDate}`

        Promise.all([
            fetch(stuUrl, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch(attUrl, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        ]).then(([stuRes, attRes]) => {
            const fetchedStudents: Student[] = (stuRes?.success && Array.isArray(stuRes.data)) ? stuRes.data : []
            setStudents(fetchedStudents)

            const initAttendance: Record<string, AttendanceState> = {}
            let existingFound = false

            // Map existing attendance from DB
            const existingMap = new Map<string, any>()
            if (attRes?.success && Array.isArray(attRes.data)) {
                attRes.data.forEach((rec: any) => {
                    if (rec.studentId) {
                        existingMap.set(rec.studentId, rec)
                        existingFound = true
                    }
                })
            }

            fetchedStudents.forEach(stu => {
                const ex = existingMap.get(stu.id)
                if (ex) {
                    initAttendance[stu.id] = {
                        status: ex.status || 'PRESENT',
                        notes: ex.notes || ''
                    }
                } else {
                    // Default to PRESENT for unmarked students
                    initAttendance[stu.id] = {
                        status: 'PRESENT',
                        notes: ''
                    }
                }
            })

            setAttendance(initAttendance)
            setHasExistingRecords(existingFound)
        }).catch(err => {
            console.error('Failed to fetch class attendance:', err)
            showToast('Failed to load attendance records for selected class and date', false)
        }).finally(() => {
            setLoadingData(false)
        })
    }, [token, selectedCourse, selectedBatch, selectedDate])

    const showToast = (msg: string, success = true) => {
        setToast({ show: true, success, msg })
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000)
    }

    // Change status for a single student
    const setStudentStatus = (studentId: string, status: AttendanceState['status']) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || { notes: '' }),
                status
            }
        }))
    }

    // Change note for a single student
    const setStudentNote = (studentId: string, notes: string) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || { status: 'PRESENT' }),
                notes
            }
        }))
    }

    // Mark all currently visible / loaded students
    const markAllVisible = (status: AttendanceState['status']) => {
        const next: Record<string, AttendanceState> = { ...attendance }
        students.forEach(s => {
            next[s.id] = {
                ...(next[s.id] || { notes: '' }),
                status
            }
        })
        setAttendance(next)
        showToast(`Marked all ${students.length} students as ${status}`)
    }

    // Save or Update Attendance
    const saveAttendance = async () => {
        if (!selectedCourse || students.length === 0) {
            showToast('No students to save attendance for', false)
            return
        }

        setSaving(true)
        const records = students.map(s => ({
            studentId: s.id,
            batchId: s.batchId || (selectedBatch || null),
            date: selectedDate,
            status: attendance[s.id]?.status || 'PRESENT',
            notes: attendance[s.id]?.notes || '',
        }))

        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ records }),
            })
            const data = await res.json()
            if (data.success) {
                setHasExistingRecords(true)
                showToast(`✅ Attendance successfully saved for ${records.length} students and synced with parent portal!`)
            } else {
                showToast(data.error || 'Failed to save attendance', false)
            }
        } catch (err) {
            console.error('Error saving attendance:', err)
            showToast('Network error while saving attendance', false)
        } finally {
            setSaving(false)
        }
    }

    // Download PDF Report
    const downloadPdfReport = async () => {
        if (!pdfRef.current || students.length === 0) {
            showToast('No data available to download', false)
            return
        }
        setDownloadingPdf(true)
        try {
            const html2pdf = (await import('html2pdf.js')).default
            const element = pdfRef.current
            
            const currentCourseName = courses.find(c => c.id === selectedCourse)?.name || 'Class'
            const currentBatchName = batches.find(b => b.id === selectedBatch)?.name
            const suffix = currentBatchName ? `_${currentBatchName}` : ''
            const filename = `Attendance_${currentCourseName.replace(/\s+/g, '_')}${suffix}_${selectedDate}.pdf`

            const opt = {
                margin: [8, 8, 8, 8] as [number, number, number, number],
                filename,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
            }

            await html2pdf().set(opt).from(element).save()
            showToast('📄 Attendance PDF report downloaded successfully!')
        } catch (err) {
            console.error('Failed to generate PDF:', err)
            showToast('Failed to download PDF. Please try again.', false)
        } finally {
            setDownloadingPdf(false)
        }
    }

    // Filter students by search
    const filteredStudents = students.filter(s => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase().trim()
        return (
            s.fullName.toLowerCase().includes(q) ||
            (s.scholarNo && s.scholarNo.toLowerCase().includes(q)) ||
            (s.studentId && s.studentId.toLowerCase().includes(q)) ||
            (s.phone && s.phone.includes(q))
        )
    })

    // Metrics & Counts
    const totalStudents = students.length
    const presentCount = students.filter(s => attendance[s.id]?.status === 'PRESENT').length
    const absentCount = students.filter(s => attendance[s.id]?.status === 'ABSENT').length
    const lateCount = students.filter(s => attendance[s.id]?.status === 'LATE').length
    const halfDayCount = students.filter(s => attendance[s.id]?.status === 'HALF_DAY').length
    const leaveCount = students.filter(s => attendance[s.id]?.status === 'LEAVE').length
    const presentPercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0
    const activeRate = totalStudents > 0 ? Math.round(((presentCount + lateCount + halfDayCount) / totalStudents) * 100) : 0

    // Selected metadata names
    const activeCourse = courses.find(c => c.id === selectedCourse)
    const activeBatch = batches.find(b => b.id === selectedBatch)
    const availableBatches = batches.filter(b => b.courseId === selectedCourse)

    // Formatted date string
    const formattedDate = new Date(selectedDate).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })

    // Navigation for dates
    const shiftDate = (days: number) => {
        const d = new Date(selectedDate)
        d.setDate(d.getDate() + days)
        setSelectedDate(d.toISOString().split('T')[0])
    }

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '60px' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '26px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📋</span> Student Attendance Management
                    </h1>
                    <p className="page-subtitle" style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                        View class-wise attendance submitted by teachers, track daily records, review detailed class summaries, and export official PDF reports.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={downloadPdfReport}
                        disabled={downloadingPdf || students.length === 0}
                        className="btn btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#818cf8',
                            borderColor: 'rgba(99, 102, 241, 0.3)',
                            fontWeight: '600'
                        }}
                    >
                        {downloadingPdf ? (
                            <>
                                <div className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} />
                                Generating PDF...
                            </>
                        ) : (
                            <>
                                <span>📥</span> Download PDF Report
                            </>
                        )}
                    </button>

                    <button
                        onClick={saveAttendance}
                        disabled={saving || students.length === 0}
                        className="btn btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '700',
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        {saving ? (
                            <>
                                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                Saving...
                            </>
                        ) : (
                            <>
                                <span>💾</span> Save Attendance
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Notification Toast */}
            {toast.show && (
                <div
                    style={{
                        padding: '14px 20px',
                        marginBottom: '20px',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: toast.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${toast.success ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                        color: toast.success ? '#34d399' : '#f87171',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                    }}
                >
                    <span style={{ fontSize: '18px' }}>{toast.success ? '✓' : '⚠️'}</span>
                    <span>{toast.msg}</span>
                </div>
            )}

            {/* Primary Filter Bar: Class (Required) + Section (Optional) + Date + Quick Navigation */}
            <div className="card" style={{ padding: '22px', marginBottom: '22px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                    {/* Class Selector Dropdown */}
                    <div>
                        <label className="label" style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <span>🏫</span> Select Class *
                        </label>
                        <select
                            className="input"
                            value={selectedCourse}
                            onChange={e => {
                                setSelectedCourse(e.target.value)
                                setSelectedBatch('') // reset batch selection on class change
                            }}
                            style={{
                                width: '100%',
                                fontWeight: '600',
                                borderColor: selectedCourse ? '#10b981' : 'var(--border)',
                                background: 'var(--surface-2)'
                            }}
                        >
                            <option value="">-- Choose a Class --</option>
                            {courses.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Section / Batch Selector Dropdown (Optional) */}
                    <div>
                        <label className="label" style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <span>🏷️</span> Section / Batch <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
                        </label>
                        <select
                            className="input"
                            value={selectedBatch}
                            onChange={e => setSelectedBatch(e.target.value)}
                            disabled={!selectedCourse}
                            style={{
                                width: '100%',
                                opacity: !selectedCourse ? 0.6 : 1,
                                background: 'var(--surface-2)'
                            }}
                        >
                            <option value="">-- All Sections / Batches --</option>
                            {availableBatches.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date Selector Calendar */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label className="label" style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                <span>📅</span> Attendance Date
                            </label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                                    style={{
                                        fontSize: '11px',
                                        padding: '2px 7px',
                                        background: 'rgba(99, 102, 241, 0.15)',
                                        border: '1px solid rgba(99, 102, 241, 0.3)',
                                        color: '#a5b4fc',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    onClick={() => shiftDate(-1)}
                                    title="Previous Day"
                                    style={{
                                        fontSize: '11px',
                                        padding: '2px 7px',
                                        background: 'var(--surface-2)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-secondary)',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ◀
                                </button>
                                <button
                                    type="button"
                                    onClick={() => shiftDate(1)}
                                    title="Next Day"
                                    style={{
                                        fontSize: '11px',
                                        padding: '2px 7px',
                                        background: 'var(--surface-2)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-secondary)',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ▶
                                </button>
                            </div>
                        </div>
                        <input
                            type="date"
                            className="input"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            style={{ width: '100%', background: 'var(--surface-2)' }}
                        />
                    </div>

                    {/* Student Search */}
                    <div>
                        <label className="label" style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <span>🔍</span> Search Student
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Filter by name or ID..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            disabled={students.length === 0}
                            style={{ width: '100%', background: 'var(--surface-2)' }}
                        />
                    </div>
                </div>

                {/* Status indicator row */}
                {selectedCourse && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Selected:</span>
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                                {activeCourse?.name || 'Class'}
                            </span>
                            {activeBatch && (
                                <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontSize: '12px', fontWeight: '600' }}>
                                    Section: {activeBatch.name}
                                </span>
                            )}
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            <span style={{ color: '#94a3b8' }}>{formattedDate}</span>
                        </div>

                        <div>
                            {hasExistingRecords ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '12px', fontWeight: '600' }}>
                                    <span>✓</span> Attendance recorded on this date (Synced with Parent Portal)
                                </span>
                            ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '12px', fontWeight: '600' }}>
                                    <span>⚠️</span> Attendance not marked yet for this date. Defaulting to Present.
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* When Class is Selected and Students Exist */}
            {selectedCourse && students.length > 0 && (
                <>
                    {/* Top Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '22px' }}>
                        <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', borderLeft: '4px solid #6366f1' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total Strength</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#6366f1', marginTop: '4px' }}>{totalStudents}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Students enrolled</div>
                        </div>

                        <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', borderLeft: '4px solid #10b981' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Present</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>{presentCount}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{presentPercentage}% of class</div>
                        </div>

                        <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Absent</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#ef4444', marginTop: '4px' }}>{absentCount}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{totalStudents ? Math.round((absentCount / totalStudents) * 100) : 0}% absent</div>
                        </div>

                        <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Late Arrival</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>{lateCount}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Reported late</div>
                        </div>

                        <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', borderLeft: '4px solid #8b5cf6' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Leave / Half-Day</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#8b5cf6', marginTop: '4px' }}>{leaveCount + halfDayCount}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Leave: {leaveCount} | Half: {halfDayCount}</div>
                        </div>

                        <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', borderLeft: '4px solid #06b6d4' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Attendance Rate</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#06b6d4', marginTop: '4px' }}>{activeRate}%</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Total effective attendance</div>
                        </div>
                    </div>

                    {/* Quick Bulk Marking Actions */}
                    <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Quick Mark All As:</span>
                            {statusOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => markAllVisible(opt.value)}
                                    className="btn btn-sm"
                                    style={{
                                        background: opt.bg,
                                        border: `1px solid ${opt.border}`,
                                        color: opt.color,
                                        fontWeight: '700',
                                        fontSize: '12px',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {opt.icon} All {opt.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students
                        </div>
                    </div>

                    {/* Students Attendance Table */}
                    <div className="card" style={{ padding: 0, marginBottom: '28px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div className="table-container" style={{ margin: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '14px 16px', textAlign: 'left', width: '50px' }}>#</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Scholar / Roll No</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Student Name</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Section / Batch</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left', minWidth: '130px' }}>Status</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left' }}>Mark Attendance</th>
                                        <th style={{ padding: '14px 16px', textAlign: 'left', width: '220px' }}>Remarks / Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((student, idx) => {
                                        const curStatus = attendance[student.id]?.status || 'PRESENT'
                                        const curNotes = attendance[student.id]?.notes || ''
                                        const statusConf = statusOptions.find(o => o.value === curStatus) || statusOptions[0]

                                        return (
                                            <tr key={student.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}>
                                                <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                                    {idx + 1}
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.1)', padding: '3px 8px', borderRadius: '6px' }}>
                                                        {student.scholarNo || student.studentId || '—'}
                                                    </span>
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div
                                                            className="avatar"
                                                            style={{
                                                                width: '34px',
                                                                height: '34px',
                                                                borderRadius: '50%',
                                                                fontSize: '13px',
                                                                fontWeight: '700',
                                                                background: `${statusConf.color}25`,
                                                                color: statusConf.color,
                                                                border: `1px solid ${statusConf.color}40`,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            {student.fullName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                                                                {student.fullName}
                                                            </div>
                                                            {student.phone && (
                                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                    📞 {student.phone}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                    {student.batchName || (batches.find(b => b.id === student.batchId)?.name) || 'General'}
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                    <span
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            padding: '5px 10px',
                                                            borderRadius: '8px',
                                                            fontSize: '12px',
                                                            fontWeight: '800',
                                                            background: statusConf.bg,
                                                            color: statusConf.color,
                                                            border: `1px solid ${statusConf.border}`
                                                        }}
                                                    >
                                                        <span>{statusConf.icon}</span>
                                                        <span>{statusConf.label}</span>
                                                    </span>
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                        {statusOptions.map(opt => {
                                                            const isSelected = curStatus === opt.value
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={() => setStudentStatus(student.id, opt.value)}
                                                                    style={{
                                                                        padding: '5px 10px',
                                                                        borderRadius: '7px',
                                                                        fontSize: '11px',
                                                                        fontWeight: '700',
                                                                        cursor: 'pointer',
                                                                        border: `1px solid ${isSelected ? opt.color : 'var(--border)'}`,
                                                                        background: isSelected ? opt.color : 'transparent',
                                                                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                                                                        boxShadow: isSelected ? `0 2px 8px ${opt.color}40` : 'none',
                                                                        transition: 'all 0.12s ease'
                                                                    }}
                                                                >
                                                                    {opt.shortLabel}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Add remark..."
                                                        value={curNotes}
                                                        onChange={e => setStudentNote(student.id, e.target.value)}
                                                        className="input"
                                                        style={{
                                                            padding: '6px 10px',
                                                            fontSize: '12px',
                                                            width: '100%',
                                                            background: 'var(--surface-2)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '6px'
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Class Attendance Summary at the Bottom */}
                    <div
                        className="card"
                        style={{
                            padding: '24px',
                            marginBottom: '24px',
                            background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>📊</span> Class Attendance Summary
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {activeCourse?.name} {activeBatch ? `(Section: ${activeBatch.name})` : ''} • {formattedDate}
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={saveAttendance}
                                    disabled={saving}
                                    className="btn btn-primary btn-sm"
                                    style={{
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        color: '#fff',
                                        fontWeight: '700',
                                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                                    }}
                                >
                                    {saving ? 'Saving...' : '💾 Save Changes'}
                                </button>
                                <button
                                    onClick={downloadPdfReport}
                                    disabled={downloadingPdf}
                                    className="btn btn-secondary btn-sm"
                                    style={{ borderColor: 'rgba(99, 102, 241, 0.3)', color: '#818cf8' }}
                                >
                                    📥 Download PDF
                                </button>
                            </div>
                        </div>

                        {/* Visual Breakdown Progress Bar */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                <span>Attendance Distribution</span>
                                <span>{presentPercentage}% Present</span>
                            </div>
                            <div style={{ height: '12px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                                {totalStudents > 0 && (
                                    <>
                                        <div style={{ width: `${(presentCount / totalStudents) * 100}%`, background: '#10b981' }} title={`Present: ${presentCount}`} />
                                        <div style={{ width: `${(lateCount / totalStudents) * 100}%`, background: '#f59e0b' }} title={`Late: ${lateCount}`} />
                                        <div style={{ width: `${(halfDayCount / totalStudents) * 100}%`, background: '#06b6d4' }} title={`Half Day: ${halfDayCount}`} />
                                        <div style={{ width: `${(leaveCount / totalStudents) * 100}%`, background: '#8b5cf6' }} title={`Leave: ${leaveCount}`} />
                                        <div style={{ width: `${(absentCount / totalStudents) * 100}%`, background: '#ef4444' }} title={`Absent: ${absentCount}`} />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Detailed Count Chips */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ padding: '12px', background: 'var(--surface-3)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>PRESENT</div>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: '#10b981' }}>{presentCount}</div>
                                <div style={{ fontSize: '11px', color: '#10b981' }}>{totalStudents ? Math.round((presentCount / totalStudents) * 100) : 0}%</div>
                            </div>

                            <div style={{ padding: '12px', background: 'var(--surface-3)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ABSENT</div>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: '#ef4444' }}>{absentCount}</div>
                                <div style={{ fontSize: '11px', color: '#ef4444' }}>{totalStudents ? Math.round((absentCount / totalStudents) * 100) : 0}%</div>
                            </div>

                            <div style={{ padding: '12px', background: 'var(--surface-3)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>LATE</div>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: '#f59e0b' }}>{lateCount}</div>
                                <div style={{ fontSize: '11px', color: '#f59e0b' }}>{totalStudents ? Math.round((lateCount / totalStudents) * 100) : 0}%</div>
                            </div>

                            <div style={{ padding: '12px', background: 'var(--surface-3)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>HALF DAY</div>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: '#06b6d4' }}>{halfDayCount}</div>
                                <div style={{ fontSize: '11px', color: '#06b6d4' }}>{totalStudents ? Math.round((halfDayCount / totalStudents) * 100) : 0}%</div>
                            </div>

                            <div style={{ padding: '12px', background: 'var(--surface-3)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ON LEAVE</div>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: '#8b5cf6' }}>{leaveCount}</div>
                                <div style={{ fontSize: '11px', color: '#8b5cf6' }}>{totalStudents ? Math.round((leaveCount / totalStudents) * 100) : 0}%</div>
                            </div>

                            <div style={{ padding: '12px', background: 'var(--surface-3)', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL CLASS</div>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: '#818cf8' }}>{totalStudents}</div>
                                <div style={{ fontSize: '11px', color: '#818cf8' }}>100%</div>
                            </div>
                        </div>

                        {/* List of Absent Students (Quick Glance for Admin) */}
                        {absentCount > 0 && (
                            <div style={{ padding: '14px 18px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px' }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#f87171', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>⚠️</span> Absent Students Today ({absentCount}):
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {students.filter(s => attendance[s.id]?.status === 'ABSENT').map(s => (
                                        <span
                                            key={s.id}
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#fca5a5',
                                                fontSize: '12px',
                                                fontWeight: '600'
                                            }}
                                        >
                                            {s.fullName} {s.scholarNo ? `(${s.scholarNo})` : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Empty State: Selected Class has no students */}
            {selectedCourse && students.length === 0 && !loadingData && (
                <div className="card" style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👩‍🎓</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                        No Students Found in this Class
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
                        There are currently no active students assigned to {activeCourse?.name || 'this class'}. You can add students via the Student Management section.
                    </p>
                </div>
            )}

            {/* Empty State: No Class Selected */}
            {!selectedCourse && !loadingMetadata && (
                <div className="card" style={{ textAlign: 'center', padding: '70px 20px', border: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: '52px', marginBottom: '16px' }}>🏫</div>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Please Select a Class Above
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '450px', margin: '0 auto' }}>
                        Choose a class from the dropdown selector to view teacher-submitted attendance records, review the daily summary, and download official PDF reports.
                    </p>
                </div>
            )}

            {/* Loading Indicator */}
            {(loadingMetadata || loadingData) && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 12px auto' }} />
                    <p style={{ fontSize: '14px' }}>Loading class attendance records...</p>
                </div>
            )}

            {/* =========================================================================
                OFFICIAL PDF ATTENDANCE REPORT TEMPLATE (Rendered offscreen for html2pdf)
                ========================================================================= */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div
                    ref={pdfRef}
                    id="attendance-pdf-template"
                    style={{
                        width: '210mm',
                        minHeight: '297mm',
                        padding: '12mm 14mm',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                        boxSizing: 'border-box'
                    }}
                >
                    {/* School Header */}
                    <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {schoolProfile?.logo && (
                                <img
                                    src={schoolProfile.logo}
                                    alt="School Logo"
                                    style={{ width: '56px', height: '56px', objectFit: 'contain' }}
                                />
                            )}
                            <div>
                                <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {schoolProfile?.name || 'School ERP'}
                                </h1>
                                <p style={{ fontSize: '11px', margin: '2px 0 0 0', color: '#475569' }}>
                                    {schoolProfile?.address || 'School Campus Address'}
                                </p>
                                <p style={{ fontSize: '10px', margin: '2px 0 0 0', color: '#64748b' }}>
                                    {schoolProfile?.phone ? `Phone: ${schoolProfile.phone}` : ''} {schoolProfile?.email ? ` | Email: ${schoolProfile.email}` : ''} {schoolProfile?.diseCode ? ` | DISE: ${schoolProfile.diseCode}` : ''}
                                </p>
                            </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                DAILY ATTENDANCE REPORT
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                                Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    {/* Metadata Header Box */}
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '11px' }}>
                        <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Class</span>
                            <strong style={{ color: '#0f172a', fontSize: '13px' }}>{activeCourse?.name || 'N/A'}</strong>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Section / Batch</span>
                            <strong style={{ color: '#0f172a', fontSize: '13px' }}>{activeBatch?.name || 'All Sections'}</strong>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Attendance Date</span>
                            <strong style={{ color: '#0f172a', fontSize: '13px' }}>{formattedDate}</strong>
                        </div>
                        <div>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Attendance Rate</span>
                            <strong style={{ color: '#10b981', fontSize: '13px' }}>{presentPercentage}% ({presentCount}/{totalStudents})</strong>
                        </div>
                    </div>

                    {/* Numerical Summary Row in PDF */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '14px' }}>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px', textAlign: 'center', background: '#f1f5f9' }}>
                            <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold' }}>TOTAL</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>{totalStudents}</div>
                        </div>
                        <div style={{ border: '1px solid #bbf7d0', borderRadius: '4px', padding: '6px', textAlign: 'center', background: '#f0fdf4' }}>
                            <div style={{ fontSize: '9px', color: '#16a34a', fontWeight: 'bold' }}>PRESENT</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#16a34a' }}>{presentCount}</div>
                        </div>
                        <div style={{ border: '1px solid #fecaca', borderRadius: '4px', padding: '6px', textAlign: 'center', background: '#fef2f2' }}>
                            <div style={{ fontSize: '9px', color: '#dc2626', fontWeight: 'bold' }}>ABSENT</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#dc2626' }}>{absentCount}</div>
                        </div>
                        <div style={{ border: '1px solid #fed7aa', borderRadius: '4px', padding: '6px', textAlign: 'center', background: '#fffbeb' }}>
                            <div style={{ fontSize: '9px', color: '#d97706', fontWeight: 'bold' }}>LATE</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#d97706' }}>{lateCount}</div>
                        </div>
                        <div style={{ border: '1px solid #cffafe', borderRadius: '4px', padding: '6px', textAlign: 'center', background: '#ecfeff' }}>
                            <div style={{ fontSize: '9px', color: '#0891b2', fontWeight: 'bold' }}>HALF DAY</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0891b2' }}>{halfDayCount}</div>
                        </div>
                        <div style={{ border: '1px solid #e9d5ff', borderRadius: '4px', padding: '6px', textAlign: 'center', background: '#faf5ff' }}>
                            <div style={{ fontSize: '9px', color: '#9333ea', fontWeight: 'bold' }}>LEAVE</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#9333ea' }}>{leaveCount}</div>
                        </div>
                    </div>

                    {/* Table of Students */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                        <thead>
                            <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                                <th style={{ padding: '6px 8px', border: '1px solid #0f172a', width: '28px', textAlign: 'center' }}>#</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #0f172a', textAlign: 'left', width: '70px' }}>Scholar No</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #0f172a', textAlign: 'left' }}>Student Name</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #0f172a', textAlign: 'left', width: '75px' }}>Section</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #0f172a', textAlign: 'center', width: '80px' }}>Status</th>
                                <th style={{ padding: '6px 8px', border: '1px solid #0f172a', textAlign: 'left' }}>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((stu, i) => {
                                const st = attendance[stu.id]?.status || 'PRESENT'
                                const nt = attendance[stu.id]?.notes || ''
                                const isAbs = st === 'ABSENT'
                                const isLate = st === 'LATE'
                                const isLv = st === 'LEAVE' || st === 'HALF_DAY'

                                const statusColor = isAbs ? '#dc2626' : isLate ? '#d97706' : isLv ? '#9333ea' : '#16a34a'
                                const statusBg = isAbs ? '#fef2f2' : isLate ? '#fffbeb' : isLv ? '#faf5ff' : '#f0fdf4'

                                return (
                                    <tr key={stu.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                        <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                                            {i + 1}
                                        </td>
                                        <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', fontWeight: 'bold', fontFamily: 'monospace' }}>
                                            {stu.scholarNo || stu.studentId || '—'}
                                        </td>
                                        <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', fontWeight: '600', color: '#0f172a' }}>
                                            {stu.fullName}
                                        </td>
                                        <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', color: '#475569' }}>
                                            {stu.batchName || (batches.find(b => b.id === stu.batchId)?.name) || 'General'}
                                        </td>
                                        <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold', color: statusColor, background: statusBg }}>
                                            {st}
                                        </td>
                                        <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', color: '#64748b', fontSize: '9.5px' }}>
                                            {nt || '—'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    {/* PDF Footer / Signatures */}
                    <div style={{ marginTop: '28px', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11px', color: '#334155' }}>
                        <div style={{ textAlign: 'center', width: '150px' }}>
                            <div style={{ borderBottom: '1px dashed #64748b', height: '35px', marginBottom: '6px' }} />
                            <strong>Class Teacher</strong>
                        </div>
                        <div style={{ textAlign: 'center', width: '150px' }}>
                            <div style={{ borderBottom: '1px dashed #64748b', height: '35px', marginBottom: '6px' }} />
                            <strong>Attendance In-Charge</strong>
                        </div>
                        <div style={{ textAlign: 'center', width: '150px' }}>
                            {schoolProfile?.directorSign ? (
                                <img src={schoolProfile.directorSign} alt="Signature" style={{ height: '35px', objectFit: 'contain', marginBottom: '4px' }} />
                            ) : (
                                <div style={{ borderBottom: '1px dashed #64748b', height: '35px', marginBottom: '6px' }} />
                            )}
                            <strong>Principal / Super Admin</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
