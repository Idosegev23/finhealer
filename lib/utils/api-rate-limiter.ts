/**
 * API Rate Limiter — per-IP sliding window
 *
 * Usage in API routes:
 *   const limited = checkApiRateLimit(request, 10, 60_000); // 10 req/min
 *   if (limited) return limited; // Returns 429 response
 */

import { NextRequest, NextResponse } from 'next/server';

const ipRateLimit = new Map<string, { count: number; resetAt: number }>();

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    ipRateLimit.forEach((val, key) => {
      if (val.resetAt < now) ipRateLimit.delete(key);
    });
  }, 5 * 60 * 1000);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Check rate limit for an API request.
 * Returns a 429 NextResponse if rate limited, or null if allowed.
 */
export function checkApiRateLimit(
  request: NextRequest,
  maxRequests: number = 20,
  windowMs: number = 60_000
): NextResponse | null {
  const ip = getClientIp(request);
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();

  const entry = ipRateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    ipRateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } }
    );
  }
  return null;
}
