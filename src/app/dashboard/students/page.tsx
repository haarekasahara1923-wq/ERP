'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import Script from 'next/script'
import { formatDate, formatCurrency } from '@/lib/utils'
import { downloadCSV, downloadExcel, generateAndPrintPDF } from '@/lib/reportExport'

interface CourseOption {
    id: string
    name: string
}

interface BatchOption {
    id: string
    name: string
    courseId: string
}

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
    parentEmail?: string
    parentPassword?: string
    examResults?: any[]
    courseSubjects?: string[]
    scholarNo?: string
    caste?: string
    dobInWords?: string
    medium?: string
    firstAdmissionClass?: string
    firstAdmissionDate?: string
    scholarshipScheme?: string
    bankName?: string
    bankAccountNo?: string
    ifsc?: string
    dob?: string
    address?: string
    motherName?: string
    hasSiblings?: boolean
}

interface SiblingStudent {
    siblingLinkId: string
    id: string
    fullName: string
    scholarNo?: string
    phone: string
    courseName: string
    batchName: string
    totalFee: number
    paidFee: number
    status: string
}

const statusColors: Record<string, string> = {
    ACTIVE: 'badge-success',
    INACTIVE: 'badge-gray',
    DROPOUT: 'badge-danger',
    PASSED: 'badge-info',
}

export default function StudentsPage() {
    const { token, user, tenant, handleUnauthorized } = useAuth()
    const canEditOrDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'COACHING_ADMIN'
    const [students, setStudents] = useState<Student[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState<any>({})
    const [actionLoading, setActionLoading] = useState(false)

    // Selection & Filter states
    const [filterMode, setFilterMode] = useState<'classwise' | 'name' | 'scholarNo' | 'all'>('classwise')
    const [courses, setCourses] = useState<CourseOption[]>([])
    const [batches, setBatches] = useState<BatchOption[]>([])
    const [selectedCourseId, setSelectedCourseId] = useState<string>('')
    const [selectedBatchId, setSelectedBatchId] = useState<string>('')
    const [allStudentNames, setAllStudentNames] = useState<string[]>([])
    const [allScholarNos, setAllScholarNos] = useState<string[]>([])

    // Sibling states
    const [showSiblingModal, setShowSiblingModal] = useState(false)
    const [siblingSearch, setSiblingSearch] = useState('')
    const [siblingSearchResults, setSiblingSearchResults] = useState<Student[]>([])
    const [siblingSearchLoading, setSiblingSearchLoading] = useState(false)
    const [currentSiblings, setCurrentSiblings] = useState<SiblingStudent[]>([])
    const [siblingsLoading, setSiblingsLoading] = useState(false)
    const [addingSibling, setAddingSibling] = useState(false)

    // Fetch courses and batches for dropdowns
    useEffect(() => {
        if (!token) return
        Promise.all([
            fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
            fetch('/api/batches', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
        ]).then(([c, b]) => {
            if (c?.success) setCourses(c.data || [])
            if (b?.success) setBatches(b.data || [])
        }).catch(err => console.error('Error fetching courses/batches', err))
    }, [token])

    const availableBatches = useMemo(() => {
        if (!selectedCourseId) return []
        return batches.filter(b => b.courseId === selectedCourseId)
    }, [batches, selectedCourseId])

    const fetchStudents = useCallback(async () => {
        if (!token) return
        setLoading(true)
        const params = new URLSearchParams()
        
        if (filterMode === 'classwise') {
            if (selectedCourseId) params.set('courseId', selectedCourseId)
            if (selectedBatchId) params.set('batchId', selectedBatchId)
            if (search.trim()) params.set('search', search.trim())
        } else if (filterMode === 'name') {
            if (search.trim()) {
                params.set('search', search.trim())
                params.set('searchBy', 'name')
            }
        } else if (filterMode === 'scholarNo') {
            if (search.trim()) {
                params.set('search', search.trim())
                params.set('searchBy', 'scholarNo')
            }
        } else {
            if (search.trim()) params.set('search', search.trim())
        }

        try {
            const res = await fetch(`/api/students?${params}`, { headers: { Authorization: `Bearer ${token}` } })
            const data = await res.json()
            if (data.success) {
                // Fetch sibling counts to flag students that have siblings
                const siblingRes = await fetch('/api/students/siblings/counts', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
                const siblingData = siblingRes ? await siblingRes.json().catch(() => null) : null
                const siblingSet: Set<string> = new Set(siblingData?.success ? siblingData.data : [])
                const mapped = data.data.map((s: Student) => ({ ...s, hasSiblings: siblingSet.has(s.id) }))
                setStudents(mapped)

                // Store unique student names and scholar numbers for autocomplete datalists
                if (!search && !selectedCourseId) {
                    const names = Array.from(new Set(mapped.map((s: Student) => s.fullName).filter(Boolean))) as string[]
                    const scholars = Array.from(new Set(mapped.map((s: Student) => s.scholarNo || s.studentId).filter(Boolean))) as string[]
                    setAllStudentNames(names)
                    setAllScholarNos(scholars)
                }
            }
        } catch (err) {
            console.error('Failed to fetch students', err)
        }
        setLoading(false)
    }, [token, filterMode, selectedCourseId, selectedBatchId, search])

    // Download / Export helpers
    const getExportContext = () => {
        const curCourse = courses.find(c => c.id === selectedCourseId)
        const curBatch = batches.find(b => b.id === selectedBatchId)
        
        let label = 'All Students'
        if (filterMode === 'classwise') {
            if (curCourse && curBatch) label = `${curCourse.name} - ${curBatch.name}`
            else if (curCourse) label = `${curCourse.name} (All Batches)`
            else label = 'All Classes'
        } else if (filterMode === 'name') {
            label = search ? `Student Name (${search})` : 'Student Name Filter'
        } else if (filterMode === 'scholarNo') {
            label = search ? `Scholar No (${search})` : 'Scholar No Filter'
        }

        const dateStr = new Date().toISOString().split('T')[0]
        const cleanLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_')
        return { label, filename: `Students_${cleanLabel}_${dateStr}` }
    }

    const handleDownloadCSV = () => {
        if (students.length === 0) {
            alert('No students found to download.')
            return
        }
        const { label, filename } = getExportContext()
        const rows: (string | number)[][] = [
            [`${(tenant?.name || 'UNIVERSAL DAY BOARDING ACADEMY').toUpperCase()} - STUDENT LIST`],
            [`Category / Filter: ${label}`],
            [`Generated On: ${new Date().toLocaleString('en-IN')}`],
            [`Total Students: ${students.length}`],
            [''],
            [
                'S.No.',
                'Scholar No.',
                'Student ID',
                'Student Name',
                'Class / Course',
                'Section / Batch',
                "Father's Name",
                'Student Phone',
                'Parent Phone',
                'Admission Date',
                'Total Fee (INR)',
                'Paid Fee (INR)',
                'Due Fee (INR)',
                'Status'
            ]
        ]

        students.forEach((s, idx) => {
            const due = Math.max(0, (s.totalFee || 0) - (s.paidFee || 0))
            rows.push([
                idx + 1,
                s.scholarNo || '-',
                s.studentId || '-',
                s.fullName,
                s.courseName || '-',
                s.batchName || '-',
                s.fatherName || '-',
                s.phone || '-',
                s.parentPhone || '-',
                s.admissionDate ? formatDate(s.admissionDate) : '-',
                s.totalFee || 0,
                s.paidFee || 0,
                due,
                s.status || 'ACTIVE'
            ])
        })

        downloadCSV(`${filename}.csv`, rows)
    }

    const handleDownloadExcel = () => {
        if (students.length === 0) {
            alert('No students found to download.')
            return
        }
        const { label, filename } = getExportContext()
        const totalFees = students.reduce((sum, s) => sum + (s.totalFee || 0), 0)
        const totalPaid = students.reduce((sum, s) => sum + (s.paidFee || 0), 0)
        const totalDue = Math.max(0, totalFees - totalPaid)

        downloadExcel(filename, [
            {
                title: `${tenant?.name || 'School ERP'} - Student Directory`,
                headerLines: [
                    `Class / Filter: ${label}`,
                    `Generated On: ${new Date().toLocaleString('en-IN')}`,
                    `Total Students Count: ${students.length}`
                ],
                headers: [
                    'S.No.',
                    'Scholar No.',
                    'Student ID',
                    'Student Name',
                    'Class',
                    'Section / Batch',
                    "Father's Name",
                    'Student Phone',
                    'Parent Phone',
                    'Admission Date',
                    'Total Fee (₹)',
                    'Paid Fee (₹)',
                    'Due Fee (₹)',
                    'Status'
                ],
                rows: students.map((s, idx) => [
                    idx + 1,
                    s.scholarNo || '-',
                    s.studentId || '-',
                    s.fullName,
                    s.courseName || '-',
                    s.batchName || '-',
                    s.fatherName || '-',
                    s.phone || '-',
                    s.parentPhone || '-',
                    s.admissionDate ? formatDate(s.admissionDate) : '-',
                    s.totalFee || 0,
                    s.paidFee || 0,
                    Math.max(0, (s.totalFee || 0) - (s.paidFee || 0)),
                    s.status || 'ACTIVE'
                ]),
                footer: [
                    'Total',
                    '',
                    '',
                    `${students.length} Students`,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    totalFees,
                    totalPaid,
                    totalDue,
                    ''
                ]
            }
        ])
    }

    const handleDownloadPDF = () => {
        if (students.length === 0) {
            alert('No students found to download.')
            return
        }
        const { label } = getExportContext()
        const totalFees = students.reduce((sum, s) => sum + (s.totalFee || 0), 0)
        const totalPaid = students.reduce((sum, s) => sum + (s.paidFee || 0), 0)
        const totalDue = Math.max(0, totalFees - totalPaid)
        const activeCount = students.filter(s => s.status === 'ACTIVE').length

        generateAndPrintPDF({
            title: `Student Roster • ${label}`,
            subtitle: `Official Enrollment & Class Directory (${students.length} Students)`,
            schoolName: tenant?.name || 'Universal Day Boarding Academy',
            schoolAddress: tenant?.address || '📍 Official Institution Student Registry',
            schoolLogo: tenant?.logo || '',
            schoolCode: tenant?.registrationCode || tenant?.schoolCode || '',
            diseCode: tenant?.diseCode || '',
            stats: [
                { label: 'Total Students', value: students.length, subtext: `${activeCount} Active`, color: '#6366f1' },
                { label: 'Total Billed', value: `₹${totalFees.toLocaleString('en-IN')}`, subtext: 'Course Fees', color: '#10b981' },
                { label: 'Total Collected', value: `₹${totalPaid.toLocaleString('en-IN')}`, subtext: 'Received Amount', color: '#10b981' },
                { label: 'Pending Dues', value: `₹${totalDue.toLocaleString('en-IN')}`, subtext: 'Outstanding Fees', color: '#ef4444' }
            ],
            tables: [
                {
                    title: `Students List - ${label}`,
                    headers: [
                        'S.No.',
                        'Scholar No.',
                        'Student Name',
                        'Class / Section',
                        "Father's Name",
                        'Phone',
                        'Admission',
                        'Total Fee',
                        'Paid Fee',
                        'Due Fee',
                        'Status'
                    ],
                    rows: students.map((s, idx) => [
                        idx + 1,
                        s.scholarNo || s.studentId || '-',
                        s.fullName,
                        `${s.courseName || '-'} / ${s.batchName || '-'}`,
                        s.fatherName || '-',
                        s.phone || '-',
                        s.admissionDate ? formatDate(s.admissionDate) : '-',
                        `₹${(s.totalFee || 0).toLocaleString('en-IN')}`,
                        `₹${(s.paidFee || 0).toLocaleString('en-IN')}`,
                        `₹${Math.max(0, (s.totalFee || 0) - (s.paidFee || 0)).toLocaleString('en-IN')}`,
                        s.status || 'ACTIVE'
                    ])
                }
            ],
            notes: `This is an official computer-generated student record for ${label}. Generated on ${new Date().toLocaleString('en-IN')}.`
        })
    }

    const downloadPDF = (elementId: string, title: string) => {
        const original = document.getElementById(elementId)
        if (!original) return

        const clone = original.cloneNode(true) as HTMLElement
        clone.style.background = '#ffffff'
        clone.style.color = '#000000'
        clone.style.width = '210mm'
        clone.style.padding = '20mm'
        clone.style.boxSizing = 'border-box'

        const ths = clone.querySelectorAll('th')
        ths.forEach(th => {
          th.style.background = '#f1f5f9'
          th.style.color = '#000000'
          th.style.borderColor = '#000000'
        })
        const tds = clone.querySelectorAll('td')
        tds.forEach(td => {
          if (td.style.color !== 'rgb(16, 185, 129)' && td.style.color !== '#10b981') td.style.color = '#000000'
          td.style.borderColor = '#000000'
        })
        
        const allEls = clone.querySelectorAll('*')
        allEls.forEach((el: any) => {
            const color = el.style.color
            if (color === 'white' || color === 'rgb(255, 255, 255)' || color === '#94a3b8' || color === 'rgb(148, 163, 184)' || color === '#cbd5e1') el.style.color = '#000000'
            if (el.style.borderTopColor === '#334155' || el.style.borderTopColor === 'rgb(51, 65, 85)') el.style.borderTopColor = '#000000'
            if (el.style.borderBottomColor === '#334155' || el.style.borderBottomColor === 'rgb(51, 65, 85)') el.style.borderBottomColor = '#000000'
        })

        const wrapper = document.createElement('div')
        wrapper.style.position = 'absolute'
        wrapper.style.left = '-9999px'
        wrapper.style.top = '0'
        wrapper.appendChild(clone)
        document.body.appendChild(wrapper)

        const opt = {
          margin: 0,
          filename: `${title.replace(/\s+/g, '_')}_Report_Card.pdf`,
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }
        
        // @ts-ignore
        window.html2pdf().set(opt).from(clone).save().then(() => document.body.removeChild(wrapper)).catch(() => document.body.removeChild(wrapper))
    }

    const fetchSiblingsForStudent = async (studentId: string) => {
        setSiblingsLoading(true)
        try {
            const res = await fetch(`/api/students/siblings?studentId=${studentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) setCurrentSiblings(data.data)
        } catch (e) {}
        setSiblingsLoading(false)
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
            if (res.status === 401 || data?.error === 'Unauthorized') { handleUnauthorized(); return }
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
            if (res.status === 401 || data?.error === 'Unauthorized') { handleUnauthorized(); return }
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

    const searchSiblings = async () => {
        if (!siblingSearch.trim()) return
        setSiblingSearchLoading(true)
        try {
            const res = await fetch(`/api/students?search=${encodeURIComponent(siblingSearch)}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                // Exclude the current student and already-added siblings
                const siblingIds = new Set(currentSiblings.map(s => s.id))
                siblingIds.add(selectedStudent!.id)
                setSiblingSearchResults(data.data.filter((s: Student) => !siblingIds.has(s.id)))
            }
        } catch (e) {}
        setSiblingSearchLoading(false)
    }

    const handleAddSibling = async (siblingId: string) => {
        if (addingSibling) return
        setAddingSibling(true)
        try {
            const res = await fetch('/api/students/siblings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ studentId: selectedStudent!.id, siblingId })
            })
            const data = await res.json()
            if (data.success) {
                alert('Sibling added successfully!')
                setSiblingSearch('')
                setSiblingSearchResults([])
                await fetchSiblingsForStudent(selectedStudent!.id)
                await fetchStudents()
            } else {
                alert(data.error || 'Failed to add sibling')
            }
        } catch (e) {
            alert('Error adding sibling')
        }
        setAddingSibling(false)
    }

    const handleRemoveSibling = async (linkId: string) => {
        if (!confirm('Remove this sibling link?')) return
        try {
            const res = await fetch(`/api/students/siblings?linkId=${linkId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                await fetchSiblingsForStudent(selectedStudent!.id)
                await fetchStudents()
            } else {
                alert(data.error || 'Failed to remove sibling')
            }
        } catch (e) {
            alert('Error removing sibling')
        }
    }

    useEffect(() => {
        fetchStudents()
    }, [fetchStudents])

    return (
        <div>
            <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" />
            <div className="page-header">
                <div>
                    <h1 className="page-title">👨‍🎓 Students</h1>
                    <p className="page-subtitle">
                        {selectedCourseId ? (
                            <>
                                Filtered: <strong>{courses.find(c => c.id === selectedCourseId)?.name}</strong>
                                {selectedBatchId && <> ({batches.find(b => b.id === selectedBatchId)?.name})</>} • {students.length} students found
                            </>
                        ) : (
                            <>{students.length} students registered</>
                        )}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={students.length === 0}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                        title="Download / Print PDF"
                    >
                        📄 PDF
                    </button>
                    <button
                        onClick={handleDownloadExcel}
                        disabled={students.length === 0}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                        title="Download Excel spreadsheet"
                    >
                        📊 Excel
                    </button>
                    <button
                        onClick={handleDownloadCSV}
                        disabled={students.length === 0}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                        title="Download CSV"
                    >
                        📑 CSV
                    </button>
                    <Link href="/dashboard/students/add" className="btn btn-primary">➕ Add Student</Link>
                </div>
            </div>

            {/* Selection & Filter Bar */}
            <div className="card" style={{ marginBottom: '20px', padding: '18px', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Top Mode Selector Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                🎯 Selection Mode:
                            </span>
                            <select
                                className="input"
                                value={filterMode}
                                onChange={e => {
                                    const mode = e.target.value as any
                                    setFilterMode(mode)
                                    setSearch('')
                                    if (mode !== 'classwise') {
                                        setSelectedCourseId('')
                                        setSelectedBatchId('')
                                    }
                                }}
                                style={{ minWidth: '220px', fontWeight: '600', borderColor: 'var(--primary)', cursor: 'pointer', background: 'var(--surface-2)' }}
                            >
                                <option value="classwise">🏫 Classwise Selection (कक्षा एवं बैच)</option>
                                <option value="name">👤 Student Name (विद्यार्थी नाम)</option>
                                <option value="scholarNo">🪪 Scholar No. (स्कॉलर नंबर)</option>
                                <option value="all">🌐 All Students (सभी विद्यार्थी)</option>
                            </select>
                        </div>

                        {/* Reset Filter Button */}
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                                setSearch('')
                                setSelectedCourseId('')
                                setSelectedBatchId('')
                                fetchStudents()
                            }}
                            title="Reset all filters and view all students"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            🔄 Reset All
                        </button>
                    </div>

                    {/* Mode: Classwise Selection */}
                    {filterMode === 'classwise' && (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            {/* Class Dropdown */}
                            <div style={{ flex: '1 1 240px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                                    🏫 Select Class / Course <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <select
                                    className="input"
                                    value={selectedCourseId}
                                    onChange={e => {
                                        setSelectedCourseId(e.target.value)
                                        setSelectedBatchId('')
                                    }}
                                    style={{ width: '100%', fontWeight: '600' }}
                                >
                                    <option value="">-- All Added Classes --</option>
                                    {courses.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Batch / Section Dropdown */}
                            <div style={{ flex: '1 1 240px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                                    👥 Select Batch / Section (Optional)
                                </label>
                                <select
                                    className="input"
                                    value={selectedBatchId}
                                    onChange={e => setSelectedBatchId(e.target.value)}
                                    disabled={!selectedCourseId}
                                    style={{ width: '100%', opacity: selectedCourseId ? 1 : 0.6 }}
                                >
                                    <option value="">
                                        {!selectedCourseId 
                                            ? '-- Select class first --' 
                                            : availableBatches.length === 0 
                                                ? '-- No batches added for this class --' 
                                                : '-- All Batches / Sections --'}
                                    </option>
                                    {availableBatches.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Search inside selected class */}
                            <div style={{ flex: '1 1 200px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    🔍 Search in Class
                                </label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input
                                        className="input"
                                        placeholder="Name or scholar no..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && fetchStudents()}
                                        style={{ flex: 1 }}
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setSearch('')}
                                            title="Clear search text"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mode: Student Name Search */}
                    {filterMode === 'name' && (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div style={{ flex: 1, minWidth: '280px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                                    👤 Enter or Select Student Name
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        className="input"
                                        list="student-names-suggestions"
                                        placeholder="Type or click dropdown arrow to select student by name..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && fetchStudents()}
                                        style={{ flex: 1 }}
                                        autoFocus
                                    />
                                    <datalist id="student-names-suggestions">
                                        {allStudentNames.map(name => (
                                            <option key={name} value={name} />
                                        ))}
                                    </datalist>
                                    <button className="btn btn-primary" onClick={fetchStudents} style={{ whiteSpace: 'nowrap' }}>
                                        🔍 Search
                                    </button>
                                    {search && (
                                        <button className="btn btn-secondary" onClick={() => setSearch('')}>
                                            ✕ Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mode: Scholar No Search */}
                    {filterMode === 'scholarNo' && (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div style={{ flex: 1, minWidth: '280px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                                    🪪 Enter or Select Scholar No. / ID
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        className="input"
                                        list="student-scholars-suggestions"
                                        placeholder="Type or click dropdown arrow to select Scholar No. / ID..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && fetchStudents()}
                                        style={{ flex: 1 }}
                                        autoFocus
                                    />
                                    <datalist id="student-scholars-suggestions">
                                        {allScholarNos.map(s => (
                                            <option key={s} value={s} />
                                        ))}
                                    </datalist>
                                    <button className="btn btn-primary" onClick={fetchStudents} style={{ whiteSpace: 'nowrap' }}>
                                        🔍 Search
                                    </button>
                                    {search && (
                                        <button className="btn btn-secondary" onClick={() => setSearch('')}>
                                            ✕ Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mode: All Students Search */}
                    {filterMode === 'all' && (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div style={{ flex: 1, minWidth: '280px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '5px' }}>
                                    🔍 Search Across Name, Scholar No, Phone or Student ID
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        className="input"
                                        placeholder="Search by name, scholar no, phone or ID..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && fetchStudents()}
                                        style={{ flex: 1 }}
                                    />
                                    <button className="btn btn-primary" onClick={fetchStudents} style={{ whiteSpace: 'nowrap' }}>
                                        🔍 Search
                                    </button>
                                    {search && (
                                        <button className="btn btn-secondary" onClick={() => setSearch('')}>
                                            ✕ Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
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
                                    <th>Parent Login</th>
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
                                                        <div style={{ fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {s.fullName}
                                                            {s.hasSiblings && (
                                                                <span title="Has siblings" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '11px', fontWeight: '800', cursor: 'default' }}>+</span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                            {s.scholarNo ? `#${s.scholarNo}` : s.studentId}
                                                        </div>
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
                                                {s.parentEmail ? (
                                                    <div style={{ fontSize: '12px' }}>
                                                        <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{s.parentEmail}</div>
                                                        <div style={{ color: 'var(--text-muted)' }}>Pass: {s.parentPassword || '***'}</div>
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Not linked</div>
                                                )}
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
                                                            <button onClick={() => { setSelectedStudent(s); setEditForm(s); setIsEditing(true); fetchSiblingsForStudent(s.id); }} className="btn btn-secondary btn-sm" title="Edit">✏️</button>
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

            {/* Download & Export Section (Below the Student List) */}
            <div
                className="card"
                style={{
                    marginTop: '20px',
                    padding: '20px 24px',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(16, 185, 129, 0.05))',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
                }}
            >
                <div style={{ minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '20px' }}>📥</span>
                        <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                            Download & Export Student List
                        </h3>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                        {selectedCourseId ? (
                            <>
                                Active Class: <strong style={{ color: 'var(--primary)' }}>{courses.find(c => c.id === selectedCourseId)?.name}</strong>
                                {selectedBatchId && <> | Batch: <strong style={{ color: 'var(--primary)' }}>{batches.find(b => b.id === selectedBatchId)?.name}</strong></>}
                                {' '}• ({students.length} students)
                            </>
                        ) : (
                            <>Currently showing <strong>{students.length}</strong> students</>
                        )}
                    </p>
                </div>

                {/* 3 Download Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={students.length === 0}
                        className="btn"
                        style={{
                            background: '#ef4444',
                            color: '#ffffff',
                            fontWeight: '700',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 18px',
                            borderRadius: '10px',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                            border: 'none',
                            cursor: students.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: students.length === 0 ? 0.5 : 1
                        }}
                        title="Download official PDF roster"
                    >
                        <span>📄</span> Download in PDF
                    </button>

                    <button
                        onClick={handleDownloadExcel}
                        disabled={students.length === 0}
                        className="btn"
                        style={{
                            background: '#10b981',
                            color: '#ffffff',
                            fontWeight: '700',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 18px',
                            borderRadius: '10px',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                            border: 'none',
                            cursor: students.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: students.length === 0 ? 0.5 : 1
                        }}
                        title="Download formatted Excel spreadsheet"
                    >
                        <span>📊</span> Download in Excel (.xlsx)
                    </button>

                    <button
                        onClick={handleDownloadCSV}
                        disabled={students.length === 0}
                        className="btn"
                        style={{
                            background: '#0284c7',
                            color: '#ffffff',
                            fontWeight: '700',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 18px',
                            borderRadius: '10px',
                            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                            border: 'none',
                            cursor: students.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: students.length === 0 ? 0.5 : 1
                        }}
                        title="Download standard CSV spreadsheet"
                    >
                        <span>📑</span> Download in CSV
                    </button>
                </div>
            </div>

            {/* Student Detail / Edit Modal */}
            {selectedStudent && (
                <div className="modal-overlay" onClick={() => { setSelectedStudent(null); setIsEditing(false); setShowSiblingModal(false); }}>
                    <div className="modal" style={{ maxWidth: isEditing ? '700px' : '750px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '20px' }}>{selectedStudent.fullName.charAt(0)}</div>
                                <div>
                                    <h3 style={{ fontWeight: '700', fontSize: '18px' }}>{isEditing ? 'Edit Student' : selectedStudent.fullName}</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                        {selectedStudent.scholarNo ? `Scholar #${selectedStudent.scholarNo}` : selectedStudent.studentId}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setSelectedStudent(null); setIsEditing(false); setShowSiblingModal(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            {isEditing ? (
                                <form onSubmit={handleUpdate} className="grid-cols-2" style={{ gap: '16px' }}>
                                    {/* Scholar No (editable) */}
                                    <div style={{ gridColumn: '1 / -1', padding: '12px', background: 'rgba(99,102,241,0.08)', borderRadius: '10px', border: '1px dashed rgba(99,102,241,0.4)', marginBottom: '4px' }}>
                                        <label className="label" style={{ color: 'var(--primary)', fontWeight: '700' }}>🪪 Scholar No. (Editable)</label>
                                        <input className="input" value={editForm.scholarNo || ''} onChange={e => setEditForm({...editForm, scholarNo: e.target.value})} placeholder="Enter scholar number" />
                                    </div>
                                    <div><label className="label">Full Name</label><input className="input" value={editForm.fullName || ''} onChange={e => setEditForm({...editForm, fullName: e.target.value})} /></div>
                                    <div><label className="label">Phone</label><input className="input" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                                    <div><label className="label">Parent Phone</label><input className="input" value={editForm.parentPhone || ''} onChange={e => setEditForm({...editForm, parentPhone: e.target.value})} /></div>
                                    <div><label className="label">Father's Name</label><input className="input" value={editForm.fatherName || ''} onChange={e => setEditForm({...editForm, fatherName: e.target.value})} /></div>
                                    <div><label className="label">Mother's Name</label><input className="input" value={editForm.motherName || ''} onChange={e => setEditForm({...editForm, motherName: e.target.value})} /></div>
                                    <div><label className="label">DOB</label><input type="date" className="input" value={editForm.dob ? new Date(editForm.dob).toISOString().split('T')[0] : ''} onChange={e => setEditForm({...editForm, dob: e.target.value})} /></div>
                                    <div><label className="label">DOB in words</label><input className="input" value={editForm.dobInWords || ''} onChange={e => setEditForm({...editForm, dobInWords: e.target.value})} /></div>
                                    <div>
                                        <label className="label">Gender</label>
                                        <select className="input" value={editForm.gender || 'MALE'} onChange={e => setEditForm({...editForm, gender: e.target.value})}>
                                            <option value="MALE">Male</option>
                                            <option value="FEMALE">Female</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Caste</label>
                                        <select className="input" value={editForm.caste || 'General'} onChange={e => setEditForm({...editForm, caste: e.target.value})}>
                                            <option value="General">General</option>
                                            <option value="SC">SC</option>
                                            <option value="ST">ST</option>
                                            <option value="OBC">OBC</option>
                                            <option value="OTHER">OTHER</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Medium</label>
                                        <select className="input" value={editForm.medium || 'Hindi'} onChange={e => setEditForm({...editForm, medium: e.target.value})}>
                                            <option value="Hindi">Hindi</option>
                                            <option value="English">English</option>
                                        </select>
                                    </div>
                                    <div><label className="label">Aadhaar No</label><input className="input" value={editForm.aadhaarNo || ''} onChange={e => setEditForm({...editForm, aadhaarNo: e.target.value})} /></div>
                                    <div><label className="label">Samagra ID</label><input className="input" value={editForm.samagraId || ''} onChange={e => setEditForm({...editForm, samagraId: e.target.value})} /></div>
                                    <div><label className="label">PEN ID</label><input className="input" value={editForm.penId || ''} onChange={e => setEditForm({...editForm, penId: e.target.value})} /></div>
                                    <div><label className="label">APAR ID</label><input className="input" value={editForm.aparId || ''} onChange={e => setEditForm({...editForm, aparId: e.target.value})} /></div>
                                    <div><label className="label">Total Fee</label><input type="number" className="input" value={editForm.totalFee || ''} onChange={e => setEditForm({...editForm, totalFee: e.target.value})} /></div>
                                    <div>
                                        <label className="label">Status</label>
                                        <select className="input" value={editForm.status || 'ACTIVE'} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="INACTIVE">INACTIVE</option>
                                            <option value="DROPOUT">DROPOUT</option>
                                            <option value="PASSED">PASSED</option>
                                        </select>
                                    </div>
                                    <div><label className="label">Bank Name</label><input className="input" value={editForm.bankName || ''} onChange={e => setEditForm({...editForm, bankName: e.target.value})} /></div>
                                    <div><label className="label">Bank Account No.</label><input className="input" value={editForm.bankAccountNo || ''} onChange={e => setEditForm({...editForm, bankAccountNo: e.target.value})} /></div>
                                    <div className="col-span-2"><label className="label">IFSC Code</label><input className="input" value={editForm.ifsc || ''} onChange={e => setEditForm({...editForm, ifsc: e.target.value})} /></div>
                                    <div className="col-span-2" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <button type="submit" className="btn btn-primary" disabled={actionLoading} style={{ flex: 1 }}>
                                            {actionLoading ? 'Saving...' : '💾 Save Changes'}
                                        </button>
                                        <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary">Cancel</button>
                                    </div>

                                    {/* ── Add Sibling Section ── */}
                                    {canEditOrDelete && (
                                        <div className="col-span-2" style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>👫 Sibling Links</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Max 3 siblings per student</div>
                                                </div>
                                                {currentSiblings.length < 3 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowSiblingModal(true)}
                                                        className="btn btn-primary btn-sm"
                                                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', fontSize: '12px', padding: '6px 14px' }}
                                                    >
                                                        ➕ Add Sibling
                                                    </button>
                                                )}
                                            </div>

                                            {siblingsLoading ? (
                                                <div style={{ textAlign: 'center', padding: '16px' }}><div className="spinner" style={{ margin: '0 auto', width: '24px', height: '24px' }} /></div>
                                            ) : currentSiblings.length === 0 ? (
                                                <div style={{ padding: '16px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                    No siblings added yet. Click "Add Sibling" to link siblings.
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {currentSiblings.map(sib => (
                                                        <div key={sib.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                                            <div>
                                                                <div style={{ fontWeight: '600', fontSize: '13px' }}>{sib.fullName}</div>
                                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                    {sib.scholarNo ? `#${sib.scholarNo}` : ''} • {sib.courseName} - {sib.batchName}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveSibling(sib.siblingLinkId)}
                                                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}
                                                            >
                                                                ✕ Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </form>
                            ) : (
                                <div className="grid-cols-2">
                                    {[
                                        ['🪪 Scholar No.', selectedStudent.scholarNo || 'N/A'],
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

                            {/* Report Cards Section */}
                            {!isEditing && selectedStudent.examResults && selectedStudent.examResults.length > 0 && (
                                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                                    <h4 style={{ fontWeight: '700', marginBottom: '16px' }}>📑 Student Report Cards</h4>
                                    {Object.entries(
                                        selectedStudent.examResults.reduce((acc: any, er: any) => {
                                            const title = er.exam?.title || 'Unknown Exam'
                                            if (!acc[title]) acc[title] = []
                                            acc[title].push(er)
                                            return acc
                                        }, {})
                                    ).map(([examTitle, results]: any, index) => {
                                        let grandTotalMax = 0
                                        let grandTotalObtained = 0
                                        const courseSubjects = selectedStudent.courseSubjects || []
                                        
                                        const subjectRows = courseSubjects.map((subject: string) => {
                                            const res = results.find((r: any) => r.exam?.subject === subject)
                                            if (res) {
                                                grandTotalMax += res.exam?.maxMarks || 0
                                                grandTotalObtained += res.marksObtained || 0
                                            }
                                            return { subject, max: res ? res.exam?.maxMarks : '-', obtained: res ? res.marksObtained : '-', remarks: res?.remarks || '-' }
                                        })
                                        results.forEach((r: any) => {
                                            if (r.exam?.subject && !courseSubjects.includes(r.exam.subject)) {
                                                grandTotalMax += r.exam?.maxMarks || 0
                                                grandTotalObtained += r.marksObtained || 0
                                                subjectRows.push({ subject: r.exam.subject, max: r.exam.maxMarks, obtained: r.marksObtained, remarks: r.remarks || '-' })
                                            }
                                        })
                                        const percentage = grandTotalMax > 0 ? ((grandTotalObtained / grandTotalMax) * 100).toFixed(2) : 0
                                        const reportCardId = `report-card-${index}`

                                        return (
                                            <div key={examTitle} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                                                <div id={reportCardId} style={{ padding: '24px', background: '#ffffff', color: '#0f172a', borderRadius: '10px' }}>
                                                    <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
                                                        {tenant?.logo && (
                                                            <img src={tenant.logo} alt="Logo" style={{ height: '55px', maxWidth: '100px', objectFit: 'contain', margin: '0 auto 8px auto', display: 'block' }} crossOrigin="anonymous" />
                                                        )}
                                                        <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '800', color: tenant?.themeColor || '#1e293b', textTransform: 'uppercase' }}>{tenant?.name || 'School Name'}</h2>
                                                        {tenant?.address && <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>{tenant.address}</p>}
                                                        <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>{tenant?.phone ? `Ph: ${tenant.phone}` : ''}{tenant?.phone && tenant?.email ? ' | ' : ''}{tenant?.email ? tenant.email : ''}</p>
                                                        {((tenant?.registrationCode || tenant?.schoolCode) || tenant?.diseCode) && (
                                                            <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: '700', color: '#4338ca' }}>
                                                                {(tenant?.registrationCode || tenant?.schoolCode) && <span>School ID: {tenant.registrationCode || tenant.schoolCode}</span>}
                                                                {(tenant?.registrationCode || tenant?.schoolCode) && tenant?.diseCode && <span> &nbsp;|&nbsp; </span>}
                                                                {tenant?.diseCode && <span>DISE Code: {tenant.diseCode}</span>}
                                                            </div>
                                                        )}
                                                        <h3 style={{ margin: '12px 0 0 0', fontSize: '16px', fontWeight: '700', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STUDENT REPORT CARD - {examTitle}</h3>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '13px', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                        <div>
                                                            <p style={{ margin: '3px 0' }}><strong>Student Name:</strong> {selectedStudent.fullName}</p>
                                                            <p style={{ margin: '3px 0' }}><strong>Scholar No.:</strong> {selectedStudent.scholarNo || 'N/A'}</p>
                                                            <p style={{ margin: '3px 0' }}><strong>Father&apos;s Name:</strong> {selectedStudent.fatherName || 'N/A'}</p>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <p style={{ margin: '3px 0' }}><strong>Class:</strong> {selectedStudent.courseName || 'N/A'}</p>
                                                            <p style={{ margin: '3px 0' }}><strong>Section:</strong> {selectedStudent.batchName || 'N/A'}</p>
                                                            <p style={{ margin: '3px 0' }}><strong>Student ID:</strong> {selectedStudent.studentId || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', border: '1px solid #cbd5e1' }}>
                                                        <thead>
                                                            <tr style={{ background: '#f1f5f9' }}>
                                                                <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'left', color: '#334155', fontSize: '12px' }}>Subject</th>
                                                                <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#334155', fontSize: '12px' }}>Max</th>
                                                                <th style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#334155', fontSize: '12px' }}>Obtained</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {subjectRows.map((row: any, i: number) => (
                                                                <tr key={i}>
                                                                    <td style={{ padding: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{row.subject}</td>
                                                                    <td style={{ padding: '10px', border: '1px solid #cbd5e1', fontSize: '13px', textAlign: 'center', color: '#0f172a' }}>{row.max}</td>
                                                                    <td style={{ padding: '10px', border: '1px solid #cbd5e1', fontSize: '13px', textAlign: 'center', fontWeight: '700', color: row.obtained !== '-' ? '#059669' : '#0f172a' }}>{row.obtained}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr style={{ background: '#ecfdf5' }}>
                                                                <td style={{ padding: '10px', border: '1px solid #cbd5e1', fontWeight: '800', textAlign: 'right', fontSize: '13px', color: '#0f172a' }}>TOTAL ({percentage}%)</td>
                                                                <td style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', fontSize: '13px', color: '#0f172a' }}>{grandTotalMax}</td>
                                                                <td style={{ padding: '10px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', color: '#059669', fontSize: '13px' }}>{grandTotalObtained}</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', fontSize: '13px', color: '#475569' }}>
                                                        <div style={{ textAlign: 'center', width: '160px' }}>
                                                            <div style={{ height: '36px' }}></div>
                                                            <div style={{ borderTop: '1px solid #64748b', paddingTop: '4px', fontWeight: '600' }}>Class Teacher</div>
                                                        </div>
                                                        <div style={{ textAlign: 'center', width: '160px' }}>
                                                            {tenant?.directorSign ? (
                                                                <img src={tenant.directorSign} alt="Principal Signature" style={{ height: '36px', objectFit: 'contain', marginBottom: '2px', display: 'block', margin: '0 auto 2px auto' }} crossOrigin="anonymous" />
                                                            ) : (
                                                                <div style={{ height: '36px' }}></div>
                                                            )}
                                                            <div style={{ borderTop: '1px solid #64748b', paddingTop: '4px', fontWeight: '600' }}>Principal / Director</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ padding: '12px', background: '#0f172a', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => downloadPDF(reportCardId, `${selectedStudent.fullName}_${examTitle}`)} className="btn btn-secondary btn-sm" style={{ background: '#ef4444', color: 'white', border: 'none' }}>
                                                        📄 Download PDF
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                        </div>
                        {!isEditing && (
                            <div className="modal-footer">
                                {canEditOrDelete && (
                                    <button onClick={() => { setEditForm(selectedStudent); setIsEditing(true); fetchSiblingsForStudent(selectedStudent.id); }} className="btn btn-secondary">✏️ Edit Details</button>
                                )}
                                <button onClick={() => downloadPDF('admission-form-content', `${selectedStudent.fullName}_Admission_Form`)} className="btn btn-primary">📄 Admission Form</button>
                                <a href={`https://wa.me/${(selectedStudent.parentPhone || selectedStudent.phone)?.replace(/\D/g, '')}?text=Dear Parent, This is regarding ${selectedStudent.fullName} from our school.`} target="_blank" className="btn btn-success">💬 WhatsApp Parent</a>
                                <button onClick={() => setSelectedStudent(null)} className="btn btn-secondary">Close</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add Sibling Search Modal */}
            {showSiblingModal && selectedStudent && (
                <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowSiblingModal(false)}>
                    <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 style={{ fontWeight: '700', fontSize: '18px' }}>👫 Search & Add Sibling</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>for {selectedStudent.fullName} ({3 - currentSiblings.length} slot{3 - currentSiblings.length !== 1 ? 's' : ''} remaining)</p>
                            </div>
                            <button onClick={() => setShowSiblingModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                <input
                                    className="input"
                                    style={{ flex: 1 }}
                                    placeholder="Search by name or scholar no..."
                                    value={siblingSearch}
                                    onChange={e => setSiblingSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && searchSiblings()}
                                    autoFocus
                                />
                                <button className="btn btn-primary" onClick={searchSiblings} disabled={siblingSearchLoading}>
                                    {siblingSearchLoading ? '...' : '🔍'}
                                </button>
                            </div>

                            {siblingSearchResults.length === 0 && siblingSearch && !siblingSearchLoading && (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    No matching students found (already-linked siblings are excluded).
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {siblingSearchResults.map(s => (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--surface-2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '14px' }}>{s.fullName}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {s.scholarNo ? `#${s.scholarNo} • ` : ''}{s.courseName} - {s.batchName}
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            disabled={addingSibling}
                                            onClick={() => handleAddSibling(s.id)}
                                            style={{ fontSize: '12px', padding: '6px 14px' }}
                                        >
                                            {addingSibling ? '...' : '➕ Add'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Admission Form for PDF */}
            {selectedStudent && (
                <div style={{ display: 'none' }}>
                    <div id="admission-form-content" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
                        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                            {tenant?.logo && <img src={tenant.logo} alt="Logo" style={{ height: '60px', marginBottom: '10px' }} />}
                            <h1 style={{ margin: 0, fontSize: '24px', textTransform: 'uppercase' }}>{tenant?.name || 'SCHOOL NAME'}</h1>
                            <p style={{ margin: '5px 0' }}>{tenant?.address || 'School Address'}</p>
                            <p style={{ margin: '0' }}>Phone: {tenant?.phone || '-'} | Email: {tenant?.email || '-'}</p>
                            <h2 style={{ marginTop: '15px', textDecoration: 'underline' }}>ADMISSION FORM</h2>
                        </div>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px', width: '25%', fontWeight: 'bold' }}>Scholar No.</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', width: '25%' }}>{selectedStudent.scholarNo || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', width: '25%', fontWeight: 'bold' }}>Admission Date</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', width: '25%' }}>{selectedStudent.admissionDate ? formatDate(selectedStudent.admissionDate) : '-'}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Student Name</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }} colSpan={3}>{selectedStudent.fullName}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Date of Birth</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{selectedStudent.dob ? formatDate(selectedStudent.dob) : '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>DOB (In Words)</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{selectedStudent.dobInWords || '-'}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Gender</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{selectedStudent.gender || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Caste / Medium</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{(selectedStudent.caste || '-') + ' / ' + (selectedStudent.medium || '-')}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Class & Section</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{selectedStudent.courseName} - {selectedStudent.batchName}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Phone Number</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{selectedStudent.phone || '-'}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Father's Name</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{selectedStudent.fatherName || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Mother's Name</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{selectedStudent.motherName || '-'}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Parent Phone</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{selectedStudent.parentPhone || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Aadhaar / Samagra</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{(selectedStudent.aadhaarNo || '-') + ' / ' + (selectedStudent.samagraId || '-')}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Bank Name</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{selectedStudent.bankName || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>A/C & IFSC</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{(selectedStudent.bankAccountNo || '-') + ' / ' + (selectedStudent.ifsc || '-')}</td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', padding: '0 20px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderBottom: '1px solid #000', width: '150px', marginBottom: '5px' }}></div>
                                <p style={{ margin: 0 }}>Parent/Guardian Signature</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderBottom: '1px solid #000', width: '150px', marginBottom: '5px' }}></div>
                                <p style={{ margin: 0 }}>Authorized Signatory</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
