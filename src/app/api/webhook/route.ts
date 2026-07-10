import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // ==========================================
    // 🛠️ MODO DE SIMULAÇÃO PARA DESENVOLVIMENTO
    // ==========================================
    if (body.isMockSimulation && body.ticketId) {
      const { ticketId, status } = body;
      
      const docRef = adminDb.collection("ingressos").doc(ticketId);
      const ticketSnap = await docRef.get();
      
      if (!ticketSnap.exists) {
        return NextResponse.json({ error: "Ingresso não encontrado no Firestore." }, { status: 404 });
      }

      await docRef.update({
        status: status || "aprovado",
        paymentId: `mock_payment_${Date.now()}`,
        updatedAt: new Date(),
      });

      return NextResponse.json({ 
        message: "Simulação de webhook processada com sucesso!", 
        ticketId, 
        status: status || "aprovado" 
      });
    }

    // ==========================================
    // 💳 FLUXO REAL INTEGRADO COM INFINITEPAY
    // ==========================================
    
    // Registra o body recebido para facilitar o debug em produção
    console.log(`[Webhook InfinitePay] Body recebido:`, JSON.stringify(body));

    // A InfinitePay enviará as atualizações. O identificador que usamos (order_nsu) deve voltar no webhook
    const ticketId = body.order_nsu || body.reference_id || body.transaction?.order_nsu;
    const paymentStatus = body.status || body.transaction?.status;
    const paymentId = body.id || body.transaction?.id || body.payment_id;

    if (ticketId) {
      const docRef = adminDb.collection("ingressos").doc(ticketId);
      const ticketSnap = await docRef.get();

      if (ticketSnap.exists) {
        // Converte o status da InfinitePay para o nosso sistema interno
        // Por padrão, aprovações podem vir como "approved", "paid", ou similar
        let statusInterno: "pendente" | "aprovado" | "cancelado" = "pendente";
        
        const isApproved = 
            paymentStatus === "approved" || 
            paymentStatus === "paid" || 
            paymentStatus === "completed";

        const isCancelled = 
            paymentStatus === "rejected" || 
            paymentStatus === "cancelled" || 
            paymentStatus === "refunded" || 
            paymentStatus === "failed";

        if (isApproved) {
          statusInterno = "aprovado";
        } else if (isCancelled) {
          statusInterno = "cancelado";
        }

        // 2. Atualiza o status do ingresso no Firestore
        await docRef.update({
          status: statusInterno,
          paymentId: String(paymentId || ticketId),
          updatedAt: new Date(),
        });

        console.log(`[Webhook InfinitePay] Ingresso ${ticketId} atualizado para status: ${statusInterno}`);
      } else {
        console.warn(`[Webhook InfinitePay] Ingresso com ID ${ticketId} não encontrado.`);
      }
    } else {
       console.warn(`[Webhook InfinitePay] Payload inválido, sem identificador de ingresso:`, body);
    }

    // Sempre responda 200 OK
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error("Erro ao processar Webhook:", error);
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}
