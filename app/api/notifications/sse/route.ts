import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

/**
 * SSE Endpoint for real-time notifications
 * מחזיר stream של notifications למשתמש מחובר
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  // בדיקת אימות
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // יצירת ReadableStream עבור SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // שליחת heartbeat כל 30 שניות
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (error) {
          clearInterval(heartbeatInterval);
        }
      }, 30000);
      
      // פול לשינויים בטבלת uploaded_statements
      const pollInterval = setInterval(async () => {
        try {
          const { data: completedStatements } = await supabase
            .from('uploaded_statements')
            .select('id, status, transactions_extracted, processed_at')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .gte('processed_at', new Date(Date.now() - 60000).toISOString()) // אחרון דקה
            .order('processed_at', { ascending: false });
          
          if (completedStatements && completedStatements.length > 0) {
            for (const statement of completedStatements) {
              const event = {
                type: 'document_processed',
                statementId: statement.id,
                transactionsCount: statement.transactions_extracted || 0,
                processedAt: statement.processed_at,
              };
              
              const data = `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
        } catch (error) {
          console.error('SSE poll error:', error);
        }
      }, 5000); // כל 5 שניות
      
      // ניקוי כאשר הלקוח מתנתק
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

