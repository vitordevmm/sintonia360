import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json({ error: "Identificador ausente." }, { status: 400 });
    }

    const cleanIdentifier = identifier.replace(/\D/g, "");

    if (!cleanIdentifier) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    // 1. Busca por CPF no Firestore usando Admin SDK
    let userSnap = await adminDb.collection("usuarios").where("cpf", "==", cleanIdentifier).get();

    // 2. Se não encontrar por CPF, busca por Telefone
    if (userSnap.empty) {
      userSnap = await adminDb.collection("usuarios").where("telefone", "==", cleanIdentifier).get();
    }

    if (userSnap.empty) {
      return NextResponse.json({ error: "Nenhum usuário encontrado com este CPF ou Telefone." }, { status: 404 });
    }

    const userData = userSnap.docs[0].data();
    
    // Retorna apenas o e-mail associado
    return NextResponse.json({ email: userData.email });
  } catch (error: any) {
    console.error("Erro no lookup de usuário:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
