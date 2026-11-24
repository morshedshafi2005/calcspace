
import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "@/lib/db";
import { verifySession } from "@/lib/auth";

interface HistoryRow extends RowDataPacket {
  history_id: number;
  expression: string;
  result: string;
  calculation_type: string;
  created_at: Date;
}

async function getUserId(request: NextRequest) {
  const token = request.cookies.get("calculator_session")?.value;

  if (!token) return null;

  const payload = await verifySession(token);

  if (!payload || typeof payload.userId !== "number") {
    return null;
  }

  return payload.userId;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Login required." },
        { status: 401 }
      );
    }

    const [rows] = await pool.execute<HistoryRow[]>(
      `SELECT history_id, expression, result,
              calculation_type, created_at
       FROM calculation_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      history: rows,
    });
  } catch (error) {
    console.error("History fetch error:", error);

    return NextResponse.json(
      { success: false, message: "Could not load history." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Login required." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const expression =
      typeof body.expression === "string" ? body.expression.trim() : "";

    const result =
      typeof body.result === "string" ||
      typeof body.result === "number"
        ? String(body.result)
        : "";

    const calculationType =
      typeof body.calculationType === "string"
        ? body.calculationType
        : "basic";

    if (
      !expression ||
      !result ||
      expression.length > 1000 ||
      result.length > 255 ||
      calculationType.length > 50
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid calculation data." },
        { status: 400 }
      );
    }

    const [insertResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO calculation_history
       (user_id, expression, result, calculation_type)
       VALUES (?, ?, ?, ?)`,
      [userId, expression, result, calculationType]
    );

    return NextResponse.json({
      success: true,
      message: "Calculation saved!",
      historyId: insertResult.insertId,
    }, { status: 201 });
  } catch (error) {
    console.error("History save error:", error);

    return NextResponse.json(
      { success: false, message: "Could not save calculation." },
      { status: 500 }
    );
  }
}
