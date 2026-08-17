export type SessionDeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export type SessionDeviceInfo = {
  device: string;
  browser: string;
  deviceType: SessionDeviceType;
};

function detectDevice(userAgent: string): Pick<SessionDeviceInfo, 'device' | 'deviceType'> {
  if (/iPad/i.test(userAgent)) return { device: 'iPad', deviceType: 'tablet' };
  if (/iPhone/i.test(userAgent)) return { device: 'iPhone', deviceType: 'mobile' };
  if (/Android/i.test(userAgent)) {
    return /Mobile/i.test(userAgent)
      ? { device: 'Android phone', deviceType: 'mobile' }
      : { device: 'Android tablet', deviceType: 'tablet' };
  }
  if (/Windows NT/i.test(userAgent)) return { device: 'Windows PC', deviceType: 'desktop' };
  if (/Macintosh|Mac OS X/i.test(userAgent)) return { device: 'Mac', deviceType: 'desktop' };
  if (/Linux/i.test(userAgent)) return { device: 'Linux PC', deviceType: 'desktop' };
  return { device: 'Unknown device', deviceType: 'unknown' };
}

function detectBrowser(userAgent: string): string {
  if (/Edg\//i.test(userAgent)) return 'Microsoft Edge';
  if (/OPR\//i.test(userAgent)) return 'Opera';
  if (/Chrome\//i.test(userAgent) || /CriOS\//i.test(userAgent)) return 'Chrome';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/Safari\//i.test(userAgent)) return 'Safari';
  return 'Unknown browser';
}

export function parseUserAgent(userAgent: string): SessionDeviceInfo {
  const normalizedUserAgent = userAgent.trim();
  return {
    ...detectDevice(normalizedUserAgent),
    browser: detectBrowser(normalizedUserAgent),
  };
}
