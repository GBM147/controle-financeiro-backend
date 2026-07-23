function gbmMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function gbmData(valor) {
    if (!valor) return '—';
    const data = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
    return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR');
}

function gbmEscapar(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function gbmToast(mensagem, tipo = 'info') {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = mensagem;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
}

async function gbmJson(resposta) {
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        const erro = new Error(dados.error || dados.message || 'Não foi possível concluir a operação.');
        erro.status = resposta.status;
        erro.codigo = dados.codigo;
        throw erro;
    }
    return dados;
}
