// @ts-nocheck

/** Incoming GreenAPI webhook payload */
export interface GreenAPIWebhookPayload {
  typeWebhook: string;
  instanceData: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp: number;
  idMessage: string;
  senderData: {
    chatId: string;
    chatName?: string;
    sender: string;
    senderName?: string;
  };
  messageData?: {
    typeMessage: string;
    textMessageData?: { textMessage: string };
    extendedTextMessageData?: { text: string };
    buttonsResponseMessage?: { buttonId: string; buttonText: string; selectedButtonId?: string; selectedButtonText?: string };
    interactiveButtonsResponse?: { selectedButtonId?: string; selectedButtonText?: string; selectedId?: string; selectedDisplayText?: string; selectedIndex?: number };
    listResponseMessage?: { selectedRowId: string };
    quotedMessage?: { caption: string };
    fileMessageData?: { downloadUrl: string; fileName: string; caption: string; mimeType: string };
    downloadUrl?: string;
    caption?: string;
    fileName?: string;
    jpegThumbnail?: string;
    fromMe?: boolean;
    mimeType?: string;
  };
}

/** Context passed to every handler */
export interface WebhookContext {
  userData: { id: string; name: string; wa_opt_in: boolean; phone: string };
  phoneNumber: string;
  payload: GreenAPIWebhookPayload;
  messageId: string;
  supabase: any;
  greenAPI: any;
}
