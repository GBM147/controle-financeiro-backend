const TERMOS_VERSAO_ATUAL = '2026.07';
// --- MAPA DE BANCOS (código Febraban -> nome + cor de referência) ---
const BANCOS_INFO = {
    '001': { nome: 'Banco do Brasil',  cor: '#F8DE00' },
    '033': { nome: 'Santander',        cor: '#EC0000' },
    '104': { nome: 'Caixa Econômica',  cor: '#0066B3' },
    '237': { nome: 'Bradesco',         cor: '#CC092F' },
    '341': { nome: 'Itaú',             cor: '#EC7000' },
    '260': { nome: 'Nubank',           cor: '#820AD1' },
    '077': { nome: 'Banco Inter',      cor: '#FF7A00' },
    '212': { nome: 'Banco Original',   cor: '#00AA4F' },
    '336': { nome: 'C6 Bank',          cor: '#1E1E1E' },
    '290': { nome: 'PagBank',          cor: '#00C650' },
    '756': { nome: 'Sicoob',           cor: '#6DB33F' },
    '748': { nome: 'Sicredi',          cor: '#7CB342' },
    'MANUAL': { nome: 'Manual', cor: '#8a9ba8' },
    'OUTRO': { nome: 'Outro banco', cor: '#607d8b' }
};
// --- CATEGORIAS PERSONALIZADAS (por conta/usuário) ---
const CATEGORIAS_PADRAO = [
    'Alimentação', 'Habitação', 'Transporte', 'Eletricidade / Luz',
    'Telecomunicações / Internet', 'Pagamento de Fatura', 'Pagamento de Boleto',
    'Streaming de Vídeo', 'Streaming de Música', 'Academia e Fitness',
    'Saúde', 'Educação', 'Supermercado', 'Restaurantes', 'Salário',
    'Lazer', 'Transferência', 'Crédito Cartão', 'Taxas Bancárias',
    'Igreja / Doações', 'Outros'
];

module.exports = { BANCOS_INFO, CATEGORIAS_PADRAO, TERMOS_VERSAO_ATUAL };
