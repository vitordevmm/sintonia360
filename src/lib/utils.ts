/**
 * Utilitários gerais do sistema
 */

/**
 * Calcula uma data de nascimento estável e determinística a partir de um CPF.
 * Isso impede que usuários burlem o sistema fornecendo datas falsas no cadastro.
 * Mapeia CPFs específicos de teste para simulação.
 * 
 * @param cpf CPF completo ou apenas números
 * @returns string no formato "YYYY-MM-DD"
 */
export function getBirthDateFromCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, "");
  if (!clean || clean.length !== 11) return "2000-01-01";

  // Regra especial para o CPF de teste do Vitor Hugo para que ele possa testar com o seu aniversário real!
  if (clean === "15077370680") {
    return "2009-07-09"; // Nascido em 09/07/2009 (16 anos em 2026)
  }

  // CPFs de teste mockados
  if (clean === "12345678901") return "2013-03-10"; // Menor (13 anos)
  if (clean === "98765432109") return "2014-09-22"; // Menor (11 anos)
  if (clean === "54321678909") return "1998-05-14"; // Maior (28 anos)

  const d1 = parseInt(clean.substring(0, 2), 10);
  const d2 = parseInt(clean.substring(2, 4), 10);
  const d3 = parseInt(clean.substring(4, 7), 10);

  const day = (d1 % 28) + 1;
  const month = (d2 % 12) + 1;
  
  const lastDigit = parseInt(clean[10], 10);
  let year = 0;
  if (lastDigit % 2 === 0) {
    // Par: Adulto (nascido entre 1985 e 2008)
    year = 1985 + (d3 % 24);
  } else {
    // Ímpar: Menor de 16 anos (nascido entre 2011 e 2022)
    year = 2011 + (d3 % 12);
  }

  const dayStr = day.toString().padStart(2, "0");
  const monthStr = month.toString().padStart(2, "0");
  return `${year}-${monthStr}-${dayStr}`;
}
