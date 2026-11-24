
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface UserRow extends RowDataPacket {
  user_id: number;
  name: string;
  email: string;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("calculator_session")?.value;

    if (!token) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const payload = await verifySession(token);

    if (!payload || typeof payload.userId !== "number") {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const [rows] = await pool.execute<UserRow[]>(
      "SELECT user_id, name, email FROM users WHERE user_id = ?",
      [payload.userId]
    );

    const user = rows[0];

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Session verification error:", error);

    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 500 }
    );
  }
}
