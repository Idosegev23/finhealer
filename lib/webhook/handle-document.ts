// @ts-nocheck
import { NextResponse } from 'next/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import type { WebhookContext } from './types';

/**
 * Handle document messages: auto-name, then dispatch to PDF or Excel handler.
 */
export async function handleDocument(ctx: WebhookContext): Promise<NextResponse> {
  const { userData, phoneNumber, payload, supabase } = ctx;

  console.log('📄 Document message received, mime:', payload.messageData?.fileMessageData?.mimeType || 'unknown');

  const downloadUrl = payload.messageData?.fileMessageData?.downloadUrl || payload.messageData?.downloadUrl;
  const fileName = payload.messageData?.fileMessageData?.fileName || payload.messageData?.fileName || 'document';
  const caption = payload.messageData?.fileMessageData?.caption || payload.messageData?.caption || '';

  console.log('📥 Document URL:', downloadUrl);
  console.log('📝 File name:', fileName);

  // Auto-set name if waiting_for_name
  {
    const { data: nameCheckUser } = await supabase
      .from('users')
      .select('onboarding_state, name')
      .eq('id', userData.id)
      .single();

    if (nameCheckUser?.onboarding_state === 'waiting_for_name' && !nameCheckUser?.name) {
      const docSenderName = payload.senderData?.senderName || '';
      const docCleanName = docSenderName && docSenderName !== phoneNumber && !/^\d+$/.test(docSenderName)
        ? docSenderName.trim()
        : 'משתמש';

      await supabase
        .from('users')
        .update({ name: docCleanName, full_name: docCleanName, onboarding_state: 'waiting_for_document' })
        .eq('id', userData.id);

      console.log(`📝 Auto-set name to "${docCleanName}" from document sender`);
    }
  }

  if (!downloadUrl) {
    const greenAPI = getGreenAPIClient();
    await greenAPI.sendMessage({
      phoneNumber,
      message: '😕 לא הצלחתי לקבל את המסמך.\n\nאפשר לנסות שוב?',
    });
    return NextResponse.json({ status: 'no_download_url' });
  }

  // Dispatch by file type
  const lowerName = fileName.toLowerCase();
  const isPDF = lowerName.endsWith('.pdf');
  const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv');

  if (isPDF) {
    const { handlePdf } = await import('./handle-pdf');
    return handlePdf(ctx, downloadUrl, fileName);
  } else if (isExcel) {
    const { handleExcel } = await import('./handle-excel');
    return handleExcel(ctx, downloadUrl, fileName);
  } else {
    const greenAPI = getGreenAPIClient();
    await greenAPI.sendMessage({
      phoneNumber,
      message: '📎 קיבלתי את הקובץ!\n\nאני תומך ב-PDF, Excel (XLSX/XLS/CSV) ותמונות.\n\nאפשר לשלוח בפורמט אחר?',
    });
    return NextResponse.json({ status: 'unsupported_document_type' });
  }
}
