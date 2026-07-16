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
        const allNumsSnap = await adminDb.collection("ingressos")
          .where("numeroIngresso", ">", 0)
          .orderBy("numeroIngresso", "asc")
          .get();
        
        let foundMissing = 1;
        for (const doc of allNumsSnap.docs) {
          if (doc.data().numeroIngresso === foundMissing) {
            foundMissing++;
          } else if (doc.data().numeroIngresso > foundMissing) {
            break;
          }
        }
        numeroIngresso = foundMissing;
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
