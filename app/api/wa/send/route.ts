// @ts-nocheck
import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { NextRequest, NextResponse } from 'next/server';

/**
 * WhatsApp Send API
 * שליחת הודעות WhatsApp למשתמשים
 */

interface SendMessageBody {
  userId: string;
  message: string;
  buttons?: Array<{ buttonId: string; buttonText: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // בדיקת הרשאות (רק admin או system)
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: בדיקת הרשאות admin
    // const { data: adminUser } = await supabase
    //   .from('admin_users')
    //   .select('*')
    //   .eq('user_id', authUser.id)
    //   .single();

    const body: SendMessageBody = await request.json();
    const { userId, message, buttons } = body;

    if (!userId || !message) {
      return NextResponse.json(
        { error: 'userId and message are required' },
        { status: 400 }
      );
    }

    // קבלת נתוני משתמש
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, phone, wa_opt_in')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = user as any;

    if (!userData.wa_opt_in) {
      return NextResponse.json(
        { error: 'User has not opted in to WhatsApp' },
        { status: 403 }
      );
    }

    if (!userData.phone) {
      return NextResponse.json(
        { error: 'User has no phone number' },
        { status: 400 }
      );
    }

    // שליחה דרך GreenAPI
    const greenAPI = getGreenAPIClient();
    let result;

    if (buttons && buttons.length > 0) {
      result = await greenAPI.sendButtons({
        phoneNumber: userData.phone,
        message,
        buttons,
      });
    } else {
      result = await greenAPI.sendMessage({
        phoneNumber: userData.phone,
        message,
      });
    }

    // שמירת ההודעה היוצאת
    const { data: savedMessage, error: msgError } = await (supabase as any)
      .from('wa_messages')
      .insert({
        user_id: userData.id,
        direction: 'out',
        msg_type: buttons ? 'buttons' : 'text',
        payload: { message, buttons },
        provider_msg_id: result.idMessage,
        status: 'sent',
      })
      .select()
      .single();

    if (msgError) {
      console.error('❌ Error saving message:', msgError);
    }

    return NextResponse.json({
      success: true,
      messageId: result.idMessage,
      savedId: savedMessage?.id,
    });
  } catch (error: any) {
    console.error('❌ Send message error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET() {
  try {
    const greenAPI = getGreenAPIClient();
    const status = await greenAPI.getInstanceStatus();

    return NextResponse.json({
      status: 'ok',
      greenAPI: status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


