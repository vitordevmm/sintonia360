import { NextResponse } from "next/server";

function calculateAge(birthDateString: string) {
  const today = new Date();
  const birthDate = new Date(birthDateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export async function POST(request: Request) {
  try {
    const { cpf } = await request.json();

    if (!cpf) {
      return NextResponse.json({ error: "CPF não fornecido." }, { status: 400 });
    }

    const token = process.env.CPF_API_TOKEN;
    if (!token) {
      console.error("Token da API de CPF não configurado no .env.local");
      return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    const url = `https://apicpf.com/api/consulta?cpf=${cleanCpf}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-KEY": token
      }
    });
    
    const data = await res.json();

    if (data.code === 200 && data.data) {
      let formattedDate = data.data.data_nascimento; // Formato esperado YYYY-MM-DD
      let idade = null;
      if (formattedDate) {
        idade = calculateAge(formattedDate);
      }

      return NextResponse.json({
        success: true,
        nome: data.data.nome,
        dataNascimento: formattedDate,
        idade: idade
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: data.message || "CPF Inválido ou não encontrado." 
      }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Erro ao validar CPF:", error);
    return NextResponse.json({ error: "Erro na comunicação com a API de CPF." }, { status: 500 });
  }
}
