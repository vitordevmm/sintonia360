"use client";

import React, { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  ShieldCheck,
  TrendingUp,
  Ticket,
  Users,
  Gift,
  PlusCircle,
  Sparkles,
  Database,
  Loader2,
  Calendar,
  AlertTriangle,
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  UserPlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Car,
  Settings
} from "lucide-react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

interface Metrics {
  faturamento: number;
  totalVendas: number;
  totalUsuarios: number;
  totalEstacionamento: number;
  vendasPorLote: { [key: string]: number };
}

interface ConfiguracaoGlobal {
  totalTickets: number;
  parkingSpots: number;
  parkingPrice: number;
  lotes: {
    id: string;
    nome: string;
    valor: number;
    maxVendas: number | null;
    descricao?: string;
  }[];
  ageAuthorization?: {
    enabled: boolean;
    minAge: number;
  };
}

interface Sorteio {
  id: string;
  titulo: string;
  descricao: string;
  status: "ativo" | "sorteado";
  participantes: string[];
  ganhadorUid: string | null;
  ganhadorNome: string | null;
  imagemUrl?: string;
  dataInicio?: any;
  dataFim?: any;
}

interface Venda {
  id: string;
  nomeComprador: string;
  cpfComprador: string;
  lote: string;
  valor: number;
  status: "pendente" | "aprovado" | "cancelado" | "disponivel";
  createdAt: any;
  utilizado?: boolean;
  checkedInAt?: any;
  uid?: string;
  includeParking?: boolean;
  parkingUsed?: boolean;
  parkingCheckedInAt?: any;
  numeroIngresso?: number;
}

const TABS = [
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "vendas", label: "Vendas", icon: Calendar },
  { id: "ingressos", label: "Ingressos", icon: Ticket },
  { id: "estacionamento", label: "Estacionamento", icon: Car },
  { id: "sorteios", label: "Sorteios", icon: Gift },
  { id: "usuarios", label: "Usuários", icon: Users },
] as const;

type TabId = typeof TABS[number]["id"];

const ITEMS_PER_PAGE = 30;
// We'll use a dynamic value from appConfig instead of TOTAL_TICKETS
// const TOTAL_TICKETS = 1050;

const formatCPF = (cpf: string) => {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(false);

  // Active View Tab State
  const [activeTab, setActiveTab] = useState<TabId>("insights");

  // Dashboard Data
  const [metrics, setMetrics] = useState<Metrics>({
    faturamento: 0,
    totalVendas: 0,
    totalUsuarios: 0,
    totalEstacionamento: 0,
    vendasPorLote: {},
  });
  const [appConfig, setAppConfig] = useState<ConfiguracaoGlobal | null>(null);
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [usuariosList, setUsuariosList] = useState<any[]>([]);

  // Vendas Filter & Search States
  const [vendasFilter, setVendasFilter] = useState<"todos" | "aprovado" | "pendente" | "cancelado">("todos");
  const [vendasSearch, setVendasSearch] = useState("");
  const [vendasCurrentPage, setVendasCurrentPage] = useState(1);
  const [expandedVendasGroups, setExpandedVendasGroups] = useState<string[]>([]);

  const toggleVendasGroup = (key: string) => {
    setExpandedVendasGroups(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfiguracaoGlobal | null>(null);

  const openSettingsModal = () => {
    if (appConfig) {
      // Clona profundamente para edição
      const config = JSON.parse(JSON.stringify(appConfig));
      if (!config.ageAuthorization) {
        config.ageAuthorization = { enabled: false, minAge: 18 };
      }
      setEditingConfig(config);
    }
    setIsSettingsModalOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!editingConfig) return;
    setSettingsLoading(true);
    try {
      await setDoc(doc(db, "configuracoes", "geral"), editingConfig);
      showToast("Configurações atualizadas com sucesso!", "success");
      setIsSettingsModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      showToast("Falha ao salvar as configurações no Firestore.", "error");
    } finally {
      setSettingsLoading(false);
    }
  };

  // Ingressos Portaria Search, Filters, Assignment, Pagination States
  const [ingressosSearch, setIngressosSearch] = useState("");
  const [ingressosFilter, setIngressosFilter] = useState<"todos" | "com_dono" | "sem_dono" | "validados">("todos");
  const [currentPage, setCurrentPage] = useState(1);

  // Estacionamento Portaria States
  const [estacionamentoSearch, setEstacionamentoSearch] = useState("");
  const [estacionamentoFilter, setEstacionamentoFilter] = useState<"todos" | "com_dono" | "sem_dono" | "validados">("todos");
  const [estacionamentoCurrentPage, setEstacionamentoCurrentPage] = useState(1);

  // Usuários States
  const [usuariosSearch, setUsuariosSearch] = useState("");
  const [usuariosCurrentPage, setUsuariosCurrentPage] = useState(1);
  const [assignCpfInput, setAssignCpfInput] = useState<{ [key: string]: string }>({});
  const [assignLoading, setAssignLoading] = useState<{ [key: string]: boolean }>({});
  const [checkInLoading, setCheckInLoading] = useState<{ [key: string]: boolean }>({});
  const [revokeLoading, setRevokeLoading] = useState<{ [key: string]: boolean }>({});

  // Toast notifications state
  interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = (message: string, type: Toast["type"] = "info") => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Image presets for Sorteios
  const PRESET_IMAGES = [
    { label: "Balada VIP", url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80" },
    { label: "Frontstage", url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80" },
    { label: "Lounge Exclusivo", url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80" },
  ];

  // Sorteio Form State
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoImagemUrl, setNovoImagemUrl] = useState("");
  const [novoDataInicio, setNovoDataInicio] = useState("");
  const [novoDataFim, setNovoDataFim] = useState("");
  const [criarSorteioLoading, setCriarSorteioLoading] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login?redirect=/admin");
        return;
      }
      setUser(currentUser);

      try {
        let userDoc = null;
        if (currentUser.email) {
          userDoc = await getDoc(doc(db, "usuarios", currentUser.email.toLowerCase()));
        }
        if (!userDoc || !userDoc.exists()) {
          userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        }

        // Fallback admin reconhecimento
        if (
          currentUser.email?.toLowerCase() === "vitorhugonascimentosique@gmail.com" ||
          currentUser.email?.toLowerCase() === "henriquetranssilva@gmail.com" ||
          (userDoc && userDoc.exists() && userDoc.data().role === "admin")
        ) {
          setIsAdmin(true);
          setupRealtimeListeners();
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação de admin:", error);
        if (
          currentUser.email?.toLowerCase() === "vitorhugonascimentosique@gmail.com" ||
          currentUser.email?.toLowerCase() === "henriquetranssilva@gmail.com"
        ) {
          setIsAdmin(true);
          setupRealtimeListeners();
        } else {
          setLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // Escutas em tempo real das coleções
  const setupRealtimeListeners = () => {
    // 0. Ouvir Configurações Globais
    const unsubConfig = onSnapshot(
      doc(db, "configuracoes", "geral"),
      (docSnap) => {
        if (docSnap.exists()) {
          setAppConfig(docSnap.data() as ConfiguracaoGlobal);
        } else {
          // Valores padrão caso não exista
          setAppConfig({
            totalTickets: 1050,
            parkingSpots: 50,
            parkingPrice: 25.0,
            lotes: [
              { id: "lote-1", nome: "1º Lote - Individual", valor: 40.0, maxVendas: 150 },
              { id: "lote-2", nome: "2º Lote - Individual", valor: 45.0, maxVendas: null },
            ],
            ageAuthorization: {
              enabled: false,
              minAge: 18,
            }
          });
        }
      },
      (error) => console.error("Erro ao escutar configurações:", error)
    );

    // 1. Ouvir Ingressos
    const qVendas = query(collection(db, "ingressos"), orderBy("createdAt", "desc"));
    const unsubVendas = onSnapshot(
      qVendas,
      (snapshot) => {
        const fetchedVendas: Venda[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const ticket = {
            id: docSnap.id,
            ...data,
          } as Venda;

          let isExpired = false;
          if (ticket.status === "pendente" && ticket.createdAt) {
            let createdTime = 0;
            if (ticket.createdAt.toMillis) createdTime = ticket.createdAt.toMillis();
            else if (ticket.createdAt.seconds) createdTime = ticket.createdAt.seconds * 1000;
            else createdTime = new Date(ticket.createdAt).getTime();
            
            if (Date.now() - createdTime > 24 * 60 * 60 * 1000) {
              isExpired = true;
            }
          }

          if (isExpired && ticket.id !== "0000") {
             deleteDoc(doc(db, "ingressos", ticket.id)).catch(console.error);
          } else {
             fetchedVendas.push(ticket);
          }
        });
        setVendas(fetchedVendas);

        // Calcular Métricas baseadas em Vendas
        const approvedVendas = fetchedVendas.filter((v) => v.status === "aprovado");
        const faturamento = approvedVendas.reduce((sum, v) => sum + v.valor, 0);
        const totalVendas = approvedVendas.length;
        const totalEstacionamento = approvedVendas.filter(v => v.includeParking).length;

        const vendasPorLote: { [key: string]: number } = {};
        approvedVendas.forEach((v) => {
          vendasPorLote[v.lote] = (vendasPorLote[v.lote] || 0) + 1;
        });

        setMetrics((prev) => ({
          ...prev,
          faturamento,
          totalVendas,
          totalEstacionamento,
          vendasPorLote,
        }));
      },
      (error) => {
        console.error("Erro ao escutar ingressos (verifique firestore.rules):", error);
      }
    );

    // 2. Ouvir Sorteios
    const qSorteios = query(collection(db, "sorteios"));
    const unsubSorteios = onSnapshot(
      qSorteios,
      (snapshot) => {
        const fetchedSorteios: Sorteio[] = [];
        snapshot.forEach((doc) => {
          fetchedSorteios.push({
            id: doc.id,
            ...doc.data(),
          } as Sorteio);
        });
        setSorteios(fetchedSorteios);
      },
      (error) => {
        console.error("Erro ao escutar sorteios:", error);
      }
    );

    // 3. Ouvir Usuários para contagem
    const qUsuarios = query(collection(db, "usuarios"));
    const unsubUsuarios = onSnapshot(
      qUsuarios,
      (snapshot) => {
        const fetchedUsers: any[] = [];
        snapshot.forEach((doc) => {
          fetchedUsers.push({ id: doc.id, ...doc.data() });
        });
        setUsuariosList(fetchedUsers);
        setMetrics((prev) => ({
          ...prev,
          totalUsuarios: snapshot.size,
        }));
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao escutar usuários:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubConfig();
      unsubVendas();
      unsubSorteios();
      unsubUsuarios();
    };
  };

  const handlePromoverAdmin = async () => {
    if (!user) return;
    setRoleUpdating(true);
    try {
      let userRef = doc(db, "usuarios", user.email?.toLowerCase() || user.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        userRef = doc(db, "usuarios", user.uid);
      }
      await updateDoc(userRef, {
        role: "admin",
      });
      setIsAdmin(true);
      setupRealtimeListeners();
      showToast("Você foi promovido a Administrador!", "success");
    } catch (error) {
      console.error("Erro ao se promover a admin:", error);
      showToast("Erro ao atualizar permissão no Firestore. Garanta que as novas regras estejam publicadas.", "error");
    } finally {
      setRoleUpdating(false);
    }
  };

  const handleCriarSorteio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo || !novaDescricao) return;
    setCriarSorteioLoading(true);

    try {
      const id = `sorteio_${Date.now()}`;
      await setDoc(doc(db, "sorteios", id), {
        titulo: novoTitulo,
        descricao: novaDescricao,
        status: "ativo",
        participantes: [],
        ganhadorUid: null,
        ganhadorNome: null,
        imagemUrl: novoImagemUrl || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80",
        dataInicio: novoDataInicio ? new Date(novoDataInicio) : new Date(),
        dataFim: novoDataFim ? new Date(novoDataFim) : new Date(Date.now() + 86400000 * 7),
        createdAt: serverTimestamp(),
      });

      setNovoTitulo("");
      setNovaDescricao("");
      setNovoImagemUrl("");
      setNovoDataInicio("");
      setNovoDataFim("");
      showToast("Sorteio criado com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao criar sorteio:", error);
      showToast("Falha ao criar sorteio no Firestore.", "error");
    } finally {
      setCriarSorteioLoading(false);
    }
  };

  const handleSortearAgora = async (sorteio: Sorteio) => {
    if (sorteio.participantes.length === 0) {
      showToast("Este sorteio não possui participantes cadastrados.", "warning");
      return;
    }

    try {
      const randomIndex = Math.floor(Math.random() * sorteio.participantes.length);
      const ganhadorUid = sorteio.participantes[randomIndex];

      let userDoc = await getDoc(doc(db, "usuarios", ganhadorUid));
      if (!userDoc.exists()) {
        const q = query(collection(db, "usuarios"), where("uid", "==", ganhadorUid));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          userDoc = qSnap.docs[0];
        }
      }
      const ganhadorNome = userDoc.exists() ? userDoc.data().nome : "Usuário Desconhecido";

      await updateDoc(doc(db, "sorteios", sorteio.id), {
        status: "sorteado",
        ganhadorUid,
        ganhadorNome,
        dataSorteio: serverTimestamp(),
      });

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#F5F500", "#FFFFFF", "#000000"],
      });

      showToast(`👑 Sorteio realizado! Ganhador(a): ${ganhadorNome}`, "success");
    } catch (error) {
      console.error("Erro ao realizar sorteio:", error);
      showToast("Erro ao realizar o sorteio no Firestore.", "error");
    }
  };

  // Portaria Check-In Action
  const handleCheckInTicket = async (ticketId: string, isParking = false) => {
    // 1. O ingresso de teste #0000 é infinito, nunca fica Utilizado permanently!
    if (ticketId === "0000") {
      setCheckInLoading((prev) => ({ ...prev, [ticketId]: true }));
      setTimeout(() => {
        setCheckInLoading((prev) => ({ ...prev, [ticketId]: false }));
        confetti({
          particleCount: 80,
          spread: 80,
          colors: ["#F5F500", "#FFFFFF", "#00FF00"],
        });
        showToast("✅ Entrada Autorizada! [TESTE INFINITO]", "success");
      }, 600);
      return;
    }

    setCheckInLoading((prev) => ({ ...prev, [ticketId]: true }));
    try {
      await updateDoc(doc(db, "ingressos", ticketId), {
        ...(isParking ? {
          parkingUsed: true,
          parkingCheckedInAt: serverTimestamp(),
        } : {
          utilizado: true,
          checkedInAt: serverTimestamp(),
        })
      });
      confetti({
        particleCount: 50,
        spread: 60,
        colors: ["#F5F500", "#FFFFFF"],
      });
      showToast("✅ Entrada Validada com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao validar check-in do ingresso:", error);
      showToast("Falha ao registrar check-in no banco de dados.", "error");
    } finally {
      setCheckInLoading((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  // Portaria Dar Ingresso (Atribuir por CPF no Banco de Dados)
  const handleAssignTicket = async (ticketId: string) => {
    const rawCpf = assignCpfInput[ticketId];
    if (!rawCpf) {
      showToast("Por favor, digite um CPF válido.", "warning");
      return;
    }

    const cleanCpf = rawCpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      showToast("O CPF deve conter exatamente 11 dígitos numéricos.", "warning");
      return;
    }

    setAssignLoading((prev) => ({ ...prev, [ticketId]: true }));
    try {
      // Procurar usuário pelo CPF no Firestore
      const q = query(collection(db, "usuarios"), where("cpf", "==", cleanCpf));
      const qSnap = await getDocs(q);

      if (qSnap.empty) {
        showToast(`⚠️ Usuário com o CPF ${formatCPF(cleanCpf)} não cadastrado!`, "error");
        setAssignLoading((prev) => ({ ...prev, [ticketId]: false }));
        return;
      }

      const userDoc = qSnap.docs[0];
      const userData = userDoc.data();

      const isParkingSlot = ticketId.startsWith("vaga_");

      await setDoc(doc(db, "ingressos", ticketId), {
        id: ticketId,
        uid: userData.uid || userDoc.id,
        nomeComprador: userData.nome,
        cpfComprador: formatCPF(userData.cpf),
        lote: isParkingSlot ? "Estacionamento (Painel)" : "Atribuído Manualmente (Painel)",
        valor: isParkingSlot ? 25.00 : 55.00,
        status: "aprovado",
        utilizado: false,
        includeParking: isParkingSlot,
        createdAt: new Date()
      });

      // Limpar input local
      setAssignCpfInput((prev) => ({ ...prev, [ticketId]: "" }));
      confetti({
        particleCount: 30,
        spread: 50,
        colors: ["#F5F500", "#FFFFFF"],
      });
      showToast(`🎉 Ingresso atribuído com sucesso para: ${userData.nome}`, "success");
    } catch (error) {
      console.error("Erro ao atribuir ingresso:", error);
      showToast("Ocorreu um erro ao gravar a posse do ingresso.", "error");
    } finally {
      setAssignLoading((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  // Portaria Retirar Ingresso (Remover posse - volta a ficar disponível "Sem Dono")
  const handleRevokeTicket = async (ticketId: string, isParking = false) => {
    if (ticketId === "0000") {
      showToast("Não é possível retirar a posse do ingresso de teste #0000!", "warning");
      return;
    }

    if (!confirm(`Tem certeza que deseja retirar esta posse do comprador atual?`)) {
      return;
    }

    setRevokeLoading((prev) => ({ ...prev, [ticketId]: true }));
    try {
      if (isParking && !ticketId.startsWith("vaga_")) {
        // Se for um ingresso real que comprou estacionamento junto, a gente só remove o estacionamento.
        await updateDoc(doc(db, "ingressos", ticketId), {
          includeParking: false,
          parkingUsed: false
        });
        showToast("Estacionamento retirado deste ingresso!", "success");
      } else {
        await deleteDoc(doc(db, "ingressos", ticketId));
        showToast("Ingresso/Vaga liberado! Ficou 'Sem Dono' e disponível para vendas.", "success");
      }
    } catch (error) {
      console.error("Erro ao liberar posse:", error);
      showToast("Erro ao remover a posse do banco de dados.", "error");
    } finally {
      setRevokeLoading((prev) => ({ ...prev, [ticketId]: false }));
    }
  };


  // GERAÇÃO E ESTRUTURA DOS INGRESSOS OFICIAIS + INGRESSO #0000
  const buildTicketsGrid = () => {
    const list: Venda[] = [];
    const maxTickets = appConfig?.totalTickets || 1050;

    // Preencher do ingresso_0001 ao limite
    for (let i = 1; i <= maxTickets; i++) {
      const paddedId = String(i).padStart(4, "0");
      const docId = `ingresso_${paddedId}`;

      // Verificar se este ingresso já tem posse gravada no Firestore pelo numeroIngresso
      const dbTicket = vendas.find((v) => v.numeroIngresso === i || (!v.numeroIngresso && v.id === docId));

      if (dbTicket) {
        list.push(dbTicket);
      } else {
        // Ingresso sem dono (Disponível para venda)
        list.push({
          id: docId,
          nomeComprador: "",
          cpfComprador: "",
          lote: "Sem Dono (Disponível)",
          valor: 55.00,
          status: "disponivel",
          createdAt: null,
          utilizado: false,
        });
      }
    }

    // Inserir ingresso de teste #0000 especial no início para todos os administradores
    const hasMock = list.some((t) => t.id === "0000");
    if (!hasMock) {
      list.unshift({
        id: "0000",
        nomeComprador: "Vitor Hugo",
        cpfComprador: "150.773.706-80",
        lote: "Cortesia de Teste Infinito",
        valor: 0.00,
        status: "aprovado",
        utilizado: false, // Sempre disponível/infinito para portaria
        createdAt: new Date(),
      });
    }

    return list;
  };

  // GERAÇÃO E ESTRUTURA DAS VAGAS DE ESTACIONAMENTO
  const buildParkingGrid = () => {
    const list: any[] = [];
    const TOTAL_PARKING = appConfig?.parkingSpots || 50;
    
    // Pegar todas as vendas com estacionamento
    const parkingTickets = vendas.filter(v => v.includeParking);
    
    const explicitVagas = new Map();
    const floatingVagas: any[] = [];

    parkingTickets.forEach(pt => {
      if (pt.id.startsWith("vaga_")) {
        const num = parseInt(pt.id.replace("vaga_", ""), 10);
        explicitVagas.set(num, pt);
      } else {
        floatingVagas.push(pt);
      }
    });

    for (let i = 1; i <= TOTAL_PARKING; i++) {
      const paddedId = String(i).padStart(2, "0");
      const docId = `vaga_${paddedId}`;
      
      let dbTicket = explicitVagas.get(i);
      if (!dbTicket && floatingVagas.length > 0) {
        dbTicket = floatingVagas.shift();
      }

      if (dbTicket) {
        list.push({
           ...dbTicket,
           displayId: docId,
        });
      } else {
        list.push({
          id: docId,
          displayId: docId,
          nomeComprador: "",
          cpfComprador: "",
          lote: "Vaga Livre",
          valor: 25.00,
          status: "disponivel",
          createdAt: null,
          utilizado: false,
          includeParking: true
        });
      }
    }
    return list;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center">
        <Loader2 size={36} className="text-primary animate-spin mb-4" />
        <p className="text-sm font-black tracking-widest text-neutral-400 uppercase">
          Carregando Painel de Controle...
        </p>
      </div>
    );
  }

  // TELA DE PÁGINA NÃO AUTORIZADA / DEV PROMOTER
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col pt-20">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="w-full max-w-lg flat-card rounded p-6 sm:p-8 border border-neutral-800 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded border border-dashed border-red-500/30 bg-red-950/15 flex items-center justify-center mx-auto text-red-500">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="font-display font-black text-2xl uppercase tracking-tight text-white">
                Acesso Restrito
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed px-4">
                Você está logado com uma conta padrão. Para acessar gráficos financeiros, auditorias de portaria e sorteios, é necessário obter permissão de Administrador no Firestore.
              </p>
            </div>

            <div className="p-4 rounded bg-neutral-900 border border-neutral-800 space-y-4">
              <div className="flex gap-2.5 items-start text-left text-xs text-neutral-300">
                <UserCheck size={28} className="text-primary flex-shrink-0 mt-0.5" />
                <p>
                  <strong className="text-white block mb-0.5">Ativar Acesso Admin</strong>
                  Clique no botão abaixo para promover o seu e-mail cadastrado a Administrador no banco de dados Firestore.
                </p>
              </div>

              <button
                onClick={handlePromoverAdmin}
                disabled={roleUpdating}
                className="w-full py-3 px-5 rounded bg-primary hover:bg-primary-hover text-black font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                {roleUpdating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Atualizando Banco...
                  </>
                ) : (
                  <>
                    Tornar-me Administrador
                    <ShieldCheck size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Lógica de Filtro e Busca para Aba VENDAS
  const filteredVendas = vendas.filter((v) => {
    const term = vendasSearch.toLowerCase();
    const cleanCpf = (v.cpfComprador || "").replace(/\D/g, "");
    const cleanSearch = vendasSearch.replace(/\D/g, "");
    const matchesSearch =
      v.nomeComprador.toLowerCase().includes(term) ||
      v.id.toLowerCase().includes(term) ||
      (cleanCpf && cleanSearch && cleanCpf.includes(cleanSearch));
    const matchesFilter = vendasFilter === "todos" ? true : v.status === vendasFilter;
    return matchesSearch && matchesFilter;
  });

  // Agrupamento de Vendas por Comprador (CPF ou Nome)
  const groupedVendas: { key: string; mainVenda: Venda; subVendas: Venda[] }[] = [];
  filteredVendas.forEach((venda) => {
    const cleanCpf = (venda.cpfComprador || "").replace(/\D/g, "");
    const key = cleanCpf ? cleanCpf : venda.nomeComprador.toLowerCase();
    
    if (!key) {
      groupedVendas.push({ key: venda.id, mainVenda: venda, subVendas: [] });
      return;
    }

    const existingGroup = groupedVendas.find((g) => g.key === key);
    if (existingGroup) {
      existingGroup.subVendas.push(venda);
    } else {
      groupedVendas.push({ key, mainVenda: venda, subVendas: [] });
    }
  });

  // Paginação das Vendas
  const totalVendasGroups = groupedVendas.length;
  const totalVendasPages = Math.max(Math.ceil(totalVendasGroups / ITEMS_PER_PAGE), 1);
  const activeVendasPage = vendasCurrentPage > totalVendasPages ? 1 : vendasCurrentPage;
  
  const paginatedVendas = groupedVendas.slice(
    (activeVendasPage - 1) * ITEMS_PER_PAGE,
    activeVendasPage * ITEMS_PER_PAGE
  );

  // Lógica de Busca e Filtro para Aba INGRESSOS
  const allGeneratedTickets = buildTicketsGrid();

  const filteredIngressos = allGeneratedTickets.filter((t) => {
    // 1. Busca textual
    const term = ingressosSearch.toLowerCase();
    const cleanCpf = t.cpfComprador.replace(/\D/g, "");
    const cleanSearch = ingressosSearch.replace(/\D/g, "");
    const matchesSearch =
      t.nomeComprador.toLowerCase().includes(term) ||
      t.id.toLowerCase().includes(term) ||
      t.id.replace("ingresso_", "").includes(term) ||
      (cleanCpf && cleanSearch && cleanCpf.includes(cleanSearch));

    // 2. Filtro rápido de status
    if (!matchesSearch) return false;

    if (ingressosFilter === "com_dono") {
      return t.status !== "disponivel";
    }
    if (ingressosFilter === "sem_dono") {
      return t.status === "disponivel";
    }
    if (ingressosFilter === "validados") {
      return t.utilizado === true;
    }
    return true;
  });

  // Paginação dos Ingressos
  const totalFilteredCount = filteredIngressos.length;
  const totalPages = Math.max(Math.ceil(totalFilteredCount / ITEMS_PER_PAGE), 1);
  // Resetar página se estourar
  const activePage = currentPage > totalPages ? 1 : currentPage;
  
  const paginatedIngressos = filteredIngressos.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  // Lógica de Busca e Filtro para Aba ESTACIONAMENTO
  const allGeneratedEstacionamento = buildParkingGrid();

  const filteredEstacionamento = allGeneratedEstacionamento.filter((t) => {
    const term = estacionamentoSearch.toLowerCase();
    const cleanCpf = (t.cpfComprador || "").replace(/\D/g, "");
    const cleanSearch = estacionamentoSearch.replace(/\D/g, "");
    const matchesSearch =
      (t.nomeComprador || "").toLowerCase().includes(term) ||
      (t.displayId || "").toLowerCase().includes(term) ||
      (t.displayId || "").replace("vaga_", "").includes(term) ||
      (cleanCpf && cleanSearch && cleanCpf.includes(cleanSearch));

    if (!matchesSearch) return false;

    if (estacionamentoFilter === "com_dono") {
      return t.status !== "disponivel";
    }
    if (estacionamentoFilter === "sem_dono") {
      return t.status === "disponivel";
    }
    if (estacionamentoFilter === "validados") {
      return (t.parkingUsed || (t.id.startsWith("vaga_") ? t.utilizado : false)) === true;
    }
    return true;
  });

  // Paginação do Estacionamento
  const totalFilteredEstacionamento = filteredEstacionamento.length;
  const totalPagesEstacionamento = Math.max(Math.ceil(totalFilteredEstacionamento / ITEMS_PER_PAGE), 1);
  const activeEstacionamentoPage = estacionamentoCurrentPage > totalPagesEstacionamento ? 1 : estacionamentoCurrentPage;
  
  const paginatedEstacionamento = filteredEstacionamento.slice(
    (activeEstacionamentoPage - 1) * ITEMS_PER_PAGE,
    activeEstacionamentoPage * ITEMS_PER_PAGE
  );

  // Lógica de Busca e Filtro para Aba USUÁRIOS
  const filteredUsuarios = usuariosList.filter((u) => {
    const term = usuariosSearch.toLowerCase();
    const cleanCpf = (u.cpf || "").replace(/\D/g, "");
    const cleanSearch = usuariosSearch.replace(/\D/g, "");
    
    return (
      (u.nome || "").toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term) ||
      (cleanCpf && cleanSearch && cleanCpf.includes(cleanSearch))
    );
  });

  const totalFilteredUsuarios = filteredUsuarios.length;
  const totalPagesUsuarios = Math.max(Math.ceil(totalFilteredUsuarios / ITEMS_PER_PAGE), 1);
  const activeUsuariosPage = usuariosCurrentPage > totalPagesUsuarios ? 1 : usuariosCurrentPage;
  
  const paginatedUsuarios = filteredUsuarios.slice(
    (activeUsuariosPage - 1) * ITEMS_PER_PAGE,
    activeUsuariosPage * ITEMS_PER_PAGE
  );

  const maskCpf = (cpf: string) => {
    if (!cpf) return "Não informado";
    const clean = cpf.replace(/\D/g, "");
    if (clean.length !== 11) return cpf;
    return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
  };

  // CÁLCULO DE DADOS REAIS DE DESEMPENHO SEMANAL
  const computeWeeklyPerformance = () => {
    const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    const result = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      
      // Somar faturamento das vendas aprovadas neste dia específico
      const dailyApproved = vendas.filter((v) => {
        if (v.status !== "aprovado") return false;
        
        let vDate = null;
        if (v.createdAt?.toDate) {
          vDate = v.createdAt.toDate();
        } else if (v.createdAt instanceof Date) {
          vDate = v.createdAt;
        } else if (typeof v.createdAt === "string" || typeof v.createdAt === "number") {
          vDate = new Date(v.createdAt);
        }
        
        return vDate && vDate >= dayStart && vDate <= dayEnd;
      });
      
      const revenue = dailyApproved.reduce((sum, v) => sum + v.valor, 0);
      
      result.push({
        label: WEEKDAYS[d.getDay()],
        value: revenue,
        isToday: i === 0,
      });
    }
    
    const maxValue = Math.max(...result.map((r) => r.value), 1);
    
    return {
      days: result,
      maxValue,
    };
  };

  const weeklyData = computeWeeklyPerformance();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full space-y-8">
        {/* Header Admin */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-900">
          <div>
            <span className="text-[10px] tracking-[0.25em] font-black text-primary uppercase">
              PAINEL ADM
            </span>
            <h1 className="font-display font-black text-3xl sm:text-5xl uppercase tracking-tight mt-1 text-white">
              Sintonia <span className="text-primary">Admin</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-2">
              Gestão financeira, auditoria de portaria via check-in seguro e controle de promoções em tempo real.
            </p>
          </div>
          
          <button
            onClick={openSettingsModal}
            className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 hover:border-primary/50 text-white px-4 py-2.5 rounded-md text-xs font-black uppercase tracking-wider transition-colors shadow-lg self-start md:self-auto"
          >
            <Settings size={16} className="text-primary" />
            <span>Ajustar Configs</span>
          </button>
        </div>

        {/* ---------------- SLIDING TAB NAVIGATION MENU ---------------- */}
        <div className="flex justify-start items-center overflow-x-auto pb-2 scrollbar-thin">
          <div className="flex space-x-1 bg-neutral-950 p-1.5 rounded-lg border border-neutral-900 w-full max-w-2xl">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setCurrentPage(1); // Resetar página ao trocar de aba
                    setVendasCurrentPage(1);
                    setExpandedVendasGroups([]);
                  }}
                  className={`relative flex items-center justify-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider rounded-md transition-colors cursor-pointer flex-1 z-10 select-none ${
                    isActive ? "text-black" : "text-neutral-500 hover:text-white"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-admin-tab"
                      className="absolute inset-0 bg-primary rounded-md z-[-1]"
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    />
                  )}
                  <Icon size={16} />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------------- DYNAMIC VIEWS CONTAINER ---------------- */}
        <div className="min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {/* ABA 1: INSIGHTS */}
              {activeTab === "insights" && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div 
                      onClick={() => { setActiveTab("vendas"); setCurrentPage(1); }}
                      className="flat-card p-6 rounded border border-neutral-800 flex items-center justify-between shadow-lg cursor-pointer hover:border-primary/50 transition-colors group"
                    >
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider group-hover:text-primary/80 transition-colors">Faturamento Total</p>
                        <h3 className="font-display font-black text-3xl text-primary tracking-tighter">
                          R$ {metrics.faturamento.toFixed(2)}
                        </h3>
                        <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wide flex items-center gap-1">
                          <TrendingUp size={10} /> Conciliado MP
                        </p>
                      </div>
                      <div className="p-3.5 rounded bg-neutral-900 border border-neutral-800 text-primary group-hover:bg-primary/10 transition-colors">
                        <TrendingUp size={24} />
                      </div>
                    </div>

                    <div 
                      onClick={() => { setActiveTab("ingressos"); setCurrentPage(1); }}
                      className="flat-card p-6 rounded border border-neutral-800 flex items-center justify-between shadow-lg cursor-pointer hover:border-primary/50 transition-colors group"
                    >
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider group-hover:text-white transition-colors">Ingressos Vendidos</p>
                        <h3 className="font-display font-black text-3xl text-white tracking-tighter">
                          {metrics.totalVendas}
                        </h3>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wide">
                          Total emitido no sistema
                        </p>
                      </div>
                      <div className="p-3.5 rounded bg-neutral-900 border border-neutral-800 text-white group-hover:bg-white/10 transition-colors">
                        <Ticket size={24} />
                      </div>
                    </div>

                    <div 
                      onClick={() => { setActiveTab("usuarios"); setCurrentPage(1); }}
                      className="flat-card p-6 rounded border border-neutral-800 flex items-center justify-between shadow-lg cursor-pointer hover:border-primary/50 transition-colors group"
                    >
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider group-hover:text-white transition-colors">Usuários Registrados</p>
                        <h3 className="font-display font-black text-3xl text-white tracking-tighter">
                          {metrics.totalUsuarios}
                        </h3>
                        <p className="text-[9px] text-neutral-500 uppercase font-bold">Base Integrada Firestore</p>
                      </div>
                      <div className="p-3.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 group-hover:text-white transition-colors">
                        <Users size={24} />
                      </div>
                    </div>

                    <div 
                      onClick={() => { setActiveTab("estacionamento"); setCurrentPage(1); }}
                      className="flat-card p-6 rounded border border-neutral-800 flex items-center justify-between shadow-lg cursor-pointer hover:border-primary/50 transition-colors group"
                    >
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider group-hover:text-white transition-colors">Estacionamento</p>
                        <h3 className="font-display font-black text-3xl text-white tracking-tighter">
                          {metrics.totalEstacionamento} <span className="text-sm text-neutral-500">/ {appConfig?.parkingSpots || 50}</span>
                        </h3>
                        <p className="text-[9px] text-neutral-500 uppercase font-bold">Vagas Vendidas</p>
                      </div>
                      <div className="p-3.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 group-hover:text-white transition-colors">
                        <ShieldCheck size={24} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="flat-card p-6 rounded border border-neutral-800 space-y-6">
                      <div>
                        <h3 className="font-display font-black text-lg uppercase tracking-tight text-white">
                          Status de Vendas por Lote
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1">
                          Percentual de ingressos vendidos em relação à meta definida no sistema por lote.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {Object.entries(metrics.vendasPorLote).length === 0 ? (
                          <p className="text-xs text-neutral-500 font-bold py-4">Nenhum lote com vendas aprovadas ainda.</p>
                        ) : (
                          Object.entries(metrics.vendasPorLote).map(([loteName, count]) => {
                            const configLote = appConfig?.lotes?.find((l: any) => l.nome === loteName);
                            // If maxVendas is null (unlimited) or not found, we use a fallback to just show the count or 100% full
                            const target = configLote && configLote.maxVendas !== null ? configLote.maxVendas : count || 1;
                            const percentage = Math.min((count / target) * 100, 100);
                            const isUnlimited = configLote?.maxVendas === null;

                            return (
                              <div key={loteName} className="space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase">
                                  <span className="text-neutral-300 truncate max-w-[250px]">{loteName}</span>
                                  <span className="text-primary">{count} {isUnlimited ? "vendidos" : `/ ${target} vendidos`} ({percentage.toFixed(0)}%)</span>
                                </div>
                                <div className="w-full bg-neutral-900 h-3 rounded-full overflow-hidden border border-neutral-800/80">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="bg-primary h-full rounded-full"
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="flat-card p-6 rounded border border-neutral-800 space-y-6">
                      <div>
                        <h3 className="font-display font-black text-lg uppercase tracking-tight text-white flex items-center gap-2">
                          Desempenho Semanal
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1">
                          Faturamento real de vendas nos últimos 7 dias baseado em transações aprovadas do Mercado Pago.
                        </p>
                      </div>

                      <div className="flex justify-between items-end h-40 pt-4 border-b border-neutral-900 px-2">
                        {weeklyData.days.map((day, idx) => {
                          const percentHeight = (day.value / weeklyData.maxValue) * 100;
                          const heightStyle = day.value > 0 ? `${Math.max(percentHeight, 8)}%` : "4px";

                          return (
                            <div key={idx} className="flex flex-col items-center w-full h-full">
                              <div className="flex-1 w-full flex items-end justify-center pb-2">
                                <div
                                  style={{ height: heightStyle }}
                                  className={`w-6 sm:w-8 rounded-t relative group cursor-pointer transition-all duration-500 border ${
                                    day.isToday
                                      ? "bg-primary border-primary shadow-[0_0_15px_rgba(245,245,0,0.3)]"
                                      : day.value > 0
                                      ? "bg-primary/80 border-primary/40 hover:bg-primary"
                                      : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                                  }`}
                                >
                                  {/* Premium Tooltip */}
                                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                                    <p className="text-[9px] font-black text-white uppercase tracking-wider">
                                      {day.value > 0 ? `R$ ${day.value.toFixed(2)}` : "Sem Vendas"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-wider ${
                                day.isToday ? "text-primary" : "text-neutral-500"
                              }`}>
                                {day.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: VENDAS (HISTÓRICO FINANCEIRO) */}
              {activeTab === "vendas" && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-900">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                      <input
                        type="text"
                        placeholder="Pesquisar por comprador, e-mail ou CPF..."
                        value={vendasSearch}
                        onChange={(e) => setVendasSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm premium-input"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(["todos", "aprovado", "pendente", "cancelado"] as const).map((filterOpt) => (
                        <button
                          key={filterOpt}
                          onClick={() => setVendasFilter(filterOpt)}
                          className={`px-3 py-1.5 rounded text-xs font-black uppercase tracking-wider cursor-pointer transition-all border ${
                            vendasFilter === filterOpt
                              ? "bg-primary text-black border-primary"
                              : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
                          }`}
                        >
                          {filterOpt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flat-card rounded border border-neutral-800 overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-neutral-900/60 text-neutral-400 uppercase font-black border-b border-neutral-800">
                          <tr>
                            <th className="px-6 py-4">Comprador / CPF</th>
                            <th className="px-6 py-4">Setor / Lote</th>
                            <th className="px-6 py-4">Valor</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900 font-medium">
                          {paginatedVendas.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 font-bold">
                                Nenhuma transação registrada que corresponda aos filtros de busca.
                              </td>
                            </tr>
                          ) : (
                            paginatedVendas.map((group) => {
                              const isExpanded = expandedVendasGroups.includes(group.key);
                              const hasSubVendas = group.subVendas.length > 0;
                              
                              return (
                                <Fragment key={group.key}>
                                  <tr className="hover:bg-neutral-900/40 transition-colors">
                                    <td className="px-6 py-4 space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <div className="font-bold text-white uppercase">{group.mainVenda.nomeComprador}</div>
                                        {hasSubVendas && (
                                          <button
                                            onClick={() => toggleVendasGroup(group.key)}
                                            className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                                            title="Ver outros pedidos"
                                          >
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="text-[10px] text-neutral-500">{group.mainVenda.cpfComprador || "CPF não fornecido"}</div>
                                        {hasSubVendas && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                                            +{group.subVendas.length}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-neutral-300 font-bold uppercase">{group.mainVenda.lote}</td>
                                    <td className="px-6 py-4 font-black text-white">R$ {group.mainVenda.valor.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                      <span
                                        className={`px-2.5 py-1 rounded border text-[9px] font-black uppercase inline-flex items-center gap-1 ${
                                          group.mainVenda.status === "aprovado"
                                            ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                                            : group.mainVenda.status === "pendente"
                                            ? "bg-amber-950/20 border-amber-500/20 text-amber-400"
                                            : "bg-red-950/20 border-red-500/20 text-red-400"
                                        }`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          group.mainVenda.status === "aprovado" ? "bg-emerald-400" : group.mainVenda.status === "pendente" ? "bg-amber-400" : "bg-red-400"
                                        }`} />
                                        {group.mainVenda.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-neutral-500">
                                      {group.mainVenda.createdAt?.toDate ? (
                                        group.mainVenda.createdAt.toDate().toLocaleDateString("pt-BR", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      ) : group.mainVenda.createdAt instanceof Date ? (
                                        group.mainVenda.createdAt.toLocaleDateString("pt-BR", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      ) : (
                                        "Agora"
                                      )}
                                    </td>
                                  </tr>
                                  {isExpanded && group.subVendas.map((subVenda) => (
                                    <tr
                                      key={subVenda.id} 
                                      className="bg-neutral-900/20 border-l-[3px] border-l-primary/50"
                                    >
                                      <td className="px-6 py-3 pl-8 space-y-0.5 relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-[1px] bg-neutral-800"></div>
                                        <div className="absolute left-3 top-0 bottom-1/2 w-[1px] bg-neutral-800"></div>
                                        <div className="text-[11px] font-bold text-neutral-400 uppercase">{subVenda.nomeComprador}</div>
                                        <div className="text-[9px] text-neutral-600">{subVenda.cpfComprador || "CPF não fornecido"}</div>
                                      </td>
                                      <td className="px-6 py-3 text-neutral-400 text-[11px] font-bold uppercase">{subVenda.lote}</td>
                                      <td className="px-6 py-3 font-black text-neutral-300 text-[11px]">R$ {subVenda.valor.toFixed(2)}</td>
                                      <td className="px-6 py-3">
                                        <span
                                          className={`px-2 py-0.5 rounded border text-[8px] font-black uppercase inline-flex items-center gap-1 ${
                                            subVenda.status === "aprovado"
                                              ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                                              : subVenda.status === "pendente"
                                              ? "bg-amber-950/20 border-amber-500/20 text-amber-400"
                                              : "bg-red-950/20 border-red-500/20 text-red-400"
                                          }`}
                                        >
                                          {subVenda.status}
                                        </span>
                                      </td>
                                      <td className="px-6 py-3 text-right text-neutral-600 text-[11px]">
                                        {subVenda.createdAt?.toDate ? (
                                          subVenda.createdAt.toDate().toLocaleDateString("pt-BR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        ) : subVenda.createdAt instanceof Date ? (
                                          subVenda.createdAt.toLocaleDateString("pt-BR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        ) : (
                                          "Agora"
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Paginação de Vendas */}
                  {totalVendasPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-900 text-xs mt-4">
                      <p className="text-neutral-500 font-bold uppercase tracking-wider">
                        Exibindo de {((activeVendasPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(activeVendasPage * ITEMS_PER_PAGE, totalVendasGroups)} de {totalVendasGroups} compradores encontrados
                      </p>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setVendasCurrentPage((p) => Math.max(p - 1, 1))}
                          disabled={activeVendasPage === 1}
                          className="p-2 rounded border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center space-x-1">
                          {Array.from({ length: totalVendasPages }).map((_, index) => {
                            const pIndex = index + 1;
                            const isCurrent = pIndex === activeVendasPage;
                            if (pIndex !== 1 && pIndex !== totalVendasPages && Math.abs(pIndex - activeVendasPage) > 2) {
                              if (pIndex === 2 || pIndex === totalVendasPages - 1) {
                                return <span key={pIndex} className="text-neutral-700 font-bold px-1 select-none">...</span>;
                              }
                              return null;
                            }

                            return (
                              <button
                                key={pIndex}
                                onClick={() => setVendasCurrentPage(pIndex)}
                                className={`px-3 py-1.5 rounded text-xs font-black select-none cursor-pointer ${
                                  isCurrent
                                    ? "bg-primary text-black"
                                    : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
                                }`}
                              >
                                {pIndex}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => setVendasCurrentPage((p) => Math.min(p + 1, totalVendasPages))}
                          disabled={activeVendasPage === totalVendasPages}
                          className="p-2 rounded border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: INGRESSOS (PORTARIA, ATRIBUIÇÃO E REMOÇÃO DE DONO - 1050 UNIDADES) */}
              {activeTab === "ingressos" && (
                <div className="space-y-6">
                  {/* Busca e Filtros Avançados */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-lg bg-neutral-950 border border-neutral-900">
                    <div className="space-y-1">
                      <h3 className="font-display font-black text-sm uppercase tracking-wider text-white">
                        Grade Geral do Evento ({appConfig?.totalTickets || 1050} Ingressos Máximos)
                      </h3>
                      <p className="text-[10px] sm:text-xs text-neutral-400">
                        Gerencie a posse dos ingressos por CPF cadastrado, valide check-in ou libere vagas de volta para a venda.
                      </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full xl:max-w-3xl">
                      {/* Status filter selection */}
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          { id: "todos", label: "Todos" },
                          { id: "com_dono", label: "Com Dono" },
                          { id: "sem_dono", label: "Disponíveis" },
                          { id: "validados", label: "Validados" }
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setIngressosFilter(opt.id);
                              setCurrentPage(1);
                            }}
                            className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider cursor-pointer border ${
                              ingressosFilter === opt.id
                                ? "bg-primary text-black border-primary"
                                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Input de Busca */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                        <input
                          type="text"
                          placeholder="Buscar por #Código, CPF ou Portador..."
                          value={ingressosSearch}
                          onChange={(e) => {
                            setIngressosSearch(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm premium-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Listagem de Ingressos em Grid (30 por Página) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedIngressos.length === 0 ? (
                      <div className="col-span-full flat-card p-12 text-center text-neutral-500 font-bold rounded border border-neutral-800">
                        Nenhum ingresso encontrado para esta pesquisa ou filtro.
                      </div>
                    ) : (
                      paginatedIngressos.map((t) => {
                        const isMock = t.id === "0000";
                        const isUsed = t.utilizado;
                        const isOwnerless = t.status === "disponivel";
                        const formattedId = isMock ? "#0000" : (t.numeroIngresso ? `#${String(t.numeroIngresso).padStart(4, '0')}` : `#${t.id.replace("ingresso_", "").slice(0, 5)}...`);

                        return (
                          <div
                            key={t.id}
                            className={`flat-card p-5 rounded border flex flex-col justify-between gap-4 transition-all relative overflow-hidden ${
                              isUsed
                                ? "border-red-500/20 bg-red-950/5"
                                : isOwnerless
                                ? "border-neutral-800 bg-neutral-900/10 opacity-75 hover:opacity-100"
                                : "border-emerald-500/15 bg-emerald-950/5 hover:border-emerald-500/30"
                            }`}
                          >
                            {/* Color Bar indicator */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                              isUsed ? "bg-red-500" : isOwnerless ? "bg-neutral-700" : "bg-emerald-500"
                            }`} />

                            <div className="space-y-3 pl-2">
                              {/* Header Card do Ingresso */}
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[8px] text-neutral-500 font-black uppercase tracking-wider block">ID</span>
                                  <span className="font-display font-black text-sm text-white tracking-wider">{formattedId}</span>
                                </div>

                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                  isUsed
                                    ? "bg-red-950/20 border-red-500/20 text-red-400"
                                    : isOwnerless
                                    ? "bg-neutral-950/30 border-neutral-800 text-neutral-500"
                                    : "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                                }`}>
                                  {isUsed ? "Utilizado" : isOwnerless ? "Sem Dono" : "Com Dono"}
                                </span>
                              </div>

                              {/* Detalhes do Dono do Ingresso */}
                              {!isOwnerless ? (
                                <div className="space-y-1.5 text-xs">
                                  <div>
                                    <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">Portador</span>
                                    <span className="font-bold text-white uppercase">{t.nomeComprador}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">CPF</span>
                                    <span className="text-neutral-400">{t.cpfComprador}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">Categoria</span>
                                    <span className="text-primary font-bold uppercase text-[10px]">{t.lote}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2 py-1 text-xs">
                                  <p className="text-neutral-500 italic text-[11px] leading-snug">
                                    Este ingresso está livre na grade. Você pode atribuí-lo a qualquer CPF cadastrado no site para dar posse a alguém.
                                  </p>

                                  {/* Input para CPF */}
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      placeholder="CPF (apenas números)"
                                      value={assignCpfInput[t.id] || ""}
                                      onChange={(e) =>
                                        setAssignCpfInput((prev) => ({
                                          ...prev,
                                          [t.id]: e.target.value,
                                        }))
                                      }
                                      className="flex-1 py-1.5 px-2.5 text-[11px] premium-input"
                                    />
                                    <button
                                      onClick={() => handleAssignTicket(t.id)}
                                      disabled={assignLoading[t.id]}
                                      className="py-1.5 px-3 rounded bg-primary text-black font-black text-[10px] uppercase flex items-center gap-1 cursor-pointer hover:bg-primary-hover disabled:opacity-50"
                                      title="Dar posse do ingresso"
                                    >
                                      {assignLoading[t.id] ? (
                                        <Loader2 size={10} className="animate-spin" />
                                      ) : (
                                        <>
                                          <UserPlus size={10} />
                                          Dar
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Ações de Portaria e Admin */}
                            <div className="pt-3 border-t border-neutral-900 pl-2 flex flex-col gap-2">
                              {!isOwnerless && (
                                <div className="flex gap-2">
                                  {/* Botão de Check-In */}
                                  <div className="flex-1">
                                    {isUsed ? (
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-xs text-red-500 font-black uppercase tracking-wide">
                                          <XCircle size={13} className="flex-shrink-0" />
                                          Entrada Rejeitada
                                        </div>
                                        <p className="text-[9px] text-neutral-500">
                                          Validado às {
                                            t.checkedInAt?.toDate ? (
                                              t.checkedInAt.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                                            ) : t.checkedInAt instanceof Date ? (
                                              t.checkedInAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                                            ) : (
                                              "Hoje"
                                            )
                                          }
                                        </p>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleCheckInTicket(t.id)}
                                        disabled={checkInLoading[t.id]}
                                        className="w-full py-1.5 rounded bg-primary hover:bg-primary-hover text-black font-black text-[10px] uppercase flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.01]"
                                      >
                                        {checkInLoading[t.id] ? (
                                          <>
                                            <Loader2 size={10} className="animate-spin" />
                                            Validando...
                                          </>
                                        ) : isMock ? (
                                          <>
                                            Validar [INFINITO]
                                            <Sparkles size={10} />
                                          </>
                                        ) : (
                                          <>
                                            Validar Portaria
                                            <CheckCircle2 size={10} />
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {/* Botão de Retirar Dono (Não mostrar no Mock de teste) */}
                                  {!isMock && (
                                    <button
                                      onClick={() => handleRevokeTicket(t.id)}
                                      disabled={revokeLoading[t.id]}
                                      className="p-1.5 rounded border border-red-500/20 bg-red-950/10 text-red-500 hover:bg-red-500/20 cursor-pointer"
                                      title="Retirar posse do ingresso (ficará sem dono)"
                                    >
                                      {revokeLoading[t.id] ? (
                                        <Loader2 size={12} className="animate-spin text-red-500" />
                                      ) : (
                                        <Trash2 size={12} />
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Paginação dos Ingressos */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-neutral-900 text-xs">
                      <p className="text-neutral-500 font-bold uppercase tracking-wider">
                        Exibindo de {((activePage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(activePage * ITEMS_PER_PAGE, totalFilteredCount)} de {totalFilteredCount} ingressos encontrados
                      </p>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                          disabled={activePage === 1}
                          className="p-2 rounded border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center space-x-1">
                          {Array.from({ length: totalPages }).map((_, index) => {
                            const pIndex = index + 1;
                            const isCurrent = pIndex === activePage;
                            // Mostrar apenas páginas próximas à atual para não poluir em 35 páginas
                            if (pIndex !== 1 && pIndex !== totalPages && Math.abs(pIndex - activePage) > 2) {
                              if (pIndex === 2 || pIndex === totalPages - 1) {
                                return <span key={pIndex} className="text-neutral-700 font-bold px-1 select-none">...</span>;
                              }
                              return null;
                            }

                            return (
                              <button
                                key={pIndex}
                                onClick={() => setCurrentPage(pIndex)}
                                className={`px-3 py-1.5 rounded text-xs font-black select-none cursor-pointer ${
                                  isCurrent
                                    ? "bg-primary text-black"
                                    : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
                                }`}
                              >
                                {pIndex}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                          disabled={activePage === totalPages}
                          className="p-2 rounded border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA: ESTACIONAMENTO (50 VAGAS) */}
              {activeTab === "estacionamento" && (
                <div className="space-y-6">
                  {/* Busca e Filtros Avançados */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-lg bg-neutral-950 border border-neutral-900">
                    <div className="space-y-1">
                      <h3 className="font-display font-black text-sm uppercase tracking-wider text-white">
                        Grade de Estacionamento (50 Vagas)
                      </h3>
                      <p className="text-[10px] sm:text-xs text-neutral-400">
                        Gerencie a posse das vagas por CPF, valide check-in ou libere vagas.
                      </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full xl:max-w-3xl">
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          { id: "todos", label: "Todas" },
                          { id: "com_dono", label: "Ocupadas" },
                          { id: "sem_dono", label: "Livres" },
                          { id: "validados", label: "Validadas" }
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setEstacionamentoFilter(opt.id);
                              setEstacionamentoCurrentPage(1);
                            }}
                            className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-wider cursor-pointer border ${
                              estacionamentoFilter === opt.id
                                ? "bg-primary text-black border-primary"
                                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                        <input
                          type="text"
                          placeholder="Buscar por Vaga, CPF ou Motorista..."
                          value={estacionamentoSearch}
                          onChange={(e) => {
                            setEstacionamentoSearch(e.target.value);
                            setEstacionamentoCurrentPage(1);
                          }}
                          className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm premium-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Listagem de Estacionamento em Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedEstacionamento.length === 0 ? (
                      <div className="col-span-full flat-card p-12 text-center text-neutral-500 font-bold rounded border border-neutral-800">
                        Nenhuma vaga encontrada.
                      </div>
                    ) : (
                      paginatedEstacionamento.map((t) => {
                        const isMock = t.id === "0000";
                        const isUsed = t.parkingUsed || (t.id.startsWith("vaga_") ? t.utilizado : false);
                        const isOwnerless = t.status === "disponivel";
                        const formattedId = isMock ? "#0000" : `#${t.displayId.replace("vaga_", "")}`;

                        return (
                          <div
                            key={t.displayId}
                            className={`flat-card p-5 rounded border flex flex-col justify-between gap-4 transition-all relative overflow-hidden ${
                              isUsed
                                ? "border-red-500/20 bg-red-950/5"
                                : isOwnerless
                                ? "border-neutral-800 bg-neutral-900/10 opacity-75 hover:opacity-100"
                                : "border-emerald-500/15 bg-emerald-950/5 hover:border-emerald-500/30"
                            }`}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                              isUsed ? "bg-red-500" : isOwnerless ? "bg-neutral-700" : "bg-emerald-500"
                            }`} />

                            <div className="space-y-3 pl-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[8px] text-neutral-500 font-black uppercase tracking-wider block">VAGA</span>
                                  <span className="font-display font-black text-sm text-white tracking-wider">{formattedId}</span>
                                </div>

                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                  isUsed
                                    ? "bg-red-950/20 border-red-500/20 text-red-400"
                                    : isOwnerless
                                    ? "bg-neutral-950/30 border-neutral-800 text-neutral-500"
                                    : "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                                }`}>
                                  {isUsed ? "Utilizada" : isOwnerless ? "Livre" : "Ocupada"}
                                </span>
                              </div>

                              {!isOwnerless ? (
                                <div className="space-y-1.5 text-xs">
                                  <div>
                                    <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">Motorista</span>
                                    <span className="font-bold text-white uppercase">{t.nomeComprador}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">CPF</span>
                                    <span className="text-neutral-400">{t.cpfComprador}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">Ticket Atrelado</span>
                                    <span className="text-primary font-bold uppercase text-[10px]">{t.id.startsWith("ingresso_") ? `#${t.id.replace("ingresso_", "").slice(0, 5)}...` : "Vaga Avulsa"}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2 py-1 text-xs">
                                  <p className="text-neutral-500 italic text-[11px] leading-snug">
                                    Vaga livre. Atribua um CPF para vender o estacionamento separadamente na portaria.
                                  </p>

                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      placeholder="CPF (apenas números)"
                                      value={assignCpfInput[t.displayId] || ""}
                                      onChange={(e) =>
                                        setAssignCpfInput((prev) => ({
                                          ...prev,
                                          [t.displayId]: e.target.value,
                                        }))
                                      }
                                      className="flex-1 py-1.5 px-2.5 text-[11px] premium-input"
                                    />
                                    <button
                                      onClick={() => handleAssignTicket(t.displayId)}
                                      disabled={assignLoading[t.displayId]}
                                      className="py-1.5 px-3 rounded bg-primary text-black font-black text-[10px] uppercase flex items-center gap-1 cursor-pointer hover:bg-primary-hover disabled:opacity-50"
                                      title="Dar posse da vaga"
                                    >
                                      {assignLoading[t.displayId] ? (
                                        <Loader2 size={10} className="animate-spin" />
                                      ) : (
                                        <>
                                          <UserPlus size={10} />
                                          Dar
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-3 border-t border-neutral-900 pl-2 flex flex-col gap-2">
                              {!isOwnerless && (
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    {isUsed ? (
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-xs text-red-500 font-black uppercase tracking-wide">
                                          <XCircle size={13} className="flex-shrink-0" />
                                          Vaga Registrada
                                        </div>
                                        <p className="text-[9px] text-neutral-500">
                                          Validado às {
                                            (t.parkingCheckedInAt || t.checkedInAt)?.toDate ? (
                                              (t.parkingCheckedInAt || t.checkedInAt).toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                                            ) : (t.parkingCheckedInAt || t.checkedInAt) instanceof Date ? (
                                              (t.parkingCheckedInAt || t.checkedInAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                                            ) : (
                                              "Hoje"
                                            )
                                          }
                                        </p>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleCheckInTicket(t.id, true)}
                                        disabled={checkInLoading[t.id]}
                                        className="w-full py-1.5 rounded bg-primary hover:bg-primary-hover text-black font-black text-[10px] uppercase flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.01]"
                                      >
                                        {checkInLoading[t.id] ? (
                                          <>
                                            <Loader2 size={10} className="animate-spin" />
                                            Validando...
                                          </>
                                        ) : isMock ? (
                                          <>
                                            Validar [INFINITO]
                                            <Sparkles size={10} />
                                          </>
                                        ) : (
                                          <>
                                            Registrar Carro
                                            <Car size={10} />
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {!isMock && (
                                    <button
                                      onClick={() => handleRevokeTicket(t.id, true)}
                                      disabled={revokeLoading[t.id]}
                                      className="p-1.5 rounded border border-red-500/20 bg-red-950/10 text-red-500 hover:bg-red-500/20 cursor-pointer"
                                      title="Retirar posse desta vaga"
                                    >
                                      {revokeLoading[t.id] ? (
                                        <Loader2 size={12} className="animate-spin text-red-500" />
                                      ) : (
                                        <Trash2 size={12} />
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {totalPagesEstacionamento > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-neutral-900 text-xs">
                      <p className="text-neutral-500 font-bold uppercase tracking-wider">
                        Exibindo de {((activeEstacionamentoPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(activeEstacionamentoPage * ITEMS_PER_PAGE, totalFilteredEstacionamento)} de {totalFilteredEstacionamento} vagas encontradas
                      </p>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setEstacionamentoCurrentPage((p) => Math.max(p - 1, 1))}
                          disabled={activeEstacionamentoPage === 1}
                          className="p-2 rounded border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center space-x-1">
                          {Array.from({ length: totalPagesEstacionamento }).map((_, index) => {
                            const pIndex = index + 1;
                            const isCurrent = pIndex === activeEstacionamentoPage;
                            if (pIndex !== 1 && pIndex !== totalPagesEstacionamento && Math.abs(pIndex - activeEstacionamentoPage) > 2) {
                              if (pIndex === 2 || pIndex === totalPagesEstacionamento - 1) {
                                return <span key={pIndex} className="text-neutral-700 font-bold px-1 select-none">...</span>;
                              }
                              return null;
                            }

                            return (
                              <button
                                key={pIndex}
                                onClick={() => setEstacionamentoCurrentPage(pIndex)}
                                className={`px-3 py-1.5 rounded text-xs font-black select-none cursor-pointer ${
                                  isCurrent
                                    ? "bg-primary text-black"
                                    : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
                                }`}
                              >
                                {pIndex}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => setEstacionamentoCurrentPage((p) => Math.min(p + 1, totalPagesEstacionamento))}
                          disabled={activeEstacionamentoPage === totalPagesEstacionamento}
                          className="p-2 rounded border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 4: SORTEIOS */}
              {activeTab === "sorteios" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  <div className="space-y-6">
                    <h2 className="font-display font-black text-xl tracking-tight uppercase text-white flex items-center gap-2">
                      <PlusCircle size={20} className="text-primary" />
                      Novo Sorteio
                    </h2>

                    <div className="flat-card p-6 rounded border border-neutral-800 space-y-4 bg-neutral-950">
                      <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-900 pb-2">
                        <Sparkles size={14} className="text-primary" /> Criar Premiação
                      </h3>
                      <form onSubmit={handleCriarSorteio} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-400 uppercase font-black tracking-wider">Título do Sorteio</label>
                          <input
                            type="text"
                            placeholder="Ex: VIP Upgrade + Consumação"
                            value={novoTitulo}
                            onChange={(e) => setNovoTitulo(e.target.value)}
                            className="w-full py-2.5 px-4 premium-input text-xs sm:text-sm"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-400 uppercase font-black tracking-wider">Descrição das Regras</label>
                          <textarea
                            placeholder="Descrição detalhada das regras e itens inclusos na promoção..."
                            value={novaDescricao}
                            onChange={(e) => setNovaDescricao(e.target.value)}
                            className="w-full py-2.5 px-4 premium-input text-xs sm:text-sm h-24 resize-none"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-400 uppercase font-black tracking-wider">URL da Imagem (Opcional)</label>
                          <input
                            type="url"
                            placeholder="https://exemplo.com/imagem.jpg"
                            value={novoImagemUrl}
                            onChange={(e) => setNovoImagemUrl(e.target.value)}
                            className="w-full py-2 px-3 premium-input text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-neutral-500 uppercase font-bold tracking-wider">Presets de Fotos Premium</label>
                          <div className="flex flex-wrap gap-1.5">
                            {PRESET_IMAGES.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setNovoImagemUrl(preset.url)}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase border tracking-wide transition-all cursor-pointer ${
                                  novoImagemUrl === preset.url
                                    ? "bg-primary text-black border-primary font-black"
                                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {novoImagemUrl && (
                          <div className="w-full h-24 rounded overflow-hidden border border-neutral-800 relative mt-2 group bg-neutral-950">
                            <img
                              src={novoImagemUrl}
                              alt="Preview"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80";
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex items-end p-2">
                              <span className="text-[8px] font-black uppercase text-primary tracking-widest bg-black/60 px-1.5 py-0.5 rounded border border-primary/20">
                                Live Banner Preview
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] text-neutral-400 uppercase font-black tracking-wider flex items-center gap-1">
                              <Calendar size={10} className="text-neutral-500" />
                              Início
                            </label>
                            <input
                              type="datetime-local"
                              value={novoDataInicio}
                              onChange={(e) => setNovoDataInicio(e.target.value)}
                              className="w-full py-1.5 px-2 premium-input text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-neutral-400 uppercase font-black tracking-wider flex items-center gap-1">
                              <Clock size={10} className="text-neutral-500" />
                              Fim
                            </label>
                            <input
                              type="datetime-local"
                              value={novoDataFim}
                              onChange={(e) => setNovoDataFim(e.target.value)}
                              className="w-full py-1.5 px-2 premium-input text-xs"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={criarSorteioLoading}
                          className="w-full py-2.5 px-5 rounded bg-primary hover:bg-primary-hover text-black font-black text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer mt-2"
                        >
                          {criarSorteioLoading ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Criando...
                            </>
                          ) : (
                            <>
                              Criar Sorteio
                              <Sparkles size={14} />
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <h2 className="font-display font-black text-xl tracking-tight uppercase text-white flex items-center gap-2">
                      <Gift size={20} className="text-primary" />
                      Promoções & Sorteios
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                        {sorteios.length} no total
                      </span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {sorteios.length === 0 ? (
                        <div className="col-span-full flat-card p-12 text-center text-neutral-500 font-bold rounded border border-neutral-800">
                          Nenhum sorteio registrado no sistema.
                        </div>
                      ) : (
                        sorteios.map((s) => {
                          const parseFirebaseDate = (d: any) => {
                            if (!d) return null;
                            if (d.toDate && typeof d.toDate === "function") return d.toDate();
                            if (d instanceof Date) return d;
                            if (typeof d === "string" || typeof d === "number") return new Date(d);
                            return null;
                          };

                          const dateInicio = parseFirebaseDate(s.dataInicio);
                          const dateFim = parseFirebaseDate(s.dataFim);
                          const now = new Date();

                          // Status Temporal
                          let tempStatus: "agendado" | "ativo" | "expirado" | "concluido" = "ativo";
                          if (s.status === "sorteado") {
                            tempStatus = "concluido";
                          } else if (dateInicio && now < dateInicio) {
                            tempStatus = "agendado";
                          } else if (dateFim && now > dateFim) {
                            tempStatus = "expirado";
                          }

                          // Porcentagem de tempo decorrido
                          let progressPercent = 0;
                          if (s.status === "sorteado" || tempStatus === "concluido") {
                            progressPercent = 100;
                          } else if (dateInicio && dateFim) {
                            const totalTime = dateFim.getTime() - dateInicio.getTime();
                            const elapsed = now.getTime() - dateInicio.getTime();
                            if (totalTime > 0) {
                              progressPercent = Math.max(0, Math.min(100, (elapsed / totalTime) * 100));
                            }
                          }

                          return (
                            <div
                              key={s.id}
                              className={`flat-card rounded flex flex-col justify-between transition-all overflow-hidden border bg-neutral-950 hover:shadow-[0_0_20px_rgba(245,245,0,0.03)] ${
                                s.status === "sorteado"
                                  ? "border-emerald-500/20 bg-emerald-950/5 hover:border-emerald-500/30"
                                  : tempStatus === "expirado"
                                  ? "border-red-500/20 bg-red-950/5"
                                  : tempStatus === "agendado"
                                  ? "border-blue-500/20 bg-blue-950/5"
                                  : "border-neutral-800 hover:border-neutral-700"
                              }`}
                            >
                              {/* Photo Banner */}
                              <div className="relative h-36 w-full overflow-hidden border-b border-neutral-900 group">
                                <img
                                  src={s.imagemUrl || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80"}
                                  alt={s.titulo}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                                
                                {/* Temporal status badge absolute top-3 right-3 */}
                                <div className="absolute top-3 right-3">
                                  <span className={`px-2.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-lg ${
                                    tempStatus === "concluido"
                                      ? "bg-emerald-950/80 border-emerald-500/20 text-emerald-400"
                                      : tempStatus === "expirado"
                                      ? "bg-red-950/80 border-red-500/20 text-red-400"
                                      : tempStatus === "agendado"
                                      ? "bg-blue-950/80 border-blue-500/20 text-blue-400"
                                      : "bg-primary/90 border-primary/20 text-black font-black"
                                  }`}>
                                    <span className={`w-1 h-1 rounded-full ${
                                      tempStatus === "concluido" ? "bg-emerald-400" : tempStatus === "expirado" ? "bg-red-400" : tempStatus === "agendado" ? "bg-blue-400" : "bg-black"
                                    }`} />
                                    {tempStatus === "concluido" ? "Concluído" : tempStatus === "expirado" ? "Expirado" : tempStatus === "agendado" ? "Agendado" : "Ativo"}
                                  </span>
                                </div>
                              </div>

                              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                                <div className="space-y-2">
                                  <h4 className="font-display font-black text-sm uppercase text-white tracking-wider line-clamp-1">{s.titulo}</h4>
                                  <p className="text-[10px] text-neutral-400 leading-relaxed line-clamp-2">{s.descricao}</p>

                                  {/* Period Section */}
                                  {(dateInicio || dateFim) && (
                                    <div className="flex items-center gap-1 py-1 text-[9px] text-neutral-500 font-bold uppercase">
                                      <Calendar size={10} className="text-neutral-600" />
                                      <span>
                                        {dateInicio ? dateInicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "N/A"}
                                        {dateInicio && ` às ${dateInicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {dateFim ? dateFim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "N/A"}
                                        {dateFim && ` às ${dateFim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                                      </span>
                                    </div>
                                  )}

                                  {/* Visual Progress Bar */}
                                  {(dateInicio || dateFim) && (
                                    <div className="space-y-1 pt-1">
                                      <div className="flex justify-between text-[8px] font-black uppercase text-neutral-500">
                                        <span>Validade do Sorteio</span>
                                        <span>{progressPercent.toFixed(0)}%</span>
                                      </div>
                                      <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden border border-neutral-800/60">
                                        <div
                                          style={{ width: `${progressPercent}%` }}
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            tempStatus === "concluido" ? "bg-emerald-500" : tempStatus === "expirado" ? "bg-red-500" : tempStatus === "agendado" ? "bg-blue-500" : "bg-primary"
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-3 border-t border-neutral-900 flex items-center justify-between text-[10px]">
                                  {s.status === "sorteado" ? (
                                    <div className="space-y-0.5 w-full">
                                      <p className="text-neutral-500 font-bold uppercase tracking-wider text-[8px]">Ganhador(a) 👑</p>
                                      <p className="font-black text-emerald-400 uppercase text-xs truncate">
                                        {s.ganhadorNome}
                                      </p>
                                    </div>
                                  ) : (
                                    <>
                                      <div>
                                        <p className="text-neutral-500 font-bold uppercase tracking-wider text-[8px]">Elegíveis</p>
                                        <p className="font-black text-white text-xs mt-0.5 flex items-center gap-1">
                                          <Users size={12} className="text-neutral-500" />
                                          {s.participantes.length}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleSortearAgora(s)}
                                        disabled={tempStatus === "agendado"}
                                        className={`py-1.5 px-3 rounded font-black flex items-center gap-1.5 shadow transition-all cursor-pointer ${
                                          tempStatus === "agendado"
                                            ? "bg-neutral-900 border border-neutral-800 text-neutral-500 cursor-not-allowed"
                                            : "bg-primary hover:bg-primary-hover text-black scale-100 hover:scale-[1.03] active:scale-[0.98]"
                                        }`}
                                      >
                                        <Gift size={12} />
                                        Sortear
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 5: USUÁRIOS */}
              {activeTab === "usuarios" && (
                <div className="space-y-6">
                  {/* Busca e Filtros */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-lg bg-neutral-950 border border-neutral-900">
                    <div className="space-y-1">
                      <h3 className="font-display font-black text-sm uppercase tracking-wider text-white">
                        Base de Usuários
                      </h3>
                      <p className="text-[10px] sm:text-xs text-neutral-400">
                        Consulte e gerencie os usuários cadastrados na plataforma (CPF parcialmente oculto por segurança).
                      </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full xl:max-w-xl">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                        <input
                          type="text"
                          placeholder="Buscar por Nome, Email ou CPF..."
                          value={usuariosSearch}
                          onChange={(e) => {
                            setUsuariosSearch(e.target.value);
                            setUsuariosCurrentPage(1);
                          }}
                          className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm premium-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Listagem em Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedUsuarios.length === 0 ? (
                      <div className="col-span-full flat-card p-12 text-center text-neutral-500 font-bold rounded border border-neutral-800">
                        Nenhum usuário encontrado.
                      </div>
                    ) : (
                      paginatedUsuarios.map((u) => (
                        <div key={u.id} className="flat-card p-5 rounded border border-neutral-800 bg-neutral-950/50 flex flex-col gap-3 relative overflow-hidden group hover:border-neutral-700 transition-colors">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                          <div className="pl-2">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-[8px] text-neutral-500 font-black uppercase tracking-wider block">ID do Usuário</span>
                                <span className="font-display font-black text-xs text-neutral-300 tracking-wider truncate block max-w-[150px]" title={u.id}>{u.id}</span>
                              </div>
                              {u.role === "admin" && (
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-primary/10 border-primary/20 text-primary">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div>
                                <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">Nome</span>
                                <span className="font-bold text-white uppercase">{u.nome || "Não informado"}</span>
                              </div>
                              <div>
                                <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">Email</span>
                                <span className="text-neutral-400">{u.email}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-neutral-900/50">
                                <div>
                                  <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">CPF</span>
                                  <span className="text-neutral-400 font-mono">{maskCpf(u.cpf)}</span>
                                </div>
                                <div>
                                  <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">Nascimento</span>
                                  <span className="text-neutral-400">{u.dataNascimento || "---"}</span>
                                </div>
                              </div>
                              <div className="pt-2">
                                <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider block">Telefone</span>
                                <span className="text-neutral-400">{u.telefone || "---"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Paginação */}
                  {totalPagesUsuarios > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-neutral-900 text-xs">
                      <p className="text-neutral-500 font-bold uppercase tracking-wider">
                        Exibindo de {((activeUsuariosPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(activeUsuariosPage * ITEMS_PER_PAGE, totalFilteredUsuarios)} de {totalFilteredUsuarios} usuários encontrados
                      </p>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setUsuariosCurrentPage((p) => Math.max(p - 1, 1))}
                          disabled={activeUsuariosPage === 1}
                          className="p-2 rounded border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center space-x-1">
                          {Array.from({ length: totalPagesUsuarios }).map((_, index) => {
                            const pIndex = index + 1;
                            const isCurrent = pIndex === activeUsuariosPage;
                            if (pIndex !== 1 && pIndex !== totalPagesUsuarios && Math.abs(pIndex - activeUsuariosPage) > 2) {
                              if (pIndex === 2 || pIndex === totalPagesUsuarios - 1) {
                                return <span key={pIndex} className="text-neutral-700 font-bold px-1 select-none">...</span>;
                              }
                              return null;
                            }

                            return (
                              <button
                                key={pIndex}
                                onClick={() => setUsuariosCurrentPage(pIndex)}
                                className={`px-3 py-1.5 rounded text-xs font-black select-none cursor-pointer ${
                                  isCurrent
                                    ? "bg-primary text-black"
                                    : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
                                }`}
                              >
                                {pIndex}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => setUsuariosCurrentPage((p) => Math.min(p + 1, totalPagesUsuarios))}
                          disabled={activeUsuariosPage === totalPagesUsuarios}
                          className="p-2 rounded border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <Footer />

      {/* ---------------- SETTINGS MODAL ---------------- */}
      <AnimatePresence>
        {isSettingsModalOpen && editingConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-display font-black uppercase tracking-tight text-white">
                  Ajustes <span className="text-primary">Globais</span>
                </h2>
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Total de Ingressos (Sistema)</label>
                    <input
                      type="number"
                      value={editingConfig.totalTickets}
                      onChange={(e) => setEditingConfig({ ...editingConfig, totalTickets: Number(e.target.value) })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Vagas de Estacionamento</label>
                    <input
                      type="number"
                      value={editingConfig.parkingSpots}
                      onChange={(e) => setEditingConfig({ ...editingConfig, parkingSpots: Number(e.target.value) })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Preço Estacionamento (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingConfig.parkingPrice}
                      onChange={(e) => setEditingConfig({ ...editingConfig, parkingPrice: Number(e.target.value) })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>
                
                <div className="border-t border-neutral-900 pt-6 space-y-4">
                  <h3 className="text-sm font-bold text-neutral-300 uppercase">Autorização por Idade</h3>
                  <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-400 uppercase">Sistema Ativado</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={editingConfig.ageAuthorization?.enabled || false}
                          onChange={(e) =>
                            setEditingConfig({
                              ...editingConfig,
                              ageAuthorization: {
                                ...(editingConfig.ageAuthorization || { minAge: 18 }),
                                enabled: e.target.checked,
                              },
                            })
                          }
                        />
                        <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                    {editingConfig.ageAuthorization?.enabled && (
                      <div className="space-y-2 pt-2 border-t border-neutral-800">
                        <label className="text-xs font-bold text-neutral-400 uppercase">A partir de que idade deve pedir autorização?</label>
                        <input
                          type="number"
                          value={editingConfig.ageAuthorization?.minAge || 18}
                          onChange={(e) =>
                            setEditingConfig({
                              ...editingConfig,
                              ageAuthorization: {
                                ...(editingConfig.ageAuthorization || { enabled: true }),
                                minAge: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-neutral-900 pt-6 space-y-4">
                  <h3 className="text-sm font-bold text-neutral-300 uppercase">Configuração de Lotes</h3>
                  {editingConfig.lotes.map((lote, index) => (
                    <div key={lote.id} className="p-4 bg-neutral-900/50 border border-neutral-800 rounded space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">{lote.nome}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-neutral-400 uppercase">Valor (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={lote.valor}
                            onChange={(e) => {
                              const newLotes = [...editingConfig.lotes];
                              newLotes[index].valor = Number(e.target.value);
                              setEditingConfig({ ...editingConfig, lotes: newLotes });
                            }}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-neutral-400 uppercase">Máx. Vendas (Vazio = Ilimitado)</label>
                          <input
                            type="number"
                            value={lote.maxVendas || ""}
                            onChange={(e) => {
                              const newLotes = [...editingConfig.lotes];
                              newLotes[index].maxVendas = e.target.value ? Number(e.target.value) : null;
                              setEditingConfig({ ...editingConfig, lotes: newLotes });
                            }}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            placeholder="Ilimitado"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="px-4 py-2 rounded text-sm font-bold text-neutral-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={settingsLoading}
                    className="px-4 py-2 bg-primary text-black rounded text-sm font-black uppercase hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {settingsLoading ? "Salvando..." : "Salvar Alterações"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------- FLOATING PREMIUM TOAST SYSTEM ---------------- */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const isSuccess = toast.type === "success";
            const isError = toast.type === "error";
            const isWarning = toast.type === "warning";
            
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 30, scale: 0.92, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, scale: 0.95, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`pointer-events-auto p-4 rounded border shadow-2xl backdrop-blur-md flex gap-3 items-start select-none ${
                  isSuccess
                    ? "bg-emerald-950/70 border-emerald-500/20 text-emerald-100"
                    : isError
                    ? "bg-red-950/70 border-red-500/20 text-red-100"
                    : isWarning
                    ? "bg-amber-950/70 border-amber-500/20 text-amber-100"
                    : "bg-neutral-900/80 border-neutral-800 text-neutral-100"
                }`}
              >
                {/* Icon wrapper */}
                <div className={`p-1.5 rounded-md flex items-center justify-center flex-shrink-0 ${
                  isSuccess
                    ? "bg-emerald-500/10 text-emerald-400"
                    : isError
                    ? "bg-red-500/10 text-red-400"
                    : isWarning
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-primary/10 text-primary"
                }`}>
                  {isSuccess && <CheckCircle2 size={16} />}
                  {isError && <XCircle size={16} />}
                  {isWarning && <AlertTriangle size={16} />}
                  {!isSuccess && !isError && !isWarning && <Sparkles size={16} />}
                </div>

                <div className="flex-1 space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    {isSuccess ? "Sucesso" : isError ? "Erro" : isWarning ? "Aviso" : "Notificação"}
                  </p>
                  <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
                </div>

                {/* Dismiss X button */}
                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="text-neutral-500 hover:text-white transition-colors cursor-pointer text-xs font-bold uppercase select-none flex-shrink-0 mt-0.5"
                >
                  ✕
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
