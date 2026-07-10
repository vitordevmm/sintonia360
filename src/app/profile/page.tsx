"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, getDocFromServer, collection, query, where, getDocs, orderBy, updateDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TicketCard from "@/components/TicketCard";
import { User as UserIcon, Mail, Phone, FileText, Calendar, LogOut, ShieldAlert, Sparkles, Loader2, Check, X, Edit2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getBirthDateFromCPF } from "@/lib/utils";

interface UserProfile {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  dataNascimento?: string;
  role: string;
}

interface TicketData {
  id: string;
  nomeComprador: string;
  cpfComprador: string;
  lote: string;
  valor: number;
  status: "pendente" | "aprovado" | "cancelado";
  qrCodeData: string;
  parkingQrCodeData?: string;
  includeParking?: boolean;
  createdAt: any;
}

const formatCPF = (val: string) => {
  return val
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatPhone = (val: string) => {
  if (val.length === 11) {
    return val.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  return val.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<TicketData[]>([]);

  // Edição de Telefone
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  const calculateAge = (birthDateString?: string): number => {
    if (!birthDateString) return 0;
    
    let formattedDate = birthDateString;
    if (birthDateString.includes("/")) {
      const parts = birthDateString.split("/");
      if (parts.length === 3) {
        formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    const birthDate = new Date(formattedDate + "T00:00:00");
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const renderBirthDate = (dateStr?: string) => {
    if (!dateStr) return "---";
    if (dateStr.includes("/")) return dateStr;
    try {
      const d = new Date(dateStr + "T00:00:00");
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  useEffect(() => {
    // Sincronização via URL de redirecionamento (Fallback se webhook atrasar/falhar)
    const checkSync = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const orderNsu = urlParams.get("order_nsu");
        const transactionNsu = urlParams.get("transaction_nsu");
        
        if (orderNsu) {
          await fetch("/api/checkout/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_nsu: orderNsu, transaction_nsu: transactionNsu })
          });
          // Remove os parâmetros da URL sem recarregar a página para evitar loop
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (err) {
        console.error("Erro na sincronização de fallback:", err);
      }
    };
    checkSync();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login?redirect=/profile");
        return;
      }
      
      setUser(currentUser);

      try {
        let profileData: UserProfile | null = null;
        let userDoc = null;
        
        // 1. Tentar ler do local (cache) para carregamento instantâneo
        if (currentUser.email) {
          userDoc = await getDoc(doc(db, "usuarios", currentUser.email.toLowerCase()));
        }
        if (!userDoc || !userDoc.exists()) {
          userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        }

        // 2. Se falhar, tentar buscar diretamente do servidor para evitar problemas de cache lag de novos cadastros
        if (!userDoc || !userDoc.exists()) {
          try {
            if (currentUser.email) {
              userDoc = await getDocFromServer(doc(db, "usuarios", currentUser.email.toLowerCase()));
            }
          } catch (serverErr) {
            console.warn("Erro ao buscar email do servidor:", serverErr);
          }
          if (!userDoc || !userDoc.exists()) {
            try {
              userDoc = await getDocFromServer(doc(db, "usuarios", currentUser.uid));
            } catch (serverErr) {
              console.warn("Erro ao buscar uid do servidor:", serverErr);
            }
          }
        }

        // 3. Extrair dados se encontrados
        if (userDoc && userDoc.exists()) {
          profileData = userDoc.data() as UserProfile;
        } else {
          // 4. Fallback final: Tentar obter do localStorage (especialmente pós-cadastro imediato)
          const cached = localStorage.getItem(`user_profile_${currentUser.uid}`) || 
                         (currentUser.email ? localStorage.getItem(`user_profile_${currentUser.email.toLowerCase()}`) : null);
          if (cached) {
            profileData = JSON.parse(cached);
          }
        }

        const isAdminEmail = 
          currentUser.email?.toLowerCase() === "vitorhugonascimentosique@gmail.com" ||
          currentUser.email?.toLowerCase() === "henriquetranssilva@gmail.com";

        if (isAdminEmail) {
          if (profileData) {
            profileData = { ...profileData, role: "admin" };
          } else {
            const isVitor = currentUser.email?.toLowerCase() === "vitorhugonascimentosique@gmail.com";
            profileData = {
              nome: isVitor ? "Vitor Hugo" : "Henrique Silva",
              cpf: isVitor ? "15077370680" : "00000000000",
              email: currentUser.email.toLowerCase(),
              telefone: isVitor ? "34999270907" : "34999999999",
              role: "admin"
            };
          }
        }

        if (profileData && !profileData.dataNascimento) {
          profileData.dataNascimento = getBirthDateFromCPF(profileData.cpf);
        }

        setProfile(profileData);

        const ticketsQuery = query(
          collection(db, "ingressos"),
          where("uid", "==", currentUser.uid),
          orderBy("createdAt", "desc")
        );
        let fetchedTickets: TicketData[] = [];
        try {
          const querySnapshot = await getDocs(ticketsQuery);
          querySnapshot.forEach((doc) => {
            fetchedTickets.push({
              id: doc.id,
              ...doc.data(),
            } as TicketData);
          });
        } catch (err) {
          console.error("Erro ao buscar ingressos do Firestore:", err);
        }

        const isAdmin = 
          currentUser.email?.toLowerCase() === "vitorhugonascimentosique@gmail.com" ||
          currentUser.email?.toLowerCase() === "henriquetranssilva@gmail.com";

        // Lógica de filtragem: Mostrar apenas 1 ingresso (Aprovado tem prioridade. Se não, o Pendente mais recente).
        let finalTickets: TicketData[] = [];
        const hasAprovado = fetchedTickets.find(t => t.status === "aprovado" && t.id !== "0000");
        
        if (hasAprovado) {
          finalTickets.push(hasAprovado);
        } else {
          const mostRecentPendente = fetchedTickets.find(t => t.status === "pendente");
          if (mostRecentPendente) {
            finalTickets.push(mostRecentPendente);
          }
        }

        if (isAdmin) {
          const hasMockTicket = fetchedTickets.some(t => t.id === "0000");
          if (!hasMockTicket) {
            const isVitor = currentUser.email?.toLowerCase() === "vitorhugonascimentosique@gmail.com";
            finalTickets.unshift({
              id: "0000",
              nomeComprador: profileData?.nome || (isVitor ? "Vitor Hugo" : "Henrique Silva"),
              cpfComprador: profileData?.cpf ? formatCPF(profileData.cpf) : (isVitor ? "150.773.706-80" : "000.000.000-00"),
              lote: "1º Lote - Cortesia de Teste",
              valor: 0.00,
              status: "aprovado",
              qrCodeData: "SINTONIA360-TEST-TICKET-0000",
              createdAt: new Date()
            });
          } else {
            // Se já existia mock na query original (ex: criado no banco), garante que ele aparece
            const mockFromDb = fetchedTickets.find(t => t.id === "0000");
            if (mockFromDb && !finalTickets.some(t => t.id === "0000")) {
              finalTickets.unshift(mockFromDb);
            }
          }
        }

        setTickets(finalTickets);
      } catch (error) {
        console.error("Erro ao buscar dados do perfil:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSavePhone = async () => {
    if (!profile || !user) return;
    const rawPhone = newPhone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      toast.error("Telefone inválido.");
      return;
    }
    
    setSavingPhone(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/profile/update-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, telefone: rawPhone })
      });
      
      if (!res.ok) throw new Error("Falha ao salvar o telefone");
      
      setProfile({ ...profile, telefone: rawPhone });
      setIsEditingPhone(false);
      toast.success("Telefone atualizado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar telefone.");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center">
        <Loader2 size={36} className="text-primary animate-spin mb-4" />
        <p className="text-xs font-black tracking-widest text-neutral-400 uppercase">
          Carregando perfil...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Header de Boas Vindas */}
        <motion.div 
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
        >
          <div>
            <span className="text-[10px] tracking-widest font-black text-primary uppercase">
              PAINEL DO CLIENTE
            </span>
            <h1 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight mt-1 text-white">
              Olá, <span className="text-primary">{profile?.nome.split(" ")[0]}</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-2 uppercase tracking-wide">
              Gerencie seus ingressos, histórico e participe de sorteios ativos.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-3 border border-neutral-800 text-neutral-400 hover:text-red-500 hover:border-red-500/20 transition-all font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              <LogOut size={14} />
              Sair da Conta
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Informações Cadastrais (Lado Esquerdo) */}
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="flat-card p-6 sm:p-8 rounded border border-neutral-800 space-y-6 lg:sticky lg:top-28"
          >
            <h2 className="font-display font-black text-sm tracking-widest uppercase text-white border-b border-neutral-900 pb-4">
              Dados Cadastrais
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-xs">
                <div className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-500 mt-0.5">
                  <UserIcon size={14} />
                </div>
                <div>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">Nome Completo</p>
                  <p className="font-bold text-white mt-0.5">{profile?.nome}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <div className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-500 mt-0.5">
                  <FileText size={14} />
                </div>
                <div>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">CPF</p>
                  <p className="font-bold text-white mt-0.5">
                    {profile ? formatCPF(profile.cpf) : "---"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <div className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-500 mt-0.5">
                  <Mail size={14} />
                </div>
                <div>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">E-mail</p>
                  <p className="font-bold text-white mt-0.5 select-all">{profile?.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <div className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-500 mt-0.5">
                  <Phone size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">WhatsApp</p>
                  
                  {isEditingPhone ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        maxLength={15}
                        placeholder="(00) 00000-0000"
                        value={newPhone}
                        onChange={(e) => setNewPhone(formatPhone(e.target.value))}
                        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-white text-xs w-full max-w-[150px] outline-none focus:border-primary"
                        autoFocus
                      />
                      <button 
                        onClick={handleSavePhone} 
                        disabled={savingPhone}
                        className="p-1 bg-green-500/20 text-green-500 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        {savingPhone ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </button>
                      <button 
                        onClick={() => setIsEditingPhone(false)}
                        disabled={savingPhone}
                        className="p-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      {profile?.telefone ? (
                        <p className="font-bold text-white">{formatPhone(profile.telefone)}</p>
                      ) : (
                        <>
                          <p className="font-bold text-neutral-500 italic">Não registrado</p>
                          <button
                            onClick={() => {
                              setNewPhone("");
                              setIsEditingPhone(true);
                            }}
                            className="flex items-center gap-1 text-[9px] font-black tracking-widest uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 hover:bg-primary/20 transition-colors"
                          >
                            <Edit2 size={10} />
                            Adicionar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <div className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-500 mt-0.5">
                  <Calendar size={14} />
                </div>
                <div className="w-full">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">Data de Nascimento</p>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="font-bold text-white">
                      {renderBirthDate(profile?.dataNascimento)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-900/50 border border-neutral-900 flex items-center gap-3">
              <Sparkles size={16} className="text-primary flex-shrink-0" />
              <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider leading-relaxed">
                Você faz parte do GHVE Club. Fique por dentro de novidades exclusivas.
              </p>
            </div>

            {profile?.role === "admin" && (
              <Link
                href="/admin"
                className="flex items-center justify-center gap-2 w-full py-3.5 mt-2 border border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 text-red-500 transition-all font-bold text-xs uppercase tracking-wider rounded shadow-lg shadow-red-950/20 cursor-pointer"
              >
                <ShieldAlert size={14} />
                Painel ADM
              </Link>
            )}
          </motion.div>

          {/* Lista de Ingressos (Lado Direito) */}
          <motion.div 
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="lg:col-span-2 space-y-6"
          >
            {profile?.dataNascimento && calculateAge(profile.dataNascimento) < 16 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-amber-950/15 border border-amber-500/30 rounded flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-[0_0_15px_rgba(245,158,11,0.05)] backdrop-blur-sm"
              >
                <div className="flex gap-3.5 items-start">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded mt-0.5 md:mt-0 flex-shrink-0">
                    <ShieldAlert size={20} className="animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display font-black text-xs tracking-widest text-amber-500 uppercase">
                      Autorização Obrigatória para Menores
                    </h3>
                    <p className="text-xs text-neutral-300 font-medium leading-relaxed max-w-xl">
                      Você tem <strong className="text-white font-bold">{calculateAge(profile.dataNascimento)} anos</strong>. Por ser menor de 16 anos, de acordo com as diretrizes do evento, você **deve** gerar e apresentar a Autorização para Menores de 16 anos assinada por um responsável legal na entrada do festival.
                    </p>
                  </div>
                </div>
                <Link
                  href="/profile/autorizacao"
                  target="_blank"
                  className="w-full md:w-auto px-5 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-wider rounded transition-all duration-200 shadow-lg shadow-amber-950/20 flex items-center justify-center gap-2 flex-shrink-0 border border-amber-400"
                >
                  <FileText size={14} />
                  Gerar Autorização (PDF)
                </Link>
              </motion.div>
            )}

            <h2 className="font-display font-black text-lg tracking-wider uppercase text-white flex items-center gap-2">
              Meus Ingressos
              <span className="text-[10px] font-black px-2 py-0.5 bg-primary/10 text-primary border border-primary/20">
                {tickets.length}
              </span>
            </h2>

            {tickets.length === 0 ? (
              <div className="flat-card rounded p-12 text-center border border-neutral-800 space-y-6">
                <div className="w-14 h-14 border border-dashed border-neutral-800 flex items-center justify-center mx-auto text-neutral-600 bg-neutral-950">
                  <UserIcon size={24} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-white">Nenhum ingresso encontrado</p>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed font-medium">
                    Você ainda não adquiriu ingressos para a Sintonia 360 ou sua compra está pendente.
                  </p>
                </div>
                <Link
                  href="/#lotes"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-black font-black text-xs uppercase tracking-widest transition-all"
                >
                  Adquirir meu Ingresso
                  <Calendar size={14} />
                </Link>
              </div>
            ) : (
              <div className="space-y-8">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="space-y-8">
                    <TicketCard ticket={ticket} />
                    {ticket.includeParking && (
                      <TicketCard ticket={ticket} type="parking" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
