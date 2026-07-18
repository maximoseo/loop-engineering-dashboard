/**
 * Sanitize file paths for display in the dashboard.
 * Shows only skill/file name, stores full path in tooltip.
 */
export function sanitizePath(fullPath: string): { display: string; full: string } {
  if (!fullPath) return { display: '', full: '' }

  // Extract just the filename or skill name
  const parts = fullPath.replace(/\\/g, '/').split('/')
  const lastParts = parts.slice(-3) // Last 3 segments for context
  const display = lastParts.join('/')

  return { display, full: fullPath }
}

/**
 * Sanitize a proposal or lesson for display, stripping sensitive paths.
 */
export interface SanitizedField {
  display: string
  full?: string
  tooltip?: string
}

export function sanitizeProposalText(text: string): string {
  if (!text) return ''

  // Replace Windows paths with just the relevant filename
  return text.replace(
    /[A-Z]:\\[^\s]*?(?:\\|\/)([^\\\/]+?)(?=\s|$|\.)/gi,
    (_match, name) => name || ''
  )
}

/**
 * Remove user-specific paths from any field that reaches the UI.
 */
export function sanitizeField(value: string | null | undefined): string {
  if (!value) return ''
  return sanitizeProposalText(value)
}
