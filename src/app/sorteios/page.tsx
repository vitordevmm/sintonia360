"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, getDocs, updateDoc, doc, arrayUnion, onSnapshot } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Sparkles, Gift, CheckCircle, Ticket, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface Sorteio {
  id: string;
  titulo: string;
  descricao: string;
  status: "ativo" | "sorteado";
  participantes: string[];
  ganhadorUid: string | null;
  ganhadorNome: string | null;
}

export default function SorteiosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // Escuta em tempo real a coleção de sorteios do Firestore
    const q = query(collection(db, "sorteios"));
    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const fetchedSorteios: Sorteio[] = [];
      snapshot.forEach((doc) => {
        fetchedSorteios.push({
          id: doc.id,
          ...doc.data(),
        } as Sorteio);
      });
      setSorteios(fetchedSorteios);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao escutar sorteios:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, []);

  const handleParticipar = async (sorteioId: string) => {
    if (!user) return;
    setActionLoading(sorteioId);

    try {
      const docRef = doc(db, "sorteios", sorteioId);
      await updateDoc(docRef, {
        participantes: arrayUnion(user.uid),
      });
      
      // Lança efeito confetti leve para celebrar a inscrição do usuário
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ["#F5F500", "#FFFFFF", "#000000"],
      });

    } catch (error) {
      console.error("Erro ao participar do sorteio:", error);
      toast.error("Houve uma falha ao registrar sua participação. Tente novamente.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center">
        <Loader2 size={36} className="text-primary animate-spin mb-4" />
        <p className="text-sm font-black tracking-widest text-neutral-400 uppercase">
          Carregando Sorteios...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16 space-y-4"
        >
          <span className="text-[10px] tracking-[0.25em] font-black text-primary uppercase">
            PROMOÇÕES GHVE CLUB
          </span>
          <h1 className="font-display font-black text-3xl sm:text-5xl uppercase tracking-tight text-white leading-none">
            SORTEIOS <span className="text-primary">ATIVOS</span>
          </h1>
          <div className="w-16 h-1 bg-primary mx-auto"></div>
          <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto">
            Participação exclusiva para clientes cadastrados. Adquira seu ingresso ou registre-se na plataforma para participar!
          </p>
        </motion.div>

        {/* Listagem de Sorteios */}
        {sorteios.length === 0 ? (
          <div className="flat-card rounded p-12 text-center border border-neutral-800 space-y-6">
            <div className="w-16 h-16 rounded border border-dashed border-neutral-800 flex items-center justify-center mx-auto text-neutral-600 bg-neutral-950">
              <Gift size={32} />
            </div>
            <div className="space-y-2">
              <p className="text-base font-bold text-white">Nenhum sorteio no momento</p>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                A GHVE Eventos realiza sorteios frequentes de ingressos e consumação. Fique atento às nossas redes sociais para saber quando o próximo for lançado!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {sorteios.map((sorteio, index) => {
              const isParticipando = user ? sorteio.participantes.includes(user.uid) : false;
              const isSorteado = sorteio.status === "sorteado";

              return (
                <motion.div
                  key={sorteio.id}
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
                  whileHover={{ y: -5, borderColor: isSorteado ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 245, 0, 0.4)", boxShadow: isSorteado ? "0 10px 30px -10px rgba(16, 185, 129, 0.08)" : "0 10px 30px -10px rgba(245, 245, 0, 0.12)" }}
                  className={`flat-card p-6 sm:p-8 rounded border flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                    isSorteado
                      ? "border-emerald-500/20 bg-emerald-950/5"
                      : "border-neutral-800"
                  }`}
                >
                  {/* Selo superior direito */}
                  <div className="absolute top-6 right-6">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded border ${
                        isSorteado
                          ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                          : "bg-primary/5 border-primary/20 text-primary"
                      }`}
                    >
                      {isSorteado ? "Finalizado" : "Ativo"}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display font-black text-xl uppercase text-white leading-tight mb-2 pr-16">
                      {sorteio.titulo}
                    </h3>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                      {sorteio.descricao}
                    </p>
                  </div>

                  {/* Informações dos Participantes ou Ganhador */}
                  <div className="py-4 border-t border-neutral-900 my-4 flex items-center justify-between">
                    {isSorteado ? (
                      <div className="w-full">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase">🎉 Vencedor(a)</p>
                        <p className="text-base font-black text-emerald-400 uppercase tracking-tight flex items-center gap-1.5 mt-0.5 animate-pulse">
                          {sorteio.ganhadorNome}
                        </p>
                        <p className="text-[9px] text-neutral-500 mt-1">
                          Sorteio auditado via banco de dados Firestore.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase">Participantes</p>
                          <p className="text-xl font-black text-white tracking-tighter mt-0.5">
                            {sorteio.participantes.length}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-neutral-500 font-bold uppercase">Requisito</p>
                          <p className="text-xs font-bold text-neutral-300 mt-0.5">Estar Cadastrado</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* CTAs de Ação */}
                  {!isSorteado && (
                    <div className="mt-4">
                      {user ? (
                        isParticipando ? (
                          <div className="w-full py-3.5 px-6 rounded border border-emerald-500/20 bg-emerald-950/20 text-emerald-400 font-black text-center text-xs sm:text-sm flex items-center justify-center gap-2 cursor-default">
                            <CheckCircle size={16} />
                            Participando do Sorteio
                          </div>
                        ) : (
                          <button
                            onClick={() => handleParticipar(sorteio.id)}
                            disabled={actionLoading === sorteio.id}
                            className="w-full py-3.5 px-6 rounded bg-primary hover:bg-primary-hover text-black font-black text-center text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all duration-200"
                          >
                            {actionLoading === sorteio.id ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                Processando...
                              </>
                            ) : (
                              <>
                                Quero Participar
                                <Sparkles size={16} />
                              </>
                            )}
                          </button>
                        )
                      ) : (
                        <Link
                          href={`/login?redirect=/sorteios`}
                          className="w-full py-3.5 px-6 rounded bg-neutral-900 border border-neutral-800 hover:border-primary/30 text-white font-bold text-center text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200"
                        >
                          Entrar para Participar
                          <Ticket size={16} className="text-neutral-500" />
                        </Link>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
