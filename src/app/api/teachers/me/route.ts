import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAuth } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

// GET /api/teachers/me — returns the Teacher profile linked to the logged-in user
export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        // Find the Teacher record whose userId matches the logged-in user
        const teacher = await prisma.teacher.findFirst({
            where: {
                tenantId: user!.tenantId,
                userId: user!.userId,
            }
        })

        if (!teacher) {
            return NextResponse.json({ success: false, error: 'Teacher profile not found for this user' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: teacher })
    } catch (err) {
        console.error('Fetch teacher profile error:', err)
        return NextResponse.json({ error: 'Failed to fetch teacher profile' }, { status: 500 })
    }
}
