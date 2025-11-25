/**
 * Response Templates
 * Variety in bot responses to avoid repetition
 */

export const RESPONSE_TEMPLATES = {
  // Confirmations
  confirmation: [
    "נכון?",
    "זה נכון?",
    "מסכים?",
    "יופי?",
    "אישור?",
    "זה זה?",
    "בסדר?",
    "תקין?",
  ],

  // Continue phrases
  continue: [
    "נמשיך?",
    "יאללה הלאה?",
    "בא לך עוד אחד?",
    "ממשיכים?",
    "עוד אחת?",
    "הלאה?",
    "בוא נמשיך?",
  ],

  // Approval/Success
  approval: [
    "מעולה!",
    "סבבה!",
    "יופי!",
    "נחמד!",
    "אש!",
    "מצוין!",
    "כל הכבוד!",
    "יפה!",
  ],

  // Greeting
  greeting: [
    "היי!",
    "שלום!",
    "מה קורה?",
    "מה נשמע?",
    "איך זה?",
    "הכל טוב?",
  ],

  // Thanks
  thanks: [
    "תודה!",
    "תודה רבה!",
    "אחלה!",
    "יפה מאוד!",
    "מעולה, תודה!",
  ],

  // Waiting
  waiting: [
    "רגע...",
    "שניה...",
    "רק רגע...",
    "אני בודק...",
    "רגע קטן...",
  ],

  // Error/Confusion
  confusion: [
    "לא הבנתי 🤔",
    "סליחה, מה?",
    "תסביר שוב?",
    "לא קלטתי...",
    "מה התכוונת?",
    "תוכל לפרט?",
  ],

  // Encouragement
  encouragement: [
    "אתה מתקדם יפה!",
    "כל הכבוד!",
    "אתה עושה עבודה מעולה!",
    "ממש יפה!",
    "אתה אלוף!",
    "ג'וב טוב!",
  ],

  // Completion
  completion: [
    "סיימנו! 🎉",
    "וואו! סיימנו! 🎊",
    "זהו! הכל מסודר! ✓",
    "מעולה! סיימנו הכל! 🌟",
    "יפה מאוד! סיימנו! 👏",
  ],

  // Break offer
  break_offer: [
    "רוצה הפסקה?",
    "נעשה הפסקה?",
    "בא לך לעצור?",
    "ממשיכים או עושים break?",
    "צריך הפסקה?",
  ],

  // Postpone acknowledgment
  postpone: [
    "בסדר גמור!",
    "אין בעיה!",
    "סבבה!",
    "אוקיי!",
    "בטח!",
  ],

  // Apology
  apology: [
    "סליחה!",
    "אופס!",
    "אי! סליחה!",
    "לא התכוונתי!",
    "סליחה על זה!",
  ],

  // Loading/Processing
  processing: [
    "אני מעבד...",
    "רק רגע, אני בודק...",
    "שניה, אני עובד על זה...",
    "רגע קטן...",
    "תן לי שניה...",
  ],

  // Yes variations
  yes: ["כן", "בטח", "אוקיי", "יופי", "סבבה", "ok", "כן כן"],

  // No variations
  no: ["לא", "לא לא", "ממש לא", "בכלל לא", "לא ממש"],

  // Maybe/Unsure
  maybe: [
    "אולי...",
    "לא בטוח...",
    "תלוי...",
    "אני לא יודע...",
    "קשה לומר...",
  ],
};

/**
 * Get random response from category
 */
export function getRandomResponse(category: keyof typeof RESPONSE_TEMPLATES): string {
  const templates = RESPONSE_TEMPLATES[category];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Get multiple random responses (no repeats)
 */
export function getRandomResponses(
  category: keyof typeof RESPONSE_TEMPLATES,
  count: number
): string[] {
  const templates = [...RESPONSE_TEMPLATES[category]];
  const selected: string[] = [];

  for (let i = 0; i < Math.min(count, templates.length); i++) {
    const index = Math.floor(Math.random() * templates.length);
    selected.push(templates[index]);
    templates.splice(index, 1);
  }

  return selected;
}

/**
 * Combine templates with custom text
 */
export function combineTemplate(
  category: keyof typeof RESPONSE_TEMPLATES,
  customText: string,
  position: "before" | "after" = "before"
): string {
  const template = getRandomResponse(category);
  
  if (position === "before") {
    return `${template} ${customText}`;
  } else {
    return `${customText} ${template}`;
  }
}

/**
 * Get contextual response based on user mood
 */
export function getContextualResponse(
  category: keyof typeof RESPONSE_TEMPLATES,
  userMood: "engaged" | "tired" | "busy"
): string {
  const base = getRandomResponse(category);

  // Adjust based on mood
  if (userMood === "tired") {
    // Shorter, more empathetic
    return base + " 😊";
  } else if (userMood === "busy") {
    // Quick and efficient
    return base;
  } else {
    // Normal, can be more expressive
    return base;
  }
}

export default {
  templates: RESPONSE_TEMPLATES,
  getRandomResponse,
  getRandomResponses,
  combineTemplate,
  getContextualResponse,
};

