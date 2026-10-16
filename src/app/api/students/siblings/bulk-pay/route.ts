import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireWriteAccess } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/students/siblings/bulk-pay
 * Body: { studentId, grossAmount, mode }
 *
 * Takes a gross payment amount and distributes it proportionally
 * across all siblings (including the given student) based on their
 * pending fee balances.
 */
export async function POST(req: NextRequest) {
    const { error, user } = requireWriteAccess(req)
    if (error) return error

    try {
        const { studentId, grossAmount, mode } = await req.json()
        if (!studentId || !grossAmount) {
            return NextResponse.json({ error: 'studentId and grossAmount are required' }, { status: 400 })
        }

        const total = parseFloat(grossAmount)
        if (total <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })

        // Find all siblings of this student
        const siblingLinks = await prisma.sibling.findMany({
            where: {
                tenantId: user!.tenantId,
                OR: [{ studentAId: studentId }, { studentBId: studentId }]
            }
        })

        // Collect all student IDs in the sibling group (including the main student)
        const siblingIds = new Set<string>([studentId])
        siblingLinks.forEach((link) => {
            siblingIds.add(link.studentAId)
            siblingIds.add(link.studentBId)
        })

        // Fetch all students in the group
        const students = await prisma.student.findMany({
            where: { id: { in: Array.from(siblingIds) }, tenantId: user!.tenantId }
        })

        // Calculate pending due for each
        const dues = students.map(s => ({
            id: s.id,
            fullName: s.fullName,
            pending: Math.max(0, s.totalFee - s.paidFee)
        }))

        const totalPending = dues.reduce((sum, d) => sum + d.pending, 0)

        if (totalPending === 0) {
            return NextResponse.json({ error: 'All siblings have cleared their dues' }, { status: 400 })
        }

        // Distribute amount proportionally based on pending dues
        const paymentMode = mode || 'CASH'
        const results: any[] = []
        let remaining = total

        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < dues.length; i++) {
                const d = dues[i]
                if (d.pending <= 0) continue

                // Proportional share; last student gets the remaining to avoid rounding errors
                let share: number
                if (i === dues.length - 1 || dues.slice(i + 1).every(x => x.pending === 0)) {
                    share = Math.min(remaining, d.pending)
                } else {
                    share = Math.round((d.pending / totalPending) * total * 100) / 100
                    share = Math.min(share, d.pending, remaining)
                }

                if (share <= 0) continue

                const payment = await tx.payment.create({
                    data: {
                        tenantId: user!.tenantId,
                        studentId: d.id,
                        amount: share,
                        mode: paymentMode as any,
                        notes: `Sibling bulk payment (gross ₹${total})`,
                    }
                })

                await tx.student.update({
                    where: { id: d.id },
                    data: { paidFee: { increment: share } }
                })

                remaining -= share
                results.push({
                    studentId: d.id,
                    studentName: d.fullName,
                    pending: d.pending,
                    allocated: share,
                    paymentId: payment.id,
                })
            }
        })

        return NextResponse.json({ success: true, data: results, totalDistributed: total - remaining })
    } catch (err: any) {
        console.error('Bulk sibling payment error:', err)
        return NextResponse.json({ error: err.message || 'Failed to process bulk payment' }, { status: 500 })
    }
}
