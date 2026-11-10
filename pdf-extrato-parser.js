require('./ia-assistente-loader');

const { GoogleGenAI } = require('@google/genai');
const { resumoErro } = require('./src/servicos/log');

// Inicializa a IA com a chave configurada no Render.
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

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
        if (!genAI) throw new Error('GEMINI_API_KEY não configurada.');

        const prompt = `
            Você é um assistente financeiro especialista em extração de dados.
            Vou te enviar o texto extraído de um extrato bancário em PDF. Ele pode estar bagunçado, com colunas fora de ordem ou em várias linhas.
            
            Sua tarefa:
            Extraia apenas as transações financeiras reais. Ignore cabeçalhos, rodapés, saldos do dia, números de página e textos informativos.
            
            Retorne ESTRITAMENTE um array JSON puro (sem markdown, sem \`\`\`json) contendo objetos com as seguintes chaves:
            - "data": A data bancária explícita da linha no formato "YYYY-MM-DD". Se o extrato usar DD/MM/AAAA, converta os componentes explicitamente. Nunca use uma data mencionada dentro da descrição, nome do estabelecimento ou histórico para substituir a data da coluna/linha bancária. Não invente datas.
            - "descricao": Preserve a descrição bancária completa da movimentação, inclusive identificadores relevantes como final de cartão ou referência. Não abrevie nem reformule o texto.
            - "valor": O valor numérico absoluto (ex: 150.50), use ponto para decimais.
            - "tipo": Exatamente "Receita" (se entrou dinheiro) ou "Despesa" (se saiu dinheiro).

            Regras de integridade:
            - Não repita uma movimentação só porque o texto do PDF aparece duplicado na camada de extração.
            - Preserve duas ocorrências quando houver duas linhas bancárias reais, mesmo que tenham data, descrição e valor iguais.
            - Débito e crédito do mesmo valor e da mesma data são movimentações distintas.
            
            Texto do extrato:
            ${texto}
        `;

        // responseMimeType pede JSON puro; a limpeza abaixo cobre respostas antigas.
        const result = await genAI.models.generateContent({
            model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', temperature: 0 }
        });
        let respostaTexto = String(result.text || '');
        
        // Limpa possíveis formatações markdown que a IA possa retornar
        respostaTexto = respostaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const transacoes = JSON.parse(respostaTexto);
        
        return { 
            transacoes, 
            reconciliacao: null, // IA foca nos lançamentos, não cruza o saldo final
            confianca: 'alta' 
        };

    } catch (error) {
        console.error('Erro ao chamar a API do Gemini:', resumoErro(error));
        return { transacoes: [], reconciliacao: null, confianca: 'baixa' };
    }
}

module.exports = { extrairTransacoesDoPdf, detectarBanco };
