import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, type, entregarAutorizacao } = body;

    if (!id || !type) {
      return NextResponse.json({ error: "ID ou tipo não fornecido." }, { status: 400 });
    }

    if (id === "0000") {
      return NextResponse.json({ success: true, isMock: true });
    }

    const ticketRef = adminDb.collection("ingressos").doc(id);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      return NextResponse.json({ error: "Ingresso não encontrado." }, { status: 404 });
    }

    const ticketData = ticketSnap.data();

    // Validação de ingresso expirado (pendente há mais de 24h)
    if (ticketData?.status === "pendente" && ticketData?.createdAt) {
      let createdTime: number;
      if (ticketData.createdAt.toMillis) {
        createdTime = ticketData.createdAt.toMillis();
      } else if (ticketData.createdAt.seconds) {
        createdTime = ticketData.createdAt.seconds * 1000;
      } else {
        createdTime = new Date(ticketData.createdAt).getTime();
      }

      const now = Date.now();
      const hours24 = 24 * 60 * 60 * 1000;
      if ((now - createdTime) > hours24) {
        return NextResponse.json({ error: "Ingresso expirado por falta de pagamento." }, { status: 400 });
      }
    }

    if (ticketData?.status !== "aprovado") {
      return NextResponse.json({ error: "Ingresso não aprovado ou pagamento pendente." }, { status: 400 });
    }

    if (type === "parking") {
      if (!ticketData?.includeParking) {
        return NextResponse.json({ error: "Este ingresso não possui ticket de estacionamento." }, { status: 400 });
      }
      if (ticketData?.parkingUsed) {
        return NextResponse.json({ error: "Este ticket de estacionamento já foi utilizado." }, { status: 400 });
      }

      await ticketRef.update({
        parkingUsed: true,
        parkingCheckedInAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      if (ticketData?.utilizado) {
        return NextResponse.json({ error: "Este ingresso já foi utilizado." }, { status: 400 });
      }

      await ticketRef.update({
        utilizado: true,
        checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
        autorizacaoEntregue: entregarAutorizacao || false,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao realizar check-in:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
