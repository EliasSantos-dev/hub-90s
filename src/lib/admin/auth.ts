export function extractAdminRole(user: { user_metadata?: Record<string, unknown> } | null): boolean {
  if (!user) return false
  return user.user_metadata?.role === 'admin'
}
