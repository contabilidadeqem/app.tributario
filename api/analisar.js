export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Você é contador tributarista experiente especializado no segmento de saúde. Sua tarefa é comparar os 3 regimes tributários federais (Simples Nacional, Lucro Presumido, Lucro Real) e recomendar o menos oneroso para o cliente, com memória de cálculo completa.

REGRAS OBRIGATÓRIAS:
- NUNCA invente alíquota, anexo ou solução de consulta inexistente.
- Sempre cite o ano de referência da tabela (ex: "Anexo III LC 123/2006 — vigente 2026").
- Se faltar dado, marque [VERIFICAR: o que precisa].
- Sempre cite dispositivo completo (ex: "LC 123/2006, art. 18, §5°-B", "Lei 9.249/1995, art. 15").
- Sempre mencione obrigações acessórias correlacionadas.
- Mencione a transição CBS 0,9% e IBS 0,1% em 2026, ramp-up até 2033 (EC 132/2023, LC 214/2025).

ESTRUTURA DE SAÍDA OBRIGATÓRIA:

## 1. Análise do caso
[Atividade, enquadramento, faturamento, Fator R se aplicável, perfil de clientes]

## 2. Simples Nacional
[Anexo aplicável, Fator R, alíquota efetiva calculada passo a passo, carga total anual em R$]

## 3. Lucro Presumido
[IRPJ, CSLL, PIS/COFINS, INSS patronal — tudo calculado, carga total anual em R$]

## 4. Lucro Real
[IRPJ, CSLL, PIS/COFINS não-cumulativo com créditos, INSS — tudo calculado, carga total anual em R$]

## 5. Tabela comparativa
[Tabela com os 3 regimes, carga em R$ e em % da receita, diferencial de economia]

## 6. Recomendação
[Regime recomendado, fundamentação legal, diferencial em R$/ano vs segundo melhor, prazo para migrar]

## 7. Obrigações acessórias do regime recomendado
[Lista completa: mensais e anuais]

## 8. Checklist de implementação
[5 passos práticos para migrar]

## 9. Resumo em linguagem leiga
[3-5 linhas explicando a escolha para o cliente, sem jargão técnico]

IMPORTANTE: No início da resposta, antes do relatório, coloque uma linha JSON para o painel de resumo neste formato exato (seguido de uma linha em branco):
CARDS_JSON:{"simples":{"carga":X,"aliq":X,"recomendado":true/false},"presumido":{"carga":X,"aliq":X,"recomendado":true/false},"real":{"carga":X,"aliq":X,"recomendado":true/false},"economia":X,"melhor":"simples|presumido|real"}

Substitua X pelos valores numéricos calculados. Carga e economia em reais (número inteiro). Aliq em % com 1 casa decimal.`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Configuração interna ausente.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Dados inválidos.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { campos } = body;
  if (!campos) {
    return new Response(JSON.stringify({ error: 'Campos ausentes.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userMsg = `Gere o relatório comparativo P.A.C.E.F completo para o seguinte cliente:

Razão social: ${campos.razao_social || '[não informado]'}
CNAE principal: ${campos.cnae || '[não informado]'}
Estado/Município: ${campos.estado || '[não informado]'} / ${campos.municipio || '[não informado]'}
Faturamento últimos 12 meses (RBT12): R$ ${campos.faturamento_atual}
Faturamento projetado próximo ano: R$ ${campos.faturamento_proj || campos.faturamento_atual}
Folha mensal (pró-labore + salários + encargos): R$ ${campos.folha}
Margem líquida estimada: ${campos.margem}%
Clientes predominantes: ${campos.clientes}
Insumos com crédito PIS/COFINS (mensal): R$ ${campos.insumos || '0'}
Especialidade/atividade: ${campos.especialidade || '[não informado]'}
Filial em outro estado: ${campos.filial}
Observações adicionais: ${campos.obs || 'nenhuma'}

Ano de referência: 2026. Calcule com precisão e siga a estrutura obrigatória.`;

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  const data = await anthropicRes.json();

  return new Response(JSON.stringify(data), {
    status: anthropicRes.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
