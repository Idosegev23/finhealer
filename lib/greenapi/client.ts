/**
 * GreenAPI Client
 * לניהול תקשורת WhatsApp דרך GreenAPI
 */

interface SendMessageParams {
  phoneNumber: string;
  message: string;
}

interface SendButtonsParams {
  phoneNumber: string;
  message: string;
  buttons: Array<{ buttonId: string; buttonText: string }>;
}

export class GreenAPIClient {
  private instanceId: string;
  private token: string;
  private baseUrl: string;

  constructor() {
    const instanceId = process.env.GREEN_API_INSTANCE_ID;
    const token = process.env.GREEN_API_TOKEN;

    if (!instanceId || !token) {
      throw new Error('GreenAPI credentials not configured');
    }

    this.instanceId = instanceId;
    this.token = token;
    this.baseUrl = `https://api.green-api.com/waInstance${instanceId}`;
  }

  /**
   * המרת מספר טלפון ישראלי לפורמט בינלאומי
   * 0547667775 → 972547667775
   * 972547667775 → 972547667775 (כבר נכון)
   * +972547667775 → 972547667775 (הסרת +)
   */
  private normalizePhoneNumber(phone: string): string {
    // הסרת רווחים ומקפים
    let normalized = phone.replace(/[\s\-]/g, '');
    
    // הסרת + אם יש
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }
    
    // המרה מ-05X ל-972X
    if (normalized.startsWith('0')) {
      normalized = '972' + normalized.substring(1);
    }
    
    return normalized;
  }

  /**
   * שליחת הודעת טקסט פשוטה
   */
  async sendMessage({ phoneNumber, message }: SendMessageParams) {
    const url = `${this.baseUrl}/sendMessage/${this.token}`;
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: `${normalizedPhone}@c.us`,
          message: message,
        }),
      });

      if (!response.ok) {
        throw new Error(`GreenAPI error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ GreenAPI message sent to ${normalizedPhone}@c.us:`, data.idMessage);
      return data;
    } catch (error) {
      console.error('❌ GreenAPI send error:', error);
      throw error;
    }
  }

  /**
   * שליחת הודעה עם כפתורים
   */
  async sendButtons({ phoneNumber, message, buttons }: SendButtonsParams) {
    const url = `${this.baseUrl}/sendButtons/${this.token}`;
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: `${normalizedPhone}@c.us`,
          message: message,
          footer: 'FinHealer',
          buttons: buttons.map((btn, index) => ({
            buttonId: btn.buttonId || `btn_${index}`,
            buttonText: {
              displayText: btn.buttonText,
            },
            type: 1,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`GreenAPI error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ GreenAPI buttons sent to ${normalizedPhone}@c.us:`, data.idMessage);
      return data;
    } catch (error) {
      console.error('❌ GreenAPI buttons error:', error);
      throw error;
    }
  }

  /**
   * הורדת קובץ מ-WhatsApp (תמונה/קבלה)
   */
  async downloadFile(downloadUrl: string): Promise<Blob> {
    try {
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('❌ File download error:', error);
      throw error;
    }
  }

  /**
   * בדיקת סטטוס Instance
   */
  async getInstanceStatus() {
    const url = `${this.baseUrl}/getStateInstance/${this.token}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log('📱 GreenAPI instance status:', data.stateInstance);
      return data;
    } catch (error) {
      console.error('❌ Instance status error:', error);
      throw error;
    }
  }
}

// Singleton instance
let greenAPIClient: GreenAPIClient | null = null;

export function getGreenAPIClient(): GreenAPIClient {
  if (!greenAPIClient) {
    greenAPIClient = new GreenAPIClient();
  }
  return greenAPIClient;
}

/**
 * Convenience function to send WhatsApp message
 */
export async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  const client = getGreenAPIClient();
  return client.sendMessage({ phoneNumber, message });
}


