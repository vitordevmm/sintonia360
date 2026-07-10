import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Scale, ShieldCheck, HelpCircle, Lock, Users, Database, FileText } from "lucide-react";

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        {/* Header */}
        <div className="mb-12 text-center sm:text-left">
          <span className="text-[10px] tracking-[0.25em] font-black text-primary uppercase">
            Exigências Legais e Privacidade
          </span>
          <h1 className="font-display font-black text-3xl sm:text-5xl uppercase tracking-tight mt-1 text-white">
            TERMOS DE USO E <span className="text-primary">PRIVACIDADE</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            Conformidade integral com a LGPD, transparência no tratamento de dados e regras gerais estabelecidas pela GHVE Eventos para o Sintonia 360.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 text-neutral-300 text-sm sm:text-base leading-relaxed">
          {/* Termos de Compra */}
          <section className="flat-card p-6 sm:p-8 rounded border border-neutral-800 space-y-4">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase text-white flex items-center gap-2.5">
              <Scale className="text-primary animate-pulse" size={20} />
              1. Termos de Compra e Acesso ao Festival
            </h2>
            <div className="space-y-3 font-medium text-neutral-400">
              <p>
                Os ingressos adquiridos através da plataforma oficial <strong className="text-white">Sintonia 360</strong> (uma marca da produtora <strong className="text-white">GHVE Eventos</strong>) são estritamente nominais e vinculados ao CPF do comprador fornecido no momento do cadastro.
              </p>
              <p>
                Cada ingresso gera um QR Code eletrônico criptografado e de uso único na portaria do evento. É de inteira responsabilidade do comprador a guarda e a preservação do arquivo ou imagem de seu QR Code, evitando compartilhá-lo com terceiros sob qualquer hipótese.
              </p>
              <p>
                A tolerância de entrada, as restrições de idade e os itens permitidos na arena seguirão rigidamente as diretrizes locais e a classificação indicativa do festival. A apresentação de um documento oficial de identidade com foto original e físico é obrigatória no controle de acesso para confrontar os dados nominais impressos no bilhete.
              </p>
            </div>
          </section>

          {/* LGPD e Dados Coletados */}
          <section className="flat-card p-6 sm:p-8 rounded border border-neutral-800 space-y-6">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase text-white flex items-center gap-2.5 border-b border-neutral-800 pb-3">
              <ShieldCheck className="text-primary" size={22} />
              2. Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018)
            </h2>
            <div className="space-y-4 font-medium text-neutral-400">
              <p>
                Em conformidade estrita com a **Lei Geral de Proteção de Dados Pessoais (LGPD)**, a GHVE Eventos assegura transparência, confidencialidade e segurança total no tratamento das informações enviadas por nossos usuários. Coletamos e tratamos apenas os dados essenciais para viabilizar sua participação no evento e mitigar riscos de fraudes fiscais e de segurança.
              </p>
              
              <h3 className="text-white font-bold text-sm sm:text-base uppercase flex items-center gap-2 mt-4">
                <Database className="text-primary" size={16} />
                Quais dados pessoais coletamos e por quê?
              </h3>

              <div className="grid grid-cols-1 gap-4 mt-2">
                {/* Nome */}
                <div className="p-4 bg-neutral-950/60 rounded border border-neutral-900">
                  <span className="text-white font-bold text-xs sm:text-sm block mb-1">A. NOME COMPLETO</span>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    <strong className="text-white">Finalidade:</strong> Vinculação e identificação nominal da propriedade do ingresso eletrônico.
                    <br />
                    <strong className="text-white">Justificativa Legal:</strong> Execução de contrato e segurança. O nome no ingresso deve coincidir com o documento com foto apresentado na portaria para evitar falsificações e transferências ilícitas.
                  </p>
                </div>

                {/* CPF */}
                <div className="p-4 bg-neutral-950/60 rounded border border-neutral-900">
                  <span className="text-white font-bold text-xs sm:text-sm block mb-1">B. CPF (Cadastro de Pessoas Físicas)</span>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    <strong className="text-white">Finalidade:</strong> Chave única de validação contra duplicidade de ingressos e emissão de comprovantes de transação.
                    <br />
                    <strong className="text-white">Justificativa Legal:</strong> Prevenção a fraudes financeiras e cambismo (Legítimo Interesse) e cumprimento de obrigações fiscais e tributárias legais com os órgãos competentes.
                  </p>
                </div>

                {/* Email */}
                <div className="p-4 bg-neutral-950/60 rounded border border-neutral-900">
                  <span className="text-white font-bold text-xs sm:text-sm block mb-1">C. ENDEREÇO DE E-MAIL</span>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    <strong className="text-white">Finalidade:</strong> Envio dos ingressos digitais gerados, recibos das compras, notificações de segurança e alterações de cronograma do festival.
                    <br />
                    <strong className="text-white">Justificativa Legal:</strong> Execução de contrato de prestação de serviços e canal de comunicação primário do cliente.
                  </p>
                </div>

                {/* Telefone */}
                <div className="p-4 bg-neutral-950/60 rounded border border-neutral-900">
                  <span className="text-white font-bold text-xs sm:text-sm block mb-1">D. TELEFONE / WHATSAPP</span>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    <strong className="text-white">Finalidade:</strong> Canal de contato emergencial, suporte técnico direto ao cliente e avisos de alta prioridade.
                    <br />
                    <strong className="text-white">Justificativa Legal:</strong> Legítimo Interesse para a prestação adequada de suporte e segurança ao portador do ingresso.
                  </p>
                </div>

                {/* Data de Nascimento */}
                <div className="p-4 bg-neutral-950/60 rounded border border-neutral-900">
                  <span className="text-white font-bold text-xs sm:text-sm block mb-1">E. DATA DE NASCIMENTO</span>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    <strong className="text-white">Finalidade:</strong> Validação automática e precisa da idade do usuário.
                    <br />
                    <strong className="text-white">Justificativa Legal:</strong> Cumprimento de obrigação legal e proteção a menores de idade. A data de nascimento permite verificar se o usuário é maior de 18 anos (obrigatório para consumo de bebidas alcoólicas nas áreas VIP) ou se possui menos de 16 anos. Caso o usuário tenha menos de 16 anos, o sistema exige dinamicamente o preenchimento, assinatura e download de uma **Autorização de Menor**, garantindo a conformidade com as diretrizes do Juizado da Infância e Juventude.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Segurança dos Dados e Compartilhamento */}
          <section className="flat-card p-6 sm:p-8 rounded border border-neutral-800 space-y-4">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase text-white flex items-center gap-2.5">
              <Lock className="text-primary" size={20} />
              3. Onde Armazenamos e Como Protegemos Seus Dados
            </h2>
            <div className="space-y-3 font-medium text-neutral-400">
              <p>
                Implementamos rigorosas proteções físicas, administrativas e digitais para assegurar a inviolabilidade de suas informações pessoais:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-xs sm:text-sm">
                <li>
                  <strong className="text-white">Infraestrutura Google Firebase:</strong> Os dados cadastrais e o banco de dados são hospedados em nuvem sob o protocolo de segurança de nível corporativo do Google Cloud. As credenciais de senhas de acesso passam por algoritmos robustos de hash irreversível, impedindo o acesso ou leitura direta por qualquer funcionário ou terceiros.
                </li>
                <li>
                  <strong className="text-white">Gateway de Pagamentos Mercado Pago:</strong> Todas as informações financeiras e de cartões de crédito são processadas de forma criptografada nos servidores oficiais da instituição de pagamento parceira <strong className="text-white">Mercado Pago</strong>, operando sob certificação internacional estrita <strong className="text-white">PCI-DSS</strong>. A nossa plataforma não armazena nem tem acesso às informações de pagamento do seu cartão de crédito.
                </li>
                <li>
                  <strong className="text-white">Não Compartilhamento:</strong> A GHVE Eventos assume o compromisso de nunca vender, ceder, alugar ou comercializar seus dados pessoais com nenhuma agência de marketing ou terceiros não envolvidos diretamente na execução técnica da sua compra.
                </li>
              </ul>
            </div>
          </section>

          {/* Direitos dos Usuários */}
          <section className="flat-card p-6 sm:p-8 rounded border border-neutral-800 space-y-4">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase text-white flex items-center gap-2.5">
              <Users className="text-primary" size={20} />
              4. Direitos do Titular dos Dados (Seus Direitos)
            </h2>
            <div className="space-y-3 font-medium text-neutral-400">
              <p>
                Você, como titular de seus dados pessoais, tem o direito pleno e soberano assegurado pelo Artigo 18 da LGPD de solicitar a qualquer momento:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-xs sm:text-sm">
                <li>Confirmação da existência e tratamento de seus dados na plataforma Sintonia 360;</li>
                <li>Acesso facilitado aos seus dados coletados;</li>
                <li>Correção imediata de dados incompletos, inexatos ou desatualizados (incluindo a edição própria e direta de seu campo de idade/data de nascimento no painel de perfil);</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade legal;</li>
                <li>Eliminação e exclusão total de sua conta e dados pessoais de nossos registros permanentes, ressalvadas as obrigações de guarda legal decorrentes de dados fiscais de transações de compra pendentes.</li>
              </ul>
              <p className="text-xs sm:text-sm">
                Para exercer qualquer direito de eliminação, portabilidade ou requisições complexas de dados pessoais, entre em contato direto com o suporte oficial da GHVE Eventos no WhatsApp <strong className="text-primary">(34) 99927-0907</strong> ou e-mail indicado na plataforma.
              </p>
            </div>
          </section>

          {/* Reembolso e Cancelamento */}
          <section className="flat-card p-6 sm:p-8 rounded border border-neutral-800 space-y-4">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase text-white flex items-center gap-2.5">
              <HelpCircle className="text-primary" size={20} />
              5. Política de Reembolso e Desistência
            </h2>
            <div className="space-y-3 font-medium text-neutral-400">
              <p>
                Seguindo as normas estipuladas pelo <strong className="text-white">Código de Defesa do Consumidor (Artigo 49)</strong>, o cliente tem direito ao arrependimento de compra com reembolso integral do valor pago no prazo de até <strong className="text-white">7 (sete) dias corridos</strong> a contar da data de confirmação do pagamento.
              </p>
              <p>
                <strong className="text-primary">AVISO IMPORTANTE:</strong> Visando a programação, contratação de segurança local e controle logístico das arenas, não realizaremos cancelamentos nem estornos para ingressos solicitados com prazo inferior a **48 horas antes da realização do festival**, ou após a realização do evento.
              </p>
              <p>
                Para solicitar o cancelamento e o consequente estorno da transação de forma simplificada, envie uma mensagem ao suporte oficial no WhatsApp <strong className="text-primary">(34) 99927-0907</strong> informando seu CPF e E-mail de cadastro. Para pagamentos realizados via Pix, o reembolso é liquidado na mesma conta bancária de origem instantaneamente após a confirmação.
              </p>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
