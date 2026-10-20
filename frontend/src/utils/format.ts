export function parseUserAgent(ua: string): { browser: string; os: string; deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' } {
  if (!ua) {
    return { browser: 'Browser Tidak Dikenal', os: 'Sistem Tidak Dikenal', deviceType: 'unknown' };
  }

  const lower = ua.toLowerCase();

  let os = 'Desktop';
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'desktop';

  if (lower.includes('windows nt 10.0')) os = 'Windows 10/11';
  else if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('macintosh') || lower.includes('mac os x')) os = 'macOS';
  else if (lower.includes('iphone')) { os = 'iPhone (iOS)'; deviceType = 'mobile'; }
  else if (lower.includes('ipad')) { os = 'iPad (iPadOS)'; deviceType = 'tablet'; }
  else if (lower.includes('android')) { os = 'Android'; deviceType = 'mobile'; }
  else if (lower.includes('linux')) os = 'Linux';

  let browser = 'Browser Web';
  if (lower.includes('edg/')) browser = 'Microsoft Edge';
  else if (lower.includes('chrome/') && !lower.includes('edg/')) browser = 'Google Chrome';
  else if (lower.includes('safari/') && !lower.includes('chrome/')) browser = 'Apple Safari';
  else if (lower.includes('firefox/')) browser = 'Mozilla Firefox';
  else if (lower.includes('opr/') || lower.includes('opera/')) browser = 'Opera';

  return { browser, os, deviceType };
}

export function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
