import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAuth, requireWriteAccess } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    const url = new URL(req.url)
    const dateStr = url.searchParams.get('date')
    const teacherId = url.searchParams.get('teacherId')

    try {
        let whereClause: any = { tenantId: user!.tenantId }
        
        if (dateStr) {
            const startOfDay = new Date(dateStr)
            startOfDay.setHours(0, 0, 0, 0)
            const endOfDay = new Date(dateStr)
            endOfDay.setHours(23, 59, 59, 999)
            
            whereClause.date = {
                gte: startOfDay,
                lte: endOfDay
            }
        }
        
        if (teacherId) {
            whereClause.teacherId = teacherId
        } else {
            // Only fetch teacher attendances (where studentId is null)
            whereClause.studentId = null
        }

        const attendances = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                teacher: {
                    select: { id: true, name: true, photo: true }
                }
            },
            orderBy: { date: 'desc' }
        })

        return NextResponse.json({ success: true, data: attendances })
    } catch (err) {
        console.error('Fetch teacher attendance error:', err)
        return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    const isAdmin = user!.role === 'SUPER_ADMIN' || user!.role === 'COACHING_ADMIN' || user!.role === 'ADMIN_OPERATION'
    const isTeacher = user!.role === 'TEACHER'

    try {
        const body = await req.json()
        let { teacherId, date, status, inTime, outTime, notes } = body

        // If teacher is marking their own attendance
        if (isTeacher) {
            // Look up this user's teacher profile
            const teacherProfile = await prisma.teacher.findFirst({
                where: { tenantId: user!.tenantId, userId: user!.userId }
            })
            if (!teacherProfile) {
                return NextResponse.json({ error: 'Teacher profile not linked to your account' }, { status: 403 })
            }
            teacherId = teacherProfile.id
            // Teachers can only mark themselves PRESENT with in/out times (admin sets status)
            if (!inTime && !outTime) {
                status = 'PRESENT'
            }
        } else if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        if (!teacherId || !date) {
            return NextResponse.json({ error: 'teacherId and date are required' }, { status: 400 })
        }

        // Admin must provide status; teacher defaults to PRESENT
        if (!status) status = 'PRESENT'

        const attendanceDate = new Date(date)
        attendanceDate.setHours(0, 0, 0, 0)
        
        const nextDay = new Date(attendanceDate)
        nextDay.setDate(nextDay.getDate() + 1)

        // Find if attendance already exists for this teacher on this day
        const existing = await prisma.attendance.findFirst({
            where: {
                tenantId: user!.tenantId,
                teacherId,
                date: {
                    gte: attendanceDate,
                    lt: nextDay
                }
            }
        })

        let record;
        if (existing) {
            // Update
            record = await prisma.attendance.update({
                where: { id: existing.id },
                data: {
                    status,
                    inTime: inTime !== undefined ? inTime : existing.inTime,
                    outTime: outTime !== undefined ? outTime : existing.outTime,
                    notes: notes !== undefined ? notes : existing.notes,
                    markedBy: (user as any).name || 'System'
                }
            })
        } else {
            // Create
            record = await prisma.attendance.create({
                data: {
                    tenantId: user!.tenantId,
                    teacherId,
                    date: attendanceDate,
                    status,
                    inTime,
                    outTime,
                    notes,
                    markedBy: (user as any).name || 'System'
                }
            })
        }

        return NextResponse.json({ success: true, data: record })
    } catch (err) {
        console.error('Save teacher attendance error:', err)
        return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 })
    }
}
