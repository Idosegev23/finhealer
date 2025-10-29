import { Inngest } from 'inngest';

// יצירת Inngest client
export const inngest = new Inngest({ 
  id: 'finhealer',
  name: 'FinHealer',
  eventKey: process.env.INNGEST_EVENT_KEY,
});

