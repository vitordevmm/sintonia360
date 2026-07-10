import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

const LOTES_OFICIAIS = {
  "lote-1": { nome: "1º Lote - Individual", valor: 40.0, maxVendas: 150 },
  "lote-2": { nome: "2º Lote - Individual", valor: 45.0, maxVendas: null },
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Acesso negado: Token ausente" }, { status: 401 });
    }
    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: "Acesso negado: Token inválido" }, { status: 401 });
    }

    const body = await request.json();
    const { loteId, userId, userNome, userCpf, userEmail, userTelefone, includeParking } = body;

    if (!loteId || !userId || !userNome || !userCpf || !userEmail) {
      return NextResponse.json(
        { error: "Dados incompletos para processar a compra." },
        { status: 400 }
      );
    }

    if (decodedToken.uid !== userId) {
      return NextResponse.json({ error: "Tentativa de compra para outro usuário não permitida." }, { status: 403 });
    }

    const loteData = LOTES_OFICIAIS[loteId as keyof typeof LOTES_OFICIAIS];
    if (!loteData) {
      return NextResponse.json({ error: "Lote inválido ou esgotado." }, { status: 400 });
    }

    // Verifica se o usuário já possui um ingresso aprovado
    const userTicketsSnapshot = await adminDb.collection("ingressos")
      .where("uid", "==", userId)
      .where("status", "==", "aprovado")
      .get();
    
    if (!userTicketsSnapshot.empty) {
      return NextResponse.json({ error: "Você já possui um ingresso garantido. Só é permitido um ingresso por pessoa." }, { status: 400 });
    }

    const loteNome = loteData.nome;
    const valor = loteData.valor;

    // Verificação de Limite Automática para Lote 1
    if (loteData.maxVendas !== null) {
      const vendidosSnapshot = await adminDb.collection("ingressos")
        .where("loteId", "==", loteId)
        .where("status", "==", "aprovado")
        .count()
        .get();
      
      const vendidos = vendidosSnapshot.data().count;
      if (vendidos >= loteData.maxVendas) {
        return NextResponse.json({ error: "Lote Esgotado! Por favor, atualize a página para ver o próximo lote." }, { status: 400 });
      }
    }

    // Verificação de Limite de Estacionamento (50 vagas)
    if (includeParking) {
      const estacionamentoVendido = await adminDb.collection("ingressos")
        .where("includeParking", "==", true)
        .where("status", "==", "aprovado")
        .count()
        .get();
      
      const vagasVendidas = estacionamentoVendido.data().count;
      if (vagasVendidas >= 50) {
        return NextResponse.json({ error: "As vagas de estacionamento estão esgotadas! Por favor, desmarque a opção para continuar com a compra do ingresso." }, { status: 400 });
      }
    }

    // Gera um identificador de compra único
    const purchaseId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Define a base URL para redirecionamento pós-pagamento de forma robusta
    const host = request.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const origin = request.headers.get("origin");
    const baseUrl = origin || (host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || "https://sintonia360.vercel.app"));
    const infinitePayHandle = process.env.INFINITEPAY_HANDLE || "sintonia360";

    // 1. Cria a preferência de pagamento na InfinitePay
    const ipResponse = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle: infinitePayHandle,
        customer: {
          name: userNome,
          email: userEmail,
          phone_number: userTelefone ? `+55${userTelefone.replace(/\D/g, "")}` : undefined
        },
        items: [
          {
            quantity: 1,
            price: Math.round(Number(valor) * 100), // Converte para centavos usando o valor oficial do backend
            description: `Sintonia 360 - ${loteNome}`,
            name: loteNome,
          },
          ...(includeParking ? [{
            quantity: 1,
            price: 2500, // R$ 25,00 em centavos
            description: "Ticket Estacionamento (1 Vaga de Carro)",
            name: "Estacionamento",
          }] : [])
        ],
        order_nsu: purchaseId, // Nosso identificador de pedido único
        redirect_url: `${baseUrl}/profile`,
        // O Webhook enviará notificações para esta URL de callback
        webhook_url: process.env.WEBHOOK_URL
          ? `${process.env.WEBHOOK_URL}/api/webhook`
          : `${baseUrl}/api/webhook`
      }),
    });

    if (!ipResponse.ok) {
       const errorData = await ipResponse.text();
       throw new Error(`Erro na InfinitePay: ${errorData}`);
    }

    const ipData = await ipResponse.json();

    // 2. Registra o ingresso com status "pendente" no Firestore
    await adminDb.collection("ingressos").doc(purchaseId).set({
      uid: userId,
      nomeComprador: userNome,
      cpfComprador: userCpf,
      lote: loteNome,
      loteId: loteId,
      valor: includeParking ? Number(valor) + 25 : Number(valor),
      includeParking: Boolean(includeParking),
      parkingUsed: false,
      parkingQrCodeData: includeParking ? `sintonia360_parking_${purchaseId}_${userId}` : null,
      status: "pendente", // Inicia como pendente aguardando webhook
      paymentId: "", // Será preenchido no webhook se fornecido
      qrCodeData: `sintonia360_${purchaseId}_${userId}`, // Código que será lido no leitor da portaria
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Retorna a URL de redirecionamento do checkout
    return NextResponse.json({
      id: purchaseId,
      url: ipData.url,
      init_point: ipData.url // para retrocompatibilidade
    });

  } catch (error: unknown) {
    console.error("Erro na rota de checkout:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Erro ao gerar preferência de pagamento.", details: msg },
      { status: 500 }
    );
  }
}
