import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/app/lib/serverAuth";

export const runtime = "nodejs";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function POST(request: NextRequest) {
  try {
    const authentication = await authenticateAdmin(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json(
        { error: authentication.error },
        { status: authentication.error === "Niste prijavljeni" ? 401 : 403 }
      );
    }

    const payload = await request.json();
    const email = normalizeEmail(payload?.email);
    const fullName = normalizeName(payload?.fullName);
    const password = typeof payload?.password === "string" ? payload.password : "";

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json({ error: "Enter the driver's full name" }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: "The temporary password must contain at least 8 characters" },
        { status: 400 }
      );
    }

    const { data: created, error: createError } = await authentication.supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message || "The driver account could not be created" },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await authentication.supabaseAdmin
      .from("drivers")
      .upsert({
        id: created.user.id,
        email,
        full_name: fullName,
        role: "driver",
        active: true,
      })
      .select("id, email, full_name, role, active, created_at")
      .single();

    if (profileError) {
      await authentication.supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json(
        { error: `The driver profile could not be created: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, driver: profile });
  } catch (error) {
    console.error("Driver creation failed:", error);
    return NextResponse.json({ error: "The driver could not be created" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authentication = await authenticateAdmin(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 403 });
    }

    const payload = await request.json();
    const driverId = typeof payload?.driverId === "string" ? payload.driverId : "";
    const active = payload?.active;

    if (!driverId || typeof active !== "boolean") {
      return NextResponse.json({ error: "Invalid driver update" }, { status: 400 });
    }

    const { data: target } = await authentication.supabaseAdmin
      .from("drivers")
      .select("id, role")
      .eq("id", driverId)
      .maybeSingle();

    if (!target || target.role === "admin") {
      return NextResponse.json({ error: "Only driver accounts can be changed here" }, { status: 400 });
    }

    const { error: authError } = await authentication.supabaseAdmin.auth.admin.updateUserById(
      driverId,
      { ban_duration: active ? "none" : "876000h" }
    );
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { data: driver, error: profileError } = await authentication.supabaseAdmin
      .from("drivers")
      .update({ active })
      .eq("id", driverId)
      .select("id, email, full_name, role, active, created_at")
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!active) {
      await authentication.supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", driverId);
    }

    return NextResponse.json({ success: true, driver });
  } catch (error) {
    console.error("Driver status update failed:", error);
    return NextResponse.json({ error: "The driver status could not be changed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authentication = await authenticateAdmin(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 403 });
    }

    const payload = await request.json();
    const driverId = typeof payload?.driverId === "string" ? payload.driverId : "";
    if (!driverId) {
      return NextResponse.json({ error: "Choose a driver" }, { status: 400 });
    }

    const { data: target } = await authentication.supabaseAdmin
      .from("drivers")
      .select("id, role")
      .eq("id", driverId)
      .maybeSingle();

    if (!target || target.role === "admin") {
      return NextResponse.json({ error: "Administrator accounts cannot be removed here" }, { status: 400 });
    }

    const { error: authError } = await authentication.supabaseAdmin.auth.admin.updateUserById(
      driverId,
      { ban_duration: "876000h" }
    );
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { error: profileError } = await authentication.supabaseAdmin
      .from("drivers")
      .update({ active: false })
      .eq("id", driverId);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    await authentication.supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", driverId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Driver removal failed:", error);
    return NextResponse.json({ error: "The driver could not be removed" }, { status: 500 });
  }
}

