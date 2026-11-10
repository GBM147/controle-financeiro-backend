/* Movimento com propósito e tema dos gráficos.
   - números que mudam entram com transição curta;
   - barras de progresso preenchem ao aparecer;
   - "Carregando..." vira esqueleto no formato do conteúdo;
   - seções do site público aparecem uma única vez;
   - Chart.js usa as cores e a fonte dos tokens e acompanha a troca de tema. */
(() => {
    'use strict';
    if (window.GBMMovimento) return;

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    const estilo = () => getComputedStyle(document.documentElement);
    const cor = (nome) => estilo().getPropertyValue(`--${nome}`).trim();

    /* ---------- Gráficos ---------- */
    const GBMGraficos = {
        cor,
        paleta() {
            return [1, 2, 3, 4, 5, 6].map((indice) => cor(`grafico-${indice}`));
        },
        suave(nome, alfa = 0.14) {
            const valor = cor(nome);
            const hex = valor.match(/^#([0-9a-f]{6})$/i);
            if (!hex) return valor;
            const numero = parseInt(hex[1], 16);
            return `rgba(${numero >> 16}, ${(numero >> 8) & 255}, ${numero & 255}, ${alfa})`;
        },
        aplicarPadroes() {
            const Chart = window.Chart;
            if (!Chart?.defaults) return;
            const padroes = Chart.defaults;
            padroes.font.family = cor('font-ui') || 'system-ui, sans-serif';
            padroes.font.size = 12;
            padroes.locale = 'pt-BR';
            padroes.color = cor('text-3');
            padroes.borderColor = cor('border');
            padroes.animation = reduzido.matches ? false : { duration: 700, easing: 'easeOutQuart' };
            padroes.transitions.active.animation.duration = 150;
            if (padroes.elements?.line) {
                padroes.elements.line.borderWidth = 2;
                padroes.elements.line.tension = 0.25;
            }
            if (padroes.elements?.point) {
                padroes.elements.point.radius = 0;
                padroes.elements.point.hoverRadius = 4;
                padroes.elements.point.hitRadius = 12;
            }
            if (padroes.elements?.bar) padroes.elements.bar.borderRadius = 4;
            if (padroes.elements?.arc) padroes.elements.arc.borderWidth = 0;
            const tooltip = padroes.plugins.tooltip;
            tooltip.backgroundColor = cor('text');
            tooltip.titleColor = cor('bg');
            tooltip.bodyColor = cor('bg');
            tooltip.borderWidth = 0;
            tooltip.cornerRadius = 8;
            tooltip.padding = 10;
            tooltip.displayColors = false;
            tooltip.titleFont = { weight: '600' };
            const legenda = padroes.plugins.legend;
            legenda.labels.color = cor('text-2');
            legenda.labels.boxWidth = 10;
            legenda.labels.boxHeight = 10;
            legenda.labels.usePointStyle = true;
        },
        // Cores de séries por nome de token: { borderColor: 'accent', backgroundColor: ['accent', .08] }
        // ou { backgroundColor: 'paleta' }. São reaplicadas quando o tema muda.
        resolver(spec) {
            if (spec === 'paleta') return GBMGraficos.paleta();
            if (Array.isArray(spec) && typeof spec[1] === 'number') return GBMGraficos.suave(spec[0], spec[1]);
            if (Array.isArray(spec)) return spec.map((item) => GBMGraficos.resolver(item));
            return cor(spec);
        },
        tingir(dataset) {
            Object.entries(dataset.gbmTokens || {}).forEach(([propriedade, spec]) => {
                dataset[propriedade] = GBMGraficos.resolver(spec);
            });
            return dataset;
        },
        atualizarTodos() {
            const Chart = window.Chart;
            if (!Chart) return;
            GBMGraficos.aplicarPadroes();
            Object.values(Chart.instances || {}).forEach((grafico) => {
                (grafico.data?.datasets || []).forEach(GBMGraficos.tingir);
                const escalas = grafico.options?.scales || {};
                Object.values(escalas).forEach((escala) => {
                    if (escala.ticks) escala.ticks.color = cor('text-3');
                    if (escala.grid) escala.grid.color = cor('border');
                });
                grafico.update('none');
            });
        }
    };
    window.GBMGraficos = GBMGraficos;
    // Carregado depois do CSS: os gráficos criados pela página já nascem com o tema.
    GBMGraficos.aplicarPadroes();

    /* ---------- Números que mudam ---------- */
    const SELETOR_NUMEROS = '.v3-metric strong, .stat strong, .stat-card strong, .resumo-card strong, [data-gbm-numero]';
    function animarNumero(elemento) {
        if (reduzido.matches) return;
        const proxima = elemento.classList.contains('gbm-numero-a') ? 'gbm-numero-b' : 'gbm-numero-a';
        elemento.classList.remove('gbm-numero-a', 'gbm-numero-b');
        elemento.classList.add(proxima);
    }

    /* ---------- Barras ---------- */
    const SELETOR_BARRAS = '.progress > span, .barra > div, [data-gbm-barra]';
    const observadorBarras = 'IntersectionObserver' in window
        ? new IntersectionObserver((entradas) => {
            entradas.forEach((entrada) => {
                if (!entrada.isIntersecting) return;
                entrada.target.classList.add('gbm-preenche');
                observadorBarras.unobserve(entrada.target);
            });
        }, { threshold: 0.2 })
        : null;
    function prepararBarra(barra) {
        if (barra.dataset.gbmBarraPronta || reduzido.matches || !observadorBarras) return;
        barra.dataset.gbmBarraPronta = '1';
        observadorBarras.observe(barra);
    }

    /* ---------- Esqueletos ---------- */
    const SELETOR_CARREGANDO = '.empty, .dashboard-v3-empty, .estado-carregando';
    function virarEsqueleto(elemento) {
        const texto = (elemento.textContent || '').trim();
        if (!/^carregando/i.test(texto) || elemento.dataset.gbmEsqueleto) return;
        elemento.dataset.gbmEsqueleto = '1';
        elemento.setAttribute('aria-busy', 'true');
        elemento.classList.add('gbm-carregando');
        elemento.innerHTML = '<span class="sr-only"></span><span class="gbm-esqueleto" style="width:72%"></span>'
            + '<span class="gbm-esqueleto" style="width:54%"></span><span class="gbm-esqueleto" style="width:64%"></span>';
        elemento.firstElementChild.textContent = texto;
    }

    /* ---------- Site público: revelar uma vez ---------- */
    const observadorRevelar = 'IntersectionObserver' in window
        ? new IntersectionObserver((entradas) => {
            entradas.filter((entrada) => entrada.isIntersecting).forEach((entrada, indice) => {
                entrada.target.style.animationDelay = `${Math.min(indice, 5) * 50}ms`;
                entrada.target.classList.remove('gbm-revela-pendente');
                entrada.target.classList.add('gbm-revela');
                observadorRevelar.unobserve(entrada.target);
            });
        }, { rootMargin: '0px 0px -8% 0px' })
        : null;

    function varrer(raiz) {
        if (!(raiz instanceof Element)) return;
        const todos = (seletor) => [...(raiz.matches(seletor) ? [raiz] : []), ...raiz.querySelectorAll(seletor)];
        todos(SELETOR_BARRAS).forEach(prepararBarra);
        todos(SELETOR_CARREGANDO).forEach(virarEsqueleto);
    }

    // Robôs de indexação e do AdSense veem todo o conteúdo sem esperar animação.
    const robo = /bot|crawler|spider|mediapartners|adsbot|lighthouse|headless/i.test(navigator.userAgent)
        || navigator.webdriver === true;

    function iniciar() {
        GBMGraficos.atualizarTodos();
        varrer(document.body);

        if (document.body.classList.contains('gbm-public') && observadorRevelar && !reduzido.matches && !robo) {
            document.querySelectorAll('main > section, main > .section, article > h2, .grid > a, .grid > .card')
                .forEach((elemento) => {
                    if (elemento.getBoundingClientRect().top < window.innerHeight * 0.9) return;
                    elemento.classList.add('gbm-revela-pendente');
                    observadorRevelar.observe(elemento);
                });
        }

        new MutationObserver((mutacoes) => {
            for (const mutacao of mutacoes) {
                if (mutacao.type === 'characterData') {
                    const alvo = mutacao.target.parentElement?.closest(SELETOR_NUMEROS);
                    if (alvo) animarNumero(alvo);
                    continue;
                }
                const alvo = mutacao.target instanceof Element ? mutacao.target : null;
                if (alvo?.matches(SELETOR_NUMEROS)) animarNumero(alvo);
                if (alvo?.dataset.gbmEsqueleto && !alvo.querySelector('.gbm-esqueleto')) {
                    alvo.classList.remove('gbm-carregando');
                    alvo.removeAttribute('aria-busy');
                }
                mutacao.addedNodes.forEach(varrer);
            }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });

        window.addEventListener('gbm:tema', () => requestAnimationFrame(GBMGraficos.atualizarTodos));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    else iniciar();

    window.GBMMovimento = Object.freeze({ animarNumero, varrer });
})();
