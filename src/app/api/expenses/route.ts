import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAuth } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const expenses = await prisma.expense.findMany({
            where: { tenantId: user!.tenantId },
            orderBy: { date: 'desc' }
        })
        return NextResponse.json({ success: true, data: expenses })
    } catch (err) {
        console.error('Fetch expenses error:', err)
        return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const body = await req.json()
        const { category, amount, date, description, paidTo } = body

        if (!category || !amount || !date) {
            return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
        }

        const expense = await prisma.expense.create({
            data: {
                tenantId: user!.tenantId,
                category,
                amount: parseFloat(amount),
                date: new Date(date),
                description: description || '',
                paidTo: paidTo || '',
            }
        })
        return NextResponse.json({ success: true, data: expense }, { status: 201 })
    } catch (err) {
        console.error('Create expense error:', err)
        return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
    }
}
