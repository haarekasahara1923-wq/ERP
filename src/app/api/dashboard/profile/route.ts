import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1]
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        
        const user = verifyAccessToken(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const tenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: {
                id: true,
                name: true,
                slug: true,
                schoolCode: true,
                registrationCode: true,
                diseCode: true,
                logo: true,
                themeColor: true,
                address: true,
                phone: true,
                email: true,
                website: true,
                directorSign: true,
            }
        })

        if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

        return NextResponse.json({ success: true, tenant })
    } catch (error) {
        console.error('Profile fetch error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PUT(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1]
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        
        const user = verifyAccessToken(token)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { name, phone, email, address, themeColor, logo, registrationCode, diseCode, schoolCode, directorSign } = body

        if (user.role !== 'SUPER_ADMIN' && user.role !== 'COACHING_ADMIN') {
            return NextResponse.json({ error: 'Only Super Admin can update school profile' }, { status: 403 })
        }

        const updatedTenant = await prisma.tenant.update({
            where: { id: user.tenantId },
            data: {
                ...(name ? { name } : {}),
                ...(phone !== undefined ? { phone } : {}),
                ...(email !== undefined ? { email } : {}),
                ...(address !== undefined ? { address } : {}),
                ...(themeColor !== undefined ? { themeColor } : {}),
                ...(registrationCode !== undefined ? { registrationCode } : {}),
                ...(diseCode !== undefined ? { diseCode } : {}),
                ...(schoolCode !== undefined && schoolCode ? { schoolCode } : {}),
                ...(directorSign !== undefined ? { directorSign } : {}),
                ...(logo ? { logo } : {})
            }
        })

        return NextResponse.json({ success: true, tenant: updatedTenant })
    } catch (error) {
        console.error('Profile update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
