/**
 * המרת מספר טלפון ישראלי לפורמט E.164 של GreenAPI
 * פורמט: +972XXXXXXXXX (ללא אפס מוביל, ללא מקפים)
 * 
 * דוגמאות:
 * 050-1234567 -> +972501234567
 * 0501234567 -> +972501234567
 * 972501234567 -> +972501234567
 * +972501234567 -> +972501234567
 */
export function formatPhoneForGreenAPI(phone: string): string {
  // הסרת כל התווים שאינם ספרות
  let cleaned = phone.replace(/\D/g, '')
  
  // אם מתחיל ב-972, הוסף + בהתחלה
  if (cleaned.startsWith('972')) {
    return `+${cleaned}`
  }
  
  // אם מתחיל ב-0, הסר את האפס והוסף +972
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
    return `+972${cleaned}`
  }
  
  // אחרת, פשוט הוסף +972
  return `+972${cleaned}`
}

/**
 * וולידציה של מספר טלפון ישראלי
 */
export function validateIsraeliPhone(phone: string): boolean {
  // הסרת תווים שאינם ספרות
  const cleaned = phone.replace(/\D/g, '')
  
  // בדיקה שהמספר מתחיל ב-05 או 972 ואורכו נכון
  if (cleaned.startsWith('05')) {
    return cleaned.length === 10 // 05XXXXXXXX
  }
  
  if (cleaned.startsWith('972')) {
    return cleaned.length === 12 // 972XXXXXXXXX
  }
  
  return false
}

/**
 * פורמט מספר טלפון לתצוגה יפה
 * +972501234567 -> 050-123-4567
 */
export function formatPhoneForDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.startsWith('972')) {
    const withoutCode = cleaned.substring(3)
    return `0${withoutCode.substring(0, 2)}-${withoutCode.substring(2, 5)}-${withoutCode.substring(5)}`
  }
  
  if (cleaned.startsWith('0')) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)}-${cleaned.substring(6)}`
  }
  
  return phone
}

/**
 * בדיקה אם מספר טלפון תקין לשימוש ב-GreenAPI
 */
export function isValidGreenAPIPhone(phone: string): boolean {
  const regex = /^\+972[5][0-9]{8}$/
  return regex.test(phone)
}

