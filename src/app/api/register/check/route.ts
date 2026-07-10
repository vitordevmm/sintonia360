import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { cpf, telefone } = await request.json();

    if (!cpf && !telefone) {
      return NextResponse.json({ error: "Dados para verificação ausentes." }, { status: 400 });
    }

    if (cpf) {
      const rawCpf = cpf.replace(/\D/g, "");
      const cpfSnap = await adminDb.collection("usuarios").where("cpf", "==", rawCpf).get();
      if (!cpfSnap.empty) {
        return NextResponse.json({ exists: true, field: "cpf" });
      }
    }

    if (telefone) {
      const rawPhone = telefone.replace(/\D/g, "");
      if (rawPhone.length > 0) {
        const phoneSnap = await adminDb.collection("usuarios").where("telefone", "==", rawPhone).get();
        if (!phoneSnap.empty) {
          return NextResponse.json({ exists: true, field: "telefone" });
        }
      }
    }

    return NextResponse.json({ exists: false });
  } catch (error: any) {
    console.error("Erro ao verificar duplicidade de usuário:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
