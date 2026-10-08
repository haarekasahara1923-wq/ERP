export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/app/api/middleware'

/**
 * GET /api/students/tc
 * Returns the next sequential TC number for this tenant.
 * Format: TC-YYYY-NNNN  (e.g. TC-2026-0001, TC-2026-0002 …)
 */
export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    if (user!.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only Super Admin can access TC data' }, { status: 403 })
    }

    try {
        const year = new Date().getFullYear()

        // Find the last TC issued for this tenant in the current year
        const lastTc = await prisma.transferCertificate.findFirst({
            where: {
                tenantId: user!.tenantId,
                tcNumber: { startsWith: `TC-${year}-` }
            },
            orderBy: { createdAt: 'desc' }
        })

        let nextSeq = 1
        if (lastTc?.tcNumber) {
            // Parse the sequence number from "TC-YYYY-NNNN"
            const parts = lastTc.tcNumber.split('-')
            const lastSeq = parseInt(parts[parts.length - 1], 10)
            if (!isNaN(lastSeq)) nextSeq = lastSeq + 1
        }

        const nextTcNumber = `TC-${year}-${String(nextSeq).padStart(4, '0')}`

        return NextResponse.json({ success: true, nextTcNumber })
    } catch (err) {
        console.error('TC Number fetch error:', err)
        return NextResponse.json({ error: 'Failed to generate TC number' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    // Only SUPER_ADMIN can generate TC
    if (user!.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only Super Admin can generate Transfer Certificates' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { studentId, scholarNo, studentName, fatherName, tcNumber, issueDate } = body

        if (!studentId || !scholarNo || !studentName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        if (!issueDate) {
            return NextResponse.json({ error: 'Date of Issue is required' }, { status: 400 })
        }

        // Parse the admin-provided date (format: YYYY-MM-DD)
        const parsedIssueDate = new Date(issueDate + 'T00:00:00')
        if (isNaN(parsedIssueDate.getTime())) {
            return NextResponse.json({ error: 'Invalid Date of Issue' }, { status: 400 })
        }

        // Duplicate check
        const existingTc = await prisma.transferCertificate.findFirst({
            where: {
                tenantId: user!.tenantId,
                scholarNo: { equals: scholarNo, mode: 'insensitive' },
                studentName: { equals: studentName, mode: 'insensitive' },
                fatherName: { equals: fatherName || '', mode: 'insensitive' },
            }
        })

        if (existingTc) {
            return NextResponse.json({ 
                error: `Transfer Certificate already generated for this student on ${existingTc.issueDate.toLocaleDateString('en-IN')}`, 
                code: 'DUPLICATE_TC' 
            }, { status: 409 })
        }

        // Create TC record with admin-provided issue date
        const tc = await prisma.transferCertificate.create({
            data: {
                tenantId: user!.tenantId,
                studentId,
                scholarNo,
                studentName,
                fatherName: fatherName || '',
                tcNumber,
                issueDate: parsedIssueDate,
            }
        })

        return NextResponse.json({ success: true, data: tc })
    } catch (err) {
        console.error('TC Generation Error:', err)
        return NextResponse.json({ error: 'Failed to record Transfer Certificate' }, { status: 500 })
    }
}
