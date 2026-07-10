import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Uma estrutura simples em memória para guardar IPs (ideal para instâncias únicas / Node.js puro)
const ipMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT = 20; // limite de requisições
const TIME_WINDOW_MS = 60 * 1000; // 1 minuto

export function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
  
  // Limpa IPs antigos a cada requisição (coleta de lixo simples)
  const now = Date.now();
  if (ipMap.size > 1000) {
    ipMap.clear();
  }

  const record = ipMap.get(ip);
  if (!record) {
    ipMap.set(ip, { count: 1, timestamp: now });
  } else {
    // Se o tempo passou, reseta a contagem
    if (now - record.timestamp > TIME_WINDOW_MS) {
      ipMap.set(ip, { count: 1, timestamp: now });
    } else {
      record.count += 1;
      if (record.count > RATE_LIMIT) {
        return new NextResponse(
          JSON.stringify({ error: "Muitas requisições. Tente novamente em 1 minuto." }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  return NextResponse.next();
}

// Configura o middleware para rodar apenas nas rotas sensíveis de API
export const config = {
  matcher: [
    '/api/register/validate-cpf',
    '/api/login/lookup',
    '/api/checkout'
  ],
};
