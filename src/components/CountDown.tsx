"use client";

import { useEffect, useState } from "react";

interface CountDownProps {
  targetDate: string; // Ex: "2026-06-30T23:59:59"
}

export default function CountDown({ targetDate }: CountDownProps) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    dias: "00",
    horas: "00",
    minutos: "00",
    segundos: "00",
  });

  useEffect(() => {
    setMounted(true);

    const calculateTimeLeft = () => {
      const difference = +new Date(targetDate) - +new Date();
      let newTimeLeft = {
        dias: "00",
        horas: "00",
        minutos: "00",
        segundos: "00",
      };

      if (difference > 0) {
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const m = Math.floor((difference / 1000 / 60) % 60);
        const s = Math.floor((difference / 1000) % 60);

        newTimeLeft = {
          dias: d < 10 ? `0${d}` : `${d}`,
          horas: h < 10 ? `0${h}` : `${h}`,
          minutos: m < 10 ? `0${m}` : `${m}`,
          segundos: s < 10 ? `0${s}` : `${s}`,
        };
      }

      setTimeLeft(newTimeLeft);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  // Evita Hydration Error em Server Side Rendering
  if (!mounted) {
    return (
      <div className="flex gap-4 items-center justify-center animate-pulse opacity-50">
        {["DIAS", "HORAS", "MIN", "SEG"].map((label) => (
          <div key={label} className="flex flex-col items-center">
            <div className="w-16 h-16 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <span className="font-display font-black text-2xl text-neutral-600">--</span>
            </div>
            <span className="text-[10px] tracking-widest text-neutral-500 font-bold mt-2">{label}</span>
          </div>
        ))}
      </div>
    );
  }

  const timeBlocks = [
    { label: "DIAS", val: timeLeft.dias },
    { label: "HORAS", val: timeLeft.horas },
    { label: "MIN", val: timeLeft.minutos },
    { label: "SEG", val: timeLeft.segundos, highlight: true },
  ];

  return (
    <div className="flex gap-3 sm:gap-4 items-center justify-center">
      {timeBlocks.map((block) => (
        <div key={block.label} className="flex flex-col items-center">
          <div
            className={`w-14 h-14 sm:w-20 sm:h-20 rounded flex items-center justify-center transition-all duration-300 ${
              block.highlight
                ? "bg-primary text-black border border-primary"
                : "bg-neutral-950/70 border border-neutral-800 text-white"
            }`}
          >
            <span className="font-display font-black text-xl sm:text-4xl tracking-tighter">
              {block.val}
            </span>
          </div>
          <span
            className={`text-[9px] sm:text-[11px] tracking-widest font-black mt-2.5 ${
              block.highlight ? "text-primary" : "text-neutral-500"
            }`}
          >
            {block.label}
          </span>
        </div>
      ))}
    </div>
  );
}
