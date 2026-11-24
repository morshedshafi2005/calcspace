
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { createSession } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";

interface UserRow extends RowDataPacket {
  user_id: number;
  name: string;
  email: string;
  password_hash: string;
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute<UserRow[]>(
      "SELECT user_id, name, email, password_hash FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = await createSession(user.user_id);

    const response = NextResponse.json({
      success: true,
      message: "Login successful!",
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
      },
    });

    response.cookies.set("calculator_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { success: false, message: "Login failed." },
      { status: 500 }
    );
  }
}
