"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Lock, Mail, User, Phone, FileText, ArrowRight, Loader2, AlertCircle, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

// Subcomponente contendo o formulário que consome useSearchParams
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/profile";
  
  const [activeTab, setActiveTab] = useState<"login" | "cadastro">("login");
  const [loading, setLoading] = useState(false);
  
  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState(""); // E-mail, CPF ou Celular
  const [loginPassword, setLoginPassword] = useState("");
  
  // Cadastro Form States
  const [cadCpf, setCadCpf] = useState("");
  const [cadEmail, setCadEmail] = useState("");
  const [cadTelefone, setCadTelefone] = useState("");
  const [cadSenha, setCadSenha] = useState("");
  const [cadConfirmSenha, setCadConfirmSenha] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // Fallback states caso a API do CPF falhe
  const [fallbackMode, setFallbackMode] = useState(false);
  const [cadNome, setCadNome] = useState("");
  const [cadDataNascimento, setCadDataNascimento] = useState("");
  
  const [isSearchingCpf, setIsSearchingCpf] = useState(false);
  const [welcomePopup, setWelcomePopup] = useState<{show: boolean, nome: string}>({show: false, nome: ""});

  // Redireciona se já estiver logado
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push(redirect);
      }
    });
    return () => unsubscribe();
  }, [router, redirect]);

  // Auxiliares de Máscara
  const formatCPF = (val: string) => {
    const numbers = val.replace(/\D/g, "");
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const formatPhone = (val: string) => {
    const numbers = val.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2")
        .replace(/(-\d{4})\d+?$/, "$1");
    } else {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2")
        .replace(/(-\d{4})\d+?$/, "$1");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!loginIdentifier || !loginPassword) {
      toast.error("Preencha todos os campos.");
      setLoading(false);
      return;
    }

    try {
      let emailToAuth = loginIdentifier.trim();

      // Verifica se o identificador digitado não é e-mail (não possui @)
      if (!emailToAuth.includes("@")) {
        const rawNumbers = emailToAuth.replace(/\D/g, "");
        
        if (!rawNumbers) {
          toast.error("Identificador inválido.");
          setLoading(false);
          return;
        }

        // Busca o e-mail associado de forma segura via API do servidor
        const lookupRes = await fetch("/api/login/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: rawNumbers }),
        });

        if (!lookupRes.ok) {
          if (lookupRes.status === 404) {
            toast.error("Nenhum usuário encontrado com este CPF ou Telefone.");
          } else {
            toast.error("Erro na comunicação com o servidor de autenticação.");
          }
          setLoading(false);
          return;
        }

        const lookupData = await lookupRes.json();
        emailToAuth = lookupData.email;
      }

      // Efetua autenticação no Firebase Auth
      await signInWithEmailAndPassword(auth, emailToAuth, loginPassword);
      toast.success("Login efetuado com sucesso!");
      router.push(redirect);
    } catch (error: any) {
      console.error("Erro no login:", error);
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        toast.error("Credenciais inválidas. Verifique sua senha e tente novamente.");
      } else {
        toast.error("Erro ao realizar login. Tente novamente mais tarde.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validações Básicas
    if (!cadCpf || !cadEmail || !cadSenha || !cadConfirmSenha || !cadTelefone) {
      toast.error("Preencha todos os campos obrigatórios do formulário.");
      setLoading(false);
      return;
    }

    const rawCpf = cadCpf.replace(/\D/g, "");
    if (rawCpf.length !== 11) {
      toast.error("CPF incompleto ou inválido.");
      setLoading(false);
      return;
    }

    const rawPhone = cadTelefone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      toast.error("Telefone incompleto ou inválido.");
      setLoading(false);
      return;
    }

    if (cadSenha.length < 6) {
      toast.error("A senha deve possuir no mínimo 6 caracteres.");
      setLoading(false);
      return;
    }

    if (cadSenha !== cadConfirmSenha) {
      toast.error("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      let nomeEncontrado = cadNome;
      let dataNascimentoEncontrada = cadDataNascimento;
      let idadeEncontrada: number | null = null;

      if (!fallbackMode) {
        // 0. Consultar CPF na API
        setIsSearchingCpf(true);
        const cpfRes = await fetch("/api/register/validate-cpf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: rawCpf }),
        });
        setIsSearchingCpf(false);

        if (!cpfRes.ok) {
          setFallbackMode(true);
          toast.error("Não conseguimos buscar seus dados automaticamente. Por favor, preencha seu Nome e Data de Nascimento abaixo.");
          setLoading(false);
          return;
        }

        const cpfData = await cpfRes.json();
        nomeEncontrado = cpfData.nome;
        dataNascimentoEncontrada = cpfData.dataNascimento;
        idadeEncontrada = cpfData.idade;
      } else {
        if (!cadNome || !cadDataNascimento) {
          toast.error("Preencha seu Nome Completo e Data de Nascimento.");
          setLoading(false);
          return;
        }
      }

      // 1. Verificar duplicidade de CPF e Telefone no Firestore via API segura do servidor
      const checkRes = await fetch("/api/register/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: rawCpf, telefone: rawPhone }),
      });

      if (!checkRes.ok) {
        throw new Error("Erro na comunicação com o servidor de validação.");
      }

      const checkData = await checkRes.json();
      if (checkData.exists) {
        if (checkData.field === "cpf") {
          toast.error("Este CPF já está cadastrado.");
        } else if (checkData.field === "telefone") {
          toast.error("Este Telefone já está cadastrado.");
        }
        setLoading(false);
        return;
      }

      // 3. Criar usuário no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, cadEmail.trim(), cadSenha);
      const user = userCredential.user;

      // Obter o Token de ID da sessão recém-criada para envio seguro ao servidor
      const idToken = await user.getIdToken();

      // 4. Salvar dados extras do perfil do usuário no Firestore via API segura do servidor
        const profileRes = await fetch("/api/register/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            nome: nomeEncontrado,
            cpf: rawCpf,
            email: cadEmail,
            telefone: rawPhone,
            dataNascimento: dataNascimentoEncontrada,
            idade: idadeEncontrada,
            idToken,
          }),
        });

      if (!profileRes.ok) {
        const errorData = await profileRes.json();
        throw new Error(errorData.error || "Erro ao salvar perfil do usuário no servidor.");
      }

      // Salvar no localStorage temporariamente para evitar cache lag do Firestore no client-side router
      const localProfile = {
        nome: nomeEncontrado.trim(),
        cpf: rawCpf,
        email: cadEmail.trim(),
        telefone: rawPhone,
        dataNascimento: dataNascimentoEncontrada,
        role: "user"
      };
      localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(localProfile));
      if (user.email) {
        localStorage.setItem(`user_profile_${user.email.toLowerCase()}`, JSON.stringify(localProfile));
      }

      // Show Confetti and Welcome Popup
      import("canvas-confetti").then((confetti) => {
        confetti.default({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F5F500', '#FFFFFF', '#000000']
        });
      });
      setWelcomePopup({ show: true, nome: nomeEncontrado });
      toast.success("Conta criada com sucesso!");

    } catch (error: any) {
      setIsSearchingCpf(false);
      console.error("Erro no cadastro:", error);
      if (error.code === "auth/email-already-in-use") {
        toast.error("Este e-mail já está em uso.");
      } else if (error.code === "auth/invalid-email") {
        toast.error("E-mail inválido.");
      } else {
        toast.error(error.message || "Erro ao criar conta. Tente novamente mais tarde.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10 w-full max-w-md flat-card rounded p-6 sm:p-8 border border-neutral-800 shadow-2xl"
    >
      {/* Tabs */}
      <div className="flex rounded bg-neutral-900 p-1 mb-8 border border-neutral-850">
        <button
          onClick={() => {
            setActiveTab("login");
          }}
          className={`flex-1 py-2.5 rounded text-xs sm:text-sm font-black transition-all duration-200 ${
            activeTab === "login"
              ? "bg-primary text-black"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Acessar Conta
        </button>
        <button
          onClick={() => {
            setActiveTab("cadastro");
          }}
          className={`flex-1 py-2.5 rounded text-xs sm:text-sm font-black transition-all duration-200 ${
            activeTab === "cadastro"
              ? "bg-primary text-black"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Criar Cadastro
        </button>
      </div>



      {/* Form de Login */}
      {activeTab === "login" ? (
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
              Identificador
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                <Mail size={16} />
              </span>
              <input
                type="text"
                placeholder="E-mail, CPF ou Telefone"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-3 premium-input text-sm"
                required
              />
            </div>
            <p className="text-[10px] text-neutral-500 font-medium">
              Digite seu e-mail, seu CPF (apenas números) ou celular cadastrado.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                Sua Senha
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                <Lock size={16} />
              </span>
              <input
                type="password"
                placeholder="Digite sua senha"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 premium-input text-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded bg-primary hover:bg-primary-hover text-black font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all mt-8"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Autenticando...
              </>
            ) : (
              <>
                Entrar na Conta
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      ) : (
        /* Form de Cadastro */
        <form onSubmit={handleCadastro} className="space-y-4">


          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
              CPF
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                <FileText size={16} />
              </span>
              <input
                type="text"
                placeholder="000.000.000-00"
                maxLength={14}
                value={cadCpf}
                onChange={(e) => setCadCpf(formatCPF(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 premium-input text-sm"
                required
              />
            </div>
          </div>

          {fallbackMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 pt-1"
            >
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                  Nome Completo
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Como você se chama?"
                    value={cadNome}
                    onChange={(e) => setCadNome(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 premium-input text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                  Data de Nascimento
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <Calendar size={16} />
                  </span>
                  <input
                    type="date"
                    value={cadDataNascimento}
                    onChange={(e) => setCadDataNascimento(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 premium-input text-sm [color-scheme:dark]"
                  />
                </div>
              </div>
            </motion.div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
              E-mail
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                <Mail size={16} />
              </span>
              <input
                type="email"
                placeholder="exemplo@email.com"
                value={cadEmail}
                onChange={(e) => setCadEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 premium-input text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
              WhatsApp / Celular
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                <Phone size={16} />
              </span>
              <input
                type="text"
                placeholder="(00) 00000-0000"
                maxLength={15}
                value={cadTelefone}
                onChange={(e) => setCadTelefone(formatPhone(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 premium-input text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  placeholder="Senha"
                  value={cadSenha}
                  onChange={(e) => setCadSenha(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 premium-input text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                Confirmar
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  placeholder="Confirmar"
                  value={cadConfirmSenha}
                  onChange={(e) => setCadConfirmSenha(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 premium-input text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Checkbox de Aceitar Termos customizado da marca */}
          <label className="flex items-start gap-3 pt-2 pb-1 cursor-pointer select-none">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="sr-only"
              />
              {/* Box Customizada da Marca */}
              <div className={`w-5 h-5 rounded border transition-all duration-200 flex items-center justify-center ${
                acceptTerms 
                  ? "bg-primary border-primary text-black shadow-[0_0_10px_rgba(245,245,0,0.2)]" 
                  : "bg-neutral-950 border-neutral-850 hover:border-primary"
              }`}>
                {acceptTerms && (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-3 h-3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-neutral-400 font-bold leading-normal">
              Li e concordo com os{" "}
              <Link href="/termos" className="text-primary hover:underline font-black" target="_blank">
                Termos de Uso
              </Link>{" "}
              e as políticas da plataforma.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !acceptTerms}
            className={`w-full py-3.5 px-6 rounded font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all mt-4 ${
              loading || !acceptTerms
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-60 animate-none"
                : "bg-primary hover:bg-primary-hover text-black cursor-pointer"
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {isSearchingCpf ? "Validando CPF e Buscando Dados..." : "Cadastrando..."}
              </>
            ) : (
              <>
                Registrar e Entrar
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      )}

      {/* Welcome Popup Overlay */}
      {welcomePopup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-neutral-900 border border-neutral-800 p-8 rounded shadow-2xl flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6">
              <Sparkles size={32} />
            </div>
            <h2 className="text-2xl font-black mb-2 text-white">Bem-vindo(a),</h2>
            <p className="text-xl text-primary font-bold mb-6">{welcomePopup.nome}!</p>
            <p className="text-sm text-neutral-400 mb-8">
              Seu cadastro foi realizado com sucesso. Agora você já pode garantir o seu ingresso para a melhor festa da região.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3.5 px-6 rounded bg-primary hover:bg-primary-hover text-black font-black text-sm shadow-[0_0_15px_rgba(245,245,0,0.4)] transition-all"
            >
              Comprar Bilhete
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// Componente principal que exporta com Suspense Boundary para compilação estática do Next.js
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-16 px-4 relative overflow-hidden">
        <Suspense
          fallback={
            <div className="relative z-10 w-full max-w-md flat-card rounded p-12 text-center border border-neutral-800 flex flex-col items-center justify-center">
              <Loader2 size={36} className="text-primary animate-spin mb-4" />
              <p className="text-xs font-black tracking-widest text-neutral-400 uppercase">
                Carregando Autenticação...
              </p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
