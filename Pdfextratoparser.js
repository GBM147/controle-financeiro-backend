const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa a IA usando a chave da Render
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function detectarBanco(texto) {
    const t = texto.toLowerCase();
    if (t.includes('santander')) return 'Santander';
    if (t.includes('itaú') || t.includes('itau')) return 'Itaú';
    if (t.includes('bradesco')) return 'Bradesco';
    if (t.includes('nubank') || t.includes('nu pagamentos')) return 'Nubank';
    if (t.includes('banco do brasil') || t.includes('bb.com.br')) return 'Banco do Brasil';
    if (t.includes('caixa econômica') || t.includes('caixa.gov')) return 'Caixa Econômica';
    if (t.includes('banco inter')) return 'Banco Inter';
    if (t.includes('c6 bank')) return 'C6 Bank';
    if (t.includes('sicoob')) return 'Sicoob';
    if (t.includes('sicredi')) return 'Sicredi';
    return 'Outro banco';
}

async function extrairTransacoesDoPdf(texto) {
    try {
        // Usamos o modelo mais rápido e inteligente para essa tarefa
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const prompt = `
            Você é um assistente financeiro especialista em extração de dados.
            Vou te enviar o texto extraído de um extrato bancário em PDF. Ele pode estar bagunçado, com colunas fora de ordem ou em várias linhas.
            
            Sua tarefa:
            Extraia apenas as transações financeiras reais. Ignore cabeçalhos, rodapés, saldos do dia, números de página e textos informativos.
            
            Retorne ESTRITAMENTE um array JSON puro (sem markdown, sem \`\`\`json) contendo objetos com as seguintes chaves:
            - "data": A data da transação no formato "YYYY-MM-DD".
            - "descricao": O nome do estabelecimento ou motivo (limpo, sem números de documento).
            - "valor": O valor numérico absoluto (ex: 150.50), use ponto para decimais.
            - "tipo": Exatamente "Receita" (se entrou dinheiro) ou "Despesa" (se saiu dinheiro).
            
            Texto do extrato:
            ${texto}
        `;

        const result = await model.generateContent(prompt);
        let respostaTexto = result.response.text();
        
        // Limpa possíveis formatações markdown que a IA possa retornar
        respostaTexto = respostaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const transacoes = JSON.parse(respostaTexto);
        
        return { 
            transacoes, 
            reconciliacao: null, // IA foca nos lançamentos, não cruza o saldo final
            confianca: 'alta' 
        };

    } catch (error) {
        console.error("Erro ao chamar o Gemini API:", error);
        return { transacoes: [], reconciliacao: null, confianca: 'baixa' };
    }
}

module.exports = { extrairTransacoesDoPdf, detectarBanco };