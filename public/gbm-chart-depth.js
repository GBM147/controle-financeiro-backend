/* GBM Finance — dimensional materials for the existing Chart.js geometry. */
(function (global) {
    'use strict';

    if (global.GBMChartDepth) return;

    const TAU = Math.PI * 2;
    const registered = new WeakSet();
    const automaticLabels = new WeakMap();
    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function color(value) {
        const helper = global.Chart?.helpers?.color;
        if (typeof value === 'string' && helper) {
            const parsed = helper(value);
            if (parsed.valid) return parsed.rgb;
        }
        const hex = typeof value === 'string' && value.match(/^#([a-f\d]{6})$/i);
        if (hex) {
            const rgb = parseInt(hex[1], 16);
            return { r: rgb >> 16, g: (rgb >> 8) & 255, b: rgb & 255, a: 1 };
        }
        return { r: 85, g: 167, b: 255, a: 1 };
    }

    function tint(rgb, light = 0, opacity = 1) {
        const component = (value) => Math.round(light < 0 ? value * (1 + light) : value + (255 - value) * light);
        return `rgba(${component(rgb.r)},${component(rgb.g)},${component(rgb.b)},${opacity})`;
    }

    function material(element) {
        const options = element.options || {};
        return color(typeof options.backgroundColor === 'string' ? options.backgroundColor : options.borderColor);
    }

    function withinChart(chart, paint) {
        const { ctx, chartArea: area } = chart;
        if (!ctx || !area || area.right <= area.left || area.bottom <= area.top) return;
        ctx.save();
        try {
            // Faces, shadows and highlights never cover axis labels or the legend.
            ctx.beginPath();
            ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
            ctx.clip();
            paint(ctx);
        } finally {
            ctx.restore();
        }
    }

    function polygon(ctx, points) {
        ctx.beginPath();
        points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
    }

    function barBox(element) {
        if (!element || element.hidden || element.skip) return null;
        const { x, y, base, width, height, horizontal } = element;
        if (![x, y, base, horizontal ? height : width].every(Number.isFinite)) return null;
        const box = horizontal
            ? { left: Math.min(x, base), right: Math.max(x, base), top: y - height / 2, bottom: y + height / 2 }
            : { left: x - width / 2, right: x + width / 2, top: Math.min(y, base), bottom: Math.max(y, base) };
        if (box.right - box.left < .5 || box.bottom - box.top < .5) return null;
        box.horizontal = Boolean(horizontal);
        box.negative = horizontal ? x < base : y > base;
        return box;
    }

    function roundedFace(ctx, box, radius) {
        const width = box.right - box.left;
        const height = box.bottom - box.top;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(box.left, box.top, width, height, radius);
        else ctx.rect(box.left, box.top, width, height);
    }

    function drawBarSides(ctx, elements, options) {
        for (const element of elements) {
            const box = barBox(element);
            if (!box) continue;
            const width = box.right - box.left;
            const height = box.bottom - box.top;
            const depth = Math.min(options.depth, (box.horizontal ? height : width) * .23, 11);
            const dx = depth;
            const dy = -depth * .63;
            const rgb = material(element);
            const { left: l, right: r, top: t, bottom: b } = box;

            // The back edge is a real projected face; the front retains the scale endpoint.
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,.28)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 4;
            polygon(ctx, [[r, t], [r + dx, t + dy], [r + dx, b + dy], [r, b]]);
            const side = ctx.createLinearGradient(r, 0, r + dx, 0);
            side.addColorStop(0, tint(rgb, -.3));
            side.addColorStop(1, tint(rgb, -.64));
            ctx.fillStyle = side;
            ctx.fill();
            ctx.restore();

            polygon(ctx, [[l, t], [l + dx, t + dy], [r + dx, t + dy], [r, t]]);
            const cap = ctx.createLinearGradient(0, t + dy, 0, t);
            cap.addColorStop(0, tint(rgb, .42));
            cap.addColorStop(1, tint(rgb, .1));
            ctx.fillStyle = cap;
            ctx.fill();
        }
    }

    function drawBarFaces(ctx, elements) {
        for (const element of elements) {
            const box = barBox(element);
            if (!box) continue;
            const width = box.right - box.left;
            const height = box.bottom - box.top;
            const radiusOption = element.options?.borderRadius;
            const radius = Math.min(typeof radiusOption === 'number' ? radiusOption : 0, width / 2, height / 2);
            ctx.save();
            roundedFace(ctx, box, radius);
            ctx.clip();
            // A broad softbox reflection and a narrow polished edge, rather than a flat glow.
            const face = ctx.createLinearGradient(box.left, 0, box.right, 0);
            face.addColorStop(0, 'rgba(255,255,255,.19)');
            face.addColorStop(.16, 'rgba(255,255,255,.03)');
            face.addColorStop(.54, 'rgba(255,255,255,.11)');
            face.addColorStop(.86, 'rgba(0,0,0,.025)');
            face.addColorStop(1, 'rgba(0,0,0,.19)');
            ctx.fillStyle = face;
            ctx.fillRect(box.left, box.top, width, height);
            const light = ctx.createLinearGradient(0, box.top, 0, box.bottom);
            light.addColorStop(0, 'rgba(255,255,255,.11)');
            light.addColorStop(.45, 'rgba(255,255,255,0)');
            light.addColorStop(1, 'rgba(0,0,0,.11)');
            ctx.fillStyle = light;
            ctx.fillRect(box.left, box.top, width, height);
            ctx.strokeStyle = 'rgba(255,255,255,.33)';
            ctx.lineWidth = .8;
            ctx.beginPath();
            ctx.moveTo(box.left + .7, box.bottom);
            ctx.lineTo(box.left + .7, box.top + radius);
            ctx.stroke();
            ctx.restore();
        }
    }

    function arcGeometry(element, inset = 0) {
        if (!element || element.hidden || element.skip) return null;
        const { x, y, startAngle, endAngle } = element;
        if (![x, y, startAngle, endAngle, element.outerRadius].every(Number.isFinite)) return null;
        const sweep = Math.min(TAU, endAngle - startAngle);
        if (sweep <= .0001 || element.outerRadius <= 1) return null;
        const offset = number(element.options?.offset) / 4;
        const mid = (startAngle + endAngle) / 2;
        const spacing = number(element.options?.spacing) / 2;
        const outer = element.outerRadius - inset;
        const inner = Math.max(0, number(element.innerRadius) + (element.innerRadius > 0 ? inset : 0));
        if (outer <= inner) return null;
        const gap = Math.min(sweep / 3, spacing / Math.max(outer, 1));
        return {
            x: x + Math.cos(mid) * offset, y: y + Math.sin(mid) * offset,
            outer, inner, start: startAngle + gap, end: startAngle + sweep - gap,
            rgb: material(element)
        };
    }

    function arcPath(ctx, arc, dy = 0) {
        ctx.beginPath();
        ctx.arc(arc.x, arc.y + dy, arc.outer, arc.start, arc.end);
        if (arc.inner > 0) ctx.arc(arc.x, arc.y + dy, arc.inner, arc.end, arc.start, true);
        else ctx.lineTo(arc.x, arc.y + dy);
        ctx.closePath();
    }

    function drawArcSides(ctx, elements, options) {
        const arcs = elements.map((element) => arcGeometry(element)).filter(Boolean);
        if (!arcs.length) return;
        const radius = Math.max(...arcs.map((arc) => arc.outer));
        const depth = Math.max(1, Math.min(options.depth * 1.35, radius * .105, 14));
        // Back-to-front solid layers create both the outer wall and the inner recess.
        for (let layer = Math.ceil(depth); layer >= 1; layer--) {
            for (const arc of arcs) {
                const dy = layer / Math.ceil(depth) * depth;
                ctx.save();
                if (layer === Math.ceil(depth)) {
                    ctx.shadowColor = 'rgba(0,0,0,.38)';
                    ctx.shadowBlur = 10;
                    ctx.shadowOffsetY = 5;
                }
                const wall = ctx.createLinearGradient(arc.x - arc.outer, arc.y, arc.x + arc.outer, arc.y + depth);
                wall.addColorStop(0, tint(arc.rgb, -.24));
                wall.addColorStop(.48, tint(arc.rgb, -.48));
                wall.addColorStop(1, tint(arc.rgb, -.66));
                ctx.fillStyle = wall;
                arcPath(ctx, arc, dy);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    function drawArcFaces(ctx, elements) {
        for (const element of elements) {
            const border = number(element.options?.borderWidth, 0);
            const arc = arcGeometry(element, Math.max(.55, border / 2));
            if (!arc) continue;
            ctx.save();
            arcPath(ctx, arc);
            ctx.clip();
            const radius = arc.outer;
            const surface = ctx.createLinearGradient(arc.x - radius * .65, arc.y - radius, arc.x + radius * .7, arc.y + radius);
            surface.addColorStop(0, 'rgba(255,255,255,.29)');
            surface.addColorStop(.28, 'rgba(255,255,255,.11)');
            surface.addColorStop(.53, 'rgba(255,255,255,0)');
            surface.addColorStop(.82, 'rgba(0,0,0,.1)');
            surface.addColorStop(1, 'rgba(0,0,0,.23)');
            ctx.fillStyle = surface;
            ctx.fillRect(arc.x - radius, arc.y - radius, radius * 2, radius * 2);

            // Cross-section shading makes a convex machined rim, with a darker inner lip.
            if (arc.inner > 0) {
                const bevel = ctx.createRadialGradient(arc.x, arc.y, arc.inner, arc.x, arc.y, radius);
                bevel.addColorStop(0, 'rgba(0,0,0,.23)');
                bevel.addColorStop(.12, 'rgba(255,255,255,.08)');
                bevel.addColorStop(.32, 'rgba(255,255,255,.2)');
                bevel.addColorStop(.67, 'rgba(255,255,255,.03)');
                bevel.addColorStop(.9, 'rgba(255,255,255,.1)');
                bevel.addColorStop(1, 'rgba(0,0,0,.13)');
                ctx.fillStyle = bevel;
                ctx.fillRect(arc.x - radius, arc.y - radius, radius * 2, radius * 2);
            }

            const reflection = ctx.createRadialGradient(arc.x - radius * .4, arc.y - radius * .58, 0, arc.x - radius * .4, arc.y - radius * .58, radius * .9);
            reflection.addColorStop(0, 'rgba(255,255,255,.27)');
            reflection.addColorStop(.27, 'rgba(255,255,255,.09)');
            reflection.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = reflection;
            ctx.fillRect(arc.x - radius, arc.y - radius, radius * 2, radius * 2);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.arc(arc.x, arc.y, radius - .35, arc.start + .002, arc.end - .002);
            const edge = ctx.createLinearGradient(arc.x, arc.y - radius, arc.x, arc.y + radius);
            edge.addColorStop(0, 'rgba(255,255,255,.58)');
            edge.addColorStop(.45, 'rgba(255,255,255,.13)');
            edge.addColorStop(1, 'rgba(255,255,255,.03)');
            ctx.strokeStyle = edge;
            ctx.lineWidth = .8;
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawLineShadow(ctx, meta, chart) {
        if (!meta.dataset || typeof meta.dataset.draw !== 'function') return;
        ctx.save();
        try {
            ctx.globalAlpha = .26;
            ctx.translate(0, 3.5);
            ctx.shadowColor = 'rgba(0,0,0,.5)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 3;
            meta.dataset.draw(ctx, chart.chartArea);
        } finally {
            ctx.restore();
        }
    }

    function drawPointMaterials(ctx, elements) {
        for (const point of elements) {
            const radius = number(point?.options?.radius);
            if (!point || point.skip || point.hidden || radius < 1 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
            ctx.save();
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, TAU);
            ctx.clip();
            const lens = ctx.createRadialGradient(point.x - radius * .38, point.y - radius * .45, 0, point.x, point.y, radius);
            lens.addColorStop(0, 'rgba(255,255,255,.68)');
            lens.addColorStop(.35, 'rgba(255,255,255,.1)');
            lens.addColorStop(.7, 'rgba(0,0,0,0)');
            lens.addColorStop(1, 'rgba(0,0,0,.25)');
            ctx.fillStyle = lens;
            ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
            ctx.restore();
        }
    }

    function settings(options) {
        return { enabled: options?.enabled !== false, depth: clamp(number(options?.depth, 8), 0, 14) };
    }

    function describeChart(chart) {
        const canvas = chart.canvas;
        if (!canvas?.getAttribute || !canvas?.setAttribute) return;
        if (!canvas.hasAttribute('role')) canvas.setAttribute('role', 'img');
        const existing = canvas.getAttribute('aria-label');
        if (existing && existing !== automaticLabels.get(canvas)) return;
        const labels = chart.data?.labels || [];
        const formatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
        const descriptions = (chart.data?.datasets || []).map((dataset) => {
            const values = (dataset.data || []).map((value, index) => {
                const raw = value && typeof value === 'object' ? value.y ?? value.r : value;
                return `${labels[index] ?? index + 1}: ${raw == null || !Number.isFinite(Number(raw)) ? 'sem valor' : formatter.format(Number(raw))}`;
            });
            return `${dataset.label || 'Valores'} — ${values.join('; ')}`;
        });
        const description = `Gráfico financeiro. ${descriptions.join('. ')}.`;
        canvas.setAttribute('aria-label', description);
        automaticLabels.set(canvas, description);
    }

    const plugin = {
        id: 'gbmDepth',
        defaults: { enabled: true, depth: 8 },
        afterUpdate: describeChart,
        beforeDatasetDraw(chart, args, pluginOptions) {
            const options = settings(pluginOptions);
            if (!options.enabled || options.depth <= 0) return;
            const meta = args.meta || chart.getDatasetMeta(args.index);
            withinChart(chart, (ctx) => {
                if (meta.type === 'bar') drawBarSides(ctx, meta.data, options);
                else if (['doughnut', 'pie', 'polarArea'].includes(meta.type)) drawArcSides(ctx, meta.data, options);
                else if (['line', 'radar'].includes(meta.type)) drawLineShadow(ctx, meta, chart);
            });
        },
        afterDatasetDraw(chart, args, pluginOptions) {
            const options = settings(pluginOptions);
            if (!options.enabled || options.depth <= 0) return;
            const meta = args.meta || chart.getDatasetMeta(args.index);
            withinChart(chart, (ctx) => {
                if (meta.type === 'bar') drawBarFaces(ctx, meta.data);
                else if (['doughnut', 'pie', 'polarArea'].includes(meta.type)) drawArcFaces(ctx, meta.data);
                else if (['line', 'radar', 'scatter', 'bubble'].includes(meta.type)) drawPointMaterials(ctx, meta.data);
            });
        }
    };

    function register(Chart = global.Chart) {
        if (!Chart || typeof Chart.register !== 'function') return false;
        if (!registered.has(Chart)) {
            Chart.register(plugin);
            registered.add(Chart);
        }
        return true;
    }

    // No timers, extra animation frames, WebGL contexts or altered financial values.
    global.GBMChartDepth = Object.freeze({ version: '1.0.0', register });
    if (!register() && global.document) global.document.addEventListener('DOMContentLoaded', () => register(), { once: true });
})(typeof window !== 'undefined' ? window : globalThis);
