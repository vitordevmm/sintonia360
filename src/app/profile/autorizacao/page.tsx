"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { ArrowLeft, Printer, ShieldAlert, FileText, Loader2, Info } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { getBirthDateFromCPF } from "@/lib/utils";
import { toast } from "sonner";

interface UserProfile {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  dataNascimento?: string;
  role: string;
}

const formatCPF = (val: string) => {
  return val
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

export default function AutorizacaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const formatInputCPF = (val: string) => {
    const numbers = val.replace(/\D/g, "");
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const formatInputPhone = (val: string) => {
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

  const calculateAge = (birthDateString?: string): number => {
    if (!birthDateString) return 0;
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login?redirect=/profile/autorizacao");
        return;
      }

      setUser(currentUser);

      try {
        let profileData: UserProfile | null = null;
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
            console.warn("Erro ao buscar email do servidor no Autorizacao:", err);
          }
          if (!userDoc || !userDoc.exists()) {
            try {
              userDoc = await getDocFromServer(doc(db, "usuarios", currentUser.uid));
            } catch (err) {
              console.warn("Erro ao buscar uid do servidor no Autorizacao:", err);
            }
          }
        }

        if (userDoc && userDoc.exists()) {
          profileData = userDoc.data() as UserProfile;
        } else {
          // Tentar do localStorage
          const cached = localStorage.getItem(`user_profile_${currentUser.uid}`) ||
            (currentUser.email ? localStorage.getItem(`user_profile_${currentUser.email.toLowerCase()}`) : null);
          if (cached) {
            profileData = JSON.parse(cached);
          }
        }

        if (profileData && !profileData.dataNascimento) {
          profileData.dataNascimento = getBirthDateFromCPF(profileData.cpf);
        }

        setProfile(profileData);
      } catch (error) {
        console.error("Erro ao buscar dados do perfil:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleDownloadPDF = () => {
    const originalTitle = document.title;
    document.title = `Autorização Sintonia 360 para Menor: ${profile?.nome || "Sintonia"}`;
    toast.success("Preparando o documento para impressão/PDF...");
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center">
        <Loader2 size={36} className="text-primary animate-spin mb-4" />
        <p className="text-xs font-black tracking-widest text-neutral-400 uppercase">
          Carregando Autorização...
        </p>
      </div>
    );
  }

  const age = profile?.dataNascimento ? calculateAge(profile.dataNascimento) : 0;
  const isMinor = age < 16;

  return (
    <div className="min-h-screen bg-[#070707] text-white font-sans antialiased print:bg-white print:text-black">
      {/* Estilos específicos para Impressão */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            margin: 0;
            size: A4;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20mm !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .watermark-img {
            opacity: 0.08 !important;
            filter: grayscale(1) !important;
          }
        }
      `}</style>

      {/* Painel no-print de Configuração (Lado Esquerdo na Tela / Escondido no PDF) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:max-w-none">
        <div className="flex flex-col lg:flex-row gap-8 print:block print:gap-0">
          {/* Formulário Interativo do Responsável */}
          <div className="no-print w-full lg:w-96 space-y-6">
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 text-xs font-black tracking-wider uppercase text-neutral-400 hover:text-white transition-all"
            >
              <ArrowLeft size={14} />
              Voltar ao Perfil
            </Link>

            <div className="flat-card p-6 rounded border border-neutral-800 space-y-6">
              <div>
                <span className="text-[9px] tracking-widest font-black text-primary uppercase">
                  GHVE EVENTOS
                </span>
                <h1 className="font-display font-black text-xl uppercase text-white mt-1">
                  Gerador de Autorização
                </h1>
                <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed font-medium">
                  Preencha os dados abaixo dos responsáveis legais do menor. O documento no painel ao lado será atualizado em tempo real.
                </p>
              </div>

              {/* Dica para PDF */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded flex gap-2.5 items-start">
                <Info size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-neutral-300 leading-normal font-medium">
                  <strong>Dica de PDF:</strong> Ao clicar em Imprimir, na tela de destino selecione <strong>"Salvar como PDF"</strong> para salvar o documento digitalizado.
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Para gerar a autorização, basta clicar no botão abaixo. O documento será baixado e as informações do responsável devem ser <strong>preenchidas à mão</strong>.
                </p>
              </div>

              <button
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
                className="w-full py-3.5 px-6 rounded bg-primary hover:bg-primary-hover text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Gerando PDF para Download...
                  </>
                ) : (
                  <>
                    <FileText size={14} />
                    Baixar Autorização (PDF)
                  </>
                )}
              </button>
            </div>

            {!isMinor && (
              <div className="p-4 bg-red-950/20 border border-red-500/20 rounded flex gap-2.5 items-start text-red-400">
                <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Aviso:</strong> De acordo com os seus dados cadastrais, você já possui **16 anos ou mais** e não necessita de autorização de menores para ingressar no evento.
                </p>
              </div>
            )}
          </div>

          {/* Visualização Realista da Folha A4 (Lado Direito na Tela / Conteúdo Completo no PDF) */}
          <div className="flex-1 w-full overflow-x-auto flex justify-start lg:justify-center py-4 px-2 select-none md:select-text print:p-0 print:m-0 print:block print:overflow-visible">
            <div id="capture-container" className="print-container bg-white text-black shadow-2xl border border-neutral-200 w-[210mm] min-h-[297mm] p-[20mm] relative flex flex-col justify-between font-sans leading-relaxed box-border select-text flex-shrink-0 mx-auto print:shadow-none print:border-none">

              {/* Marca d'Água Centrada GHVE Eventos */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none z-0">
                <img
                  src="/logo_sintonia.png"
                  alt="Sintonia Watermark"
                  className="watermark-img w-[480px] opacity-[0.06] grayscale filter scale-110 -rotate-12"
                />
              </div>

              {/* Conteúdo Interno do Documento (Superior ao Watermark) */}
              <div className="relative z-10 flex flex-col justify-between h-full min-h-[257mm]">
                <div>
                  {/* Cabeçalho do Documento */}
                  <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-8">
                    <div>
                      <h2 className="text-[20px] font-black tracking-tight uppercase leading-none font-display">
                        GHVE EVENTOS
                      </h2>
                      <p className="text-[9px] tracking-widest text-neutral-600 font-bold uppercase mt-1">
                        SINTONIA 360 • TERMO DE RESPONSABILIDADE
                      </p>
                    </div>
                    <img
                      src="/logo_ghve.jpg"
                      alt="Logo GHVE"
                      className="h-10 w-auto border border-neutral-200"
                    />
                  </div>

                  {/* Título Principal */}
                  <h3 className="text-center font-black text-md tracking-wider uppercase mb-8 leading-snug">
                    AUTORIZAÇÃO DE ENTRADA E TERMO DE RESPONSABILIDADE CIVIL E CRIMINAL
                    <br />
                    <span className="text-[12px] font-bold tracking-normal normal-case">
                      (Para menores de 16 anos desacompanhados ou acompanhados de terceiros)
                    </span>
                  </h3>

                  {/* Corpo do Termo */}
                  <div className="text-[12px] space-y-4 text-justify leading-relaxed">
                    <p>
                      Eu, <strong className="border-b border-black inline-block px-1 min-w-[250px] text-center font-bold">__________________________________________________</strong>,
                      portador(a) do documento de identidade RG nº <strong className="border-b border-black inline-block px-1 min-w-[120px] text-center font-bold">____________________</strong> e
                      inscrito(a) no CPF/MF sob o nº <strong className="border-b border-black inline-block px-1 min-w-[140px] text-center font-bold">____________________</strong>,
                      na qualidade de responsável legal (genitor, tutor, curador ou guardião) do(a) menor de idade
                      <strong className="border-b border-black inline-block px-1 min-w-[280px] text-center font-bold">{profile?.nome || "__________________________________________________"}</strong>,
                      nascido(a) em <strong className="border-b border-black inline-block px-1 min-w-[100px] text-center font-bold">{profile?.dataNascimento ? new Date(profile.dataNascimento + "T00:00:00").toLocaleDateString("pt-BR") : "____/____/______"}</strong>,
                      contando atualmente com <strong className="border-b border-black inline-block px-1 min-w-[30px] text-center font-bold">{age || "__"}</strong> anos de idade, e portador(a) do CPF nº
                      <strong className="border-b border-black inline-block px-1 min-w-[140px] text-center font-bold">{profile ? formatCPF(profile.cpf) : "____________________"}</strong>,
                      <strong> AUTORIZO</strong> expressamente a sua entrada, permanência e circulação nas dependências do evento
                      <strong> SINTONIA 360</strong>, a realizar-se sob a promoção e organização da **GHVE EVENTOS**.
                    </p>

                    {/* Cláusulas de Isenção */}
                    <div className="space-y-3 mt-6">
                      <h4 className="font-bold uppercase text-[11px] tracking-wide border-b border-neutral-300 pb-1">
                        CLÁUSULAS DE DECLARAÇÃO E ISENÇÃO DE RESPONSABILIDADE DA ORGANIZAÇÃO
                      </h4>

                      <p className="text-[11px]">
                        <strong>1. DA RESPONSABILIDADE INTEGRAL DOS PAIS:</strong> Na qualidade de pai/mãe ou responsável legal, declaro ter plena ciência das características do evento (festival de música e audiovisual), seu horário de funcionamento e local, assumindo inteira e exclusiva responsabilidade civil, penal e moral por todas as condutas, ações, segurança física e integridade física do(a) referido(a) menor de idade durante o período em que ele(a) permanecer no evento.
                      </p>

                      <p className="text-[11px]">
                        <strong>2. DA ISENÇÃO DA ORGANIZAÇÃO:</strong> Exonero expressamente a **GHVE EVENTOS**, seus diretores, sócios, patrocinadores, organizadores, prestadores de serviços e demais colaboradores de toda e qualquer responsabilidade civil ou criminal por quaisquer incidentes, acidentes de qualquer natureza, perdas, furtos, extravios de bens pessoais, lesões físicas, danos morais ou estéticos que o(a) menor venha a sofrer ou a causar a terceiros nas dependências do evento ou no percurso de ida e volta deste.
                      </p>

                      <p className="text-[11px]">
                        <strong>3. DO COMPORTAMENTO E LEGISLAÇÃO:</strong> Comprometo-me a orientar o(a) menor a manter conduta condizente com a ordem pública e a respeitar todas as orientações da equipe técnica e de segurança privada do local. Declaro-me ciente de que é **expressamente proibido** o fornecimento, venda ou consumo de bebidas alcoólicas, cigarros ou quaisquer substâncias entorpecentes a menores de 18 anos, nos termos do Estatuto da Criança e do Adolescente (ECA), sujeitando o infrator às sanções legais.
                      </p>

                      <p className="text-[11px]">
                        <strong>4. DO ACOMPANHAMENTO:</strong> Declaro ainda que o menor está autorizado a frequentar o evento desacompanhado, portando este termo assinado em conjunto com documento de identificação original com foto.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bloco de Assinaturas e Data */}
                <div className="space-y-6 mt-8">
                  <p className="text-[12px] text-right font-medium">
                    Localidade e data: ________________________, ______ de _________________ de 2026.
                  </p>

                  <div className="grid grid-cols-2 gap-8 pt-8">
                    <div className="space-y-1.5 text-center">
                      <div className="border-t border-black w-full mx-auto"></div>
                      <p className="text-[11px] font-bold uppercase">Assinatura do Responsável Legal</p>
                      <p className="text-[10px] text-neutral-600">CPF: _____________________</p>
                      <p className="text-[10px] text-neutral-600">Grau de Parentesco: _________________</p>
                    </div>

                    <div className="space-y-1.5 text-center flex flex-col justify-end">
                      <div className="border-t border-black w-full mx-auto"></div>
                      <p className="text-[11px] font-bold uppercase">Assinatura do Menor Autorizado</p>
                      <p className="text-[10px] text-neutral-600">Nome: {profile?.nome || "_____________________"}</p>
                      <p className="text-[10px] text-neutral-600">CPF: {profile ? formatCPF(profile.cpf) : "_____________________"}</p>
                    </div>
                  </div>

                  {/* Notas de Validação da Portaria */}
                  <div className="mt-8 p-3 border border-neutral-300 bg-neutral-50/50 rounded space-y-1">
                    <p className="text-[9px] font-bold uppercase text-neutral-600">INSTRUÇÕES PARA VALIDAÇÃO NA ENTRADA DO EVENTO:</p>
                    <ul className="text-[8.5px] text-neutral-500 list-disc pl-4 space-y-0.5">
                      <li>Este documento deve ser apresentado na portaria impresso e assinado de próprio punho pelo responsável legal.</li>
                      <li>É obrigatória a apresentação de documento de identificação original oficial com foto (RG ou CNH) apenas do menor, desde que ele porte esta autorização assinada.</li>
                      <li>A assinatura deste termo não necessita de reconhecimento em cartório, mas responsabiliza legalmente o assinante.</li>
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
