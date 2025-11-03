import { NextRequest } from 'next/server';

/**
 * SSE Endpoint - DISABLED
 * 
 * זה הושבת כי:
 * 1. Vercel מגביל serverless functions ל-5 דקות - SSE לא עובד טוב
 * 2. גרם לעומס מיותר עם polling פנימי כל 5 שניות
 * 3. החלפנו ל-context-based polling כל 3 דקות במקום
 * 
 * @deprecated Use PendingExpensesContext instead
 */
export async function GET(request: NextRequest) {
  return new Response(
    JSON.stringify({ 
      error: 'SSE endpoint is disabled. Use polling instead.',
      reason: 'Vercel serverless functions timeout after 5 minutes'
    }), 
    { 
      status: 410, // Gone
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );
}

