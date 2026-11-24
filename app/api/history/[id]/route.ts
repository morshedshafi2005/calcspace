
import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";
import pool from "@/lib/db";
import { verifySession } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("calculator_session")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Login required." },
        { status: 401 }
      );
    }

    const payload = await verifySession(token);

    if (!payload || typeof payload.userId !== "number") {
      return NextResponse.json(
        { success: false, message: "Invalid session." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const historyId = Number(id);

    if (!Number.isSafeInteger(historyId) || historyId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid history ID." },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM calculation_history
       WHERE history_id = ? AND user_id = ?`,
      [historyId, payload.userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "History not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "History deleted successfully!",
    });
  } catch (error) {
    console.error("History delete error:", error);

    return NextResponse.json(
      { success: false, message: "Could not delete history." },
      { status: 500 }
    );
  }
}
