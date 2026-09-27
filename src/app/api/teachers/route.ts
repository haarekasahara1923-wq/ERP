import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAuth, requireWriteAccess, checkPlanLimit } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const teachers = await prisma.teacher.findMany({
            where: { tenantId: user!.tenantId },
            orderBy: { createdAt: 'desc' }
        })

        // Include plan limit info in response
        const limitCheck = await checkPlanLimit(user!.tenantId, 'maxTeachers', teachers.length)

        return NextResponse.json({
            success: true,
            data: teachers,
            total: teachers.length,
            planInfo: {
                limit: limitCheck.limit,
                used: teachers.length,
                currentPlan: limitCheck.currentPlan,
                canAdd: limitCheck.allowed,
            },
        })
    } catch (err) {
        console.error('Fetch teachers error:', err)
        return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        // Check plan limit before adding
        const currentCount = await prisma.teacher.count({ where: { tenantId: user!.tenantId } })
        const limitCheck = await checkPlanLimit(user!.tenantId, 'maxTeachers', currentCount)

        if (!limitCheck.allowed) {
            return NextResponse.json({
                error: limitCheck.message,
                code: 'PLAN_LIMIT_REACHED',
                currentPlan: limitCheck.currentPlan,
                limit: limitCheck.limit,
                used: currentCount,
            }, { status: 403 })
        }

        const body = await req.json()
        const { name, email, phone, subject, salary, joinDate } = body

        if (!name || !phone) {
            return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
        }

        const teacher = await prisma.teacher.create({
            data: {
                tenantId: user!.tenantId,
                name,
                email: email || '',
                phone,
                subject: Array.isArray(subject) ? subject : subject ? [subject] : [],
                salary: parseFloat(salary) || 0,
                joinDate: joinDate ? new Date(joinDate) : new Date(),
                isActive: true,
            }
        })

        return NextResponse.json({ success: true, data: teacher }, { status: 201 })
    } catch (err) {
        console.error('Create teacher error:', err)
        return NextResponse.json({ error: 'Failed to create teacher' }, { status: 500 })
    }
}
