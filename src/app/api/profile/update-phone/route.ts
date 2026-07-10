import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { idToken, telefone } = await request.json();

    if (!idToken || !telefone) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    const docId = userEmail ? userEmail.toLowerCase() : userId;
    const userRef = adminDb.collection("usuarios").doc(docId);
    
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    await userRef.update({
      telefone: telefone.replace(/\D/g, "")
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar telefone:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
