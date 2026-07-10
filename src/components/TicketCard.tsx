"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, MapPin, User, FileText, CheckCircle2, Clock, XCircle, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TicketData {
  id: string;
  nomeComprador: string;
  cpfComprador: string;
  lote: string;
  valor: number;
  status: "pendente" | "aprovado" | "cancelado";
  qrCodeData: string;
  parkingQrCodeData?: string;
  numeroIngresso?: number;
  includeParking?: boolean;
  createdAt?: any;
}

export default function TicketCard({ ticket, type = "ingresso" }: { ticket: TicketData, type?: "ingresso" | "parking" }) {
  const [isDownloading, setIsDownloading] = useState(false);

  // Verifica se expirou (24h)
  const isExpired = () => {
    if (ticket.status !== "pendente" || !ticket.createdAt) return false;
    
    let createdTime: number;
    if (ticket.createdAt.toMillis) {
      createdTime = ticket.createdAt.toMillis();
    } else if (ticket.createdAt.seconds) {
      createdTime = ticket.createdAt.seconds * 1000;
    } else {
      createdTime = new Date(ticket.createdAt).getTime();
    }

    const now = Date.now();
    const hours24 = 24 * 60 * 60 * 1000;
    return (now - createdTime) > hours24;
  };

  const expired = isExpired();

  const handleDownloadTicket = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      // 1. Get the QR code SVG element
      const svgElement = document.getElementById(`qr-code-${ticket.id}`);
      if (!svgElement) {
        throw new Error("QR Code SVG não encontrado.");
      }

      // 2. Convert SVG to Data URL
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const blobURL = URL.createObjectURL(svgBlob);

      // 3. Create image element and load the QR code
      const qrImage = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = (e) => reject(e);
        qrImage.src = blobURL;
      });

      // 4. Create the high-res canvas
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível criar o contexto 2D do Canvas.");

      // Polyfill para roundRect se necessário
      if (typeof ctx.roundRect !== "function") {
        ctx.roundRect = function (x: number, y: number, w: number, h: number, r?: number | number[]) {
          let tl = 0, tr = 0, br = 0, bl = 0;
          if (typeof r === "number") {
            tl = tr = br = bl = r;
          } else if (Array.isArray(r)) {
            tl = r[0] || 0;
            tr = r[1] || 0;
            br = r[2] || 0;
            bl = r[3] || 0;
          }
          this.beginPath();
          this.moveTo(x + tl, y);
          this.lineTo(x + w - tr, y);
          this.quadraticCurveTo(x + w, y, x + w, y + tr);
          this.lineTo(x + w, y + h - br);
          this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
          this.lineTo(x + bl, y + h);
          this.quadraticCurveTo(x, y + h, x, y + h - bl);
          this.lineTo(x, y + tl);
          this.quadraticCurveTo(x, y, x + tl, y);
          this.closePath();
          return this;
        };
      }

      // --- DRAW BACKGROUND ---
      // Premium dark gradient
      const bgGrad = ctx.createRadialGradient(400, 300, 50, 600, 300, 800);
      bgGrad.addColorStop(0, "#121212");
      bgGrad.addColorStop(1, "#050505");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 600);

      // Glow effect on the left
      const glowGrad = ctx.createRadialGradient(150, 150, 0, 150, 150, 300);
      glowGrad.addColorStop(0, "rgba(245, 245, 0, 0.08)");
      glowGrad.addColorStop(1, "rgba(245, 245, 0, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, 1200, 600);

      // Subtle tech grid pattern
      ctx.fillStyle = "rgba(245, 245, 0, 0.025)";
      for (let x = 0; x < canvas.width; x += 30) {
        for (let y = 0; y < canvas.height; y += 30) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Elegant neon yellow border
      ctx.strokeStyle = "rgba(245, 245, 0, 0.8)";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 1160, 560);

      // --- DRAW TEAR-OFF DIVIDER ---
      const tearX = 860;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(tearX, 40);
      ctx.lineTo(tearX, 560);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Tear cutouts
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(tearX, 20, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(245, 245, 0, 0.8)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(tearX, 20, 24, 0, Math.PI); // Top cutout outline
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(tearX, 580, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tearX, 580, 24, Math.PI, 0); // Bottom cutout outline
      ctx.stroke();

      // --- LEFT SECTION: CONTENT ---
      // Main Title
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 52px Arial, Helvetica, sans-serif";
      let title = ticket.id === "0000" ? "INGRESSO DE TESTE" : "SINTONIA 360";
      if (type === "parking") title = "ESTACIONAMENTO";
      ctx.fillText(title, 60, 100);

      // Slogan
      ctx.fillStyle = "#F5F500";
      ctx.font = "900 12px Arial, Helvetica, sans-serif";
      ctx.fillText("UMA PRODUÇÃO GHVE EVENTOS", 60, 128);

      // Badge: APROVADO
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(620, 58, 180, 42, 6);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = "#10B981";
      ctx.font = "900 14px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✓ APROVADO", 710, 84);
      ctx.textAlign = "left"; // Reset

      // Golden divider line
      ctx.strokeStyle = "rgba(245, 245, 0, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, 160);
      ctx.lineTo(800, 160);
      ctx.stroke();

      // Details Columns: Data & Hora & Local
      // 1. Data & Hora
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "900 12px Arial, Helvetica, sans-serif";
      ctx.fillText("DATA & HORA", 60, 200);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 20px Arial, Helvetica, sans-serif";
      ctx.fillText("10 de Out, 2026", 60, 230);

      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "normal 14px Arial, Helvetica, sans-serif";
      ctx.fillText("A partir das 21h", 60, 255);

      // 2. Local
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "900 12px Arial, Helvetica, sans-serif";
      ctx.fillText("LOCAL", 440, 200);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 20px Arial, Helvetica, sans-serif";
      ctx.fillText("Capitu", 440, 230);

      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "normal 14px Arial, Helvetica, sans-serif";
      ctx.fillText("Tupaciguara, MG", 440, 255);

      // Another horizontal line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.moveTo(60, 290);
      ctx.lineTo(800, 290);
      ctx.stroke();

      // Portador Info
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "900 12px Arial, Helvetica, sans-serif";
      ctx.fillText("PORTADOR DO INGRESSO", 60, 330);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 22px Arial, Helvetica, sans-serif";
      ctx.fillText(ticket.nomeComprador, 60, 365);

      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "bold 14px Arial, Helvetica, sans-serif";
      ctx.fillText(`CPF: ${ticket.cpfComprador}`, 60, 395);

      // Lote / Setor & Valor
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "900 12px Arial, Helvetica, sans-serif";
      ctx.fillText("SETOR / LOTE", 60, 460);
      
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 18px Arial, Helvetica, sans-serif";
      ctx.fillText(type === "parking" ? "VAGA CARRO (1 VEÍCULO)" : ticket.lote.toUpperCase(), 60, 490);

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "900 12px Arial, Helvetica, sans-serif";
      ctx.fillText(type === "parking" ? "TICKET ADICIONAL" : "VALOR DO TICKET", 440, 460);

      ctx.fillStyle = "#F5F500";
      ctx.font = "900 24px Arial, Helvetica, sans-serif";
      ctx.fillText(type === "parking" ? "R$ 25.00" : `R$ ${ticket.valor.toFixed(2)}`, 440, 495);

      // --- RIGHT SECTION: QR CODE ---
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "900 12px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("INGRESSO VIRTUAL", 1020, 100);

      // Draw QR Code
      const qrSize = 220;
      const qrX = 1020 - qrSize / 2;
      const qrY = 160;

      // Draw background white container for QR code to stand out
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30, 8);
      ctx.fill();

      // Draw QR code image
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      // Ticket ID
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`ID: #${ticket.id.toUpperCase()}`, 1020, 450);

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "normal 11px Arial, Helvetica, sans-serif";
      ctx.fillText("Apresente na portaria para validação.", 1020, 490);
      ctx.fillText("Uso único e nominal.", 1020, 510);
      ctx.textAlign = "left"; // Reset

      // Clean up dynamic object URL
      URL.revokeObjectURL(blobURL);

      // 5. Trigger download of the canvas
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const cleanCpf = ticket.cpfComprador.replace(/\D/g, "");
      link.download = `${type === "parking" ? "estacionamento" : "ingresso"} - ${cleanCpf} - ${ticket.id}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Erro ao gerar ingresso:", error);
      toast.error("Houve um erro ao processar o download do ingresso. Por favor, tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aprovado":
        return "text-emerald-400 bg-emerald-950/30 border-emerald-500/30";
      case "pendente":
        return "text-amber-400 bg-amber-950/30 border-amber-500/30";
      case "cancelado":
      default:
        return "text-red-400 bg-red-950/30 border-red-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "aprovado":
        return <CheckCircle2 size={16} className="text-emerald-400" />;
      case "pendente":
        return <Clock size={16} className="text-amber-400" />;
      case "cancelado":
      default:
        return <XCircle size={16} className="text-red-400" />;
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto flat-card rounded overflow-hidden flex flex-col md:flex-row border border-neutral-800 shadow-2xl transition-all duration-300 hover:border-primary/40">
      {/* Decorações do Ticket Lateral (Bolinhas cortadas do bilhete físico) */}
      <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 rounded-full bg-black z-10 hidden md:block border-r border-neutral-800"></div>
      <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-black z-10 hidden md:block border-l border-neutral-800"></div>

      {/* Seção Principal (Dados) */}
      <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="font-sans text-[10px] tracking-widest font-black text-primary uppercase">
              {type === "parking" ? "TICKET DE ESTACIONAMENTO" : "INGRESSO VIRTUAL"}
            </span>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded border text-[10px] font-black tracking-widest ${getStatusColor(ticket.status)}`}>
              {getStatusIcon(ticket.status)}
              {ticket.status.toUpperCase()}
            </div>
          </div>
          <h3 className="font-display font-black text-2xl tracking-tighter text-white leading-tight uppercase">
            {type === "parking" ? "ESTACIONAMENTO SINTONIA 360" : ticket.id === "0000" ? "INGRESSO DE TESTE" : "SINTONIA 360"}
          </h3>
          <p className="font-sans text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-1">
            GHVE EVENTOS
          </p>
        </div>

        {/* Info Evento */}
        <div className="grid grid-cols-2 gap-4 my-6 py-4 border-y border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-400">
              <Calendar size={14} />
            </div>
            <div>
              <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">Data & Hora</p>
              <p className="text-xs text-white font-bold">10 de Out, 2026</p>
              <p className="text-[9px] text-neutral-400">A partir das 21h</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-400">
              <MapPin size={14} />
            </div>
            <div>
              <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">Local</p>
              <p className="text-xs text-white font-bold">Capitu</p>
              <p className="text-[9px] text-neutral-400">Tupaciguara, MG</p>
            </div>
          </div>
        </div>

        {/* Info Comprador */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <User size={12} className="text-neutral-500" />
            <span className="font-bold text-neutral-500 uppercase text-[9px] tracking-wider">Portador:</span>
            <span className="font-black text-white">{ticket.nomeComprador}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <FileText size={12} className="text-neutral-500" />
            <span className="font-bold text-neutral-500 uppercase text-[9px] tracking-wider">Documento:</span>
            <span className="font-bold text-neutral-200">{ticket.cpfComprador}</span>
          </div>
        </div>

        {/* Footer do Lote */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">Setor / Lote</p>
            <p className="text-xs font-black text-white uppercase mt-0.5">{type === "parking" ? "VAGA CARRO (1 VEÍCULO)" : ticket.lote}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">Valor</p>
            <p className="text-sm font-black text-primary mt-0.5">
              R$ {type === "parking" ? "25.00" : (ticket.includeParking ? (ticket.valor - 25).toFixed(2) : ticket.valor.toFixed(2))}
            </p>
          </div>
        </div>
      </div>

      {/* Linha Divisória Dotted (Rasgo de Ticket físico) */}
      <div className="w-full md:w-px border-t md:border-t-0 md:border-l border-dashed border-neutral-800 relative">
        {/* Enfeites redondos em mobile */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-black z-10 md:hidden border-b border-neutral-800"></div>
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-black z-10 md:hidden border-t border-neutral-800"></div>
      </div>

      {/* Seção Lateral (QR Code) */}
      <div className="w-full md:w-56 p-6 sm:p-8 flex flex-col items-center justify-center bg-neutral-900/20 relative">
        {ticket.status === "aprovado" ? (
          <div className="flex flex-col items-center gap-4">
            <div className="p-3 bg-white rounded border border-neutral-800">
              <QRCodeSVG
                id={`qr-code-${ticket.id}`}
                value={typeof window !== "undefined" ? `${window.location.origin}/admin/check-in?id=${ticket.id}${type === "parking" ? "&type=parking" : ""}` : (type === "parking" ? ticket.parkingQrCodeData || "" : ticket.qrCodeData)}
                size={110}
                bgColor="#FFFFFF"
                fgColor="#000000"
                level="H"
              />
            </div>
            <span className="font-mono text-[9px] tracking-widest text-neutral-500 text-center select-all">
              ID: {ticket.id === "0000" ? "#0000" : (ticket.numeroIngresso ? `#${String(ticket.numeroIngresso).padStart(4, '0')}` : ticket.id.slice(0, 10).toUpperCase() + "...")}
            </span>
            <p className="text-[9px] text-neutral-500 text-center px-2 leading-tight">
              Apresente o QR Code na portaria para validação do acesso.
            </p>
            <button
              onClick={handleDownloadTicket}
              disabled={isDownloading}
              className="mt-2 flex items-center justify-center gap-1.5 px-3 py-2 border border-primary/20 hover:border-primary/50 text-primary hover:bg-primary/5 transition-all font-bold text-[9px] uppercase tracking-wider w-full rounded"
            >
              {isDownloading ? (
                <>
                  <Loader2 size={10} className="animate-spin text-primary" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download size={10} className="text-primary" />
                  Baixar Ingresso
                </>
              )}
            </button>
          </div>
        ) : ticket.status === "pendente" && !expired ? (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-14 h-14 rounded border border-dashed border-amber-500/40 flex items-center justify-center mb-4 bg-amber-950/10">
              <Clock size={24} className="text-amber-500" />
            </div>
            <p className="text-xs font-black text-white uppercase tracking-wider">Aguardando</p>
            <p className="text-[9px] text-neutral-500 mt-2 px-2">
              Seu ingresso será liberado na hora assim que o pagamento for confirmado pela InfinitePay. Prazo máximo: 24 horas.
            </p>
          </div>
        ) : ticket.status === "pendente" && expired ? (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-14 h-14 rounded border border-dashed border-red-500/40 flex items-center justify-center mb-4 bg-red-950/10">
              <XCircle size={24} className="text-red-500" />
            </div>
            <p className="text-xs font-black text-red-500 uppercase tracking-wider">Expirado</p>
            <p className="text-[9px] text-neutral-500 mt-2 px-2">
              O tempo limite para pagamento deste ingresso esgotou.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-14 h-14 rounded border border-dashed border-red-500/40 flex items-center justify-center mb-4 bg-red-950/10">
              <XCircle size={24} className="text-red-500" />
            </div>
            <p className="text-xs font-black text-white uppercase tracking-wider">Cancelado</p>
            <p className="text-[9px] text-neutral-500 mt-2 px-2">
              Esta transação foi recusada ou cancelada.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
