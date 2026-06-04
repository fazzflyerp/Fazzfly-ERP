/**
 * GET   /api/inv/request  — รายการ requests
 *   Super Admin: ทุก request (filter by status=PENDING optional)
 *   Branch: requests ของสาขาตัวเอง
 * POST  /api/inv/request  — สร้าง request ใหม่ (Branch)
 * PATCH /api/inv/request  — แก้ไข request (Super Admin, PENDING only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow, saUpdateRow, saInvalidateCache, saGetSheetMeta, saStructuralBatchUpdate } from "@/lib/google-sa";
import { getInvAccess, genId, thaiTimestamp } from "@/lib/inv-access";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { searchParams } = request.nextUrl;
    const statusFilter = searchParams.get("status") || "";

    const rows = await saReadRange(access.centralSheetId, "INV_Request!A:P", 0);

    let requests = rows.slice(1).map((r: any[]) => ({
      request_id:    (r[0]  ?? "").toString(),
      branch_id:     (r[1]  ?? "").toString(),
      branch_name:   (r[2]  ?? "").toString(),
      product_id:    (r[3]  ?? "").toString(),
      product_name:  (r[4]  ?? "").toString(),
      unit:          (r[5]  ?? "").toString(),
      qty_requested: Number(r[6] ?? 0),
      qty_approved:  (r[7]  ?? "").toString(),
      lot_id:        (r[8]  ?? "").toString(),
      expiry_date:   (r[9]  ?? "").toString(),
      status:        (r[10] ?? "").toString(),
      note:          (r[11] ?? "").toString(),
      requested_by:  (r[12] ?? "").toString(),
      requested_at:  (r[13] ?? "").toString(),
      reviewed_by:   (r[14] ?? "").toString(),
      reviewed_at:   (r[15] ?? "").toString(),
    })).filter((r) => r.request_id);

    // Branch: filter own branch only
    if (access.role !== "SUPER_ADMIN" && access.branchId) {
      requests = requests.filter((r) => r.branch_id === access.branchId);
    }

    if (statusFilter) {
      requests = requests.filter((r) => r.status.toUpperCase() === statusFilter.toUpperCase());
    }

    // Sort newest first
    requests.reverse();

    return NextResponse.json({ requests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const body = await request.json();
    const {
      branch_id, branch_name, product_id, product_name, unit, qty_requested, note,
    } = body;

    const effectiveBranchId   = branch_id   || access.branchId;
    const effectiveBranchName = branch_name || access.branchName;

    if (!effectiveBranchId || !product_name || !qty_requested) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sid = access.centralSheetId;
    const reqId = await genId("REQ", sid, "INV_Request");
    const ts    = thaiTimestamp();

    await saAppendRow(sid, "INV_Request!A:P", [
      reqId,
      effectiveBranchId,
      effectiveBranchName,
      product_id,
      product_name,
      unit,
      Number(qty_requested),
      "",   // qty_approved
      "",   // lot_id
      "",   // expiry_date
      "PENDING",
      note || "",
      email,
      ts,
      "",   // reviewed_by
      "",   // reviewed_at
    ]);

    saInvalidateCache(sid);

    // Create notification for Super Admin
    try {
      await saAppendRow(sid, "INV_Notification!A:H", [
        `NOTIF-${Date.now()}`,
        "SUPER_ADMIN",
        effectiveBranchId,
        "new_request",
        `คำขอสินค้าใหม่จาก ${effectiveBranchName}: ${product_name} x${qty_requested}`,
        reqId,
        "FALSE",
        ts,
      ]);
    } catch { /* notification failure should not block */ }

    return NextResponse.json({ request_id: reqId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access || access.role !== "SUPER_ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { request_id, qty_requested, note } = await request.json();
    if (!request_id) return NextResponse.json({ error: "request_id required" }, { status: 400 });

    const sid = access.centralSheetId;

    const reqRows  = await saReadRange(sid, "INV_Request!A:P", 0);
    const rowIdx   = reqRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === request_id);
    if (rowIdx < 1) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const row    = reqRows[rowIdx];
    const status = (row[10] ?? "").toString().toUpperCase();
    if (status !== "PENDING")
      return NextResponse.json({ error: "แก้ไขได้เฉพาะ Request ที่ PENDING เท่านั้น" }, { status: 409 });

    const updated = [...row];
    if (qty_requested !== undefined) updated[6] = Number(qty_requested);
    if (note          !== undefined) updated[11] = note;
    await saUpdateRow(sid, `INV_Request!A${rowIdx + 1}`, updated);

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, request_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email  = (token.email as string).toLowerCase().trim();
    const access = await getInvAccess(email);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!access.centralSheetId)
      return NextResponse.json({ error: "Central INV not configured" }, { status: 400 });

    const { request_id } = await request.json();
    if (!request_id) return NextResponse.json({ error: "request_id required" }, { status: 400 });

    const sid = access.centralSheetId;

    const reqRows = await saReadRange(sid, "INV_Request!A:P", 0);
    const rowIdx  = reqRows.findIndex((r, i) => i > 0 && (r[0] ?? "").toString() === request_id);
    if (rowIdx < 1) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const row      = reqRows[rowIdx];
    const branchId = (row[1] ?? "").toString();
    const status   = (row[10] ?? "").toString().toUpperCase();

    // Branch users can only delete their own PENDING requests
    if (access.role !== "SUPER_ADMIN") {
      if (branchId !== access.branchId)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (status !== "PENDING")
        return NextResponse.json({ error: "ลบได้เฉพาะ Request ที่ PENDING เท่านั้น" }, { status: 409 });
    }

    const { sheetId } = await saGetSheetMeta(sid, "INV_Request");
    await saStructuralBatchUpdate(sid, [{
      deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIdx, endIndex: rowIdx + 1 } },
    }]);

    saInvalidateCache(sid);
    return NextResponse.json({ ok: true, request_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
