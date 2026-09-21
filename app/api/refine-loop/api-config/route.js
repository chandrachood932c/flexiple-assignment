import { cookies } from "next/headers";
import crypto from "crypto";
import { setApiConfig } from "@/lib/api-config-store";

export async function POST(request) {
  try {
    const { apiKey, apiModel } = await request.json();

    if (!apiKey || !apiModel) {
      return Response.json(
        { error: "API key and model are required" },
        { status: 400 }
      );
    }

    console.log(apiKey, apiModel, 'sd')
    const sessionId = crypto.randomUUID();

    setApiConfig(sessionId, {
      apiKey,
      apiModel,
    });

    const cookieStore = await cookies();

    cookieStore.set("recruiter_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 1, // 1 hours
    });

    return Response.json({
      success: true,
      apiModel: apiModel.trim(),
    });
  } catch (err) {
    console.error("API Config error:", err);
    return Response.json(
      { error: err.message || "Failed to save API configuration. Please try again." },
      { status: 500 }
    );
  }
}