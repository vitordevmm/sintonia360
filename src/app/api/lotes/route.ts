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
    // Fetch configuration from Firestore
    const configDoc = await adminDb.collection("configuracoes").doc("geral").get();
    let lotesConfig = configDoc.exists ? configDoc.data()?.lotes : null;

    // Fallback default lotes if not configured yet
    if (!lotesConfig) {
      lotesConfig = [
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
    }

    const lotesData = await Promise.all(lotesConfig.map(async (lote: any) => {
      if (lote.maxVendas !== null && typeof lote.maxVendas !== "undefined") {
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

    // Find first active or next waiting lote to manage status
    let foundActive = false;
    for (let i = 0; i < lotesData.length; i++) {
      if (lotesData[i].esgotado) {
        // If exhausted, keep as esgotado
        continue;
      }
      
      if (!foundActive) {
        // First non-exhausted lote becomes active
        lotesData[i].status = "ativo";
        lotesData[i].badges = ["Disponível"];
        foundActive = true;
      } else {
        // Subsequent non-exhausted lotes remain aguardando
        lotesData[i].status = "aguardando";
        lotesData[i].badges = ["Aguardando"];
      }
    }

    return NextResponse.json({
      lotes: lotesData,
      parkingPrice: configDoc.exists ? configDoc.data()?.parkingPrice || 25.0 : 25.0
    });
  } catch (error) {
    console.error("Erro ao buscar lotes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
