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

interface SendImageParams {
  phoneNumber: string;
  imageBase64: string;
  caption?: string;
  mimeType?: string;
}

interface SendListParams {
  phoneNumber: string;
  message: string;
  buttonText: string;
  title: string;
  footer?: string;
  sections: Array<{
    title: string;
    rows: Array<{
      rowId: string;
      title: string;
      description?: string;
    }>;
  }>;
}

// New Interactive Buttons API (Beta) - works unlike the deprecated sendButtons
interface SendInteractiveButtonsParams {
  phoneNumber: string;
  message: string;
  header?: string;
  footer?: string;
  buttons: Array<{
    buttonId: string;
    buttonText: string;
  }>;
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
   */
  private normalizePhoneNumber(phone: string): string {
    let normalized = phone.replace(/[\s\-]/g, '');
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }
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
   * Note: GreenAPI buttons require WhatsApp Business API and may not work on all instances
   */
  async sendButtons({ phoneNumber, message, buttons }: SendButtonsParams) {
    const url = `${this.baseUrl}/sendButtons/${this.token}`;
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    const payload = {
      chatId: `${normalizedPhone}@c.us`,
      message: message,
      footer: 'Phi φ',
      buttons: buttons.map((btn, index) => ({
        buttonId: btn.buttonId || `btn_${index}`,
        buttonText: {
          displayText: btn.buttonText.substring(0, 20), // WhatsApp button text limit
        },
        type: 1,
      })),
    };

    console.log('📱 Sending buttons:', JSON.stringify(payload, null, 2));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      // GreenAPI may return 200 but with an error in the body
      if (data.error) {
        console.error('❌ GreenAPI buttons error in response:', data.error);
        throw new Error(data.error);
      }

      if (!response.ok) {
        console.error('❌ GreenAPI buttons HTTP error:', response.status, response.statusText, data);
        throw new Error(`GreenAPI error: ${response.statusText} - ${JSON.stringify(data)}`);
      }

      console.log(`✅ GreenAPI buttons sent to ${normalizedPhone}@c.us:`, data.idMessage);
      return data;
    } catch (error: any) {
      console.error('❌ GreenAPI buttons error:', error?.message || error);
      throw error;
    }
  }

  /**
   * שליחת כפתורים אינטראקטיביים (API חדש - Beta)
   * משתמש ב-sendInteractiveButtonsReply
   * @see https://green-api.com/en/docs/api/sending/SendInteractiveButtonsReply/
   * 
   * מגבלות:
   * - עד 3 כפתורים
   * - טקסט כפתור עד 25 תווים
   * - לא עובד ב-Windows Desktop
   */
  async sendInteractiveButtons({ phoneNumber, message, header, footer, buttons }: SendInteractiveButtonsParams) {
    const url = `${this.baseUrl}/sendInteractiveButtonsReply/${this.token}`;
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    // Validate and format buttons (max 3, max 25 chars each)
    const formattedButtons = buttons.slice(0, 3).map((btn, index) => ({
      buttonId: btn.buttonId || `btn_${index}`,
      buttonText: btn.buttonText.substring(0, 25), // Max 25 chars
    }));

    const payload: Record<string, any> = {
      chatId: `${normalizedPhone}@c.us`,
      body: message,
      buttons: formattedButtons,
    };
    
    // Add optional fields only if provided
    if (header) payload.header = header;
    if (footer) payload.footer = footer;

    console.log('📱 Sending interactive buttons reply:', JSON.stringify(payload, null, 2));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      // Check for errors in response body
      if (data.error) {
        console.error('❌ sendInteractiveButtonsReply error:', data.error);
        // Fallback to regular message if buttons fail
        console.log('📝 Falling back to regular message...');
        return this.sendMessage({ phoneNumber, message });
      }

      if (!response.ok) {
        console.error('❌ sendInteractiveButtonsReply HTTP error:', response.status, data);
        // Fallback to regular message if buttons fail
        console.log('📝 Falling back to regular message...');
        return this.sendMessage({ phoneNumber, message });
      }

      console.log(`✅ Interactive buttons sent to ${normalizedPhone}@c.us:`, data.idMessage);
      return data;
    } catch (error: any) {
      console.error('❌ sendInteractiveButtonsReply error:', error?.message || error);
      // Fallback to regular message
      console.log('📝 Falling back to regular message...');
      return this.sendMessage({ phoneNumber, message });
    }
  }

  /**
   * שליחת הודעת רשימה (תפריט)
   */
  async sendListMessage({ phoneNumber, message, buttonText, title, footer, sections }: SendListParams) {
    const url = `${this.baseUrl}/sendListMessage/${this.token}`;
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
          title: title,
          footer: footer || 'FinHealer',
          buttonText: buttonText,
          sections: sections
        }),
      });

      if (!response.ok) {
        throw new Error(`GreenAPI list error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ GreenAPI list message sent to ${normalizedPhone}@c.us:`, data.idMessage);
      return data;
    } catch (error) {
      console.error('❌ GreenAPI list error:', error);
      throw error;
    }
  }

  /**
   * שליחת תמונה עם base64
   */
  async sendImage({ phoneNumber, imageBase64, caption, mimeType = 'image/png' }: SendImageParams) {
    const url = `${this.baseUrl}/sendFileByUpload/${this.token}`;
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      // המרת base64 ל-blob
      const byteCharacters = atob(imageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      // יצירת FormData
      const formData = new FormData();
      formData.append('chatId', `${normalizedPhone}@c.us`);
      formData.append('file', blob, `chart_${Date.now()}.png`);
      if (caption) {
        formData.append('caption', caption);
      }

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Fallback: נסה עם sendFileByUrl
        return await this.sendImageBase64Fallback(normalizedPhone, imageBase64, caption, mimeType);
      }

      const data = await response.json();
      console.log(`✅ GreenAPI image sent to ${normalizedPhone}@c.us:`, data.idMessage);
      return data;
    } catch (error) {
      console.error('❌ GreenAPI image error:', error);
      throw error;
    }
  }

  /**
   * שליחת תמונה - fallback עם base64 ישיר
   */
  private async sendImageBase64Fallback(
    normalizedPhone: string,
    imageBase64: string,
    caption?: string,
    mimeType: string = 'image/png'
  ) {
    const url = `${this.baseUrl}/sendFileByUrl/${this.token}`;
    
    // בניית data URL
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: `${normalizedPhone}@c.us`,
          urlFile: dataUrl,
          fileName: `phi_chart_${Date.now()}.png`,
          caption: caption || '',
        }),
      });

      if (!response.ok) {
        throw new Error(`GreenAPI fallback error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ GreenAPI image (fallback) sent to ${normalizedPhone}@c.us:`, data.idMessage);
      return data;
    } catch (error) {
      console.error('❌ GreenAPI image fallback error:', error);
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

/**
 * Convenience function to send WhatsApp image
 */
export async function sendWhatsAppImage(
  phoneNumber: string, 
  imageBase64: string, 
  caption?: string,
  mimeType?: string
) {
  const client = getGreenAPIClient();
  return client.sendImage({ phoneNumber, imageBase64, caption, mimeType });
}


