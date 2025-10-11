import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - שליפת תנועות עם filters
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const status = searchParams.get('status') || 'confirmed';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('transactions')
      .select('*, budget_categories(name, color, icon)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('tx_date', { ascending: false });

    // Filters
    if (from) query = query.gte('tx_date', from);
    if (to) query = query.lte('tx_date', to);
    if (category) query = query.eq('category', category);
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);

    // Pagination
    const rangeFrom = (page - 1) * limit;
    const rangeTo = rangeFrom + limit - 1;
    query = query.range(rangeFrom, rangeTo);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    return NextResponse.json({
      transactions: data || [],
      total: count || 0,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit)
    });

  } catch (error) {
    console.error('Transactions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - יצירת/עדכון תנועה
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      id, 
      type, 
      amount, 
      category, 
      category_id,
      vendor, 
      tx_date, 
      source = 'manual',
      status = 'confirmed',
      notes 
    } = body;

    // Validation
    if (!type || !amount || !tx_date) {
      return NextResponse.json(
        { error: 'Missing required fields: type, amount, tx_date' },
        { status: 400 }
      );
    }

    if (!['expense', 'income'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be expense or income' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be positive' },
        { status: 400 }
      );
    }

    // Update או Insert
    if (id) {
      // Update
      const { data, error } = await (supabase as any)
        .from('transactions')
        .update({
          type,
          amount,
          category,
          category_id,
          vendor,
          tx_date,
          status,
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating transaction:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
      }

      return NextResponse.json({ transaction: data });
    } else {
      // Insert
      const { data, error } = await (supabase as any)
        .from('transactions')
        .insert({
          user_id: user.id,
          type,
          amount,
          category,
          category_id,
          vendor,
          tx_date,
          source,
          status,
          notes
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
      }

      return NextResponse.json({ transaction: data }, { status: 201 });
    }

  } catch (error) {
    console.error('Transactions POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


