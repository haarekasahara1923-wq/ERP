'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import { downloadCSV, generateAndPrintPDF } from '@/lib/reportExport'

interface Student {
    id: string
    fullName: string
    phone: string
    parentPhone: string
    courseName: string
    totalFee: number
    paidFee: number
    status: string
    scholarNo?: string
    hasSiblings?: boolean
}

interface SiblingInfo {
    siblingLinkId: string
    id: string
    fullName: string
    scholarNo?: string
    courseName: string
    batchName: string
    totalFee: number
    paidFee: number
    status: string
}

export default function FeesPage() {
    const { token, tenant } = useAuth()
    const [students, setStudents] = useState<Student[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('outstanding')
    const [toast, setToast] = useState('')
    const [feeSearch, setFeeSearch] = useState('')

    // Installments Modal State
    const [selectedStudentForFees, setSelectedStudentForFees] = useState<Student | null>(null)
    const [studentFees, setStudentFees] = useState<any[]>([])
    const [feesLoading, setFeesLoading] = useState(false)
    const [paymentMode, setPaymentMode] = useState('CASH')
    const [processingPayment, setProcessingPayment] = useState<string | null>(null)

    // Sibling state in fee modal
    const [feeModalSiblings, setFeeModalSiblings] = useState<SiblingInfo[]>([])
    const [selectedSiblingForFees, setSelectedSiblingForFees] = useState<SiblingInfo | null>(null)
    const [siblingFees, setSiblingFees] = useState<any[]>([])
    const [siblingFeesLoading, setSiblingFeesLoading] = useState(false)

    // Gross payment state
    const [showGrossPayModal, setShowGrossPayModal] = useState(false)
    const [grossAmount, setGrossAmount] = useState('')
    const [grossPayMode, setGrossPayMode] = useState('CASH')
    const [grossPayLoading, setGrossPayLoading] = useState(false)
    const [grossPayResult, setGrossPayResult] = useState<any[] | null>(null)

    const fetchStudents = useCallback(() => {
        fetch('/api/students', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(async data => {
                if (data.success) {
                    // Fetch sibling flags
                    const siblingRes = await fetch('/api/students/siblings/counts', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
                    const siblingData = siblingRes ? await siblingRes.json().catch(() => null) : null
                    const siblingSet: Set<string> = new Set(siblingData?.success ? siblingData.data : [])
                    setStudents(data.data.map((s: Student) => ({ ...s, hasSiblings: siblingSet.has(s.id) })))
                }
                setLoading(false)
            })
    }, [token])

    useEffect(() => {
        if (!token) return
        fetchStudents()
    }, [token])

    const outstanding = students.filter(s => s.totalFee > s.paidFee).sort((a, b) => (b.totalFee - b.paidFee) - (a.totalFee - a.paidFee))
    const paid = students.filter(s => s.paidFee >= s.totalFee)
    const totalDue = outstanding.reduce((s, st) => s + (st.totalFee - st.paidFee), 0)
    const totalCollected = students.reduce((s, st) => s + st.paidFee, 0)

    const getFilteredList = () => {
        const base = activeTab === 'outstanding' ? outstanding : activeTab === 'paid' ? paid : students
        if (!feeSearch.trim()) return base
        const q = feeSearch.trim().toLowerCase()
        return base.filter(s =>
            s.fullName.toLowerCase().includes(q) ||
            (s.scholarNo && s.scholarNo.toLowerCase().includes(q)) ||
            s.phone.includes(q)
        )
    }

    const sendWhatsAppReminder = (student: Student) => {
        const due = formatCurrency(student.totalFee - student.paidFee)
        const msg = `Dear Parent, This is a gentle reminder that ${student.fullName}'s fee of ${due} is pending at our school. Please arrange payment at your earliest convenience. Thank you!`
        window.open(`https://wa.me/91${(student.parentPhone || student.phone).replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
    }

    const openInstallments = async (student: Student) => {
        setSelectedStudentForFees(student)
        setSelectedSiblingForFees(null)
        setSiblingFees([])
        setGrossPayResult(null)
        setFeesLoading(true)

        // Fetch fee installments
        const res = await fetch(`/api/fees?studentId=${student.id}`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (data.success) setStudentFees(data.data)

        // Fetch siblings
        const sibRes = await fetch(`/api/students/siblings?studentId=${student.id}`, { headers: { Authorization: `Bearer ${token}` } })
        const sibData = await sibRes.json()
        if (sibData.success) setFeeModalSiblings(sibData.data)
        else setFeeModalSiblings([])

        setFeesLoading(false)
    }

    const openSiblingInstallments = async (sib: SiblingInfo) => {
        setSelectedSiblingForFees(sib)
        setSiblingFeesLoading(true)
        const res = await fetch(`/api/fees?studentId=${sib.id}`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (data.success) setSiblingFees(data.data)
        setSiblingFeesLoading(false)
    }

    const handlePayInstallment = async (fee: any, isSibling = false) => {
        if (!confirm(`Mark ${formatCurrency(fee.amount)} as PAID via ${paymentMode}?`)) return
        setProcessingPayment(fee.id)

        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    studentId: fee.studentId,
                    feeId: fee.id,
                    amount: fee.amount,
                    mode: paymentMode,
                    notes: `Installment Payment (${fee.notes || 'Monthly'})`,
                })
            })
            const data = await res.json()
            if (data.success) {
                setToast('Installment marked as paid!')
                setTimeout(() => setToast(''), 3000)
                if (isSibling && selectedSiblingForFees) openSiblingInstallments(selectedSiblingForFees)
                else openInstallments(selectedStudentForFees!)
                fetchStudents()
            } else {
                alert(data.error || 'Payment failed')
            }
        } catch (err) {
            alert('Error processing payment')
        }
        setProcessingPayment(null)
    }

    const handleGrossPayment = async () => {
        const amt = parseFloat(grossAmount)
        if (!amt || amt <= 0) { alert('Enter a valid amount'); return }
        if (!confirm(`Distribute ₹${amt} proportionally across ${selectedStudentForFees!.fullName} and ${feeModalSiblings.length} sibling(s)?`)) return

        setGrossPayLoading(true)
        try {
            const res = await fetch('/api/students/siblings/bulk-pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ studentId: selectedStudentForFees!.id, grossAmount: amt, mode: grossPayMode })
            })
            const data = await res.json()
            if (data.success) {
                setGrossPayResult(data.data)
                setToast('Gross payment distributed successfully!')
                setTimeout(() => setToast(''), 4000)
                setGrossAmount('')
                // Refresh
                await openInstallments(selectedStudentForFees!)
                fetchStudents()
            } else {
                alert(data.error || 'Failed to process payment')
            }
        } catch (err) {
            alert('Error processing gross payment')
        }
        setGrossPayLoading(false)
        setShowGrossPayModal(false)
    }

    const getCurrentList = () => getFilteredList()

    const handleExportCSV = () => {
        const list = getCurrentList()
        const timestamp = new Date().toISOString().split('T')[0]
        const tabTitle = activeTab === 'outstanding' ? 'OUTSTANDING DUES' : activeTab === 'paid' ? 'PAID FEES' : 'ALL STUDENTS'
        const rows = [
            [`FEE REPORT (${tabTitle})`],
            ['Generated On', new Date().toLocaleString('en-IN')],
            ['Total Students In List', list.length],
            ['Total Outstanding Dues', formatCurrency(totalDue)],
            ['Total Collected', formatCurrency(totalCollected)],
            [''],
            ['Student Name', 'Scholar No', 'Phone', 'Parent Phone', 'Course', 'Total Fee (INR)', 'Paid Fee (INR)', 'Pending Due (INR)', 'Payment %', 'Status', 'Has Siblings']
        ]
        list.forEach(s => {
            const pending = s.totalFee - s.paidFee
            const pct = s.totalFee > 0 ? Math.round((s.paidFee / s.totalFee) * 100) : 0
            rows.push([
                s.fullName,
                s.scholarNo || '-',
                s.phone || '-',
                s.parentPhone || '-',
                s.courseName || '-',
                s.totalFee,
                s.paidFee,
                Math.max(0, pending),
                `${pct}%`,
                s.status,
                s.hasSiblings ? 'Yes' : 'No'
            ])
        })
        downloadCSV(`fees-${activeTab}-${timestamp}.csv`, rows)
    }

    const handleExportPDF = () => {
        const list = getCurrentList()
        const tabTitle = activeTab === 'outstanding' ? 'Outstanding Fees Report' : activeTab === 'paid' ? 'Paid Fees Report' : 'Student Fee Accounts Report'
        generateAndPrintPDF({
            title: tabTitle,
            subtitle: `Filter: ${activeTab.toUpperCase()} | Generated: ${new Date().toLocaleDateString('en-IN')}`,
            schoolName: tenant?.name || 'School',
            schoolAddress: tenant?.address || '',
            stats: [
                { label: 'Total Collected', value: formatCurrency(totalCollected), subtext: 'Received so far', color: '#10b981' },
                { label: 'Total Outstanding', value: formatCurrency(totalDue), subtext: 'Pending balance', color: '#f59e0b' },
                { label: 'Students with Dues', value: outstanding.length, subtext: 'Unpaid installments', color: '#ef4444' },
                { label: 'Fully Paid Students', value: paid.length, subtext: 'Completed payments', color: '#6366f1' },
            ],
            tables: [
                {
                    title: `Fee Accounts (${list.length} Students)`,
                    headers: ['Student Name', 'Scholar No', 'Course', 'Total Fee', 'Paid', 'Pending Due', 'Payment %'],
                    rows: list.map(s => {
                        const pending = s.totalFee - s.paidFee
                        const pct = s.totalFee > 0 ? Math.round((s.paidFee / s.totalFee) * 100) : 0
                        return [
                            s.hasSiblings ? `${s.fullName} ⁺` : s.fullName,
                            s.scholarNo || '-',
                            s.courseName,
                            formatCurrency(s.totalFee),
                            formatCurrency(s.paidFee),
                            pending > 0 ? formatCurrency(pending) : '✅ Clear',
                            `${pct}%`
                        ]
                    })
                }
            ]
        })
    }

    const renderFeeSlots = (fees: any[], forSibling = false, sibObj?: SiblingInfo) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {[0, 1, 2, 3, 4, 5].map(idx => {
                const fee = fees[idx]
                return (
                    <div key={idx} style={{ padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-secondary)' }}>Slot {idx + 1}</div>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--text-muted)' }}>₹</span>
                            <input
                                type="number"
                                className="input"
                                style={{ paddingLeft: '24px', fontWeight: '700' }}
                                placeholder="0.00"
                                defaultValue={fee?.amount || 0}
                                onBlur={async (e) => {
                                    const val = parseFloat(e.target.value) || 0
                                    if (fee && val === fee.amount) return
                                    if (!fee) { alert('Please generate slots first!'); return }

                                    setFeesLoading(true)
                                    try {
                                        const res = await fetch('/api/fees', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                            body: JSON.stringify({ id: fee.id, amount: val, mode: paymentMode })
                                        })
                                        const data = await res.json()
                                        if (data.success) {
                                            const resStudents = await fetch('/api/students', { headers: { Authorization: `Bearer ${token}` } })
                                            const dataStudents = await resStudents.json()
                                            if (dataStudents.success) {
                                                setStudents(dataStudents.data)
                                                if (!forSibling) {
                                                    const updatedStu = dataStudents.data.find((s: any) => s.id === selectedStudentForFees!.id)
                                                    if (updatedStu) setSelectedStudentForFees(updatedStu)
                                                }
                                            }
                                            const studentId = forSibling ? sibObj!.id : selectedStudentForFees!.id
                                            const resFees = await fetch(`/api/fees?studentId=${studentId}`, { headers: { Authorization: `Bearer ${token}` } })
                                            const dataFees = await resFees.json()
                                            if (dataFees.success) {
                                                if (forSibling) setSiblingFees(dataFees.data)
                                                else setStudentFees(dataFees.data)
                                            }

                                            setToast(`Slot ${idx + 1} updated!`)
                                            setTimeout(() => setToast(''), 3000)
                                        }
                                    } catch (err) { alert('Update failed') }
                                    setFeesLoading(false)
                                }}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
    )

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 className="page-title">💰 Fee Management</h1>
                    <p className="page-subtitle">Track and manage student fees</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleExportCSV}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '9px 14px' }}
                        title="Download current fee list as CSV"
                    >
                        <span>⬇️</span> Download CSV
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '9px 14px', background: 'linear-gradient(135deg, #1a5c38, #0f3d26)' }}
                        title="Print or Save current fee report as PDF"
                    >
                        <span>🖨️</span> Download PDF
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Collected', value: formatCurrency(totalCollected), icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                    { label: 'Total Outstanding', value: formatCurrency(totalDue), icon: '⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                    { label: 'Students with Dues', value: outstanding.length, icon: '👥', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                    { label: 'Fully Paid Students', value: paid.length, icon: '🎉', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                ].map(c => (
                    <div key={c.label} style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', borderLeft: `4px solid ${c.color}` }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>{c.icon}</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: c.color, marginBottom: '4px' }}>{c.value}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{c.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab ${activeTab === 'outstanding' ? 'active' : ''}`} onClick={() => setActiveTab('outstanding')}>⚠️ Outstanding ({outstanding.length})</button>
                <button className={`tab ${activeTab === 'paid' ? 'active' : ''}`} onClick={() => setActiveTab('paid')}>✅ Paid ({paid.length})</button>
                <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>👥 All Students</button>
            </div>

            {/* Search Bar */}
            <div style={{ padding: '12px 0 8px' }}>
                <input
                    className="input"
                    placeholder="🔍 Search by name, scholar no. or phone..."
                    value={feeSearch}
                    onChange={e => setFeeSearch(e.target.value)}
                    style={{ maxWidth: '400px' }}
                />
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Course</th>
                                    <th>Total Fee</th>
                                    <th>Paid</th>
                                    <th>Pending</th>
                                    <th>Payment %</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getCurrentList().map(s => {
                                    const pending = s.totalFee - s.paidFee
                                    const pct = s.totalFee > 0 ? Math.round((s.paidFee / s.totalFee) * 100) : 0
                                    return (
                                        <tr key={s.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{s.fullName.charAt(0)}</div>
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {s.fullName}
                                                            {s.hasSiblings && (
                                                                <span title="Has siblings linked" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: '11px', fontWeight: '800' }}>+</span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.scholarNo ? `#${s.scholarNo}` : s.phone}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.courseName}</td>
                                            <td style={{ fontWeight: '600', fontSize: '14px' }}>{formatCurrency(s.totalFee)}</td>
                                            <td style={{ color: '#10b981', fontWeight: '700' }}>{formatCurrency(s.paidFee)}</td>
                                            <td style={{ color: pending > 0 ? '#ef4444' : '#10b981', fontWeight: '700' }}>
                                                {pending > 0 ? formatCurrency(pending) : '✅ Clear'}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div className="progress-bar" style={{ flex: 1 }}>
                                                        <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444' }} />
                                                    </div>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', minWidth: '32px' }}>{pct}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button onClick={() => openInstallments(s)} className="btn btn-primary btn-sm" title="View Installments" style={{ padding: '5px 10px', fontSize: '11px', fontWeight: '700' }}>
                                                        📜 Installments
                                                    </button>
                                                    {pending > 0 && (
                                                        <button onClick={() => sendWhatsAppReminder(s)} style={{ padding: '5px 10px', background: '#25d36615', border: '1px solid #25d36640', borderRadius: '6px', color: '#25d366', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>
                                                            💬 Remind
                                                        </button>
                                                    )}
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

            {/* Installments Modal */}
            {selectedStudentForFees && (
                <div className="modal-overlay" onClick={() => setSelectedStudentForFees(null)}>
                    <div className="modal" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 style={{ fontWeight: '700', fontSize: '18px' }}>📜 Fee Ledger</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {selectedStudentForFees.fullName}
                                    {selectedStudentForFees.scholarNo && ` (#${selectedStudentForFees.scholarNo})`}
                                    {' • '}{selectedStudentForFees.courseName}
                                    {feeModalSiblings.length > 0 && <span style={{ marginLeft: '8px', padding: '2px 8px', background: 'rgba(99,102,241,0.15)', borderRadius: '12px', color: '#6366f1', fontSize: '11px', fontWeight: '700' }}>👫 {feeModalSiblings.length} Sibling{feeModalSiblings.length > 1 ? 's' : ''}</span>}
                                </p>
                            </div>
                            <button onClick={() => setSelectedStudentForFees(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                            {feesLoading ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Gross sibling payment - only show if there are siblings */}
                                    {feeModalSiblings.length > 0 && (
                                        <div style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))', borderRadius: '14px', border: '1px solid rgba(99,102,241,0.25)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>💸 Family Gross Payment</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pay once — amount auto-distributed to all siblings proportionally</div>
                                                </div>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => { setShowGrossPayModal(true); setGrossPayResult(null) }}
                                                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', fontSize: '12px' }}
                                                >
                                                    💰 Pay Gross Amount
                                                </button>
                                            </div>
                                            {/* Sibling summary */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {[selectedStudentForFees, ...feeModalSiblings].map((s, i) => {
                                                    const pending = Math.max(0, s.totalFee - s.paidFee)
                                                    return (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: '8px' }}>
                                                            <div style={{ fontWeight: '600', fontSize: '13px' }}>
                                                                {i === 0 ? '👤 ' : '👫 '}{s.fullName}
                                                                {(s as any).scholarNo && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>#{(s as any).scholarNo}</span>}
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: pending > 0 ? '#ef4444' : '#10b981', fontWeight: '700' }}>
                                                                Due: {formatCurrency(pending)}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Main student fee slots */}
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>
                                            👤 {selectedStudentForFees.fullName} — Fee Installments
                                        </div>
                                        <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '12px', marginBottom: '12px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Total Fee</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>{formatCurrency(selectedStudentForFees.totalFee)}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Remaining</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444' }}>{formatCurrency(selectedStudentForFees.totalFee - selectedStudentForFees.paidFee)}</div>
                                                </div>
                                            </div>
                                            <div className="progress-bar" style={{ marginTop: '12px', height: '6px' }}>
                                                <div className="progress-fill" style={{ width: `${(selectedStudentForFees.paidFee / selectedStudentForFees.totalFee) * 100}%`, background: 'var(--primary)' }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: '12px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Payment Mode</div>
                                            <select
                                                className="input"
                                                style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', borderRadius: '8px' }}
                                                value={paymentMode}
                                                onChange={e => setPaymentMode(e.target.value)}
                                            >
                                                <option value="CASH">💵 Cash</option>
                                                <option value="UPI">📱 UPI</option>
                                                <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                                                <option value="CHEQUE">💳 Cheque</option>
                                                <option value="CARD">💳 Card</option>
                                            </select>
                                        </div>

                                        {studentFees.length === 0 ? (
                                            <div style={{ padding: '24px', textAlign: 'center' }}>
                                                <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>No installments found!</p>
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={async () => {
                                                        setFeesLoading(true)
                                                        try {
                                                            const res = await fetch('/api/fees/generate', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                                                body: JSON.stringify({ studentId: selectedStudentForFees.id })
                                                            })
                                                            const data = await res.json()
                                                            if (data.success) {
                                                                setToast('Installments generated!')
                                                                openInstallments(selectedStudentForFees)
                                                            } else { alert(data.error || 'Failed to generate'); setFeesLoading(false) }
                                                        } catch { alert('Error'); setFeesLoading(false) }
                                                    }}
                                                >
                                                    ⚙️ Auto-Generate Installments
                                                </button>
                                            </div>
                                        ) : (
                                            renderFeeSlots(studentFees)
                                        )}
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                                            * Enter amount in any slot. Dashboard will update in real-time.
                                        </div>
                                    </div>

                                    {/* Sibling Fee Sections */}
                                    {feeModalSiblings.map(sib => (
                                        <div key={sib.id} style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                                                    👫 {sib.fullName}
                                                    {sib.scholarNo && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>#{sib.scholarNo}</span>}
                                                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>{sib.courseName}</span>
                                                </div>
                                                {selectedSiblingForFees?.id !== sib.id && (
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => openSiblingInstallments(sib)}
                                                        style={{ fontSize: '11px' }}
                                                    >
                                                        📜 Load Installments
                                                    </button>
                                                )}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                                <div style={{ padding: '10px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Fee</div>
                                                    <div style={{ fontWeight: '800', color: 'var(--primary)' }}>{formatCurrency(sib.totalFee)}</div>
                                                </div>
                                                <div style={{ padding: '10px', background: 'var(--surface-2)', borderRadius: '8px', textAlign: 'right' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Remaining</div>
                                                    <div style={{ fontWeight: '800', color: '#ef4444' }}>{formatCurrency(Math.max(0, sib.totalFee - sib.paidFee))}</div>
                                                </div>
                                            </div>
                                            {selectedSiblingForFees?.id === sib.id && (
                                                siblingFeesLoading ? (
                                                    <div style={{ textAlign: 'center', padding: '16px' }}><div className="spinner" style={{ margin: '0 auto', width: '24px', height: '24px' }} /></div>
                                                ) : renderFeeSlots(siblingFees, true, sib)
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Gross Payment Modal */}
            {showGrossPayModal && selectedStudentForFees && (
                <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowGrossPayModal(false)}>
                    <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 style={{ fontWeight: '700', fontSize: '18px' }}>💸 Family Gross Payment</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Enter total amount — it will be split proportionally</p>
                            </div>
                            <button onClick={() => setShowGrossPayModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ padding: '14px', background: 'var(--surface-2)', borderRadius: '12px' }}>
                                    {[selectedStudentForFees, ...feeModalSiblings].map((s, i) => {
                                        const pending = Math.max(0, s.totalFee - s.paidFee)
                                        const totalPending = Math.max(0, selectedStudentForFees.totalFee - selectedStudentForFees.paidFee) + feeModalSiblings.reduce((sum, sib) => sum + Math.max(0, sib.totalFee - sib.paidFee), 0)
                                        const g = parseFloat(grossAmount) || 0
                                        const share = totalPending > 0 && pending > 0 ? Math.min(Math.round((pending / totalPending) * g * 100) / 100, pending) : 0
                                        return (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < feeModalSiblings.length ? '1px solid var(--border)' : 'none' }}>
                                                <div style={{ fontSize: '13px', fontWeight: '600' }}>{i === 0 ? '👤 ' : '👫 '}{s.fullName}</div>
                                                <div style={{ fontSize: '13px', color: '#6366f1', fontWeight: '700' }}>
                                                    {g > 0 ? `→ ${formatCurrency(share)}` : `Due: ${formatCurrency(pending)}`}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div>
                                    <label className="label">Gross Amount (₹)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="Enter total payment amount"
                                        value={grossAmount}
                                        onChange={e => setGrossAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="label">Payment Mode</label>
                                    <select className="input" value={grossPayMode} onChange={e => setGrossPayMode(e.target.value)}>
                                        <option value="CASH">💵 Cash</option>
                                        <option value="UPI">📱 UPI</option>
                                        <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                                        <option value="CHEQUE">💳 Cheque</option>
                                        <option value="CARD">💳 Card</option>
                                    </select>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleGrossPayment}
                                    disabled={grossPayLoading || !grossAmount}
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '12px' }}
                                >
                                    {grossPayLoading ? '⏳ Processing...' : '✅ Confirm & Distribute Payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
                    background: '#10b981', color: 'white', padding: '12px 20px',
                    borderRadius: '12px', fontWeight: '700', fontSize: '14px',
                    boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
                    animation: 'slideIn 0.3s ease'
                }}>
                    ✅ {toast}
                </div>
            )}
        </div>
    )
}
