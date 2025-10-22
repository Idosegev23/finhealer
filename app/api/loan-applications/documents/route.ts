import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - Fetch documents for an application
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get("applicationId");

    if (!applicationId) {
      return NextResponse.json({ error: "Missing application ID" }, { status: 400 });
    }

    // Verify user owns this application
    const { data: application } = await supabase
      .from("loan_applications")
      .select("user_id")
      .eq("id", applicationId)
      .single();

    if (!application || application.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch documents
    const { data: documents, error } = await supabase
      .from("loan_documents")
      .select("*")
      .eq("application_id", applicationId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching loan documents:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: documents });
  } catch (error: any) {
    console.error("Error in GET /api/loan-applications/documents:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Upload a document
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { applicationId, documentType, documentCategory, fileName, fileUrl, fileSize, mimeType } = body;

    // Verify user owns this application
    const { data: application } = await supabase
      .from("loan_applications")
      .select("user_id")
      .eq("id", applicationId)
      .single();

    if (!application || application.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create document record
    const { data: document, error } = await (supabase as any)
      .from("loan_documents")
      .insert({
        application_id: applicationId,
        document_type: documentType,
        document_category: documentCategory,
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileSize,
        mime_type: mimeType,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating loan document:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/loan-applications/documents:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a document
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
    }

    // Delete document (RLS will ensure user owns it)
    const { error } = await supabase
      .from("loan_documents")
      .delete()
      .eq("id", documentId);

    if (error) {
      console.error("Error deleting loan document:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/loan-applications/documents:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

