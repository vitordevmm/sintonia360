import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID do ingresso não fornecido." }, { status: 400 });
    }

    if (id === "0000") {
      return NextResponse.json({
        id: "0000",
        uid: "mock_vitor",
        nomeComprador: "Vitor Hugo",
        cpfComprador: "150.773.706-80",
        lote: "Cortesia de Teste Infinito",
        valor: 0.00,
        status: "aprovado",
        qrCodeData: "SINTONIA360-TEST-TICKET-0000",
        utilizado: false,
        age: 26,
        isMinor: false
      });
    }

    const ticketRef = adminDb.collection("ingressos").doc(id);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      return NextResponse.json({ error: "Ingresso não encontrado." }, { status: 404 });
    }

    const ticketData = ticketSnap.data();
    
    // Obter data de nascimento
    let birthDate = null;
    let age = null;
    let isMinor = false;

    if (ticketData?.uid) {
      const userQuery = await adminDb.collection("usuarios").where("uid", "==", ticketData.uid).limit(1).get();
      if (!userQuery.empty) {
        const userDocData = userQuery.docs[0].data();
        if (userDocData?.dataNascimento) {
          birthDate = userDocData.dataNascimento;
        } else if (userDocData?.idade) {
          age = userDocData.idade;
        }
      }
    }

    if (birthDate) {
      const bd = new Date(birthDate);
      const today = new Date();
      age = today.getFullYear() - bd.getFullYear();
      const m = today.getMonth() - bd.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) {
        age--;
      }
      isMinor = age < 16;
    } else if (age !== null) {
      isMinor = age < 16;
    }

    return NextResponse.json({
      id: ticketSnap.id,
      ...ticketData,
      age,
      isMinor,
    });
  } catch (error: any) {
    console.error("Erro na busca do ingresso:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
