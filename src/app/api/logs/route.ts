import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await adminDb.collection("webhook_logs").orderBy("receivedAt", "desc").limit(10).get();
    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        receivedAt: data.receivedAt ? data.receivedAt.toDate() : null
      };
    });
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
