"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { Menu, X, User as UserIcon, LogOut, ShieldAlert } from "lucide-react";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
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
              console.warn("Erro ao buscar email do servidor no Navbar:", err);
            }
            if (!userDoc || !userDoc.exists()) {
              try {
                userDoc = await getDocFromServer(doc(db, "usuarios", currentUser.uid));
              } catch (err) {
                console.warn("Erro ao buscar uid do servidor no Navbar:", err);
              }
            }
          }

          let role = "user";
          if (userDoc && userDoc.exists()) {
            role = userDoc.data().role;
          } else {
            // Tentar do localStorage
            const cached = localStorage.getItem(`user_profile_${currentUser.uid}`) || 
                           (currentUser.email ? localStorage.getItem(`user_profile_${currentUser.email.toLowerCase()}`) : null);
            if (cached) {
              const cachedData = JSON.parse(cached);
              role = cachedData.role || "user";
            }
          }

          const isAdminEmail = 
            currentUser.email?.toLowerCase() === "vitorhugonascimentosique@gmail.com" ||
            currentUser.email?.toLowerCase() === "henriquetranssilva@gmail.com";

          if (isAdminEmail || role === "admin") {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Erro ao buscar a role do usuário:", error);
          const isAdminEmail = 
            currentUser.email?.toLowerCase() === "vitorhugonascimentosique@gmail.com" ||
            currentUser.email?.toLowerCase() === "henriquetranssilva@gmail.com";
          if (isAdminEmail) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const navLinks = [
    { name: "Início", href: "/" },
    { name: "Sorteios", href: "/sorteios" },
    { name: "Termos", href: "/termos" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo e Parceria */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative w-28 h-12 flex items-center justify-center">
                <Image
                  src="/logo_sintonia.png"
                  alt="Sintonia 360 Logo"
                  fill
                  sizes="112px"
                  className="object-contain"
                  priority
                />
              </div>
              <div className="h-6 w-px bg-neutral-800 hidden sm:block"></div>
              <div className="relative w-16 h-8 items-center justify-center hidden sm:flex opacity-60 hover:opacity-100 transition-opacity">
                <Image
                  src="/logo_ghve.jpg"
                  alt="GHVE Eventos Logo"
                  fill
                  sizes="64px"
                  className="object-contain mix-blend-screen"
                />
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`text-xs uppercase tracking-widest font-black transition-all ${
                    isActive
                      ? "text-primary border-b-2 border-primary pb-1"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}

            {/* Admin Route Link */}
            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1.5 border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-all cursor-pointer ${
                  pathname === "/admin" ? "bg-red-500/10 border-red-500" : ""
                }`}
              >
                <ShieldAlert size={12} />
                Painel ADM
              </Link>
            )}
          </div>

          {/* User / CTA Action */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <Link
                  href="/profile"
                  className={`flex items-center gap-2 px-4 py-2 border ${
                    pathname === "/profile" ? "border-primary text-primary" : "border-neutral-800 text-white hover:border-neutral-700"
                  } text-xs font-black uppercase tracking-widest transition-all`}
                >
                  <UserIcon size={14} className={pathname === "/profile" ? "text-primary" : "text-neutral-400"} />
                  Meu Perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 text-neutral-500 hover:text-red-500 text-xs font-black uppercase tracking-widest transition-colors"
                  title="Sair da Conta"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-2 bg-primary hover:bg-primary-hover text-black font-black text-xs uppercase tracking-widest transition-all duration-200"
              >
                Minha Conta
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 focus:outline-none transition-colors"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-black border-t border-neutral-900">
          <div className="px-2 pt-2 pb-4 space-y-1 sm:px-3">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-3 py-3 text-xs font-black uppercase tracking-widest ${
                    isActive
                      ? "text-primary bg-neutral-900/50 border-l-4 border-primary"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-3 py-3 text-xs font-black uppercase tracking-widest text-red-500 bg-red-950/10 border-l-4 border-red-500 hover:bg-red-950/20 cursor-pointer"
              >
                <ShieldAlert size={14} />
                Painel ADM
              </Link>
            )}

            <div className="pt-4 pb-2 border-t border-neutral-900 mt-4 px-3 flex flex-col gap-3">
              {user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-neutral-800 text-white hover:border-neutral-700 text-xs font-black uppercase tracking-widest transition-all"
                  >
                    <UserIcon size={14} />
                    Meu Perfil
                  </Link>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-red-500/20 text-red-500 bg-red-950/10 hover:bg-red-950/20 text-xs font-black uppercase tracking-widest transition-all"
                  >
                    <LogOut size={14} />
                    Sair da Conta
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-center px-6 py-3 bg-primary hover:bg-primary-hover text-black font-black text-xs uppercase tracking-widest transition-all"
                >
                  Minha Conta
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
