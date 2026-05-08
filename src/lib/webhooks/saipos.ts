export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Brazilian mobile numbers: if country code (55) + area code (2) + 9th digit + 8 digits = 13 digits, remove the 9th digit
  if (digits.length === 13 && digits.startsWith('55')) {
    const areaCode = digits.slice(2, 4)
    const local = digits.slice(4)
    // Remove leading 9 from 9-digit local numbers
    if (local.length === 9 && local.startsWith('9')) {
      return '55' + areaCode + local.slice(1)
    }
  }
  return digits
}

export function validateSaiposSignature(secret: string, authorizationHeader: string): boolean {
  if (!secret || !authorizationHeader) return false
  return authorizationHeader === `Bearer ${secret}`
}
