/**
 * POST /api/loans/consolidation/[id]/update
 * עדכון סטטוס בקשה (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientServerClient } from '@/lib/supabase/server';
import type { ConsolidationRequestStatus } from '@/types/loans';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClientServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // בדוק שהמשתמש הוא admin
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single();
    
    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Forbidden - Admin only' },
        { status: 403 }
      );
    }
    
    const { id } = params;
    const body = await req.json();
    const { 
      status, 
      advisor_notes,
      proposed_rate,
      proposed_monthly_payment,
      proposed_total_amount,
      estimated_savings,
    } = body;
    
    // Validate status
    const validStatuses: ConsolidationRequestStatus[] = [
      'pending_documents',
      'documents_received',
      'sent_to_advisor',
      'advisor_reviewing',
      'offer_sent',
      'accepted',
      'rejected',
      'cancelled',
    ];
    
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }
    
    // עדכן בקשה
    const updateData: any = {};
    
    if (status) updateData.status = status;
    if (advisor_notes !== undefined) updateData.advisor_notes = advisor_notes;
    if (proposed_rate !== undefined) updateData.proposed_rate = proposed_rate;
    if (proposed_monthly_payment !== undefined) updateData.proposed_monthly_payment = proposed_monthly_payment;
    if (proposed_total_amount !== undefined) updateData.proposed_total_amount = proposed_total_amount;
    if (estimated_savings !== undefined) updateData.estimated_savings = estimated_savings;
    
    const { data: updated, error: updateError } = await supabase
      .from('loan_consolidation_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Failed to update request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update request' },
        { status: 500 }
      );
    }
    
    // אם סטטוס השתנה ל-offer_sent, שלח הודעת WhatsApp למשתמש
    if (status === 'offer_sent' && updated) {
      const { data: userData } = await supabase
        .from('users')
        .select('phone, name, full_name')
        .eq('id', updated.user_id)
        .single();
      
      if (userData?.phone) {
        const { sendWhatsAppMessage } = await import('@/lib/greenapi/client');
        
        const message = `🎉 יש לנו חדשות טובות!

גדי בדק את האפשרויות לאיחוד ההלוואות שלך.

💰 *הצעה מיוחדת:*
• ריבית: ${proposed_rate}%
• תשלום חודשי חדש: ${proposed_monthly_payment?.toLocaleString('he-IL')} ₪
• חיסכון משוער: ${estimated_savings?.toLocaleString('he-IL')} ₪/חודש

${advisor_notes || ''}

מעוניין/ת לקבל פרטים נוספים? גדי יצור איתך קשר בהקדם!`;
        
        await sendWhatsAppMessage(userData.phone, message);
      }
    }
    
    return NextResponse.json({ data: updated });
    
  } catch (error) {
    console.error('Error in POST /api/loans/consolidation/[id]/update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
