import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/app/api/middleware'

export async function POST(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    // Only SUPER_ADMIN can generate TC
    if (user!.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only Super Admin can generate Transfer Certificates' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { studentId, scholarNo, studentName, fatherName, tcNumber } = body

        if (!studentId || !scholarNo || !studentName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

        // Create TC record
        const tc = await prisma.transferCertificate.create({
            data: {
                tenantId: user!.tenantId,
                studentId,
                scholarNo,
                studentName,
                fatherName: fatherName || '',
                tcNumber,
                issueDate: new Date(),
            }
        })

        return NextResponse.json({ success: true, data: tc })
    } catch (err) {
        console.error('TC Generation Error:', err)
        return NextResponse.json({ error: 'Failed to record Transfer Certificate' }, { status: 500 })
    }
}
