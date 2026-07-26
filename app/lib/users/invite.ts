import type { createServiceClient } from '../supabase/server'
import type { UserRole } from '../supabase/database.types'

type ServiceClient = ReturnType<typeof createServiceClient>

export type InvitationInput = {
  email: string
  role: Exclude<UserRole, 'unassigned'>
  fullName: string
  employeeIndex?: string | null
  specialisation?: string | null
  studentId?: number | null
  redirectTo?: string
}

export async function invitePortalUser(client: ServiceClient, input: InvitationInput) {
  const { data, error: inviteError } = await client.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.fullName, role: input.role },
    redirectTo: input.redirectTo,
  })
  if (inviteError) throw inviteError

  const userId = data.user.id
  try {
    const { error: profileError } = await client.from('profiles').upsert({
      id: userId,
      full_name: input.fullName,
      role: input.role,
      employee_index: input.employeeIndex || null,
    })
    if (profileError) throw profileError

    if (input.role === 'doctor') {
      const { error } = await client.from('doctors').upsert(
        {
          user_id: userId,
          full_name: input.fullName,
          specialisation: input.specialisation || null,
        },
        { onConflict: 'user_id' }
      )
      if (error) throw error
    }

    if (input.role === 'student') {
      if (!input.studentId) throw new Error('A valid existing student record is required.')
      const { data: student, error } = await client
        .from('students')
        .update({ user_id: userId, full_name: input.fullName })
        .eq('student_id', input.studentId)
        .is('user_id', null)
        .select('student_id')
        .maybeSingle()
      if (error) throw error
      if (!student) throw new Error('The student record is missing or already linked to an account.')
    }

    return data.user
  } catch (error) {
    await client.auth.admin.deleteUser(userId)
    throw error
  }
}
