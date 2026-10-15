/* Camada decorativa: nenhuma cor, medida, ação ou informação financeira é alterada. */
(() => {
    'use strict';

    if (window.GBMVisualMotion) return;

    function initialize() {
        const body = document.body;
        if (!body || window.GBMVisualMotion) return;

        const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
        const panel = document.querySelector('.hero-home .demo-panel');
        const listeners = [];
        const reveals = new Map();
        let destroyed = false;
        let manualPaused = false;
        let reduced = reducedQuery.matches;
        let heroVisible = Boolean(panel);
        let frame = 0;
        let frameCount = 0;
        let previousTime = 0;
        let lastPaint = 0;
        let animationUntil = 0;
        let resizeTimer = 0;
        let phase = 0;
        let width = 0;
        let height = 0;
        let panelWidth = 0;
        let panelHeight = 0;
        let panelTop = 0;
        let mobile = false;
        let dpr = 1;
        let ambientParticles = [];
        let constellationParticles = [];
        let dispersion = 0;
        let dispersionTarget = 0;
        let pointerX = 0;
        let pointerY = 0;
        let lastPointerTime = 0;
        let heroObserver;
        let revealObserver;
        let resizeObserver;

        function listen(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            listeners.push(() => target.removeEventListener(type, handler, options));
        }

        function createCanvas(id, className, parent) {
            const canvas = document.createElement('canvas');
            if (id) canvas.id = id;
            canvas.className = className;
            canvas.setAttribute('aria-hidden', 'true');
            canvas.setAttribute('role', 'presentation');
            canvas.style.pointerEvents = 'none';
            let context;
            try { context = canvas.getContext('2d', { alpha: true }); } catch { return null; }
            if (!context) return null;
            parent.prepend(canvas);
            return { canvas, context };
        }

        const field = createCanvas('gbm-motion-field', 'gbm-motion-field', body);
        const constellation = panel ? createCanvas('', 'gbm-motion-constellation', panel) : null;
        if (field || constellation) body.classList.add('gbm-motion-enabled');

        function palette(element, primarySelector, secondarySelector) {
            const styles = window.getComputedStyle(element);
            const first = primarySelector && element.querySelector(primarySelector);
            const second = secondarySelector && element.querySelector(secondarySelector);
            return [
                first ? window.getComputedStyle(first).color :
                    styles.getPropertyValue('--gbm-green').trim() || styles.getPropertyValue('--green').trim() || styles.color,
                second ? window.getComputedStyle(second).color :
                    styles.getPropertyValue('--gbm-blue').trim() || styles.getPropertyValue('--blue').trim() || styles.color
            ];
        }

        let ambientColors = palette(body);
        let constellationColors = panel ? palette(panel, '.demo-top svg', '.demo-stats div:last-child svg') : ambientColors;

        // A distribuição é determinística: redimensionar não muda o desenho aleatoriamente.
        const fraction = (value) => value - Math.floor(value);
        const seed = (index, salt) => fraction(Math.sin(index * 127.1 + salt * 311.7) * 43758.5453);
        const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));

        function sizeCanvas(layer, layerWidth, layerHeight) {
            if (!layer) return;
            layer.canvas.width = Math.max(1, Math.round(layerWidth * dpr));
            layer.canvas.height = Math.max(1, Math.round(layerHeight * dpr));
            layer.context.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function updateScroll() {
            if (!panel) return;
            const distance = window.scrollY - panelTop;
            dispersionTarget = clamp((distance + panelHeight * .16) / Math.max(panelHeight, 1), 0, 1);
        }

        function measure() {
            if (destroyed) return;
            width = window.innerWidth;
            height = window.innerHeight;
            mobile = width <= 700;
            dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
            ambientColors = palette(body);
            ambientParticles = Array.from({ length: mobile ? 11 : 26 }, (_, index) => ({
                x: index % 2 ? .74 + seed(index, 1) * .23 : .02 + seed(index, 1) * .23,
                y: seed(index, 2),
                size: (mobile ? 5 : 7) + seed(index, 3) * (mobile ? 6 : 13),
                angle: seed(index, 4) * Math.PI * 2,
                speed: .35 + seed(index, 5) * .6,
                color: index % 2,
                shape: index % 4
            }));
            sizeCanvas(field, width, height);
            if (panel && constellation) {
                const rect = panel.getBoundingClientRect();
                panelWidth = rect.width;
                panelHeight = rect.height;
                panelTop = rect.top + window.scrollY;
                constellationColors = palette(panel, '.demo-top svg', '.demo-stats div:last-child svg');
                sizeCanvas(constellation, panelWidth, panelHeight);
                const count = mobile ? 78 : 240;
                const goldenAngle = Math.PI * (3 - Math.sqrt(5));
                constellationParticles = Array.from({ length: count }, (_, index) => {
                    const y = 1 - (index / Math.max(count - 1, 1)) * 2;
                    const radius = Math.sqrt(1 - y * y);
                    const angle = goldenAngle * index;
                    return {
                        x: Math.cos(angle) * radius,
                        y,
                        z: Math.sin(angle) * radius,
                        scatterX: (seed(index, 6) - .5) * 2.8,
                        scatterY: (seed(index, 7) - .5) * 2.2,
                        scatterZ: (seed(index, 8) - .5) * 1.5,
                        size: 1.4 + seed(index, 9) * 1.6,
                        angle: seed(index, 10) * Math.PI * 2,
                        color: index % 3 ? 0 : 1
                    };
                });
                updateScroll();
            }
            if (reduced || manualPaused) dispersion = dispersionTarget;
            paint();
        }

        function polygon(context, x, y, size, angle, sides) {
            context.beginPath();
            for (let index = 0; index < sides; index += 1) {
                const pointAngle = angle + index * Math.PI * 2 / sides;
                const pointX = x + Math.cos(pointAngle) * size;
                const pointY = y + Math.sin(pointAngle) * size;
                if (index) context.lineTo(pointX, pointY);
                else context.moveTo(pointX, pointY);
            }
            context.closePath();
        }

        function drawAmbient() {
            if (!field) return;
            const context = field.context;
            context.clearRect(0, 0, width, height);
            context.lineWidth = .8;
            ambientParticles.forEach((particle) => {
                const drift = phase * particle.speed;
                const x = particle.x * width + Math.sin(drift + particle.angle) * 11;
                const y = particle.y * height + Math.cos(drift * .8 + particle.angle) * 16;
                polygon(context, x, y, particle.size, particle.angle + drift * .25, particle.shape === 3 ? 4 : 3);
                context.globalAlpha = mobile ? .075 : .12;
                context.strokeStyle = ambientColors[particle.color];
                context.stroke();
                if (particle.shape === 0) {
                    context.globalAlpha = .045;
                    context.fillStyle = ambientColors[particle.color];
                    context.fill();
                }
            });
            context.globalAlpha = 1;
        }

        function drawConstellation() {
            if (!constellation || !heroVisible) return;
            const context = constellation.context;
            context.clearRect(0, 0, panelWidth, panelHeight);
            const radius = Math.min(panelWidth * .215, panelHeight * .19);
            const centerX = panelWidth * .81;
            const centerY = panelHeight * .255;
            const angle = phase * .85 + pointerX * .06;
            const cosine = Math.cos(angle);
            const sine = Math.sin(angle);
            const projected = constellationParticles.map((particle) => {
                const organic = 1 + Math.sin(particle.y * 4 + phase) * .06;
                const localX = particle.x * organic + particle.scatterX * dispersion;
                const localY = particle.y * organic + particle.scatterY * dispersion;
                const localZ = particle.z + particle.scatterZ * dispersion;
                const x = localX * cosine + localZ * sine;
                const z = localZ * cosine - localX * sine;
                const perspective = 2.8 / (2.8 - z * .32);
                return {
                    particle,
                    z,
                    x: centerX + x * radius * perspective,
                    y: centerY + localY * radius * .91 * perspective + pointerY * 2,
                    perspective
                };
            }).sort((first, second) => first.z - second.z);
            projected.forEach(({ particle, x, y, z, perspective }) => {
                // O lado esquerdo contém os valores: o brilho cai antes dessa área.
                const freeSpace = clamp((x / Math.max(panelWidth, 1) - .58) / .22, .08, 1);
                const opacity = (.10 + clamp((z + 1.6) / 3.2, 0, 1) * .17) * freeSpace * (1 - dispersion * .36);
                polygon(context, x, y, particle.size * perspective, particle.angle + phase * .23, 3);
                context.globalAlpha = opacity;
                context.fillStyle = constellationColors[particle.color];
                context.fill();
                if (particle.color === 1) {
                    context.globalAlpha = opacity * .6;
                    context.strokeStyle = constellationColors[particle.color];
                    context.lineWidth = .45;
                    context.stroke();
                }
            });
            context.globalAlpha = 1;
        }

        function paint() {
            if (destroyed) return;
            drawAmbient();
            drawConstellation();
            frameCount += 1;
        }

        function stop() {
            if (frame) window.cancelAnimationFrame(frame);
            frame = 0;
            previousTime = 0;
            lastPaint = 0;
        }

        function tick(now) {
            frame = 0;
            if (destroyed || manualPaused || reduced || document.hidden || now >= animationUntil) {
                previousTime = 0;
                return;
            }
            const interval = 1000 / (mobile ? 24 : 30);
            if (!lastPaint || now - lastPaint >= interval) {
                const delta = previousTime ? clamp(now - previousTime, 0, 80) / 1000 : interval / 1000;
                phase += delta * .45;
                dispersion += (dispersionTarget - dispersion) * Math.min(1, delta * 8);
                previousTime = now;
                lastPaint = now;
                paint();
            }
            frame = window.requestAnimationFrame(tick);
        }

        function engage(duration = 1500) {
            if (destroyed || manualPaused || reduced || document.hidden || (!field && !constellation)) return;
            animationUntil = Math.max(animationUntil, performance.now() + duration);
            if (!frame) {
                previousTime = 0;
                lastPaint = 0;
                frame = window.requestAnimationFrame(tick);
            }
        }

        function finishReveals() {
            reveals.forEach((animation) => {
                try { animation.finish(); } catch { animation.cancel(); }
            });
            reveals.clear();
        }

        function reveal(element) {
            if (reduced || manualPaused || document.hidden || typeof element.animate !== 'function') return;
            if (element.contains(document.activeElement)) return;
            const animation = element.animate([
                { opacity: .88, transform: 'translateY(7px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], { duration: 450, easing: 'cubic-bezier(.22,.75,.25,1)' });
            reveals.set(element, animation);
            const cleanup = () => reveals.delete(element);
            animation.addEventListener('finish', cleanup, { once: true });
            animation.addEventListener('cancel', cleanup, { once: true });
        }

        if (typeof window.IntersectionObserver === 'function') {
            if (panel && constellation) {
                heroObserver = new IntersectionObserver((entries) => {
                    heroVisible = entries[0].isIntersecting;
                    if (heroVisible) {
                        paint();
                        if (performance.now() < animationUntil) engage(0);
                    }
                }, { threshold: 0 });
                heroObserver.observe(panel);
            }
            revealObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    revealObserver.unobserve(entry.target);
                    reveal(entry.target);
                });
            }, { threshold: .12 });
            const selectors = '.hero h1, .section-heading, .hero-home .demo-panel, main article > h2, main .intro, main .introducao, .page-title, .dashboard-v3-card-head';
            Array.from(document.querySelectorAll(selectors)).slice(0, 30).forEach((element) => revealObserver.observe(element));
        }

        listen(window, 'scroll', () => {
            updateScroll();
            if (!reduced) engage(1500);
        }, { passive: true });
        listen(window, 'pointermove', (event) => {
            if (!finePointerQuery.matches || event.pointerType !== 'mouse' || reduced) return;
            const now = performance.now();
            if (now - lastPointerTime < 90) return;
            lastPointerTime = now;
            pointerX = clamp((event.clientX / Math.max(width, 1) - .5) * 2, -1, 1);
            pointerY = clamp((event.clientY / Math.max(height, 1) - .5) * 2, -1, 1);
            engage(1250);
        }, { passive: true });
        listen(document, 'visibilitychange', () => {
            if (document.hidden) {
                stop();
                finishReveals();
            } else if (performance.now() < animationUntil) engage(0);
        });
        listen(document, 'focusin', (event) => {
            reveals.forEach((animation, element) => {
                if (!element.contains(event.target)) return;
                try { animation.finish(); } catch { animation.cancel(); }
                reveals.delete(element);
            });
        });

        function onResize() {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                measure();
                engage(1200);
            }, 120);
        }
        listen(window, 'resize', onResize, { passive: true });
        if (panel && typeof window.ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(onResize);
            resizeObserver.observe(panel);
        }

        function onReducedChange() {
            reduced = reducedQuery.matches;
            stop();
            finishReveals();
            if (reduced) {
                pointerX = 0;
                pointerY = 0;
                dispersion = dispersionTarget;
                paint();
            } else engage(1500);
        }
        if (typeof reducedQuery.addEventListener === 'function') listen(reducedQuery, 'change', onReducedChange);
        else {
            reducedQuery.addListener(onReducedChange);
            listeners.push(() => reducedQuery.removeListener(onReducedChange));
        }

        const controller = {
            pause() {
                manualPaused = true;
                stop();
                finishReveals();
            },
            resume() {
                if (destroyed) return;
                manualPaused = false;
                engage(1500);
            },
            getState() {
                return {
                    running: Boolean(frame),
                    frames: frameCount,
                    reducedMotion: reduced,
                    paused: manualPaused,
                    destroyed,
                    hidden: document.hidden,
                    heroVisible,
                    mobile,
                    dpr,
                    ambientParticles: field ? ambientParticles.length : 0,
                    constellationParticles: constellation ? constellationParticles.length : 0,
                    dispersion: Number(dispersion.toFixed(3)),
                    revealsRunning: reveals.size
                };
            },
            destroy() {
                if (destroyed) return;
                destroyed = true;
                stop();
                window.clearTimeout(resizeTimer);
                finishReveals();
                listeners.forEach((remove) => remove());
                heroObserver?.disconnect();
                revealObserver?.disconnect();
                resizeObserver?.disconnect();
                field?.canvas.remove();
                constellation?.canvas.remove();
                body.classList.remove('gbm-motion-enabled');
            }
        };
        window.GBMVisualMotion = Object.freeze(controller);
        measure();
        engage(4500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
