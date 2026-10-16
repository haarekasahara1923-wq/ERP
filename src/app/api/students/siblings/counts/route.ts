import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAuth } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/students/siblings/counts
 * Returns an array of student IDs that have at least one sibling link.
 * Used to show the "+" badge on the students list.
 */
export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const siblingLinks = await prisma.sibling.findMany({
            where: { tenantId: user!.tenantId },
            select: { studentAId: true, studentBId: true }
        })

        const studentIds = new Set<string>()
        siblingLinks.forEach((link) => {
            studentIds.add(link.studentAId)
            studentIds.add(link.studentBId)
        })

        return NextResponse.json({ success: true, data: Array.from(studentIds) })
    } catch (err) {
        console.error('Fetch sibling counts error:', err)
        return NextResponse.json({ error: 'Failed to fetch sibling counts' }, { status: 500 })
    }
}
