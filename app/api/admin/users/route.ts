import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Initialize the Admin Client (Bypasses RLS)
// We use supabase-js directly here because we need the SERVICE_ROLE_KEY
// to create users without logging out the current admin.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // MAKE SURE THIS IS IN YOUR .ENV FILE
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    // 1. Check if the requester is actually an Admin
    const supabase = await createServerClient();
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role in public.users table
    const { data: adminCheck } = await supabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (adminCheck?.role !== "admin" && adminCheck?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    // 2. Parse the body data
    const body = await request.json();
    const { email, password, full_name, phone, role, manager_id } = body;

    // 3. Create the user in Supabase Auth (using Service Role)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email so they can login immediately
      user_metadata: {
        full_name: full_name,
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: "Failed to create user object" }, { status: 500 });
    }

    // 4. Update the public.users table with the extra details (Phone, Role, Manager)
    // Note: A trigger usually creates the row, so we UPDATE it. 
    // If you don't have a trigger, change this to .insert()
    
    // We wait a brief moment to ensure the trigger (if any) has run
    // But to be safe, let's try an upsert (insert or update)
    const { error: profileError } = await supabaseAdmin
      .from("users")
      .upsert({
        id: newUser.user.id,
        email: email,
        full_name: full_name,
        phone: phone,
        role: role || "telecaller",
        manager_id: manager_id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error("Profile update error:", profileError);
      // We don't fail the whole request since Auth user is created, but we warn
      return NextResponse.json({ 
        message: "User created but profile update failed", 
        details: profileError.message 
      }, { status: 201 });
    }

    return NextResponse.json({ success: true, user: newUser.user }, { status: 200 });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
