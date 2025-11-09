// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch all children for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: children, error } = await supabase
      .from('children')
      .select('*')
      .eq('user_id', user.id)
      .order('birth_date', { ascending: true })

    if (error) {
      console.error('❌ Error fetching children:', error)
      return NextResponse.json(
        { error: 'Failed to fetch children', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ children: children || [] })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add a new child
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, birth_date, notes } = body

    // Validation
    if (!name || !birth_date) {
      return NextResponse.json(
        { error: 'Name and birth date are required' },
        { status: 400 }
      )
    }

    const { data: child, error } = await supabase
      .from('children')
      .insert({
        user_id: user.id,
        name,
        birth_date,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error adding child:', error)
      return NextResponse.json(
        { error: 'Failed to add child', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Child added successfully:', child.id)
    return NextResponse.json({ success: true, child })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update an existing child
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, birth_date, notes } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Child ID is required' },
        { status: 400 }
      )
    }

    const { data: child, error } = await supabase
      .from('children')
      .update({
        name,
        birth_date,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id) // Security: ensure user owns this child
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating child:', error)
      return NextResponse.json(
        { error: 'Failed to update child', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Child updated successfully:', child.id)
    return NextResponse.json({ success: true, child })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a child
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Child ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Security: ensure user owns this child

    if (error) {
      console.error('❌ Error deleting child:', error)
      return NextResponse.json(
        { error: 'Failed to delete child', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Child deleted successfully:', id)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

