/* Materiais e microinterações. Nenhum efeito altera valores, rotas ou ações. */
(() => {
    'use strict';

    if (window.GBMInteractions) return;

    function initialize() {
        const body = document.body;
        if (!body || window.GBMInteractions) return;

        const surfaces = [
            '.v3-metric', '.dashboard-v3-surface', '.card', '.cartao', '.panel', '.painel',
            '.resumo-card', '.stat-card', '.conta-card', '.meta', '.plano-card', '.resumo-item',
            '.feature', '.tool-card', '.guide-card', '.price-card', '.demo-panel', '.result-card',
            '.calculator-result', '.perfil-card', '.form-card', '.filtros-card', '.chart-container',
            '.grafico-wrapper', '.card-resultado-grafico', '.painel-ajustes', '.insights-panel'
        ].join(',');
        const actions = 'button, a.btn, a.btn-primary, a.btn-small, .btn[role="button"], input[type="submit"]';
        const navigation = '.menu-item, .dashboard-v3-nav-item';
        const textLinks = '.text-link, .site-nav a, .site-footer a, .forgot-pass, .signup-prompt a, .dashboard-v3-card-head > a, .article-body a, .sources a, .legal-nav a';
        const passive = '.v3-metric, .resumo-card, .stat-card, .resumo-item, .feature';
        const excluded = '[data-gbm-no-effects], .zona-perigo, [role="dialog"], [aria-modal="true"], dialog, .modal, .modal-overlay, .gbm-tour, .gbm-ai-modal, #modal-notificacoes, [inert]';
        const destructive = '.btn-danger, .btn-cancelar-assinatura, .btn-excluir-transacao, #btn-excluir, .texto-vermelho, .menu-item-sair, [data-danger], [onclick*="excluir"], [onclick*="deletar"], [onclick*="remover"]';
        const focusable = 'a, button, input, select, textarea, summary, [contenteditable="true"], [tabindex], [role="button"]';
        const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
        const listeners = [];
        const decorated = new Map();
        let destroyed = false;
        let active = null;
        let bounds = null;
        let frame = 0;
        let framesPainted = 0;
        let pointerX = 0;
        let pointerY = 0;

        const canTrack = () => !destroyed && !reducedQuery.matches && pointerQuery.matches && !document.hidden;
        const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

        function listen(target, name, callback, options) {
            target.addEventListener(name, callback, options);
            listeners.push(() => target.removeEventListener(name, callback, options));
        }

        function remember(element) {
            if (!decorated.has(element)) {
                decorated.set(element, { position: element.style.position, positionChanged: false, finish: null });
            }
            return decorated.get(element);
        }

        function eligible(element) {
            return element instanceof Element && !element.closest(excluded) &&
                !element.matches(':disabled, [aria-disabled="true"], [hidden]');
        }

        function decorateControl(element) {
            if (!eligible(element)) return;
            remember(element);
            if (element.matches(navigation)) {
                element.dataset.gbmNav = 'true';
            } else if (element.matches(actions)) {
                element.dataset.gbmAction = element.matches(destructive) ? 'quiet' : 'tactile';
            } else if (element.matches(textLinks) && !element.matches('a.btn, .card, .tool-card, .guide-card')) {
                // Only plain text receives the underline; brand gradients and cards keep their backgrounds.
                if (getComputedStyle(element).backgroundImage === 'none') element.dataset.gbmTextLink = 'true';
            }
        }

        function decorateSurface(element) {
            if (!eligible(element) || element.matches(destructive)) return false;
            if (body.classList.contains('gbm-public') && element.matches('.meta')) return false;
            const style = getComputedStyle(element);
            if (style.display === 'inline' || style.display === 'contents' || style.position === 'fixed') return false;
            const stored = remember(element);
            // Changing the containing block of an absolute child would alter the existing layout.
            if (style.position === 'static') {
                if ([...element.children].some(child => getComputedStyle(child).position === 'absolute')) return false;
                element.style.position = 'relative';
                stored.positionChanged = true;
            }
            element.dataset.gbmSurface = 'material';
            element.dataset.gbmTilt = element.matches(passive) && !element.querySelector(`${focusable}, canvas, iframe, table, [role="img"]`) ? 'true' : 'false';
            if (!stored.finish && canTrack()) {
                const finish = document.createElement('span');
                finish.className = 'gbm-surface-finish';
                finish.setAttribute('aria-hidden', 'true');
                // Keep :last-child category colors and existing counters on the final child intact.
                element.prepend(finish);
                stored.finish = finish;
            }
            return true;
        }

        function clearActive() {
            if (frame) window.cancelAnimationFrame(frame);
            frame = 0;
            if (active) {
                delete active.dataset.gbmHover;
                ['--gbm-light-x', '--gbm-light-y', '--gbm-tilt-x', '--gbm-tilt-y', '--gbm-light-angle'].forEach(name => active.style.removeProperty(name));
            }
            active = null;
            bounds = null;
        }

        function targetFor(node) {
            if (!(node instanceof Element)) return null;
            if (node.closest(excluded)) return null;
            const control = node.closest(`${actions}, ${navigation}`);
            if (control) {
                if (eligible(control)) decorateControl(control);
                return null; // Controls and chart hit targets remain physically stable.
            }
            const surface = node.closest(surfaces);
            if (surface && surface === active) return surface;
            return surface && decorateSurface(surface) ? surface : null;
        }

        function paint() {
            frame = 0;
            if (!active || !bounds || !canTrack() || !active.isConnected) {
                clearActive();
                return;
            }
            const x = clamp((pointerX - bounds.left) / Math.max(1, bounds.width), 0, 1);
            const y = clamp((pointerY - bounds.top) / Math.max(1, bounds.height), 0, 1);
            active.style.setProperty('--gbm-light-x', `${(x * 100).toFixed(2)}%`);
            active.style.setProperty('--gbm-light-y', `${(y * 100).toFixed(2)}%`);
            active.style.setProperty('--gbm-light-angle', `${(116 + x * 24).toFixed(2)}deg`);
            if (active.dataset.gbmTilt === 'true' && active.querySelector(`${focusable}, canvas, iframe, table, [role="img"]`)) {
                active.dataset.gbmTilt = 'false';
                active.style.removeProperty('--gbm-tilt-x');
                active.style.removeProperty('--gbm-tilt-y');
            }
            if (active.dataset.gbmTilt === 'true') {
                active.style.setProperty('--gbm-tilt-x', `${((.5 - y) * 1.2).toFixed(3)}deg`);
                active.style.setProperty('--gbm-tilt-y', `${((x - .5) * 1.5).toFixed(3)}deg`);
            }
            framesPainted += 1;
            // One frame per pointer update. A resting cursor never runs an animation loop.
        }

        function move(event) {
            if (!canTrack() || event.pointerType === 'touch') return;
            const candidate = targetFor(event.target);
            if (candidate !== active) {
                clearActive();
                if (!candidate) return;
                bounds = candidate.getBoundingClientRect();
                if (!bounds.width || !bounds.height) return;
                active = candidate;
                active.dataset.gbmHover = 'true';
            }
            if (!active) return;
            pointerX = event.clientX;
            pointerY = event.clientY;
            if (!frame) frame = window.requestAnimationFrame(paint);
        }

        function preferencesChanged() {
            clearActive();
            body.dataset.gbmInteractionsMotion = canTrack() ? 'tracking' : 'static';
            if (!canTrack()) {
                decorated.forEach(stored => {
                    stored.finish?.remove();
                    stored.finish = null;
                });
            }
        }

        body.classList.add('gbm-interactions-ready');
        body.dataset.gbmInteractions = 'ready';
        document.querySelectorAll(`${actions}, ${navigation}, ${textLinks}`).forEach(decorateControl);
        document.querySelectorAll(surfaces).forEach(element => {
            if (!element.parentElement?.closest(surfaces)) decorateSurface(element);
        });
        preferencesChanged();

        listen(document, 'pointerover', move, { passive: true });
        listen(document, 'pointermove', move, { passive: true });
        listen(document, 'pointerout', event => {
            if (active && (!(event.relatedTarget instanceof Node) || !active.contains(event.relatedTarget))) clearActive();
        }, { passive: true });
        listen(document, 'focusin', event => {
            const control = event.target instanceof Element && event.target.closest(`${actions}, ${navigation}, ${textLinks}`);
            if (control) decorateControl(control);
            clearActive();
        });
        listen(document, 'scroll', clearActive, { passive: true, capture: true });
        listen(window, 'resize', clearActive, { passive: true });
        listen(window, 'blur', clearActive);
        listen(window, 'pagehide', clearActive);
        listen(document, 'visibilitychange', preferencesChanged);
        listen(reducedQuery, 'change', preferencesChanged);
        listen(pointerQuery, 'change', preferencesChanged);

        window.GBMInteractions = {
            getState: () => ({
                destroyed,
                tracking: canTrack(),
                reducedMotion: reducedQuery.matches,
                active: active?.className || null,
                framePending: Boolean(frame),
                framesPainted,
                surfaces: document.querySelectorAll('[data-gbm-surface]').length,
                finishes: document.querySelectorAll('.gbm-surface-finish').length
            }),
            destroy() {
                if (destroyed) return;
                clearActive();
                destroyed = true;
                listeners.forEach(remove => remove());
                decorated.forEach((stored, element) => {
                    stored.finish?.remove();
                    if (stored.positionChanged && element.style.position === 'relative') element.style.position = stored.position;
                    ['gbmSurface', 'gbmTilt', 'gbmAction', 'gbmNav', 'gbmTextLink'].forEach(name => delete element.dataset[name]);
                });
                decorated.clear();
                body.classList.remove('gbm-interactions-ready');
                delete body.dataset.gbmInteractions;
                delete body.dataset.gbmInteractionsMotion;
            }
        };
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
