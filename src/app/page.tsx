"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CountDown from "@/components/CountDown";
import { Ticket, ArrowRight, Zap, Volume2, AlertCircle, Loader2, Check } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface Lote {
  id: string;
  nome: string;
  valor: number;
  descricao: string;
  status: "esgotado" | "ativo" | "esgotado-em-breve" | "aguardando";
  badges: string[];
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ nome: string; cpf: string; telefone?: string } | null>(null);
  const [selectedLote, setSelectedLote] = useState<Lote | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [includeParking, setIncludeParking] = useState(false);
  const [lotes, setLotes] = useState<Lote[]>([
    {
      id: "lote-1",
      nome: "1º Lote - Individual",
      valor: 45.0,
      descricao: "Ingresso individual com acesso total ao evento.",
      status: "ativo",
      badges: ["Promocional", "Disponível"],
    },
    {
      id: "lote-2",
      nome: "2º Lote - Individual",
      valor: 55.0,
      descricao: "Ingresso individual com acesso total ao evento.",
      status: "aguardando",
      badges: ["Aguardando"],
    }
  ]);

  const [parkingPrice, setParkingPrice] = useState(25.0);

  useEffect(() => {
    fetch("/api/lotes")
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          const fetchedLotes = data.lotes || data; // Falback to data directly if needed
          if (data.parkingPrice) setParkingPrice(data.parkingPrice);

          const parkingLote = {
            id: "estacionamento",
            nome: "Estacionamento (1 Vaga)",
            valor: data.parkingPrice || 25.0,
            descricao: "Vaga de estacionamento válida para 1 carro durante o evento.",
            status: "ativo",
            badges: ["Estacionamento"],
          };
          
          setLotes([...fetchedLotes, parkingLote as any]);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          let userDoc = null;
          if (currentUser.email) {
            userDoc = await getDoc(doc(db, "usuarios", currentUser.email.toLowerCase()));
          }
          if (!userDoc || !userDoc.exists()) {
            userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
          }

          // Se falhar no cache local, buscar direto no servidor para contornar lag de novo cadastro
          if (!userDoc || !userDoc.exists()) {
            try {
              if (currentUser.email) {
                userDoc = await getDocFromServer(doc(db, "usuarios", currentUser.email.toLowerCase()));
              }
            } catch (err) {
              console.warn("Erro ao buscar email do servidor no Home:", err);
            }
            if (!userDoc || !userDoc.exists()) {
              try {
                userDoc = await getDocFromServer(doc(db, "usuarios", currentUser.uid));
              } catch (err) {
                console.warn("Erro ao buscar uid do servidor no Home:", err);
              }
            }
          }

          if (userDoc && userDoc.exists()) {
            setUserData({
              nome: userDoc.data().nome,
              cpf: userDoc.data().cpf,
              telefone: userDoc.data().telefone,
            });
          } else {
            // Tentar do localStorage
            const cached = localStorage.getItem(`user_profile_${currentUser.uid}`) ||
              (currentUser.email ? localStorage.getItem(`user_profile_${currentUser.email.toLowerCase()}`) : null);
            if (cached) {
              const cachedData = JSON.parse(cached);
              setUserData({
                nome: cachedData.nome,
                cpf: cachedData.cpf,
                telefone: cachedData.telefone,
              });
            }
          }
        } catch (error) {
          console.error("Erro ao buscar dados do usuário:", error);
        }
      } else {
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && userData && !isModalOpen) {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const isCheckout = params.get("checkout") === "true";
        const loteId = params.get("lote");
        
        if (isCheckout && loteId) {
          const loteEncontrado = lotes.find(l => l.id === loteId);
          if (loteEncontrado && loteEncontrado.status !== "esgotado" && loteEncontrado.status !== "aguardando") {
            setSelectedLote(loteEncontrado);
            setIsModalOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      }
    }
  }, [user, userData, isModalOpen, lotes]);

  const handleComprarClick = (lote: Lote) => {
    if (lote.status === "esgotado" || lote.status === "aguardando") return;

    setSelectedLote(lote);

    if (!user) {
      router.push(`/login?redirect=/?checkout=true&lote=${lote.id}`);
      return;
    }

    setIsModalOpen(true);
  };

  const handleConfirmarCompra = async () => {
    if (!selectedLote || !user || !userData) return;

    setLoadingCheckout(true);
    const toastId = toast.loading("Gerando link de pagamento...");

    try {
      // Obter o Token de ID da sessão atual
      const idToken = await user.getIdToken();

      const isParkingOnly = selectedLote.id === "estacionamento";

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          loteId: selectedLote.id,
          includeParking: false,
          isParkingOnly: isParkingOnly,
          userId: user.uid,
          userNome: userData.nome,
          userCpf: userData.cpf,
          userEmail: user.email,
          userTelefone: userData.telefone,
        }),
      });

      const data = await response.json();

      if (data.init_point) {
        toast.success("Redirecionando para o pagamento...", { id: toastId });
        window.location.href = data.init_point;
      } else {
        toast.error("Erro ao gerar link de pagamento. Tente novamente.", { id: toastId });
        setLoadingCheckout(false);
      }
    } catch (error) {
      console.error("Erro no checkout:", error);
      toast.error("Houve uma falha na conexão. Tente novamente.", { id: toastId });
      setLoadingCheckout(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pt-20">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden py-20 px-4">
        {/* Ambient Dark Premium Background with Glow & Subtle Tech Grid */}
        <div className="absolute inset-0 z-0 bg-black">
          {/* Central subtle dark yellow radial ambient glow to give depth */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#F5F500]/5 blur-[120px] pointer-events-none"></div>

          {/* Subtle grid pattern to feel high-tech & premium */}
          <div
            className="absolute inset-0 opacity-[0.03] select-none pointer-events-none bg-repeat"
            style={{
              backgroundImage: `radial-gradient(circle, #F5F500 1px, transparent 1px)`,
              backgroundSize: "24px 24px"
            }}
          ></div>

          {/* Gradients to blend with the rest of the dark site */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/90"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black"></div>
        </div>

        {/* Left Floating Logo with loop animation */}
        <motion.div
          className="absolute left-[-150px] md:left-[-100px] top-[15%] w-[350px] h-[350px] md:w-[550px] md:h-[550px] z-0 select-none opacity-[0.05] pointer-events-none filter blur-[1px] md:blur-none"
          animate={{
            y: [0, -25, 0],
            rotate: [-8, 4, -8],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Image
            src="/logo_sintonia.png"
            alt="Sintonia 360 Left Floating Logo"
            fill
            sizes="(max-width: 768px) 350px, 550px"
            className="object-contain"
          />
        </motion.div>

        {/* Right Floating Logo with loop animation */}
        <motion.div
          className="absolute right-[-150px] md:right-[-100px] top-[30%] w-[350px] h-[350px] md:w-[550px] md:h-[550px] z-0 select-none opacity-[0.05] pointer-events-none filter blur-[1px] md:blur-none"
          animate={{
            y: [0, 25, 0],
            rotate: [8, -4, 8],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Image
            src="/logo_sintonia.png"
            alt="Sintonia 360 Right Floating Logo"
            fill
            sizes="(max-width: 768px) 350px, 550px"
            className="object-contain"
          />
        </motion.div>

        {/* Conteúdo do Hero - Limpo e com alto contraste */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center gap-10"
        >

          {/* Sintonia 360 Logo Oficial (Img 1) e GHVE Logo (Img 2) */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-80 h-32 sm:w-96 sm:h-40">
              <Image
                src="/logo_sintonia.png"
                alt="Sintonia 360 X GHVE Eventos"
                fill
                priority
                sizes="(max-width: 768px) 320px, 384px"
                className="object-contain"
              />
            </div>
            <div className="flex items-center gap-2 mt-2 opacity-80">
              <span className="text-[10px] uppercase tracking-[0.3em] font-black text-neutral-400">PRODUZIDO POR</span>
              <div className="relative w-14 h-6">
                <Image
                  src="/logo_ghve.jpg"
                  alt="GHVE Logo"
                  fill
                  sizes="56px"
                  className="object-contain mix-blend-screen"
                />
              </div>
            </div>
          </div>

          <p className="max-w-2xl text-xs sm:text-sm text-neutral-400 font-bold uppercase tracking-wider leading-relaxed px-4">
            A maior experiência sonora e visual da produtora GHVE Eventos está confirmada. Sistema surround em arena 360 e line-up com os maiores nomes da cena eletrônica.
          </p>

          {/* Contador Simples, bem-acabado */}
          <div className="w-full max-w-lg flat-card p-6 rounded border border-neutral-800 bg-black/60 shadow-xl">
            <p className="text-[9px] font-black text-neutral-500 tracking-widest uppercase mb-4 text-center">
              TEMPO RESTANTE PARA A FESTA:
            </p>
            {/* TargetDate alterada para 10 de Outubro de 2026 às 21h */}
            <CountDown targetDate="2026-10-10T21:00:00" />
          </div>

          {/* Ações Simples e Diretas */}
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center px-4 max-w-md">
            <a
              href="#lotes"
              className="flex items-center justify-center gap-2 w-full px-8 py-3.5 bg-primary hover:bg-primary-hover text-black font-black uppercase text-xs tracking-widest transition-all duration-200 shadow-md cursor-pointer"
            >
              Comprar Ingresso
              <ArrowRight size={14} />
            </a>
            <Link
              href="/sorteios"
              className="flex items-center justify-center w-full px-8 py-3.5 bg-transparent border border-neutral-800 hover:border-neutral-700 text-white font-black uppercase text-xs tracking-widest transition-all duration-200"
            >
              Ver Sorteios
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Diferenciais Simples e Sólidos */}
      <section className="py-20 bg-bg-dark border-t border-neutral-900 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="font-display font-black text-2xl tracking-widest uppercase text-white">
              DIFERENCIAIS DO <span className="text-primary">EVENTO</span>
            </h2>
            <div className="w-16 h-1 bg-primary mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -4, borderColor: "rgba(245, 245, 0, 0.4)" }}
              className="flat-card p-8 rounded border border-neutral-800 transition-all duration-200"
            >
              <div className="p-3 bg-neutral-900 border border-neutral-800 text-primary w-fit mb-5">
                <Volume2 size={20} />
              </div>
              <h3 className="font-display font-black text-base uppercase tracking-wider text-white mb-2">Som Automotivo</h3>
              <p className="text-neutral-400 text-xs leading-relaxed font-medium">
                Experiência sonora impactante com um paredão formado por 8 carros exclusivos, garantindo potência e qualidade para uma imersão musical extrema.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -4, borderColor: "rgba(245, 245, 0, 0.4)" }}
              className="flat-card p-8 rounded border border-neutral-800 transition-all duration-200"
            >
              <div className="p-3 bg-neutral-900 border border-neutral-800 text-primary w-fit mb-5">
                <Zap size={20} />
              </div>
              <h3 className="font-display font-black text-base uppercase tracking-wider text-white mb-2">Estrutura Completa</h3>
              <p className="text-neutral-400 text-xs leading-relaxed font-medium">
                Arquitetura inovadora com palco 360 graus para você curtir de qualquer ângulo, com iluminação de ponta, segurança reforçada e máxima comodidade.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -4, borderColor: "rgba(245, 245, 0, 0.4)" }}
              className="flat-card p-8 rounded border border-neutral-800 transition-all duration-200"
            >
              <div className="p-3 bg-neutral-900 border border-neutral-800 text-primary w-fit mb-5">
                <Ticket size={20} />
              </div>
              <h3 className="font-display font-black text-base uppercase tracking-wider text-white mb-2">Entrada Simplificada</h3>
              <p className="text-neutral-400 text-xs leading-relaxed font-medium">
                Ingresso nominal atrelado de forma segura ao seu CPF. Emissão imediata do bilhete digital no seu perfil com QR Code para leitura rápida na entrada da arena.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Lotes/Tickets Section */}
      <section id="lotes" className="py-20 bg-black border-t border-neutral-900 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <span className="text-[10px] tracking-widest font-black text-primary uppercase">COMPRA SEGURA</span>
            <h2 className="font-display font-black text-2xl tracking-widest uppercase text-white">
              LOTES DISPONÍVEIS
            </h2>
            <div className="w-16 h-1 bg-primary mx-auto mb-6"></div>
            
            <div className="inline-flex items-center gap-2 p-3 bg-red-950/20 border border-red-500/20 rounded text-red-500 text-xs font-black tracking-widest uppercase mt-4">
              <AlertCircle size={16} />
              <span>É extremamente proibido entrar com bebidas no local!</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
            {lotes.map((lote, index) => {
              const isEsgotado = lote.status === "esgotado";
              const isAguardando = lote.status === "aguardando";
              const isDisabled = isEsgotado || isAguardando;
              return (
                <motion.div
                  key={lote.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
                  whileHover={!isDisabled ? { y: -6, borderColor: "rgba(245, 245, 0, 0.5)", boxShadow: "0 12px 30px -10px rgba(245, 245, 0, 0.15)" } : {}}
                  className={`flat-card p-8 rounded border flex flex-col justify-between transition-all duration-200 ${isDisabled
                      ? "opacity-50 border-neutral-900 bg-neutral-950/45"
                      : "border-neutral-800 shadow-lg"
                    }`}
                >
                  <div className="flex flex-wrap gap-2 mb-6">
                    {lote.badges.map((badge) => (
                      <span
                        key={badge}
                        className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 border ${badge === "Esgotado"
                            ? "bg-red-950/20 border-red-500/20 text-red-500"
                            : badge === "Aguardando"
                              ? "bg-neutral-900/10 border-neutral-800 text-neutral-500"
                              : badge === "Mais Procurado"
                                ? "bg-primary/5 border-primary/20 text-primary"
                                : "bg-neutral-900 border-neutral-800 text-neutral-400"
                          }`}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div>
                    <h3 className="font-display font-black text-lg uppercase tracking-wider text-white mb-2">
                      {lote.nome}
                    </h3>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-6 font-medium">
                      {lote.descricao}
                    </p>
                  </div>

                  <div className="mt-auto">
                    <div className="mb-6 flex items-baseline gap-1">
                      <span className="text-[10px] text-neutral-500 font-bold uppercase">R$</span>
                      <span className={`font-display font-black tracking-tighter ${isEsgotado
                          ? "text-3xl text-neutral-600 line-through"
                          : isAguardando
                            ? "text-4xl text-neutral-500"
                            : "text-4xl text-primary"
                        }`}>
                        {lote.valor.toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleComprarClick(lote)}
                      disabled={isDisabled}
                      className={`w-full py-3.5 px-6 font-black text-center text-xs uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2 ${isDisabled
                          ? "bg-neutral-900 border border-neutral-800 text-neutral-500 cursor-not-allowed"
                          : "bg-primary text-black hover:bg-primary-hover cursor-pointer"
                        }`}
                    >
                      {isEsgotado ? "Lote Esgotado" : isAguardando ? "Aguardando Abertura" : "Comprar Ingresso"}
                      {!isDisabled && <ArrowRight size={14} />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Modal de Confirmação de Compra */}
      {isModalOpen && selectedLote && user && userData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
          <div className="w-full max-w-lg flat-card rounded border border-neutral-800 p-6 sm:p-8 bg-black shadow-2xl relative">
            <h3 className="font-display font-black text-lg uppercase tracking-wider text-white mb-4">
              Confirmar Reserva
            </h3>

            <div className="space-y-4 mb-6 py-4 border-y border-neutral-800 text-xs font-bold uppercase tracking-wider">
              <div className="flex justify-between">
                <span className="text-neutral-500">Evento:</span>
                <span className="text-white">Sintonia 360 X GHVE Eventos</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Setor / Lote:</span>
                <span className="text-primary">{selectedLote.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Portador:</span>
                <span className="text-white">{userData.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Documento:</span>
                <span className="text-neutral-300">{userData.cpf}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2">
                <span className="text-neutral-500">Valor Total:</span>
                <span className="text-xl font-black text-primary">R$ {(selectedLote.valor).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-4 rounded bg-red-950/20 border border-red-500/20 text-red-500 text-[10px] leading-normal uppercase tracking-wider mb-4">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <p>Aviso: É extremamente proibido entrar com bebidas no local do evento.</p>
            </div>

            <div className="flex items-start gap-2.5 p-4 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] leading-normal uppercase tracking-wider mb-6">
              <AlertCircle size={16} className="text-primary flex-shrink-0" />
              <p>
                Ao avançar, você será redirecionado para concluir o pagamento de forma segura via Pix ou Cartão na **InfinitePay**.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={loadingCheckout}
                className="flex-1 py-3 border border-neutral-800 hover:border-neutral-700 font-black text-xs uppercase tracking-widest text-center transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmarCompra}
                disabled={loadingCheckout}
                className="flex-1 py-3 bg-primary hover:bg-primary-hover text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
              >
                {loadingCheckout ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    Concluir Compra
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
