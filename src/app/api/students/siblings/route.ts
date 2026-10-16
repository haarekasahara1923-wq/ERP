import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAuth, requireWriteAccess } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

const MAX_SIBLINGS = 3

// GET /api/students/siblings?studentId=xxx  → returns all siblings of given student
export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const { studentId } = Object.fromEntries(new URL(req.url).searchParams.entries())
        if (!studentId) return NextResponse.json({ error: 'studentId is required' }, { status: 400 })

        // Fetch sibling records where student is either A or B
        const siblingLinks = await prisma.sibling.findMany({
            where: {
                tenantId: user!.tenantId,
                OR: [{ studentAId: studentId }, { studentBId: studentId }]
            },
            include: {
                studentA: {
                    select: {
                        id: true, fullName: true, scholarNo: true, phone: true,
                        course: { select: { name: true } },
                        batch: { select: { name: true } },
                        totalFee: true, paidFee: true, status: true
                    }
                },
                studentB: {
                    select: {
                        id: true, fullName: true, scholarNo: true, phone: true,
                        course: { select: { name: true } },
                        batch: { select: { name: true } },
                        totalFee: true, paidFee: true, status: true
                    }
                }
            }
        })

        // Return the "other" student in each sibling link
        const siblings = siblingLinks.map((link) => {
            const sibling = link.studentAId === studentId ? link.studentB : link.studentA
            return {
                siblingLinkId: link.id,
                ...sibling,
                courseName: sibling.course.name,
                batchName: sibling.batch.name,
            }
        })

        return NextResponse.json({ success: true, data: siblings })
    } catch (err) {
        console.error('Fetch siblings error:', err)
        return NextResponse.json({ error: 'Failed to fetch siblings' }, { status: 500 })
    }
}

// POST /api/students/siblings  body: { studentId, siblingId }
export async function POST(req: NextRequest) {
    const { error, user } = requireWriteAccess(req)
    if (error) return error

    try {
        const { studentId, siblingId } = await req.json()
        if (!studentId || !siblingId) return NextResponse.json({ error: 'studentId and siblingId are required' }, { status: 400 })
        if (studentId === siblingId) return NextResponse.json({ error: 'A student cannot be their own sibling' }, { status: 400 })

        // Both students must belong to this tenant
        const [studentA, studentB] = await Promise.all([
            prisma.student.findFirst({ where: { id: studentId, tenantId: user!.tenantId } }),
            prisma.student.findFirst({ where: { id: siblingId, tenantId: user!.tenantId } }),
        ])
        if (!studentA) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
        if (!studentB) return NextResponse.json({ error: 'Sibling student not found' }, { status: 404 })

        // Check if already linked
        const existing = await prisma.sibling.findFirst({
            where: {
                tenantId: user!.tenantId,
                OR: [
                    { studentAId: studentId, studentBId: siblingId },
                    { studentAId: siblingId, studentBId: studentId }
                ]
            }
        })
        if (existing) return NextResponse.json({ error: 'These students are already linked as siblings' }, { status: 409 })

        // Count existing siblings for studentId (A side + B side)
        const countForA = await prisma.sibling.count({
            where: { tenantId: user!.tenantId, OR: [{ studentAId: studentId }, { studentBId: studentId }] }
        })
        if (countForA >= MAX_SIBLINGS) {
            return NextResponse.json({ error: `Maximum ${MAX_SIBLINGS} siblings allowed per student` }, { status: 400 })
        }

        // Count existing siblings for siblingId
        const countForB = await prisma.sibling.count({
            where: { tenantId: user!.tenantId, OR: [{ studentAId: siblingId }, { studentBId: siblingId }] }
        })
        if (countForB >= MAX_SIBLINGS) {
            return NextResponse.json({ error: `The selected student already has ${MAX_SIBLINGS} siblings linked` }, { status: 400 })
        }

        // Always store with lower id as A to avoid duplicate issues
        const [aId, bId] = studentId < siblingId ? [studentId, siblingId] : [siblingId, studentId]
        const link = await prisma.sibling.create({
            data: {
                tenantId: user!.tenantId,
                studentAId: aId,
                studentBId: bId,
            }
        })

        return NextResponse.json({ success: true, data: link }, { status: 201 })
    } catch (err: any) {
        console.error('Add sibling error:', err)
        if (err.code === 'P2002') return NextResponse.json({ error: 'These students are already linked as siblings' }, { status: 409 })
        return NextResponse.json({ error: 'Failed to add sibling' }, { status: 500 })
    }
}

// DELETE /api/students/siblings?linkId=xxx
export async function DELETE(req: NextRequest) {
    const { error, user } = requireWriteAccess(req)
    if (error) return error

    try {
        const { linkId } = Object.fromEntries(new URL(req.url).searchParams.entries())
        if (!linkId) return NextResponse.json({ error: 'linkId is required' }, { status: 400 })

        await prisma.sibling.delete({
            where: { id: linkId, tenantId: user!.tenantId }
        })

        return NextResponse.json({ success: true, message: 'Sibling link removed' })
    } catch (err: any) {
        console.error('Delete sibling error:', err)
        return NextResponse.json({ error: err.message || 'Failed to remove sibling' }, { status: 500 })
    }
}
