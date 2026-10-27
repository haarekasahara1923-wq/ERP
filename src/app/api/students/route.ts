import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { requireAuth, requireWriteAccess, checkPlanLimit } from '@/app/api/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const { search, searchBy, course, courseId, batch, batchId, status } = Object.fromEntries(
            new URL(req.url).searchParams.entries()
        )

        const where: any = { tenantId: user!.tenantId }
        const resolvedCourseId = course || courseId
        const resolvedBatchId = batch || batchId
        if (resolvedCourseId) where.courseId = resolvedCourseId
        if (resolvedBatchId) where.batchId = resolvedBatchId
        if (status) where.status = status
        if (search && search.trim()) {
            const query = search.trim()
            if (searchBy === 'name') {
                where.fullName = { contains: query, mode: 'insensitive' }
            } else if (searchBy === 'scholarNo') {
                where.OR = [
                    { scholarNo: { contains: query, mode: 'insensitive' } },
                    { studentId: { contains: query, mode: 'insensitive' } }
                ]
            } else if (searchBy === 'phone') {
                where.phone = { contains: query }
            } else {
                where.OR = [
                    { fullName: { contains: query, mode: 'insensitive' } },
                    { phone: { contains: query } },
                    { studentId: { contains: query, mode: 'insensitive' } },
                    { scholarNo: { contains: query, mode: 'insensitive' } },
                ]
            }
        }

        const students = await prisma.student.findMany({
            where,
            include: {
                course: { select: { name: true, subjects: true } },
                batch: { select: { name: true } },
                parentLinks: { 
                    include: { 
                        user: { 
                            select: { 
                                id: true, 
                                email: true, 
                                phone: true, 
                                plainPassword: true, 
                                lastLogin: true 
                            } 
                        } 
                    } 
                },
                examResults: { include: { exam: true } }
            },
            orderBy: { createdAt: 'desc' }
        })

        // -- Parent Portal Detection (3-condition logic) ----------------------------
        // GREEN (parentLoggedIn=true) if ANY of these is satisfied:
        //   [1] Student has parentLinks (a parent explicitly linked this child in their portal)
        //   [2] student.parentPhone matches a PARENT user's phone number
        //   [3] student.parentPhone or student.email matches a PARENT user's email

        // Fetch all PARENT role users in this tenant
        const parentUsers = await prisma.user.findMany({
            where: { tenantId: user!.tenantId, role: 'PARENT' },
            select: { id: true, phone: true, email: true, plainPassword: true, lastLogin: true }
        })

        const normalizePhone = (num?: string | null) => {
            if (!num) return ''
            return num.replace(/\D/g, '').slice(-10)
        }

        // Build lookup maps: normalised phone and lowercase email
        const parentByPhone = new Map<string, typeof parentUsers[0]>()
        const parentByEmail = new Map<string, typeof parentUsers[0]>()
        parentUsers.forEach(pu => {
            const ph = normalizePhone(pu.phone)
            if (ph) parentByPhone.set(ph, pu)
            if (pu.email) parentByEmail.set(pu.email.toLowerCase().trim(), pu)
        })

        const data = students.map(s => {
            // CONDITION 1: Direct parent-link exists (parent added this child in portal)
            const linkedParentProfiles = s.parentLinks || []
            const hasDirectLink = linkedParentProfiles.length > 0
            const linkedUsers = linkedParentProfiles.map((pl: any) => pl.user).filter(Boolean)
            const bestLinkedUser = linkedUsers.find((u: any) => u.lastLogin) || linkedUsers[0] || null

            // CONDITION 2: parentPhone matches a PARENT user's phone
            const normParentPhone = normalizePhone(s.parentPhone)
            const normStudentPhone = normalizePhone(s.phone)
            const matchedByPhone =
                (normParentPhone ? parentByPhone.get(normParentPhone) : null) ||
                (normStudentPhone ? parentByPhone.get(normStudentPhone) : null) ||
                null

            // CONDITION 3: parentPhone or student email matches a PARENT user's email
            const parentPhoneStr = s.parentPhone?.toLowerCase().trim() || ''
            const studentEmailStr = s.email?.toLowerCase().trim() || ''
            const matchedByEmail =
                (parentPhoneStr ? parentByEmail.get(parentPhoneStr) : null) ||
                (studentEmailStr ? parentByEmail.get(studentEmailStr) : null) ||
                null

            // GREEN if ANY condition is satisfied
            const parentLinked = hasDirectLink || Boolean(matchedByPhone) || Boolean(matchedByEmail)

            // Best user to pull lastLogin / credentials from
            const candidates = [bestLinkedUser, matchedByPhone, matchedByEmail].filter(Boolean)
            const effectiveUser =
                candidates.find((u: any) => u?.lastLogin) ||
                candidates[0] ||
                null

            const parentLoggedIn = parentLinked
            const parentLastLogin = effectiveUser?.lastLogin
                ? new Date(effectiveUser.lastLogin).toISOString()
                : null

            return {
                ...s,
                courseName: s.course.name,
                courseSubjects: s.course.subjects || [],
                batchName: s.batch.name,
                parentEmail: effectiveUser?.email || s.parentLinks?.[0]?.user?.email || null,
                parentPassword: effectiveUser?.plainPassword || s.parentLinks?.[0]?.user?.plainPassword || null,
                parentLoggedIn,
                parentLastLogin,
                parentPortalStatus: parentLoggedIn ? 'LOGGED_IN' : 'NOT_LOGGED_IN',
                parentAccountFound: Boolean(effectiveUser),
                _parentLinkSource: hasDirectLink ? 'DIRECT_LINK' : matchedByPhone ? 'PHONE_MATCH' : matchedByEmail ? 'EMAIL_MATCH' : 'NONE'
            }
        })

        // Total count for plan limit
        const totalCount = await prisma.student.count({ where: { tenantId: user!.tenantId } })
        const limitCheck = await checkPlanLimit(user!.tenantId, 'maxStudents', totalCount)

        return NextResponse.json({
            success: true,
            data,
            total: data.length,
            planInfo: {
                limit: limitCheck.limit,
                used: totalCount,
                currentPlan: limitCheck.currentPlan,
                canAdd: limitCheck.allowed,
            },
        })
    } catch (err) {
        console.error('Fetch students error:', err)
        return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    const { error, user } = requireAuth(req)
    if (error) return error

    try {
        const currentCount = await prisma.student.count({ where: { tenantId: user!.tenantId } })
        const limitCheck = await checkPlanLimit(user!.tenantId, 'maxStudents', currentCount)

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
        const { 
            fullName, phone, courseId, batchId, fatherName, motherName, parentPhone, email, address, gender, dob, 
            admissionDate, feePlan, totalFee, previousDueFee, notes, aadhaarNo, penId, aparId, samagraId,
            scholarNo, caste, dobInWords, medium, firstAdmissionClass, firstAdmissionDate, scholarshipScheme, 
            bankName, bankAccountNo, ifsc, subjectGroup, photo
        } = body

        if (!fullName || !phone || !courseId || !batchId) {
            return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
        }

        // ── STRICT SCHOLAR NO DUPLICATE CHECK (First and foremost) ──
        if (scholarNo && scholarNo.trim()) {
            const cleanScholarNo = scholarNo.trim()
            const duplicateByScholar = await prisma.student.findFirst({
                where: {
                    tenantId: user!.tenantId,
                    scholarNo: { equals: cleanScholarNo, mode: 'insensitive' }
                },
                include: {
                    course: { select: { name: true } },
                    batch: { select: { name: true } }
                }
            })
            if (duplicateByScholar) {
                return NextResponse.json({
                    error: `Duplicate Entry Detected! Scholar No. "${cleanScholarNo}" is already assigned to student "${duplicateByScholar.fullName}" (Class: ${duplicateByScholar.course?.name || 'N/A'}, Father: ${duplicateByScholar.fatherName || 'N/A'}). Duplicate scholar number cannot be saved.`,
                    code: 'DUPLICATE_STUDENT',
                    existingStudent: {
                        id: duplicateByScholar.id,
                        fullName: duplicateByScholar.fullName,
                        scholarNo: duplicateByScholar.scholarNo,
                        fatherName: duplicateByScholar.fatherName || 'N/A',
                        studentId: duplicateByScholar.studentId || 'N/A',
                        className: duplicateByScholar.course?.name || 'N/A',
                        batchName: duplicateByScholar.batch?.name || 'N/A',
                        createdAt: duplicateByScholar.createdAt,
                    }
                }, { status: 409 })
            }
        }

        // Secondary check by Full Name + Father Name
        if (fullName && fatherName && fullName.trim() && fatherName.trim()) {
            const duplicateByNameFather = await prisma.student.findFirst({
                where: {
                    tenantId: user!.tenantId,
                    fullName: { equals: fullName.trim(), mode: 'insensitive' },
                    fatherName: { equals: fatherName.trim(), mode: 'insensitive' },
                },
                include: {
                    course: { select: { name: true } },
                    batch: { select: { name: true } }
                }
            })
            if (duplicateByNameFather) {
                return NextResponse.json({
                    error: `Student already exists! A student named "${duplicateByNameFather.fullName}" with Father's Name "${duplicateByNameFather.fatherName}" already exists with Scholar No. "${duplicateByNameFather.scholarNo || 'N/A'}".`,
                    code: 'DUPLICATE_STUDENT',
                    existingStudent: {
                        id: duplicateByNameFather.id,
                        fullName: duplicateByNameFather.fullName,
                        scholarNo: duplicateByNameFather.scholarNo,
                        fatherName: duplicateByNameFather.fatherName || 'N/A',
                        studentId: duplicateByNameFather.studentId || 'N/A',
                        className: duplicateByNameFather.course?.name || 'N/A',
                        batchName: duplicateByNameFather.batch?.name || 'N/A',
                        createdAt: duplicateByNameFather.createdAt,
                    }
                }, { status: 409 })
            }
        }

        const course = await prisma.course.findUnique({
            where: { id: courseId, tenantId: user!.tenantId }
        })

        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 })
        }

        // Calculate previous due fee
        const prevDue = parseFloat(previousDueFee) || 0
        // Total fee = if provided by admin form, use it directly (it includes base fee + prevDue); otherwise course.fees + prevDue
        const finalTotalFee = (totalFee !== undefined && totalFee !== '') 
            ? (parseFloat(totalFee) || 0) 
            : ((course.fees || 0) + prevDue)

        const student = await prisma.student.create({
            data: {
                tenantId: user!.tenantId,
                courseId,
                batchId,
                studentId: `STU${String(currentCount + 1).padStart(3, '0')}`,
                fullName,
                fatherName: fatherName || '',
                motherName: motherName || '',
                phone,
                parentPhone: parentPhone || '',
                email: email || '',
                address: address || '',
                gender: gender as any || 'MALE',
                dob: dob ? new Date(dob) : null,
                admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
                feePlan: feePlan || '',
                previousDueFee: prevDue,
                totalFee: finalTotalFee,
                paidFee: 0,
                status: 'ACTIVE',
                notes: notes || '',
                aadhaarNo: aadhaarNo || '',
                penId: penId || '',
                aparId: aparId || '',
                samagraId: samagraId || '',
                scholarNo: scholarNo || '',
                caste: caste || '',
                dobInWords: dobInWords || '',
                medium: medium || '',
                firstAdmissionClass: firstAdmissionClass || '',
                firstAdmissionDate: firstAdmissionDate ? new Date(firstAdmissionDate) : null,
                scholarshipScheme: scholarshipScheme || '',
                bankName: bankName || '',
                bankAccountNo: bankAccountNo || '',
                ifsc: ifsc || '',
                subjectGroup: subjectGroup || '',
                photo: photo || null,
            }
        })

        const admDate = admissionDate ? new Date(admissionDate) : new Date()

        // If there's a previous due fee, create a dedicated fee slot for it (Slot 0 / Previous Year Due)
        if (prevDue > 0) {
            await prisma.fee.create({
                data: {
                    tenantId: user!.tenantId,
                    studentId: student.id,
                    amount: prevDue,
                    dueDate: admDate,
                    status: 'PENDING',
                    notes: 'Previous Year Due (पिछले वर्ष की बकाया फीस)'
                }
            })
        }

        // Create 6 Fee installments (blank slots as requested by user)
        for (let i = 0; i < 6; i++) {
            const dueDate = new Date(admDate)
            dueDate.setMonth(dueDate.getMonth() + i)
            
            await prisma.fee.create({
                data: {
                    tenantId: user!.tenantId,
                    studentId: student.id,
                    amount: 0,
                    dueDate,
                    status: 'PENDING',
                    notes: `Installment ${i + 1}`
                }
            })
        }

        return NextResponse.json({ success: true, data: student }, { status: 201 })
    } catch (err) {
        console.error('Create student error:', err)
        return NextResponse.json({ error: 'Failed to create student' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    const { error, user } = requireWriteAccess(req)
    if (error) return error

    try {
        const body = await req.json()
        const { 
            id, fullName, phone, courseId, batchId, status, fatherName, motherName, parentPhone, email, 
            totalFee, previousDueFee, admissionDate, notes, scholarNo, dob, dobInWords, gender, caste, medium, 
            aadhaarNo, samagraId, penId, aparId, bankName, bankAccountNo, ifsc, subjectGroup, photo
        } = body

        if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

        // Check scholarNo duplicate collision if scholarNo is provided
        if (scholarNo && scholarNo.trim()) {
            const cleanScholarNo = scholarNo.trim()
            const duplicate = await prisma.student.findFirst({
                where: {
                    tenantId: user!.tenantId,
                    id: { not: id },
                    scholarNo: { equals: cleanScholarNo, mode: 'insensitive' }
                },
                include: {
                    course: { select: { name: true } },
                    batch: { select: { name: true } }
                }
            })
            if (duplicate) {
                return NextResponse.json({
                    error: `Duplicate Scholar No.! Scholar No. "${cleanScholarNo}" is already in use by student "${duplicate.fullName}" (Class: ${duplicate.course?.name || 'N/A'}). Duplicate entries are not allowed.`,
                    code: 'DUPLICATE_STUDENT',
                    existingStudent: {
                        id: duplicate.id,
                        fullName: duplicate.fullName,
                        scholarNo: duplicate.scholarNo,
                        fatherName: duplicate.fatherName || 'N/A',
                        studentId: duplicate.studentId || 'N/A',
                        className: duplicate.course?.name || 'N/A',
                        batchName: duplicate.batch?.name || 'N/A',
                        createdAt: duplicate.createdAt,
                    }
                }, { status: 409 })
            }
        }

        // Use transaction to handle previousDueFee updates atomically
        const student = await prisma.$transaction(async (tx) => {
            // Fetch existing student data
            const existingStudent = await tx.student.findUnique({
                where: { id, tenantId: user!.tenantId }
            })
            if (!existingStudent) throw new Error('Student not found')

            const oldPrevDue = existingStudent.previousDueFee || 0
            const newPrevDue = previousDueFee !== undefined ? (parseFloat(previousDueFee) || 0) : oldPrevDue
            const prevDueDelta = newPrevDue - oldPrevDue

            // Calculate new total fee
            let newTotalFee: number | undefined
            if (totalFee !== undefined) {
                // If totalFee is explicitly provided from edit form, use it as the final total fee
                newTotalFee = parseFloat(totalFee) || 0
            } else if (prevDueDelta !== 0) {
                // Only previous due changed without totalFee specified — adjust totalFee by the delta
                newTotalFee = (existingStudent.totalFee || 0) + prevDueDelta
            }

            // Update student record
            const updatedStudent = await tx.student.update({
                where: { id, tenantId: user!.tenantId },
                data: {
                    fullName,
                    phone,
                    courseId,
                    batchId,
                    status: status as any,
                    fatherName,
                    motherName,
                    parentPhone,
                    email,
                    previousDueFee: newPrevDue,
                    totalFee: newTotalFee !== undefined ? newTotalFee : undefined,
                    admissionDate: admissionDate ? new Date(admissionDate) : undefined,
                    notes,
                    scholarNo: scholarNo !== undefined ? scholarNo : undefined,
                    dob: dob ? new Date(dob) : undefined,
                    dobInWords: dobInWords !== undefined ? dobInWords : undefined,
                    gender: gender as any,
                    caste: caste !== undefined ? caste : undefined,
                    medium: medium !== undefined ? medium : undefined,
                    aadhaarNo: aadhaarNo !== undefined ? aadhaarNo : undefined,
                    samagraId: samagraId !== undefined ? samagraId : undefined,
                    penId: penId !== undefined ? penId : undefined,
                    aparId: aparId !== undefined ? aparId : undefined,
                    bankName: bankName !== undefined ? bankName : undefined,
                    bankAccountNo: bankAccountNo !== undefined ? bankAccountNo : undefined,
                    ifsc: ifsc !== undefined ? ifsc : undefined,
                    subjectGroup: subjectGroup !== undefined ? subjectGroup : undefined,
                    photo: photo !== undefined ? photo : undefined,
                }
            })

            // Handle Previous Due Fee record in fees table
            if (previousDueFee !== undefined) {
                // Find existing "Previous Year Due" fee record for this student
                const existingPrevDueFee = await tx.fee.findFirst({
                    where: {
                        tenantId: user!.tenantId,
                        studentId: id,
                        notes: { contains: 'Previous Year Due' }
                    }
                })

                if (newPrevDue > 0) {
                    if (existingPrevDueFee) {
                        // Update existing previous due fee record
                        await tx.fee.update({
                            where: { id: existingPrevDueFee.id },
                            data: {
                                amount: newPrevDue,
                                status: existingPrevDueFee.paidDate ? 'PAID' : 'PENDING',
                            }
                        })
                    } else {
                        // Create new previous year due fee record
                        const admDate = existingStudent.admissionDate || new Date()
                        await tx.fee.create({
                            data: {
                                tenantId: user!.tenantId,
                                studentId: id,
                                amount: newPrevDue,
                                dueDate: admDate,
                                status: 'PENDING',
                                notes: 'Previous Year Due (पिछले वर्ष की बकाया फीस)'
                            }
                        })
                    }
                } else if (newPrevDue === 0 && existingPrevDueFee) {
                    // Previous due was cleared — check if it was paid
                    if (!existingPrevDueFee.paidDate) {
                        // Not paid, set amount to 0 and keep as pending (don't delete paid records)
                        await tx.fee.update({
                            where: { id: existingPrevDueFee.id },
                            data: { amount: 0, status: 'PENDING' }
                        })
                    }
                }
            }

            return updatedStudent
        })

        return NextResponse.json({ success: true, data: student })
    } catch (err) {
        console.error('Update student error:', err)
        return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    const { error, user } = requireWriteAccess(req)
    if (error) return error

    try {
        const { id } = Object.fromEntries(new URL(req.url).searchParams.entries())
        if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

        // Check if student has payments or dependencies
        const payments = await prisma.payment.count({ where: { studentId: id } })
        if (payments > 0) {
            return NextResponse.json({ error: 'Cannot delete student with payment history. Block them instead.' }, { status: 400 })
        }

        await prisma.student.delete({
            where: { id, tenantId: user!.tenantId }
        })

        return NextResponse.json({ success: true, message: 'Student deleted' })
    } catch (err) {
        console.error('Delete student error:', err)
        return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
    }
}
