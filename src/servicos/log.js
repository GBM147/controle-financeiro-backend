// Registro de erros sem dados pessoais. Objetos de erro completos podem trazer
// o SQL já preenchido (mysql2), corpos de requisição de SDKs e respostas de
// provedores; aqui ficam só nome, código, status, mensagem e o início da pilha.
const CAMPOS_TECNICOS = ['code', 'errno', 'sqlState', 'status', 'statusCode'];

function resumoErro(erro) {
    if (erro === null || erro === undefined) return { mensagem: String(erro) };
    if (typeof erro !== 'object') return { mensagem: String(erro).slice(0, 500) };
    const resumo = {};
    if (erro.name) resumo.nome = erro.name;
    const mensagem = erro.message || erro.error || erro.statusText;
    if (mensagem) resumo.mensagem = String(mensagem).slice(0, 500);
    for (const campo of CAMPOS_TECNICOS) {
        if (erro[campo] !== undefined && erro[campo] !== null) resumo[campo] = erro[campo];
    }
    if (typeof erro.stack === 'string') {
        resumo.pilha = erro.stack.split('\n').slice(1, 6).map((linha) => linha.trim());
    }
    return resumo;
}

function registrarErro(contexto, erro) {
    console.error(contexto, resumoErro(erro));
}

module.exports = { registrarErro, resumoErro };
