export function requestOrigin(request: Request) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (!forwardedHost) return url.origin
  return `${forwardedProto || 'https'}://${forwardedHost}`
}

export function passwordSetupCallback(request: Request) {
  return `${requestOrigin(request)}/auth/callback?next=/reset-password`
}
