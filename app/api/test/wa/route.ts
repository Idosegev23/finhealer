import { NextRequest, NextResponse } from 'next/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';

/**
 * Test endpoint לבדיקת GreenAPI
 * GET /api/test/wa?phone=972547667775
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get('phone') || '972547667775';

    console.log('🧪 Testing GreenAPI...');
    console.log('📱 Phone:', phone);

    const client = getGreenAPIClient();

    // 1. בדוק סטטוס instance
    console.log('\n1️⃣ Testing getInstanceStatus...');
    const status = await client.getInstanceStatus();
    console.log('✅ Status:', status);

    // 2. שלח הודעת טסט
    console.log('\n2️⃣ Testing sendMessage...');
    const message = await client.sendMessage({
      phoneNumber: phone,
      message: `🤖 היי! זה פיני מ-FinHealer!

זו הודעת בדיקה לראות שהכל עובד.

אם קיבלת את זה - הכל מצוין! ✅

תאריך: ${new Date().toLocaleString('he-IL')}`,
    });
    console.log('✅ Message sent:', message);

    return NextResponse.json({
      success: true,
      results: {
        instanceStatus: status,
        messageSent: message,
        phone: phone,
        format: `${phone}@c.us`,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

/**
 * POST /api/test/wa
 * שליחה עם body מותאם
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message, testButtons } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    console.log('🧪 Testing GreenAPI with custom message...');
    console.log('📱 Phone:', phone);
    console.log('💬 Message:', message);

    const client = getGreenAPIClient();
    const results: any = {};

    // 1. שלח הודעה רגילה
    if (message) {
      console.log('\n📤 Sending message...');
      const sent = await client.sendMessage({
        phoneNumber: phone,
        message: message,
      });
      results.messageSent = sent;
      console.log('✅ Message sent:', sent.idMessage);
    }

    // 2. בדוק buttons (אם מבוקש)
    if (testButtons) {
      console.log('\n🔘 Testing buttons...');
      try {
        const buttons = await client.sendButtons({
          phoneNumber: phone,
          message: 'בחר אופציה:',
          buttons: [
            { buttonId: 'opt1', buttonText: 'אופציה 1' },
            { buttonId: 'opt2', buttonText: 'אופציה 2' },
            { buttonId: 'opt3', buttonText: 'אופציה 3' },
          ],
        });
        results.buttonsSent = buttons;
        console.log('✅ Buttons sent:', buttons.idMessage);
      } catch (btnError: any) {
        console.error('❌ Buttons failed:', btnError.message);
        results.buttonsError = {
          message: btnError.message,
          note: 'Buttons might be deprecated by WhatsApp',
        };
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

