// =======================================================
// auth.js — wrapper de fetch que trata sessão expirada automaticamente
// =======================================================
// Uso: troque fetch(url, opcoes) por fetchApi(url, opcoes) em qualquer
// chamada para uma rota que exige login.
// Se o servidor responder 401 (sessão expirada), limpa o storage,
// avisa o usuário e redireciona pro login.

async function fetchApi(url, opcoes = {}) {
    // Garante que o cookie de sessão seja sempre enviado (mesmo cross-origin)
    const opcoesComCredenciais = { credentials: 'include', ...opcoes };
    const resposta = await fetch(url, opcoesComCredenciais);
    if (resposta.status === 401) {
        localStorage.removeItem('userIdAtual');
        sessionStorage.removeItem('userIdAtual');
        alert('Sua sessão expirou. Faça login novamente.');
        window.location.href = 'index.html';
        return new Promise(() => {}); // nunca resolve: página já está navegando
    }
    return resposta;
}