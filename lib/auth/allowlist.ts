const STAFF_DOMAINS = ['sainthelen.org'];

const ALLOWED_EMAILS: string[] = [
  'matthew@adventii.com',
  // Add ministry leads with personal email here as needed
];

export function isAllowedEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  const domain = e.split('@')[1];
  if (!domain) return false;
  if (STAFF_DOMAINS.includes(domain)) return true;
  if (ALLOWED_EMAILS.includes(e)) return true;
  return false;
}
