import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, signAccessToken, signRefreshToken } from '@/lib/auth'

// These roles can ONLY be created by super admin, not via self-registration
const ADMIN_ONLY_ROLES = ['ADMIN_OPERATION', 'ADMIN_LIBRARY', 'ADMIN_SPORTS', 'ADMIN_TRANSPORT', 'COACHING_ADMIN']

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { name, email, password, phone, role, tenantId } = body

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, email/phone, and password are required' }, { status: 400 })
        }

        const userRole = role || 'STUDENT'

        // Block sub-admin self-registration — only super admin can create those
        if (ADMIN_ONLY_ROLES.includes(userRole)) {
            return NextResponse.json({ error: 'Admin accounts are created by the Super Admin. Please contact your school administration.' }, { status: 403 })
        }

        // Determine email / phone from identifier
        const isRealEmail = email.includes('@') && !email.includes('@udba.local')
        const resolvedEmail = isRealEmail ? email.toLowerCase() : `${phone || email}@udba.local`
        const resolvedPhone = phone || (isRealEmail ? undefined : email)

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: resolvedEmail },
                    ...(resolvedPhone ? [{ phone: resolvedPhone }] : []),
                ]
            }
        })
        if (existingUser) {
            return NextResponse.json({ error: 'An account with this email/phone already exists' }, { status: 409 })
        }

        const hashedPassword = await hashPassword(password)

        // In multitenant mode, we need a tenantId
        // For school-registered users (SUPER_ADMIN through school-signup), they already have a tenant
        // For other registrations (students, teachers etc.) they need to be invited by their school admin
        let targetTenantId = tenantId
        let school = null

        if (targetTenantId) {
            school = await prisma.tenant.findUnique({ where: { id: targetTenantId } })
        }

        // Legacy single-school support (env var)
        if (!school) {
            const schoolSlug = process.env.NEXT_PUBLIC_SCHOOL_SLUG
            if (schoolSlug) {
                school = await prisma.tenant.findFirst({ where: { slug: schoolSlug } })
            }
        }

        // For SUPER_ADMIN: Direct through school-signup route preferred;
        // but if somehow they end up here, find or warn.
        if (!school && userRole === 'SUPER_ADMIN') {
            school = await prisma.tenant.findFirst()
        }

        if (!school) {
            return NextResponse.json({ error: 'School configuration not found. Please contact administration.' }, { status: 404 })
        }

        const resolvedTenantId = school.id

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    tenantId: resolvedTenantId,
                    email: resolvedEmail,
                    phone: resolvedPhone || null,
                    password: hashedPassword,
                    plainPassword: password,
                    name,
                    role: userRole as any,
                    isActive: true,
                }
            })

            let studentId = null

            if (userRole === 'STUDENT') {
                const existingStudent = await tx.student.findFirst({
                    where: {
                        tenantId: resolvedTenantId,
                        OR: [
                            { email: resolvedEmail },
                            ...(resolvedPhone ? [{ phone: resolvedPhone }] : []),
                        ]
                    }
                })

                if (existingStudent) {
                    await tx.student.update({ where: { id: existingStudent.id }, data: { userId: user.id } })
                    studentId = existingStudent.id
                } else {
                    let dummyCourse = await tx.course.findFirst({ where: { tenantId: resolvedTenantId } })
                    if (!dummyCourse) {
                        dummyCourse = await tx.course.create({ data: { tenantId: resolvedTenantId, name: 'Class 10' } })
                    }
                    let dummyBatch = await tx.batch.findFirst({ where: { tenantId: resolvedTenantId } })
                    if (!dummyBatch) {
                        dummyBatch = await tx.batch.create({ data: { tenantId: resolvedTenantId, courseId: dummyCourse.id, name: 'Section A' } })
                    }
                    const newStudent = await tx.student.create({
                        data: {
                            tenantId: resolvedTenantId,
                            userId: user.id,
                            fullName: name,
                            phone: resolvedPhone || null,
                            courseId: dummyCourse.id,
                            batchId: dummyBatch.id,
                            status: 'ACTIVE',
                        }
                    })
                    studentId = newStudent.id
                }
            } else if (userRole === 'PARENT') {
                await tx.parentProfile.create({
                    data: {
                        tenantId: resolvedTenantId,
                        userId: user.id,
                        name,
                        phone: resolvedPhone || null,
                    }
                })
            } else if (userRole === 'TEACHER') {
                await tx.teacher.create({
                    data: {
                        tenantId: resolvedTenantId,
                        name,
                        email: resolvedEmail,
                        phone: resolvedPhone || null,
                    }
                })
            } else if (userRole === 'DRIVER') {
                await tx.driverProfile.create({
                    data: {
                        tenantId: resolvedTenantId,
                        userId: user.id,
                        phone: resolvedPhone || null,
                        isActive: true
                    }
                })
            }

            return { tenant: school, user, studentId }
        })

        const payload = { userId: result.user.id, tenantId: resolvedTenantId, role: userRole, email: resolvedEmail }
        const accessToken = signAccessToken(payload)
        const refreshToken = signRefreshToken(payload)

        return NextResponse.json({
            success: true,
            message: 'Registration successful',
            accessToken,
            refreshToken,
            user: { id: result.user.id, name, email: resolvedEmail, role: userRole, tenantId: resolvedTenantId, studentId: result.studentId || null },
            tenant: { id: school.id, name: school.name, themeColor: school.themeColor },
        }, { status: 201 })
    } catch (error) {
        console.error('Register error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
