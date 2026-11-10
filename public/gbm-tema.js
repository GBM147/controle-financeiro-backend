/* Tema claro/escuro. Carregado no <head>, antes das folhas de estilo, para
   aplicar a escolha salva sem piscar. Sem escolha, segue o sistema. */
(() => {
    'use strict';
    if (window.GBMTema) return;

    const CHAVE = 'gbm-tema';
    const raiz = document.documentElement;
    const midia = window.matchMedia('(prefers-color-scheme: dark)');

    function salvo() {
        try {
            const valor = localStorage.getItem(CHAVE);
            return valor === 'claro' || valor === 'escuro' ? valor : 'sistema';
        } catch {
            return 'sistema';
        }
    }

    function efetivo(preferencia = salvo()) {
        if (preferencia === 'claro' || preferencia === 'escuro') return preferencia;
        return midia.matches ? 'escuro' : 'claro';
    }

    function aplicar(preferencia) {
        if (preferencia === 'claro' || preferencia === 'escuro') raiz.setAttribute('data-tema', preferencia);
        else raiz.removeAttribute('data-tema');
    }

    function avisar() {
        window.dispatchEvent(new CustomEvent('gbm:tema', { detail: { tema: efetivo(), preferencia: salvo() } }));
    }

    function escolher(preferencia) {
        try {
            if (preferencia === 'claro' || preferencia === 'escuro') localStorage.setItem(CHAVE, preferencia);
            else localStorage.removeItem(CHAVE);
        } catch { /* A escolha vale só para esta visita. */ }
        const trocar = () => aplicar(preferencia);
        const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (document.startViewTransition && !reduzido) document.startViewTransition(trocar);
        else trocar();
        avisar();
    }

    aplicar(salvo());
    midia.addEventListener('change', () => { if (salvo() === 'sistema') avisar(); });

    window.GBMTema = Object.freeze({
        atual: () => efetivo(),
        preferencia: () => salvo(),
        escolher,
        alternar: () => escolher(efetivo() === 'escuro' ? 'claro' : 'escuro')
    });
})();
