import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const LOTES_OFICIAIS = [
  {
    id: "lote-1",
    nome: "1º Lote - Individual",
    valor: 40.0,
    descricao: "Ingresso individual com acesso total ao evento.",
    maxVendas: 150,
  },
  {
    id: "lote-2",
    nome: "2º Lote - Individual",
    valor: 45.0,
    descricao: "Ingresso individual com acesso total ao evento.",
    maxVendas: null,
  }
];

export async function GET() {
  try {
    const lotesData = await Promise.all(LOTES_OFICIAIS.map(async (lote) => {
      if (lote.maxVendas !== null) {
        const vendidosSnapshot = await adminDb.collection("ingressos")
          .where("loteId", "==", lote.id)
          .where("status", "==", "aprovado")
          .count()
          .get();
        
        const vendidos = vendidosSnapshot.data().count;
        const esgotado = vendidos >= lote.maxVendas;
        
        return {
          ...lote,
          vendidos,
          esgotado,
          status: esgotado ? "esgotado" : "ativo",
          badges: esgotado ? ["Esgotado"] : ["Promocional", "Disponível"]
        };
      }

      return {
        ...lote,
        vendidos: 0,
        esgotado: false,
        status: "aguardando",
        badges: []
      };
    }));

    const lote1 = lotesData.find(l => l.id === "lote-1");
    const lote2 = lotesData.find(l => l.id === "lote-2");
    
    if (lote2) {
      if (lote1 && lote1.esgotado) {
        lote2.status = "ativo";
        lote2.badges = ["Disponível"];
      } else {
        lote2.status = "aguardando";
        lote2.badges = ["Aguardando"];
      }
    }

    return NextResponse.json(lotesData);
  } catch (error) {
    console.error("Erro ao buscar lotes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
