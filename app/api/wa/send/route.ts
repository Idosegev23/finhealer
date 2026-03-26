// @ts-nocheck
import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { NextRequest, NextResponse } from 'next/server';
import { createContext, updateContext, getOrCreateContext } from '@/lib/conversation/context-manager';

/**
 * WhatsApp Send API
 * שליחת הודעות WhatsApp למשתמשים
 * 
 * תומך בשני מצבים:
 * 1. שליחה לפי userId - מחפש את הטלפון בDB
 * 2. שליחה לפי phone - שולח ישירות למספר
 * 
 * 🆕 תמיכה ב-onboarding:
 * אם isOnboarding=true, יוצר context עם state "onboarding_personal"
 */

interface SendMessageBody {
  userId?: string;
  phone?: string;
  message: string;
  buttons?: Array<{ buttonId: string; buttonText: string }>;
  isOnboarding?: boolean; // 🆕 האם זו הודעת onboarding
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // בדיקת הרשאות
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SendMessageBody = await request.json();
    const { userId, phone, message, buttons, isOnboarding } = body;

    // RLS: users can only send messages as themselves
    if (userId && authUser.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    if (!userId && !phone) {
      return NextResponse.json(
        { error: 'Either userId or phone is required' },
        { status: 400 }
      );
    }

    let phoneNumber: string;
    let targetUserId: string | null = null;

    // מצב 1: שליחה לפי userId
    if (userId) {
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

      phoneNumber = userData.phone;
      targetUserId = userData.id;
    } 
    // מצב 2: שליחה לפי phone ישירות
    else {
      // נקה את מספר הטלפון
      let cleanPhone = phone!.replace(/\D/g, '');
      
      // המר לפורמט בינלאומי
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '972' + cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith('972')) {
        cleanPhone = '972' + cleanPhone;
      }
      
      phoneNumber = cleanPhone;
      console.log(`🔍 Looking for user with phone: ${phoneNumber}`);

      // נסה למצוא משתמש לפי טלפון (לשמירת ההודעה)
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phoneNumber)
        .single();

      if (userError) {
        console.log(`⚠️ User lookup error: ${userError.message}`);
      }

      if (user) {
        targetUserId = user.id;
        console.log(`✅ Found user: ${targetUserId}`);
      } else {
        console.log(`❌ No user found for phone: ${phoneNumber}`);
      }
    }

    // שליחה דרך GreenAPI
    const greenAPI = getGreenAPIClient();
    let result;

    console.log(`📱 Sending WhatsApp to: ${phoneNumber}`);

    if (buttons && buttons.length > 0) {
      result = await greenAPI.sendButtons({
        phoneNumber,
        message,
        buttons,
      });
    } else {
      result = await greenAPI.sendMessage({
        phoneNumber,
        message,
      });
    }

    console.log(`✅ WhatsApp sent successfully:`, result.idMessage);

    // שמירת ההודעה היוצאת (אם יש userId)
    if (targetUserId) {
      const { error: msgError } = await (supabase as any)
      .from('wa_messages')
      .insert({
          user_id: targetUserId,
        direction: 'outgoing',
        msg_type: buttons ? 'buttons' : 'text',
        payload: { message, buttons },
        provider_msg_id: result.idMessage,
        status: 'sent',
        });

    if (msgError) {
      console.error('❌ Error saving message:', msgError);
      }

      // 🆕 יצירת/עדכון context ל-onboarding
      if (isOnboarding) {
        try {
          console.log(`📝 Creating onboarding context for user: ${targetUserId}, isOnboarding: ${isOnboarding}`);
          const updatedContext = await updateContext(targetUserId, {
            currentState: 'onboarding_personal',
            lastInteraction: new Date(),
            pendingQuestions: [],
          });
          console.log(`✅ Onboarding context created for user: ${targetUserId}, state: ${updatedContext.currentState}`);
        } catch (ctxError: any) {
          console.error('❌ Error creating onboarding context:', ctxError?.message || ctxError);
          // Don't fail the request if context creation fails
        }
      } else {
        console.log(`ℹ️ Not an onboarding message, skipping context creation`);
      }
    } else {
      console.log(`⚠️ No targetUserId, cannot save message or create context`);
    }

    return NextResponse.json({
      success: true,
      messageId: result.idMessage,
      phone: phoneNumber,
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
