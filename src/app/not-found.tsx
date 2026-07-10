"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Compass, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-20 px-4 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#F5F500]/5 blur-[100px] pointer-events-none"></div>

        <div className="max-w-md w-full text-center space-y-8 z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            {/* Icon */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="p-5 bg-neutral-900 border border-neutral-800 text-primary rounded-full mb-6 shadow-xl"
            >
              <Compass size={48} className="stroke-[1.5]" />
            </motion.div>

            <span className="text-[10px] tracking-[0.3em] font-black text-primary uppercase">
              ERRO 404
            </span>
            <h1 className="font-display font-black text-4xl sm:text-5xl uppercase tracking-tight mt-2 text-white">
              PÁGINA NÃO <span className="text-primary">ENCONTRADA</span>
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm font-medium mt-4 leading-relaxed uppercase tracking-wider">
              O endereço acessado não existe ou foi movido. Use o botão abaixo para retornar de forma segura.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="pt-2"
          >
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary hover:bg-primary-hover text-black font-black uppercase text-xs tracking-widest transition-all duration-200 shadow-lg shadow-primary/10 border border-primary w-full sm:w-auto cursor-pointer"
            >
              Voltar ao Início
              <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
