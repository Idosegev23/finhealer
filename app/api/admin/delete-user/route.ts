// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * DELETE User - Admin Only
 * מחיקה מלאה של משתמש מ-Auth ומכל הטבלאות
 */
export async function POST(req: NextRequest) {
  try {
    // Admin auth: require CRON_SECRET as Bearer token
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. מצא את ה-user_id
    const { data: authUser, error: findError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (findError) {
      console.error('Error finding user:', findError);
      return NextResponse.json(
        { error: 'Failed to find user', details: findError.message },
        { status: 500 }
      );
    }

    const targetUser = authUser.users.find(u => u.email === email);

    if (!targetUser) {
      return NextResponse.json(
        { message: 'User not found in auth.users' },
        { status: 404 }
      );
    }

    const userId = targetUser.id;

    console.log(`🗑️ Deleting user: ${email} (${userId})`);

    // 2. מחק מ-Auth (זה ימחק אוטומטית גם מ-public.users אם יש trigger)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete user from auth', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log(`✅ User ${email} deleted successfully from auth.users`);

    // 3. מחק מ-public.users (למקרה שלא נמחק אוטומטית)
    const { error: publicDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('email', email);

    if (publicDeleteError) {
      console.log('Note: public.users delete error (might already be deleted):', publicDeleteError);
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} deleted successfully`,
      userId,
    });

  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

