import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { order_nsu, transaction_nsu } = await request.json();

    if (!order_nsu) {
      return NextResponse.json({ error: "order_nsu missing" }, { status: 400 });
    }

    const docRef = adminDb.collection("ingressos").doc(order_nsu);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = docSnap.data();
    
    // Only update if it's currently pending
    if (data?.status === "pendente") {
      let numeroIngresso = data.numeroIngresso || null;

      if (!numeroIngresso) {
        const maxNumSnap = await adminDb.collection("ingressos")
          .orderBy("numeroIngresso", "desc")
          .limit(1)
          .get();
        
        if (!maxNumSnap.empty) {
          const maxVal = maxNumSnap.docs[0].data().numeroIngresso || 0;
          numeroIngresso = maxVal + 1;
        } else {
          numeroIngresso = 1;
        }
      }

      await docRef.update({
        status: "aprovado",
        paymentId: transaction_nsu || order_nsu,
        ...(numeroIngresso ? { numeroIngresso } : {}),
        updatedAt: new Date(),
      });
      
      return NextResponse.json({ success: true, updated: true });
    }

    return NextResponse.json({ success: true, updated: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
