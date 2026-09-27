import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, signAccessToken, signRefreshToken } from '@/lib/auth'

// Generate a URL-friendly slug from school name
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50)
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            // School info
            schoolName,
            schoolAddress,
            schoolPhone,
            schoolEmail,
            // Director/Super Admin info
            directorName,
            directorPhone,
            directorEmail,
            // Auth
            email,
            password,
        } = body

        if (!schoolName || !directorName || !email || !password) {
            return NextResponse.json({
                error: 'School name, director name, email and password are required'
            }, { status: 400 })
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
        }

        // Check if email already in use
        const existingUser = await prisma.user.findFirst({
            where: { email: email.toLowerCase() }
        })
        if (existingUser) {
            return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
        }

        // Generate unique slug
        let baseSlug = generateSlug(schoolName)
        let slug = baseSlug
        let count = 1
        while (await prisma.tenant.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${count++}`
        }

        const hashedPassword = await hashPassword(password)

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the tenant (school)
            const tenant = await tx.tenant.create({
                data: {
                    name: schoolName,
                    slug,
                    address: schoolAddress || null,
                    phone: schoolPhone || null,
                    email: schoolEmail || null,
                    isActive: true,
                    // Director info captured at signup
                    directorName,
                    directorPhone: directorPhone || null,
                    directorEmail: directorEmail || email,
                }
            })

            // 2. Create the SUPER_ADMIN user
            const user = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: email.toLowerCase(),
                    phone: directorPhone || null,
                    password: hashedPassword,
                    plainPassword: password,
                    name: directorName,
                    role: 'SUPER_ADMIN',
                    isActive: true,
                }
            })

            // 3. Create a trial subscription
            const trialEnd = new Date()
            trialEnd.setDate(trialEnd.getDate() + 30) // 30 day trial

            await tx.subscription.create({
                data: {
                    tenantId: tenant.id,
                    plan: 'BASIC',
                    status: 'TRIAL',
                    trialEndsAt: trialEnd,
                }
            })

            return { tenant, user }
        })

        const payload = {
            userId: result.user.id,
            tenantId: result.tenant.id,
            role: 'SUPER_ADMIN',
            email: email.toLowerCase(),
        }

        const accessToken = signAccessToken(payload)
        const refreshToken = signRefreshToken(payload)

        return NextResponse.json({
            success: true,
            message: 'School registered successfully! Welcome to Scalevo.',
            accessToken,
            refreshToken,
            user: {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                role: 'SUPER_ADMIN',
                tenantId: result.tenant.id,
            },
            tenant: {
                id: result.tenant.id,
                name: result.tenant.name,
                slug: result.tenant.slug,
                themeColor: result.tenant.themeColor,
            }
        }, { status: 201 })
    } catch (error) {
        console.error('School signup error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
