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
    const dataObj = body.data || body;
    const ticketId = dataObj.order_nsu || dataObj.reference_id || dataObj.transaction?.order_nsu || body.order_nsu;
    const paymentStatus = (dataObj.status || dataObj.transaction?.status || body.status)?.toLowerCase();
    const paymentId = dataObj.id || dataObj.transaction?.id || dataObj.payment_id || body.id;

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

        let numeroIngresso = ticketSnap.data()?.numeroIngresso || null;

        if (statusInterno === "aprovado" && !numeroIngresso) {
          // Busca o maior número de ingresso já atribuído
          const maxNumSnap = await adminDb.collection("ingressos")
            .orderBy("numeroIngresso", "desc")
            .limit(1)
            .get();
          
          if (!maxNumSnap.empty) {
            const maxVal = maxNumSnap.docs[0].data().numeroIngresso || 0;
            numeroIngresso = maxVal + 1;
          } else {
            numeroIngresso = 1;
          }
        }

        // 2. Atualiza o status do ingresso no Firestore
        await docRef.update({
          status: statusInterno,
          paymentId: String(paymentId || ticketId),
          ...(numeroIngresso ? { numeroIngresso } : {}),
          updatedAt: new Date(),
        });

        console.log(`[Webhook InfinitePay] Ingresso ${ticketId} atualizado para status: ${statusInterno} (Num: ${numeroIngresso})`);
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
