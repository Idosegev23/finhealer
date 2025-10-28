import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { processStatement, processDocument } from '@/lib/inngest/functions';

// יצירת API endpoint ל-Inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processStatement,  // עיבוד דוחות ישנים (statement.process)
    processDocument,   // עיבוד מסמכים חדשים (document.process)
  ],
});

