import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAuth, requireWriteAccess } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    const url = new URL(req.url)
    const teacherId = url.searchParams.get('teacherId')
    const batchId = url.searchParams.get('batchId')

    try {
        let whereClause: any = { tenantId: user!.tenantId }
        
        if (teacherId) whereClause.teacherId = teacherId
        if (batchId) whereClause.batchId = batchId

        const timetables = await prisma.timeTable.findMany({
            where: whereClause,
            include: {
                teacher: { select: { id: true, name: true } },
                course: { select: { id: true, name: true } },
                batch: { select: { id: true, name: true } }
            },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
        })

        return NextResponse.json({ success: true, data: timetables })
    } catch (err) {
        console.error('Fetch timetable error:', err)
        return NextResponse.json({ error: 'Failed to fetch timetable' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const body = await req.json()
        let { teacherId, courseId, batchId, subject, dayOfWeek, startTime, endTime } = body

        // If a TEACHER is posting, auto-resolve their teacherId
        if (user!.role === 'TEACHER') {
            const teacherProfile = await prisma.teacher.findFirst({
                where: { tenantId: user!.tenantId, userId: user!.userId }
            })
            if (!teacherProfile) {
                return NextResponse.json({ error: 'Teacher profile not linked to your account' }, { status: 403 })
            }
            teacherId = teacherProfile.id
        }

        if (!teacherId || !subject || dayOfWeek === undefined || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const isAdmin = user!.role === 'SUPER_ADMIN' || user!.role === 'COACHING_ADMIN'

        const tt = await prisma.timeTable.create({
            data: {
                tenantId: user!.tenantId,
                teacherId,
                courseId,
                batchId,
                subject,
                dayOfWeek: parseInt(dayOfWeek),
                startTime,
                endTime,
                status: isAdmin ? 'PUBLISHED' : 'PENDING_APPROVAL'
            }
        })

        return NextResponse.json({ success: true, data: tt })
    } catch (err) {
        console.error('Create timetable error:', err)
        return NextResponse.json({ error: 'Failed to create timetable entry' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    const { error, user } = requireWriteAccess(req)
    if (error) return error

    if (user!.role !== 'SUPER_ADMIN' && user!.role !== 'COACHING_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized to approve timetable' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { id, status } = body

        if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

        const tt = await prisma.timeTable.update({
            where: { id, tenantId: user!.tenantId },
            data: { status }
        })

        return NextResponse.json({ success: true, data: tt })
    } catch (err) {
        console.error('Update timetable error:', err)
        return NextResponse.json({ error: 'Failed to update timetable entry' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    const { error, user } = requireWriteAccess(req)
    if (error) return error

    try {
        const url = new URL(req.url)
        const id = url.searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

        await prisma.timeTable.delete({
            where: { id, tenantId: user!.tenantId }
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Delete timetable error:', err)
        return NextResponse.json({ error: 'Failed to delete timetable entry' }, { status: 500 })
    }
}
