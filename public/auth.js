// =======================================================
// auth.js — chamada de API que trata sessão expirada sozinha.
// =======================================================
// Uso: troque fetch(url, opcoes) por fetchApi(url, opcoes) em qualquer
// chamada para uma rota que exige login. O retorno é o mesmo objeto
// Response de sempre (funciona com .json(), .ok, etc. sem mudar mais nada).
// Se o servidor responder 401 (sessão expirada ou inexistente), a função
// limpa o ID salvo, avisa o usuário e manda de volta pro login — o código
// que chamou fetchApi() nunca chega a rodar o .then() seguinte nesse caso.

async function fetchApi(url, opcoes = {}) {
    const resposta = await fetch(url, opcoes);
    if (resposta.status === 401) {
        localStorage.removeItem('userIdAtual');
        sessionStorage.removeItem('userIdAtual');
        alert('Sua sessão expirou. Faça login novamente.');
        window.location.href = 'index.html';
        return new Promise(() => {}); // nunca resolve: a página já está navegando pra outro lugar
    }
    return resposta;
}
