import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { getBirthDateFromCPF } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { uid, nome, cpf, email, telefone, dataNascimento, idade, idToken } = await request.json();

    if (!uid || !nome || !cpf || !email || !idToken) {
      return NextResponse.json({ error: "Dados cadastrais incompletos ou token ausente." }, { status: 400 });
    }

    // 1. Validar e decodificar o ID Token enviado pelo cliente para provar autenticação
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (tokenError: any) {
      console.error("Erro ao verificar token do Firebase Auth:", tokenError);
      return NextResponse.json({ error: "Token de autenticação inválido ou expirado." }, { status: 401 });
    }

    // 2. Garantir que o token autenticado é do próprio usuário que quer gravar o perfil
    if (decodedToken.uid !== uid) {
      return NextResponse.json({ error: "Ação não autorizada. Inconsistência de credenciais." }, { status: 403 });
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    
    // Se a data de nascimento não vier no payload (fallback), usamos a do sistema.
    const finalBirthDate = dataNascimento || getBirthDateFromCPF(cleanCpf);

    // 3. Salvar os dados do usuário no Firestore via Admin SDK usando o e-mail como ID do documento
    await adminDb.collection("usuarios").doc(email.trim().toLowerCase()).set({
      uid,
      nome: nome.trim(),
      cpf: cleanCpf,
      email: email.trim(),
      telefone: telefone ? telefone.replace(/\D/g, "") : "",
      dataNascimento: finalBirthDate,
      idade: idade || null,
      role: "user", // Role padrão seguro atribuído no servidor
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao criar perfil de usuário:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
