import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { processStatement } from '@/lib/inngest/functions';

// יצירת API endpoint ל-Inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processStatement, // הפונקציה שלנו
  ],
});

