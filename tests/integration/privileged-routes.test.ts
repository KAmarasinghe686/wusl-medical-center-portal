import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
}))

vi.mock('../../app/lib/auth/authorize', () => ({
  authorizeRequest: mocks.authorizeRequest,
}))

import { POST as inviteUser } from '../../app/api/invite/route'
import { POST as createStudent } from '../../app/api/students/route'
import { POST as inviteWorker } from '../../app/api/worker/route'
import { POST as inviteFaculty } from '../../app/api/faculty/route'

describe('privileged route authorization', () => {
  beforeEach(() => {
    mocks.authorizeRequest.mockResolvedValue({
      user: null,
      role: null,
      serviceClient: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
  })

  it.each([
    ['invite', inviteUser],
    ['students', createStudent],
    ['worker', inviteWorker],
    ['faculty', inviteFaculty],
  ])('rejects an unauthenticated request to %s before mutation', async (_name, handler) => {
    const response = await handler(new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })
})
