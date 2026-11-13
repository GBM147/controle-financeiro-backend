/* Movimento e tema dos gráficos.
   - valores em reais, percentuais e totais contam até o número final;
   - gráficos crescem devagar, com barras em sequência e a linha se desenhando;
   - barras de progresso preenchem ao aparecer;
   - "Carregando..." vira esqueleto no formato do conteúdo;
   - seções do site público aparecem uma única vez;
   - Chart.js usa as cores e a fonte dos tokens e acompanha a troca de tema.
   Com "reduzir movimento" no sistema, tudo continua, só que bem mais curto. */
(() => {
    'use strict';
    if (window.GBMMovimento) return;

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    const estilo = () => getComputedStyle(document.documentElement);
    const cor = (nome) => estilo().getPropertyValue(`--${nome}`).trim();
    // Robôs de indexação e do AdSense veem os valores finais, sem animação.
    const robo = /bot|crawler|spider|mediapartners|adsbot|lighthouse|headless/i.test(navigator.userAgent)
        || navigator.webdriver === true;

    const DURACAO_GRAFICO = 1600;
    const duracaoGrafico = () => (reduzido.matches ? 450 : DURACAO_GRAFICO);

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
            if (typeof padroes.animation !== 'object' || !padroes.animation) padroes.animation = {};
            padroes.animation.duration = duracaoGrafico();
            padroes.animation.easing = 'easeOutQuart';
            // Na primeira vez, cada barra/fatia entra um pouco depois da anterior.
            padroes.animation.delay = (contexto) => {
                if (reduzido.matches || contexto.type !== 'data' || contexto.mode !== 'default') return 0;
                if (contexto.chart.$gbmJaAnimou) return 0;
                return Math.min(contexto.dataIndex, 14) * 70 + contexto.datasetIndex * 140;
            };
            padroes.animation.onComplete = (evento) => { if (evento?.chart) evento.chart.$gbmJaAnimou = true; };
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
        // Linha que se desenha da esquerda para a direita (use em options.animation).
        linhaProgressiva(totalPontos) {
            if (reduzido.matches || robo || !totalPontos) return { duration: duracaoGrafico() };
            const passo = DURACAO_GRAFICO / Math.max(totalPontos, 1);
            const yAnterior = (contexto) => {
                if (contexto.index === 0) return contexto.chart.scales.y.getPixelForValue(0);
                const meta = contexto.chart.getDatasetMeta(contexto.datasetIndex);
                return meta.data[contexto.index - 1]?.getProps(['y'], true).y;
            };
            const atraso = (chave) => (contexto) => {
                if (contexto.type !== 'data' || contexto[chave]) return 0;
                contexto[chave] = true;
                return contexto.index * passo;
            };
            return {
                x: { type: 'number', easing: 'linear', duration: passo, from: NaN, delay: atraso('gbmX') },
                y: { type: 'number', easing: 'linear', duration: passo, from: yAnterior, delay: atraso('gbmY') }
            };
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

    /* ---------- Valores que contam até o número ---------- */
    // "R$ 1.234,56", "- R$ 12,00", "+ R$ 4.800,00", "39,4%", "1.250" (pt-BR).
    const PADRAO_VALOR = /^([+\-−][\s ]?)?(R\$[\s ]?)?(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?([\s ]?%)?$/;
    // Números sem R$ nem % (quantidades) só contam dentro de cartões de resumo,
    // para não animar anos, dias ou códigos soltos.
    const CONTEXTO_QUANTIDADE = '.v3-metric, .stat, .stat-card, .resumo-item, .resumo-card, .import-stats, [data-gbm-numero]';
    const IGNORAR = 'script, style, select, option, textarea, button, input, label, [contenteditable], [data-gbm-sem-contagem], .gbm-dialogo, .gbm-avisos, svg';
    const estados = new WeakMap();
    const formatadores = new Map();
    const formatar = (numero, casas) => {
        if (!formatadores.has(casas)) {
            formatadores.set(casas, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));
        }
        return formatadores.get(casas).format(numero);
    };

    function lerValor(elemento) {
        if (elemento.childElementCount) return null;
        const texto = (elemento.textContent || '').trim();
        if (!texto || texto.length > 24) return null;
        const partes = PADRAO_VALOR.exec(texto);
        if (!partes) return null;
        const [, sinal = '', moeda = '', menos = '', inteiro, decimais = '', porcento = ''] = partes;
        if (!moeda && !porcento && !elemento.closest(CONTEXTO_QUANTIDADE)) return null;
        const numero = Number(inteiro.replace(/\./g, '') + (decimais ? `.${decimais}` : '')) * (menos ? -1 : 1);
        if (!Number.isFinite(numero)) return null;
        return { texto, numero, casas: decimais.length, sinal, moeda, porcento };
    }

    function montarTexto(valor, numero) {
        const negativo = numero < 0;
        const corpo = formatar(Math.abs(numero), valor.casas);
        // Mantém o formato original: sinal antes, "R$" e "%" nos mesmos lugares.
        return `${valor.sinal}${negativo && !valor.sinal ? '-' : ''}${valor.moeda}${corpo}${valor.porcento}`;
    }

    const ativas = new Set();
    let quadroAgendado = false;
    let loteInicio = 0;
    let loteQuantidade = 0;
    const suavizar = (t) => 1 - (1 - t) ** 4;

    function quadro(agora) {
        quadroAgendado = false;
        for (const animacao of ativas) {
            const decorrido = agora - animacao.inicio;
            if (decorrido < 0) continue;
            const progresso = Math.min(1, decorrido / animacao.duracao);
            const atual = animacao.de + (animacao.para - animacao.de) * suavizar(progresso);
            const estado = estados.get(animacao.elemento);
            const texto = progresso >= 1 ? animacao.valor.texto : montarTexto(animacao.valor, atual);
            if (animacao.elemento.textContent !== texto) {
                estado.escrito = texto;
                animacao.elemento.textContent = texto;
            }
            estado.atual = progresso >= 1 ? animacao.para : atual;
            if (progresso >= 1) ativas.delete(animacao);
        }
        if (ativas.size) agendar();
    }
    function agendar() {
        if (quadroAgendado) return;
        quadroAgendado = true;
        requestAnimationFrame(quadro);
    }

    function contar(elemento, valor, primeiraVez) {
        const estado = estados.get(elemento) || {};
        estados.set(elemento, estado);
        for (const animacao of ativas) if (animacao.elemento === elemento) ativas.delete(animacao);
        const de = primeiraVez ? 0 : (Number.isFinite(estado.atual) ? estado.atual : 0);
        if (robo || de === valor.numero) {
            estado.atual = valor.numero;
            return;
        }
        // Valores que entram juntos (cartões do topo, linhas de uma tabela) fazem uma cascata curta.
        const agora = performance.now();
        if (agora - loteInicio > 50) {
            loteInicio = agora;
            loteQuantidade = 0;
        }
        const atraso = reduzido.matches ? 0 : Math.min(loteQuantidade++, 8) * 70;
        const duracao = reduzido.matches ? 400 : ((primeiraVez || de === 0) ? 1600 : 1100);
        estado.escrito = montarTexto(valor, de);
        elemento.textContent = estado.escrito;
        ativas.add({ elemento, valor, de, para: valor.numero, inicio: agora + atraso, duracao });
        agendar();
    }

    const observadorValores = 'IntersectionObserver' in window
        ? new IntersectionObserver((entradas) => {
            entradas.forEach((entrada) => {
                if (!entrada.isIntersecting) return;
                observadorValores.unobserve(entrada.target);
                const estado = estados.get(entrada.target);
                if (!estado?.pendente) return;
                const valor = lerValor(entrada.target);
                estado.pendente = false;
                if (valor) contar(entrada.target, valor, true);
            });
        }, { threshold: 0.2 })
        : null;

    // Primeira aparição de um valor: espera ficar visível para começar a contar.
    function prepararValor(elemento) {
        if (estados.has(elemento) || elemento.closest(IGNORAR)) return;
        const valor = lerValor(elemento);
        if (!valor) return;
        estados.set(elemento, { atual: valor.numero, escrito: valor.texto, pendente: true });
        if (!observadorValores || robo || valor.numero === 0) {
            estados.get(elemento).pendente = false;
            return;
        }
        // Já visível: começa agora, antes da pintura, sem mostrar o valor final por um instante.
        const caixa = elemento.getBoundingClientRect();
        if (caixa.width && caixa.bottom > 0 && caixa.top < window.innerHeight) {
            estados.get(elemento).pendente = false;
            contar(elemento, valor, true);
            return;
        }
        observadorValores.observe(elemento);
    }

    // Valor trocado pela página (outro período, outra conta): conta do anterior até o novo.
    function valorMudou(elemento) {
        const estado = estados.get(elemento);
        const texto = (elemento.textContent || '').trim();
        if (estado && texto === estado.escrito) return;
        if (!estado) {
            if (elemento.closest(IGNORAR)) return;
            const valor = lerValor(elemento);
            if (!valor) return;
            // Primeiro valor real depois de um texto que não era número: conta a partir de zero.
            estados.set(elemento, { atual: 0, escrito: '' });
            contar(elemento, valor, true);
            return;
        }
        const valor = lerValor(elemento);
        if (!valor) {
            estado.escrito = texto;
            estado.atual = 0;
            return;
        }
        if (estado.pendente) {
            estado.escrito = valor.texto;
            estado.atual = valor.numero;
            return;
        }
        contar(elemento, valor, false);
    }

    function varrerValores(raiz) {
        if (!(raiz instanceof Element) || raiz.closest(IGNORAR)) return;
        const caminhante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
            acceptNode: (no) => (/\d/.test(no.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
        });
        const vistos = new Set();
        while (caminhante.nextNode()) {
            const pai = caminhante.currentNode.parentElement;
            if (pai && !vistos.has(pai)) {
                vistos.add(pai);
                prepararValor(pai);
            }
        }
    }

    /* ---------- Barras ---------- */
    const SELETOR_BARRAS = [
        '.progress > span', '.barra > div', '[data-gbm-barra]',
        '.categoria-participacao-barra-preenchimento', '.dashboard-v3-goal-bar i', '.demo-bar i'
    ].join(', ');
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
        if (barra.dataset.gbmBarraPronta || robo || !observadorBarras) return;
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
        varrerValores(raiz);
    }

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
            const alterados = new Set();
            for (const mutacao of mutacoes) {
                if (mutacao.type === 'characterData') {
                    if (mutacao.target.parentElement) alterados.add(mutacao.target.parentElement);
                    continue;
                }
                const alvo = mutacao.target instanceof Element ? mutacao.target : null;
                if (alvo?.dataset.gbmEsqueleto && !alvo.querySelector('.gbm-esqueleto')) {
                    alvo.classList.remove('gbm-carregando');
                    alvo.removeAttribute('aria-busy');
                }
                // Texto trocado dentro do mesmo elemento (innerText/textContent).
                if (alvo && !alvo.childElementCount && [...mutacao.addedNodes].some((no) => no.nodeType === Node.TEXT_NODE)) {
                    alterados.add(alvo);
                }
                mutacao.addedNodes.forEach((no) => {
                    if (no instanceof Element) varrer(no);
                });
            }
            alterados.forEach(valorMudou);
        }).observe(document.body, { childList: true, subtree: true, characterData: true });

        window.addEventListener('gbm:tema', () => requestAnimationFrame(GBMGraficos.atualizarTodos));
        reduzido.addEventListener?.('change', () => GBMGraficos.aplicarPadroes());
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    else iniciar();

    window.GBMMovimento = Object.freeze({ varrer, contar: (elemento) => valorMudou(elemento) });
})();
