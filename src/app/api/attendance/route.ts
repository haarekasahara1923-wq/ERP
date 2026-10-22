import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAuth } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const { batchId, courseId, classId, studentId, date } = Object.fromEntries(new URL(req.url).searchParams.entries())
        
        const where: any = { tenantId: user!.tenantId }
        const resolvedCourseId = courseId || classId
        if (resolvedCourseId) {
            where.student = { ...(where.student || {}), courseId: resolvedCourseId }
        }
        if (batchId) {
            where.batchId = batchId
        }
        if (studentId) {
            where.studentId = studentId
        }
        if (date) {
            const dateStr = date.split('T')[0]
            const [y, m, d] = dateStr.split('-').map(Number)
            const startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
            const endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
            where.date = { gte: startDate, lte: endDate }
        }

        const attendances = await prisma.attendance.findMany({
            where,
            include: { 
                student: { 
                    select: { 
                        id: true,
                        fullName: true,
                        studentId: true,
                        scholarNo: true,
                        courseId: true,
                        batchId: true,
                        course: { select: { id: true, name: true } },
                        batch: { select: { id: true, name: true } }
                    } 
                },
                batch: { select: { id: true, name: true } }
            },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
        })

        // De-duplicate if multiple records exist for the same student on the same date (keep most recently updated)
        const studentSeen = new Set<string>()
        const uniqueAttendances: typeof attendances = []
        for (const a of attendances) {
            if (a.studentId) {
                const key = `${a.studentId}_${new Date(a.date).toISOString().split('T')[0]}`
                if (studentSeen.has(key)) continue
                studentSeen.add(key)
            }
            uniqueAttendances.push(a)
        }

        const data = uniqueAttendances.map(a => ({
            ...a,
            studentName: a.student?.fullName || 'Unknown',
            scholarNo: a.student?.scholarNo || a.student?.studentId || '',
            studentCode: a.student?.studentId || '',
            className: a.student?.course?.name || '',
            batchName: a.batch?.name || a.student?.batch?.name || '',
        }))

        return NextResponse.json({ success: true, data })
    } catch (err) {
        console.error('Fetch attendance error:', err)
        return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const body = await req.json()
        const records = body.records || [body]

        if (!Array.isArray(records) || records.length === 0) {
            return NextResponse.json({ error: 'Invalid record format or empty records' }, { status: 400 })
        }

        // Determine target date from records
        const firstDateStr = (records[0]?.date || new Date().toISOString()).split('T')[0]
        const [y, m, d] = firstDateStr.split('-').map(Number)
        const startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
        const endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
        const recordDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))

        const studentIds = records.map((r: any) => r.studentId).filter(Boolean)
        
        // Find existing records for these students on this date to upsert
        const existingRecords = await prisma.attendance.findMany({
            where: {
                tenantId: user!.tenantId,
                studentId: { in: studentIds },
                date: { gte: startDate, lte: endDate }
            }
        })
        const existingMap = new Map<string, string>() // studentId -> attendance.id
        existingRecords.forEach(er => {
            if (er.studentId) existingMap.set(er.studentId, er.id)
        })

        const operations = records.map((r: any) => {
            const existingId = existingMap.get(r.studentId)
            if (existingId) {
                return prisma.attendance.update({
                    where: { id: existingId },
                    data: {
                        status: (r.status || 'PRESENT') as any,
                        batchId: r.batchId || null,
                        markedBy: user!.userId,
                        notes: r.notes || '',
                        updatedAt: new Date()
                    }
                })
            } else {
                return prisma.attendance.create({
                    data: {
                        tenantId: user!.tenantId,
                        studentId: r.studentId,
                        batchId: r.batchId || null,
                        date: recordDate,
                        status: (r.status || 'PRESENT') as any,
                        markedBy: user!.userId,
                        notes: r.notes || '',
                    }
                })
            }
        })

        const saved = await prisma.$transaction(operations)

        // Asynchronously notify parents
        for (const r of records) {
            const student = await prisma.student.findUnique({
                where: { id: r.studentId },
                include: { parentLinks: true }
            })
            if (student && student.parentLinks.length > 0) {
                for (const parent of student.parentLinks) {
                    await prisma.notification.create({
                        data: {
                            tenantId: user!.tenantId,
                            title: `Attendance Marked: ${student.fullName}`,
                            message: `${student.fullName} has been marked ${r.status} on ${recordDate.toLocaleDateString('en-IN')}.`,
                            type: 'ATTENDANCE',
                            targetRole: 'PARENT',
                            targetId: parent.userId,
                        }
                    })
                    // Send push notification
                    try {
                        const subscriptions = await prisma.pushSubscription.findMany({
                            where: { userId: parent.userId }
                        })
                        for (const sub of subscriptions) {
                            await sendWebPush(sub, `Attendance: ${student.fullName}`, `${student.fullName} is marked ${r.status}`)
                        }
                    } catch (e) {
                        console.error('Push notification send error:', e)
                    }
                }
            }
        }

        return NextResponse.json({ success: true, count: saved.length, data: saved }, { status: 201 })
    } catch (err) {
        console.error('Create/update attendance error:', err)
        return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 })
    }
}

// Simple web push sender helper function
async function sendWebPush(sub: any, title: string, body: string) {
    const webpush = require('web-push')
    // Generate VAPID keys if not set (or use dummy/placeholder)
    const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || 'BFG54n2XjD6u05w21Zsz2g5p7fR9n...'
    const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'uKq6K9m7Q...'
    
    webpush.setVapidDetails(
        'mailto:info@udba.space',
        publicVapidKey,
        privateVapidKey
    )

    const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
            auth: sub.auth,
            p256dh: sub.p256dh
        }
    }

    await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({ title, body })
    )
}
