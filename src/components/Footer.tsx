import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black border-t border-neutral-900 mt-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Branding */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left leading-none">
          <span className="font-display font-black text-lg tracking-tighter text-white">
            SINTONIA <span className="text-primary">360</span>
          </span>
          <span className="font-sans text-[8px] uppercase tracking-[0.2em] text-neutral-500 font-bold mt-1">
            UMA PRODUÇÃO GHVE EVENTOS
          </span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
          <Link href="/" className="text-xs text-neutral-400 hover:text-white transition-colors">
            Início
          </Link>
          <Link href="/sorteios" className="text-xs text-neutral-400 hover:text-white transition-colors">
            Sorteios Ativos
          </Link>
          <Link href="/termos" className="text-xs text-neutral-400 hover:text-white transition-colors">
            Termos & Políticas de Compra
          </Link>
        </div>

        {/* Legais / Direitos */}
        <div className="text-center md:text-right">
          <p className="text-[10px] text-neutral-500">
            &copy; {currentYear} GHVE Eventos. Todos os direitos reservados.
          </p>
          <p className="text-[9px] text-neutral-600 mt-1 max-w-xs md:max-w-none">
            Plataforma integrada com pagamentos seguros via Mercado Pago. O ingresso virtual com QR Code é enviado imediatamente após a aprovação da transação.
          </p>
        </div>
      </div>
    </footer>
  );
}
