"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getBirthDateFromCPF } from "@/lib/utils";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  UserCheck, 
  ShieldAlert, 
  ArrowLeft,
  FileText
} from "lucide-react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

interface TicketData {
  id: string;
  uid: string;
  nomeComprador: string;
  cpfComprador: string;
  lote: string;
  valor: number;
  status: "pendente" | "aprovado" | "cancelado";
  qrCodeData: string;
  utilizado?: boolean;
  checkedInAt?: FirestoreTimestamp | string | number | Date | null;
  autorizacaoEntregue?: boolean;
  parkingUsed?: boolean;
  parkingCheckedInAt?: FirestoreTimestamp | string | number | Date | null;
}

const calculateAge = (birthDateString: string): number => {
  const birthDate = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

function CheckInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("id");
  const ticketType = searchParams.get("type");
  const isParking = ticketType === "parking";

  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [isMinor, setIsMinor] = useState(false);
  
  const [successState, setSuccessState] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchTicket = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setErrorMsg("");

      // Caso especial: Ingresso de Teste Infinito #0000
      if (id === "0000") {
        const mockTicket: TicketData = {
          id: "0000",
          uid: "mock_vitor",
          nomeComprador: "Vitor Hugo",
          cpfComprador: "150.773.706-80",
          lote: "Cortesia de Teste Infinito",
          valor: 0.00,
          status: "aprovado",
          qrCodeData: "SINTONIA360-TEST-TICKET-0000",
          utilizado: false
        };
        setTicket(mockTicket);
        
        // Derivar idade
        const birthDate = getBirthDateFromCPF("15077370680");
        const calcAge = calculateAge(birthDate);
        setAge(calcAge);
        setIsMinor(calcAge < 16);
        setLoading(false);
        return;
      }

      const ticketRef = doc(db, "ingressos", id);
      const ticketSnap = await getDoc(ticketRef);

      if (!ticketSnap.exists()) {
        setErrorMsg(`Ingresso com ID #${id} não foi encontrado no sistema.`);
        setTicket(null);
        setLoading(false);
        return;
      }

      const ticketData = ticketSnap.data() as TicketData;
      setTicket({ ...ticketData, id: ticketSnap.id });

      // Calcular idade
      let birthDate = "";
      
      // Tentar buscar perfil do comprador para obter dataNascimento real
      if (ticketData.uid) {
        const buyerDocSnap = await getDoc(doc(db, "usuarios", ticketData.uid));
        if (buyerDocSnap.exists() && buyerDocSnap.data().dataNascimento) {
          birthDate = buyerDocSnap.data().dataNascimento;
        }
      }

      // Fallback determinístico baseado no CPF se não encontrar no perfil
      if (!birthDate && ticketData.cpfComprador) {
        const cleanCpf = ticketData.cpfComprador.replace(/\D/g, "");
        birthDate = getBirthDateFromCPF(cleanCpf);
      }

      if (birthDate) {
        const calcAge = calculateAge(birthDate);
        setAge(calcAge);
        setIsMinor(calcAge < 16);
      } else {
        setAge(null);
        setIsMinor(false);
      }

      setLoading(false);
    } catch (error: unknown) {
      console.error("Erro ao buscar ingresso:", error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      setErrorMsg(`Erro de conexão ao buscar ingresso: ${msg}`);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push(`/login?redirect=/admin/check-in?id=${ticketId || ""}`);
        return;
      }

      try {
        // 1. Verificar se é Admin
        let userDoc = null;
        if (currentUser.email) {
          userDoc = await getDoc(doc(db, "usuarios", currentUser.email.toLowerCase()));
        }
        if (!userDoc || !userDoc.exists()) {
          userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        }

        const emailIsAdmin = 
          currentUser.email?.toLowerCase() === "vitorhugonascimentosique@gmail.com" ||
          currentUser.email?.toLowerCase() === "henriquetranssilva@gmail.com";
        const roleIsAdmin = userDoc && userDoc.exists() && userDoc.data().role === "admin";

        if (emailIsAdmin || roleIsAdmin) {
          setIsAdmin(true);
          
          // 2. Buscar dados do Ingresso
          if (ticketId) {
            await fetchTicket(ticketId);
          } else {
            setErrorMsg("Nenhum ID de ingresso foi fornecido.");
            setLoading(false);
          }
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      } catch (error) {
        console.error("Erro na validação de login admin:", error);
        setErrorMsg("Ocorreu um erro ao validar seu acesso.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [ticketId, router, fetchTicket]);

  const handleConfirmCheckIn = async (entregarAutorizacao: boolean = false) => {
    if (!ticket || checkingIn) return;
    setCheckingIn(true);

    try {
      // Caso especial teste infinito
      if (ticket.id === "0000") {
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ["#F5F500", "#FFFFFF", "#00FF00"],
          });
          setSuccessState(true);
          setCheckingIn(false);
        }, 800);
        return;
      }

      const ticketRef = doc(db, "ingressos", ticket.id);
      const updateData = isParking ? {
        parkingUsed: true,
        parkingCheckedInAt: serverTimestamp(),
      } : {
        utilizado: true,
        checkedInAt: serverTimestamp(),
        ...(entregarAutorizacao && { autorizacaoEntregue: true })
      };

      await updateDoc(ticketRef, updateData);

      // Trigger Confetti
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#F5F500", "#FFFFFF", "#10B981"],
      });

      setSuccessState(true);
    } catch (err: any) {
      const msg = err.message || "Erro desconhecido.";
      toast.error(`Falha no check-in: ${msg}`);
    } finally {
      setCheckingIn(false);
    }
  };

  // 1. TELA DE CARREGAMENTO
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center">
        <Loader2 size={36} className="text-primary animate-spin mb-4" />
        <p className="text-xs font-black tracking-widest text-neutral-400 uppercase">
          Validando Ingresso na Portaria...
        </p>
      </div>
    );
  }

  // 2. TELA DE ACESSO NÃO AUTORIZADO (NÃO ADMIN)
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col pt-20">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="w-full max-w-lg flat-card rounded p-6 sm:p-8 border border-neutral-800 shadow-2xl space-y-6 text-center bg-neutral-950/40">
            <div className="w-16 h-16 rounded border border-dashed border-red-500/30 bg-red-950/15 flex items-center justify-center mx-auto text-red-500">
              <ShieldAlert size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="font-display font-black text-2xl uppercase tracking-tight text-white">
                Acesso Restrito
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed px-4 font-medium">
                Esta página é exclusiva para a equipe de portaria e organizadores da **GHVE Eventos** para check-in de bilhetes.
              </p>
            </div>
            <button
              onClick={() => router.push("/profile")}
              className="w-full py-3 px-5 border border-neutral-800 hover:border-neutral-700 font-black text-xs uppercase tracking-widest text-center transition-colors"
            >
              Voltar ao meu Perfil
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          
          {/* CASO 1: SUCESSO DO CHECK-IN */}
          {successState ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl flat-card border-2 border-emerald-500 bg-emerald-950/10 p-8 sm:p-12 text-center rounded shadow-[0_0_50px_rgba(16,185,129,0.15)] space-y-8"
            >
              <div className="w-20 h-20 rounded-full border-4 border-emerald-500 bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-400 shadow-lg animate-bounce">
                <CheckCircle2 size={44} />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] tracking-[0.25em] font-black text-emerald-400 uppercase">
                  VALIDAÇÃO EFETIVADA
                </span>
                <h2 className="font-display font-black text-4xl sm:text-5xl uppercase tracking-tight text-white leading-none">
                  Acesso Liberado!
                </h2>
                <p className="text-xs text-neutral-300 max-w-sm mx-auto font-medium">
                  {isParking ? "A entrada do veículo foi registrada com sucesso." : "A entrada do portador foi registrada com sucesso. Bom evento!"}
                </p>
              </div>

              <div className="p-4 bg-neutral-900 border border-neutral-800 text-left text-xs uppercase tracking-wider space-y-2 w-full max-w-md mx-auto">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Portador:</span>
                  <span className="text-white font-bold">{ticket?.nomeComprador}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">CPF:</span>
                  <span className="text-white font-bold">{ticket?.cpfComprador}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Ingresso ID:</span>
                  <span className="text-primary font-bold">#{ticket?.id.toUpperCase()}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-800 pt-2 text-[10px]">
                  <span className="text-neutral-500">Status no Banco:</span>
                  <span className="text-emerald-400 font-black">✓ UTILIZADO (AGORA)</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <button
                  onClick={() => router.push("/admin")}
                  className="px-6 py-3 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-colors font-black text-xs uppercase tracking-wider"
                >
                  Ir para o Painel Geral
                </button>
                {ticketId !== "0000" && (
                  <button
                    onClick={() => fetchTicket(ticketId!)}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-black transition-colors font-black text-xs uppercase tracking-wider"
                  >
                    Verificar Novamente
                  </button>
                )}
              </div>
            </motion.div>
          ) : errorMsg ? (
            
            // CASO 2: INGRESSO INVÁLIDO OU OUTRO ERRO
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-md flat-card border-2 border-red-500 bg-red-950/10 p-8 text-center rounded space-y-6"
            >
              <div className="w-16 h-16 rounded-full border border-dashed border-red-500 bg-red-950/20 flex items-center justify-center mx-auto text-red-500">
                <XCircle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-black text-2xl uppercase text-white">
                  Ingresso Inválido
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed px-2 font-medium">
                  {errorMsg}
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push("/admin")}
                  className="flex items-center gap-2 px-5 py-3 border border-neutral-800 text-neutral-400 hover:text-white transition-all font-bold text-xs uppercase tracking-wider"
                >
                  <ArrowLeft size={12} />
                  Voltar ao Painel
                </button>
              </div>
            </motion.div>
          ) : ticket ? (
            
            // CASO 3: INGRESSO ENCONTRADO - EXIBIR INTERFACE DE DECISÃO
            <motion.div
              key="ticket-details"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => router.push("/admin")}
                  className="inline-flex items-center gap-2 text-xs font-black tracking-wider uppercase text-neutral-400 hover:text-white transition-all"
                >
                  <ArrowLeft size={14} />
                  Voltar ao Painel
                </button>
                <span className="text-[10px] tracking-[0.2em] font-black text-neutral-500 uppercase">
                  LEITOR DE PORTARIA SINTONIA 360
                </span>
              </div>

              {/* Status do Ingresso: Utilizado, Cancelado, Pendente ou Válido */}
              {ticket.status !== "aprovado" ? (
                // 3A. Ingresso não aprovado (pendente ou cancelado)
                <div className="flat-card border-2 border-red-500 bg-red-950/15 p-6 rounded space-y-4 text-center">
                  <div className="w-12 h-12 rounded border border-dashed border-red-500/30 flex items-center justify-center mx-auto text-red-500 bg-red-950/10">
                    <XCircle size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display font-black text-lg text-white uppercase">Acesso Recusado</h3>
                    <p className="text-xs text-red-400 font-bold uppercase tracking-wider">
                      Status da Transação: {ticket.status.toUpperCase()}
                    </p>
                    <p className="text-[11px] text-neutral-400 font-medium leading-relaxed max-w-md mx-auto mt-2">
                      Este ingresso foi cadastrado no sistema, porém o pagamento ainda não foi confirmado ou foi cancelado/recusado no Mercado Pago. O portador não pode acessar a arena.
                    </p>
                  </div>
                </div>
              ) : (isParking ? ticket.parkingUsed : ticket.utilizado) && ticket.id !== "0000" ? (
                // 3B. Ingresso de uso único já utilizado
                <div className="flat-card border-2 border-amber-500 bg-amber-950/15 p-6 rounded space-y-4 text-center shadow-[0_0_20px_rgba(245,158,11,0.08)]">
                  <div className="w-12 h-12 rounded border border-dashed border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 bg-amber-950/10 animate-pulse">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display font-black text-lg text-white uppercase">Acesso Negado: {isParking ? "Vaga" : "Ingresso"} Utilizado!</h3>
                    <p className="text-xs text-amber-500 font-black uppercase tracking-wider">
                      Já Utilizado em: {isParking && ticket.parkingCheckedInAt ? (
                        (typeof ticket.parkingCheckedInAt === "object" && ticket.parkingCheckedInAt !== null && "toDate" in ticket.parkingCheckedInAt)
                          ? (ticket.parkingCheckedInAt as FirestoreTimestamp).toDate().toLocaleString("pt-BR")
                          : new Date(ticket.parkingCheckedInAt as string | number | Date).toLocaleString("pt-BR")
                      ) : !isParking && ticket.checkedInAt ? (
                        (typeof ticket.checkedInAt === "object" && ticket.checkedInAt !== null && "toDate" in ticket.checkedInAt)
                          ? (ticket.checkedInAt as FirestoreTimestamp).toDate().toLocaleString("pt-BR")
                          : new Date(ticket.checkedInAt as string | number | Date).toLocaleString("pt-BR")
                      ) : "Data desconhecida"}
                    </p>
                    <p className="text-[11px] text-neutral-400 font-medium leading-relaxed max-w-md mx-auto mt-2">
                      ⚠️ **{isParking ? "Estacionamento" : "Ingresso"} de uso único**. Este QR code já foi validado na portaria anteriormente.
                    </p>
                  </div>
                </div>
              ) : isMinor && !ticket.autorizacaoEntregue ? (
                // 3C. Ingresso válido mas portador é menor e exige autorização física
                <div className="flat-card border-2 border-amber-500 bg-amber-950/10 p-6 rounded flex flex-col md:flex-row gap-4 items-center justify-between shadow-[0_0_25px_rgba(245,158,11,0.1)]">
                  <div className="flex gap-3.5 items-start text-left">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded flex-shrink-0">
                      <ShieldAlert size={20} className="animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display font-black text-xs tracking-widest text-amber-500 uppercase">
                        EXIGE AUTORIZAÇÃO DE MENOR (ABAIXO DE 16 ANOS)
                      </h3>
                      <p className="text-xs text-neutral-300 font-medium leading-relaxed">
                        O portador tem <strong className="text-white font-bold">{age} anos</strong>. De acordo com as diretrizes da <strong>GHVE Eventos</strong>, menores de 16 anos necessitam apresentar o termo de autorização assinado pelo responsável na portaria.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // 3D. Ingresso aprovado, não utilizado, portador maior de idade ou com autorização entregue
                <div className="flat-card border border-emerald-500/30 bg-emerald-950/5 p-5 rounded flex gap-3.5 items-center text-left">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex-shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-xs tracking-wider text-emerald-400 uppercase">
                      {isParking ? "VAGA VÁLIDA E LIBERADA PARA ESTACIONAR" : "INGRESSO VÁLIDO E LIBERADO PARA ENTRADA"}
                    </h3>
                    <p className="text-[11px] text-neutral-400 leading-normal font-medium">
                      O bilhete está aprovado, com status livre e o portador ({age !== null ? `${age} anos` : "Maior de Idade"}) atende a todas as diretrizes.
                    </p>
                  </div>
                </div>
              )}

              {/* Informações Completas do Ingresso */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Cartão de Dados do Comprador */}
                <div className="flat-card p-6 rounded border border-neutral-800 space-y-4 md:col-span-2">
                  <h3 className="font-display font-black text-xs tracking-widest uppercase text-white border-b border-neutral-900 pb-3">
                    Identificação do Portador
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold uppercase tracking-wider">
                    <div>
                      <p className="text-[9px] text-neutral-500 font-black">NOME COMPLETO</p>
                      <p className="text-white mt-1 select-all">{ticket.nomeComprador}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-500 font-black">CPF</p>
                      <p className="text-white mt-1 select-all">{ticket.cpfComprador}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-500 font-black">IDADE CALCULADA</p>
                      <p className={`${isMinor ? "text-amber-500" : "text-emerald-400"} mt-1`}>
                        {age !== null ? `${age} anos ${isMinor ? "(Menor de 16)" : "(Permitido)"}` : "Não identificada"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-500 font-black">ID DO INGRESSO</p>
                      <p className="text-primary mt-1 select-all">#{ticket.id.toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                {/* Detalhes do Lote */}
                <div className="flat-card p-6 rounded border border-neutral-800 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="font-display font-black text-xs tracking-widest uppercase text-white border-b border-neutral-900 pb-3">
                      Lote & Setor
                    </h3>
                    <div>
                      <p className="text-[9px] text-neutral-500 font-black uppercase">CATEGORIA</p>
                      <p className="text-white font-black text-xs uppercase tracking-wide mt-1 leading-snug">
                        {isParking ? "VAGA CARRO (1 VEÍCULO)" : ticket.lote}
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-neutral-900 mt-4">
                    <p className="text-[9px] text-neutral-500 font-black uppercase">VALOR</p>
                    <p className="text-xl font-black text-primary mt-0.5">
                      R$ {isParking ? "25.00" : ticket.valor.toFixed(2)}
                    </p>
                  </div>
                </div>

              </div>

              {/* Botões de Ação na Portaria */}
              {ticket.status === "aprovado" && (!(isParking ? ticket.parkingUsed : ticket.utilizado) || ticket.id === "0000") && (
                <div className="p-6 bg-neutral-950/60 border border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-6 rounded">
                  <div className="text-left">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">Lançar Validação</h4>
                    <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed uppercase tracking-wider font-bold">
                      Certifique-se de validar o documento oficial original com foto do portador antes de confirmar.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    {isMinor && !ticket.autorizacaoEntregue ? (
                      <>
                        <button
                          onClick={() => handleConfirmCheckIn(true)}
                          disabled={checkingIn}
                          className="w-full sm:w-auto px-6 py-4 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 rounded shadow-lg shadow-amber-950/20 border border-amber-400"
                        >
                          {checkingIn ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <FileText size={14} />
                          )}
                          Autorização Entregue & Liberar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConfirmCheckIn(false)}
                        disabled={checkingIn}
                        className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-hover text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 rounded shadow-lg shadow-yellow-950/20"
                      >
                        {checkingIn ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <UserCheck size={14} />
                        )}
                        Confirmar Entrada (Check-In)
                      </button>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          ) : null}

        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center">
        <Loader2 size={36} className="text-primary animate-spin mb-4" />
        <p className="text-xs font-black tracking-widest text-neutral-400 uppercase">
          Carregando Portaria...
        </p>
      </div>
    }>
      <CheckInContent />
    </Suspense>
  );
}
