import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// API endpoint for user to request pension report from Gadi
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user details
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('name, email, phone')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create a pension report request
    const { data: reportRequest, error } = await (supabase as any)
      .from('pension_report_requests')
      .insert({
        user_id: user.id,
        status: 'pending',
        requested_at: new Date().toISOString(),
        user_name: userData.name as string,
        user_email: userData.email as string,
        user_phone: userData.phone as string,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating report request:', error);
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }

    // TODO: Send notification to Gadi (WhatsApp/Email)
    // For now, just create an alert
    await (supabase as any)
      .from('alerts')
      .insert({
        user_id: user.id,
        type: 'pension_report_requested',
        message: 'בקשתך לדוח מסלקה נשלחה לגדי. הוא יעלה את הדוח בהקדם',
        status: 'sent',
        params: {
          request_id: reportRequest.id
        }
      });

    return NextResponse.json({ 
      success: true,
      request_id: reportRequest.id,
      message: 'הבקשה נשלחה לגדי בהצלחה' 
    });

  } catch (error) {
    console.error('Pension report request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - check status of pending requests
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: requests } = await supabase
      .from('pension_report_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ requests: requests || [] });

  } catch (error) {
    console.error('Error fetching requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

