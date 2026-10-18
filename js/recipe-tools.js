/*
 * Recipe page tools: serving scaler, US/metric, checkboxes, cook mode and nicely
 * typeset fractions.
 *
 * Works on any recipe written with "## Ingredients" and "## Steps" sections
 * (see README.md). Pages without them only get the fraction formatting.
 */
// Fraction formatting comes from js/fractions.js (window.fairvopiaFractions).
var fairvopiaFractions = window.fairvopiaFractions;

(function () {
    var body = document.querySelector('.recipe-body');
    var ingHeading = document.getElementById('ingredients');
    var stepsHeading = document.getElementById('steps');
    if (body && !(ingHeading && stepsHeading)) fairvopiaFractions.format(body);
    if (!body || !ingHeading || !stepsHeading) return;

    // Everything between one h2 and the next h2
    function sectionAfter(h2) {
        var out = [];
        for (var el = h2.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) out.push(el);
        return out;
    }
    var ingredientItems = [];
    sectionAfter(ingHeading).forEach(function (el) {
        if (el.tagName === 'UL') ingredientItems = ingredientItems.concat([].slice.call(el.children));
    });
    ingredientItems.forEach(function (li) { li.classList.add('ingredient'); });

    // =====================================================================
    // Serving scaler: changes the leading quantity of each ingredient
    // =====================================================================
    var UNICODE_FRACTIONS = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅕': 0.2, '⅘': 0.8,
        '⅖': 0.4, '⅗': 0.6, '⅙': 1 / 6, '⅚': 5 / 6, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
    // "1 1/2", "1/2", "2.5", "3 ¾", "½" (longest forms first)
    var NUM = '(?:\\d+\\s+\\d+\\s*[\\/⁄]\\s*\\d+|\\d+\\s*[\\/⁄]\\s*\\d+|\\d+(?:\\.\\d+)?(?:\\s*[¼½¾⅓⅔⅛⅕⅘⅖⅗⅙⅚⅜⅝⅞])?|[¼½¾⅓⅔⅛⅕⅘⅖⅗⅙⅚⅜⅝⅞])';
    var QTY = new RegExp('^(\\s*(?:at least|about|approx\\.?|~)?\\s*)(' + NUM + ')(\\s*(?:-|to)\\s*(' + NUM + '))?', 'i');
    // Later in a line, "1-2 cm thick" or "350 degrees" describe the method, not an amount
    var NOT_AMOUNT = /^\s*(cm|mm|inch|inches|in\b|degrees|°|minutes?|mins?|hours?|hrs?|seconds?)/i;

    function parseNum(s) {
        s = s.trim().replace(/\s*[\/⁄]\s*/g, '/');
        var total = 0;
        s.replace(/[¼½¾⅓⅔⅛⅕⅘⅖⅗⅙⅚⅜⅝⅞]/g, function (c) { total += UNICODE_FRACTIONS[c]; return ''; })
            .split(/\s+/).forEach(function (part) {
                if (!part) return;
                if (part.indexOf('/') > 0) { var p = part.split('/'); total += +p[0] / +p[1]; }
                else total += +part;
            });
        return total;
    }
    function formatNum(n) {
        if (n >= 10) return String(Math.round(n));
        var whole = Math.floor(n + 1e-9), frac = n - whole;
        var options = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
        var best = options[0];
        options.forEach(function (o) { if (Math.abs(frac - o[0]) < Math.abs(frac - best[0])) best = o; });
        if (best[0] === 1) { whole += 1; best = options[0]; }
        if (Math.abs(frac - best[0]) > 0.07) return String(Math.round(n * 10) / 10);   // e.g. 2.4
        if (!whole && !best[1]) return '0';
        return (whole ? whole + (best[1] ? ' ' : '') : '') + best[1];
    }
    // Wrap each scalable quantity in <span class="qty">; quantities at the start of the
    // item and at the start of each comma-separated part ("1 red pepper, 1 green pepper")
    function markQuantities(li) {
        [].slice.call(li.childNodes).forEach(function (node) {
            if (node.nodeType !== 3) return;
            var parts = node.nodeValue.split(/(,\s*)/);
            var frag = document.createDocumentFragment(), changed = false;
            parts.forEach(function (part, i) {
                var m = (i % 2 === 0) && part.match(QTY);
                // "1 inch ginger" at the start is an amount; ", 1-2 cm thick" later on is not
                if (m && (i === 0 || !NOT_AMOUNT.test(part.slice(m[0].length)))) {
                    frag.appendChild(document.createTextNode(m[1]));
                    var span = document.createElement('span');
                    span.className = 'qty';
                    span.textContent = m[0].slice(m[1].length);
                    span.setAttribute('data-original', span.textContent);
                    span.setAttribute('data-from', parseNum(m[2]));
                    if (m[4]) span.setAttribute('data-to', parseNum(m[4]));
                    frag.appendChild(span);
                    var rest = part.slice(m[0].length);
                    // A measurement ("cups", "oz", "lbs") can switch to metric; a count word
                    // ("cloves", "cans") just changes between singular and plural
                    var mu = rest.match(MEASURE);
                    var w = mu || rest.match(/^(\s*)([A-Za-z]+)/);
                    var forms = mu ? measureForms(mu[2]) : w && unitForms(w[2]);
                    if (forms) {
                        frag.appendChild(document.createTextNode(w[1]));
                        var unit = document.createElement('span');
                        unit.className = 'unit';
                        unit.textContent = w[2];
                        unit.setAttribute('data-original', w[2]);
                        unit.setAttribute('data-one', forms[0]);
                        unit.setAttribute('data-many', forms[1]);
                        if (mu) {
                            unit.setAttribute('data-measure', forms[2]);
                            var grams = forms[2] === 'cup' && gramsPerCup(li.textContent);
                            if (grams) unit.setAttribute('data-grams', grams);
                        }
                        frag.appendChild(unit);
                        rest = rest.slice(w[0].length);
                        // "1 cup (5 oz/142 g) flour": the recipe already gives the metric amount,
                        // so use it, and hide the bracket while metric is on
                        var given = mu && rest.match(/^(\s*)(\([^)]*?(\d+(?:\.\d+)?)\s*(g|ml)\s*\))/i);
                        if (given) {
                            unit.setAttribute('data-given', +given[3] / parseNum(m[2]));
                            unit.setAttribute('data-given-unit', given[4].toLowerCase());
                            frag.appendChild(document.createTextNode(given[1]));
                            var paren = document.createElement('span');
                            paren.className = 'given-metric';
                            paren.textContent = given[2];
                            frag.appendChild(paren);
                            rest = rest.slice(given[0].length);
                        }
                    }
                    frag.appendChild(document.createTextNode(rest));
                    changed = true;
                } else {
                    frag.appendChild(document.createTextNode(part));
                }
            });
            if (changed) li.replaceChild(frag, node);
        });
    }
    var PLURALS = { cup: 'cups', can: 'cans', egg: 'eggs', clove: 'cloves', bunch: 'bunches', stalk: 'stalks', tray: 'trays',
        sheet: 'sheets', stick: 'sticks', head: 'heads', sprig: 'sprigs', bag: 'bags', jar: 'jars', slice: 'slices', pod: 'pods',
        pinch: 'pinches', handful: 'handfuls', lemon: 'lemons', lime: 'limes', onion: 'onions', carrot: 'carrots', leek: 'leeks',
        potato: 'potatoes', tomato: 'tomatoes', quart: 'quarts', loaf: 'loaves', piece: 'pieces', package: 'packages', block: 'blocks' };
    var SINGULARS = {};
    Object.keys(PLURALS).forEach(function (k) { SINGULARS[PLURALS[k]] = k; });
    function unitForms(word) {
        var lower = word.toLowerCase();
        var one = PLURALS[lower] ? lower : SINGULARS[lower];
        if (!one) return null;
        var cap = word[0] !== lower[0] ? function (s) { return s[0].toUpperCase() + s.slice(1); } : function (s) { return s; };
        return [cap(one), cap(PLURALS[one])];
    }

    // =====================================================================
    // US / metric: cups, ounces, pounds, quarts and inches. Spoons stay as they are,
    // since metric recipes use teaspoons and tablespoons too.
    // =====================================================================
    var MEASURE = /^(\s*)(fl\.?\s*oz\.?|fluid ounces?|cups?|oz\.?|ounces?|lbs?\.?|pounds?|quarts?|qts?\.?|inch(?:es)?)(?=[\s,).;]|$)/i;
    function measureForms(word) {
        var w = word.toLowerCase().replace(/\.$/, '');
        if (/^fl|^fluid/.test(w)) return [word, word, 'floz'];
        if (/^cup/.test(w)) return ['cup', 'cups', 'cup'];
        if (/^(oz|ounce)/.test(w)) return [word, word, 'oz'];
        if (/^(lb|pound)/.test(w)) return [word, word, 'lb'];
        if (/^(quart|qt)/.test(w)) return [w.indexOf('quart') === 0 ? 'quart' : word, w.indexOf('quart') === 0 ? 'quarts' : word, 'quart'];
        return ['inch', 'inches', 'inch'];
    }
    // Grams in one US cup, for common dry ingredients. Anything else (and any liquid)
    // is converted to millilitres instead.
    var CUP_GRAMS = [
        ['powdered sugar', 120], ['icing sugar', 120], ['brown sugar', 220], ['palm sugar', 190], ['sugar', 200],
        ['bread flour', 130], ['masa', 115], ['flour', 125], ['corn starch', 128], ['cornstarch', 128], ['cocoa', 85],
        ['oats', 90], ['rice', 185], ['bread crumbs', 110], ['breadcrumbs', 110], ['panko', 60],
        ['parmesan', 100], ['mozzarella', 113], ['feta', 150], ['ricotta', 245], ['queso', 120], ['cheese', 113],
        ['butter', 227], ['almond', 140], ['cashew', 140], ['walnut', 120], ['pecan', 110], ['peanut', 145],
        ['chocolate', 170], ['coconut flakes', 85], ['shredded coconut', 85], ['raisin', 150], ['lentil', 190],
        ['quinoa', 170], ['couscous', 180], ['peas', 145], ['beans', 180], ['blueberr', 145], ['raspberr', 125],
        ['strawberr', 150], ['berries', 145], ['cherry tomatoes', 150], ['tomato', 180], ['spinach', 30],
        ['cilantro', 16], ['parsley', 30], ['basil', 24], ['mint', 25], ['mushroom', 70], ['onion', 160],
        ['yogurt', 245], ['honey', 340]
    ];
    var LIQUID = /\b(milk|cream|stock|broth|water|oil|vinegar|wine|juice|sauce|syrup|liqueur|whiskey|cognac|brandy|rum|beer|molasses)\b/i;
    function gramsPerCup(line) {
        var text = line.toLowerCase();
        if (LIQUID.test(text)) return 0;
        for (var i = 0; i < CUP_GRAMS.length; i++) if (text.indexOf(CUP_GRAMS[i][0]) !== -1) return CUP_GRAMS[i][1];
        return 0;
    }
    function roundMetric(v, unit) {
        if (unit === 'kg' || unit === 'L') return String(Math.round(v * 10) / 10);
        if (unit === 'cm') return String(v < 10 ? Math.round(v * 2) / 2 : Math.round(v));
        if (v < 30) return String(Math.max(1, Math.round(v)));
        if (v < 200) return String(Math.round(v / 5) * 5);
        return String(Math.round(v / 10) * 10);
    }
    function toMetric(measure, from, to, grams) {
        var rate = { cup: grams ? [grams, 'g'] : [240, 'ml'], floz: [29.57, 'ml'], quart: [946, 'ml'],
                     oz: [28.35, 'g'], lb: [453.6, 'g'], inch: [2.54, 'cm'] }[measure];
        var a = from * rate[0], b = to != null ? to * rate[0] : null, unit = rate[1];
        if ((unit === 'g' || unit === 'ml') && Math.max(a, b || 0) >= 1000) {
            a /= 1000; if (b != null) b /= 1000; unit = unit === 'g' ? 'kg' : 'L';
        }
        return { text: roundMetric(a, unit) + (b != null ? '–' + roundMetric(b, unit) : ''), unit: unit };
    }

    // Oven temperatures in the steps: "350 degrees Fahrenheit" -> "180°C"
    // (left alone when a Celsius value is already given, as in "350°F (180°C)")
    var TEMP = /(\d{3})(\s*(?:°\s*F\b|degrees?\s+F(?:ahrenheit)?\b|degrees?\b))(?!\s*\(\s*\d+\s*°?\s*C)/gi;
    function celsius(f) {
        var c = (f - 32) * 5 / 9;
        return c >= 100 ? Math.round(c / 5) * 5 : Math.round(c);
    }
    function metricTemps(text) {
        return text.replace(TEMP, function (all, f, rest) {
            if (+f < 200 && !/F/i.test(rest)) return all;   // a plain "120 degrees" may not be an oven
            return celsius(+f) + '°C';
        });
    }
    function markTemps(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(function (node) {
            TEMP.lastIndex = 0;
            if (!TEMP.test(node.nodeValue)) return;
            var frag = document.createDocumentFragment(), last = 0, m;
            TEMP.lastIndex = 0;
            while ((m = TEMP.exec(node.nodeValue))) {
                if (+m[1] < 200 && !/F/i.test(m[2])) continue;
                frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
                var span = document.createElement('span');
                span.className = 'temp';
                span.textContent = m[0];
                span.setAttribute('data-original', m[0]);
                span.setAttribute('data-c', celsius(+m[1]) + '°C');
                frag.appendChild(span);
                last = m.index + m[0].length;
            }
            frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
            node.parentNode.replaceChild(frag, node);
        });
    }

    ingredientItems.forEach(markQuantities);
    sectionAfter(stepsHeading).forEach(function (el) { if (el.tagName === 'OL' || el.tagName === 'P') markTemps(el); });

    // =====================================================================
    // Shopping checkboxes: tick ingredients off. Ticks are remembered on this
    // device (so they survive a reload at the store) and shared with cook mode.
    // =====================================================================
    var STORE_KEY = 'fairvopia-checked:' + location.pathname;
    var checked = {};
    try { checked = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (err) { checked = {}; }

    ingredientItems.forEach(function (li, i) {
        var label = document.createElement('label');
        label.className = 'ing-check';
        var box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('data-i', i);
        box.setAttribute('aria-label', 'Got it');
        var text = document.createElement('span');
        text.className = 'ing-text';
        while (li.firstChild) text.appendChild(li.firstChild);
        label.appendChild(box);
        label.appendChild(text);
        li.appendChild(label);
        li.parentNode.classList.add('ingredient-list');
    });

    function setChecked(i, on) {
        if (on) checked[i] = true; else delete checked[i];
        try {
            if (Object.keys(checked).length) localStorage.setItem(STORE_KEY, JSON.stringify(checked));
            else localStorage.removeItem(STORE_KEY);
        } catch (err) {}
        showChecks();
    }
    function showChecks() {
        ingredientItems.forEach(function (li, i) {
            var on = !!checked[i];
            li.querySelector('.ing-check input').checked = on;
            li.classList.toggle('is-checked', on);
        });
        [].forEach.call(document.querySelectorAll('.cm-ingredients input[data-i]'), function (box) {
            box.checked = !!checked[box.getAttribute('data-i')];
        });
        var clear = document.querySelector('.ing-clear');
        if (clear) clear.hidden = !Object.keys(checked).length;
    }
    document.addEventListener('change', function (e) {
        var box = e.target;
        if (box.matches && box.matches('.ing-check input, .cm-ingredients input[data-i]')) {
            setChecked(box.getAttribute('data-i'), box.checked);
        }
    });

    // Current amounts: the serving factor and US or metric units (remembered across recipes)
    var factor = 1;
    var metric = false;
    try { metric = localStorage.getItem('fairvopia-units') === 'metric'; } catch (err) {}

    function scaleTo(f) { factor = f; render(); }
    // A cook-mode step's text, with oven temperatures in °C when metric is on
    function stepText(step) { return metric ? metricTemps(step.text) : step.text; }
    function setUnits(isMetric) {
        metric = isMetric;
        try { localStorage.setItem('fairvopia-units', metric ? 'metric' : 'us'); } catch (err) {}
        render();
    }
    function render() {
        [].forEach.call(body.querySelectorAll('.qty'), function (span) {
            var unit = span.nextSibling && span.nextSibling.nextSibling;
            if (!(unit && unit.classList && unit.classList.contains('unit'))) unit = null;
            var from = +span.getAttribute('data-from') * factor;
            var to = span.getAttribute('data-to') ? +span.getAttribute('data-to') * factor : null;
            var measure = unit && unit.getAttribute('data-measure');
            // Highlight amounts that were converted to metric
            span.classList.toggle('converted', !!(metric && measure));
            if (unit) unit.classList.toggle('converted', !!(metric && measure));
            if (metric && measure && unit.getAttribute('data-given')) {
                var per = +unit.getAttribute('data-given'), gu = unit.getAttribute('data-given-unit');
                // The recipe's own number, kept exact (just rounded to a whole gram or millilitre)
                span.textContent = Math.round(from * per) + (to != null ? '–' + Math.round(to * per) : '');
                unit.textContent = gu;
            } else if (metric && measure) {
                var m = toMetric(measure, from, to, +unit.getAttribute('data-grams') || 0);
                span.textContent = m.text;
                unit.textContent = m.unit;
            } else if (factor === 1) {
                span.innerHTML = fairvopiaFractions.toHTML(fairvopiaFractions.esc(span.getAttribute('data-original')));
                if (unit) unit.textContent = unit.getAttribute('data-original');
            } else {
                span.innerHTML = fairvopiaFractions.toHTML(formatNum(from) + (to != null ? '–' + formatNum(to) : ''));
                if (unit) unit.textContent = unit.getAttribute((to != null ? to : from) > 1 ? 'data-many' : 'data-one');
            }
        });
        [].forEach.call(body.querySelectorAll('.given-metric'), function (p) { p.hidden = metric; });
        [].forEach.call(body.querySelectorAll('.temp'), function (t) {
            t.textContent = t.getAttribute(metric ? 'data-c' : 'data-original');
        });
        [].forEach.call(document.querySelectorAll('.scale-btn'), function (b) {
            b.classList.toggle('active', +b.getAttribute('data-factor') === factor);
        });
        [].forEach.call(document.querySelectorAll('.unit-btn'), function (b) {
            var on = (b.getAttribute('data-units') === 'metric') === metric;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on);
        });
        body.classList.toggle('is-scaled', factor !== 1);
    }

    var tools = document.createElement('div');
    tools.className = 'recipe-tools';
    tools.innerHTML =
        '<span class="tools-left">' +
            '<span class="scale-group" role="group" aria-label="Scale the recipe">' +
                '<span class="scale-label">Amounts</span>' +
                [0.5, 1, 2, 3].map(function (f) {
                    return '<button type="button" class="scale-btn' + (f === 1 ? ' active' : '') + '" data-factor="' + f + '">' +
                        (f === 0.5 ? '½×' : f + '×') + '</button>';
                }).join('') +
            '</span>' +
            '<span class="scale-group" role="group" aria-label="Units">' +
                '<span class="scale-label">Units</span>' +
                '<button type="button" class="unit-btn active" data-units="us" aria-pressed="true">US</button>' +
                '<button type="button" class="unit-btn" data-units="metric" aria-pressed="false">Metric</button>' +
            '</span>' +
        '</span>' +
        '<span class="tools-right">' +
            '<button type="button" class="share-btn"><i class="fa fa-share-alt"></i> Share</button>' +
            '<button type="button" class="ing-clear" hidden><i class="fa fa-undo"></i> Clear ticks</button>' +
            '<button type="button" class="cook-start"><i class="fa fa-cutlery"></i> Start cooking</button>' +
        '</span>';
    ingHeading.parentNode.insertBefore(tools, ingHeading);
    tools.addEventListener('click', function (e) {
        var b = e.target.closest('.scale-btn');
        if (b) scaleTo(+b.getAttribute('data-factor'));
        var u = e.target.closest('.unit-btn');
        if (u) setUnits(u.getAttribute('data-units') === 'metric');
        if (e.target.closest('.cook-start')) openCookMode();
        if (e.target.closest('.share-btn')) shareRecipe();
        if (e.target.closest('.ing-clear')) {
            checked = {};
            setChecked(-1, false);
        }
    });
    // Share: the phone's own share menu where available, otherwise copy the link
    function shareRecipe() {
        var title = (document.querySelector('.post-heading h1') || {}).textContent || document.title;
        var link = document.querySelector('link[rel="canonical"]');
        var url = link ? link.href : location.href.split('#')[0];
        if (navigator.share) {
            navigator.share({ title: title, text: title + ' on Fairvopia', url: url }).catch(function () {});
            return;
        }
        var toast = window.fairvopiaToast || function () {};
        (window.fairvopiaCopy ? window.fairvopiaCopy(url) : Promise.reject()).then(function () {
            toast('<i class="fa fa-check" aria-hidden="true"></i>Link copied. Paste it anywhere to share.');
        }, function () {
            toast('Copy this link to share: ' + url);
        });
    }

    showChecks();
    render();   // apply metric units if this visitor chose them before

    // =====================================================================
    // Cook mode: one step at a time, read aloud, timers, screen stays on
    // =====================================================================
    var steps = [];
    var currentSection = '';
    sectionAfter(stepsHeading).forEach(function (el) {
        if (el.tagName === 'H3') currentSection = el.textContent.trim();
        if (el.tagName !== 'OL') return;
        [].forEach.call(el.children, function (li) {
            splitLongStep(li.textContent.trim()).forEach(function (text) {
                steps.push({ section: currentSection, text: text });
            });
        });
    });
    if (!steps.length) { tools.querySelector('.cook-start').style.display = 'none'; }

    // Long paragraphs are split into chunks of a couple of sentences
    function splitLongStep(text) {
        if (text.length < 320) return [text];
        var sentences = text.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g) || [text];
        var chunks = [], cur = '';
        sentences.forEach(function (s) {
            if (cur && (cur + s).length > 240) { chunks.push(cur.trim()); cur = ''; }
            cur += s;
        });
        if (cur.trim()) chunks.push(cur.trim());
        return chunks;
    }

    // ---- Timers: find "10 minutes", "one hour and fifteen minutes", "8-10 minutes" ----
    var WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
        eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fortyfive: 45, fifty: 50, sixty: 60, ninety: 90, half: 0.5 };
    var N = '(\\d+(?:\\.\\d+)?|' + Object.keys(WORDS).sort(function (a, b) { return b.length - a.length; }).join('|') + ')';
    var DURATION = new RegExp(N + '(?:\\s*(?:-|to)\\s*' + N + ')?\\s*(hours?|hrs?|minutes?|mins?)(?:\\s*and\\s*' + N + '\\s*(minutes?|mins?))?', 'gi');
    function toNum(s) { s = s.toLowerCase(); return WORDS.hasOwnProperty(s) ? WORDS[s] : parseFloat(s); }
    function findTimers(text) {
        var found = [], m;
        DURATION.lastIndex = 0;
        while ((m = DURATION.exec(text))) {
            var n = toNum(m[1]);
            var secs = /^h/i.test(m[3]) ? n * 3600 : n * 60;
            if (m[4]) secs += toNum(m[4]) * 60;
            if (secs >= 30 && secs <= 12 * 3600) found.push({ label: m[0].replace(/\s+/g, ' '), secs: Math.round(secs) });
        }
        return found;
    }
    function fmtTime(s) {
        var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + sec).slice(-2);
    }

    var overlay, ui = {}, index = 0, readAloud = false, wakeLock = null, recognition = null, listening = false;
    var timers = [];

    function buildOverlay() {
        overlay = document.createElement('div');
        overlay.className = 'cook-mode';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Cook mode');
        overlay.innerHTML =
            '<div class="cm-top">' +
                '<span class="cm-title"></span>' +
                '<span class="cm-top-buttons">' +
                    '<button type="button" class="cm-btn cm-ingredients-btn"><i class="fa fa-list"></i> <span>Ingredients</span></button>' +
                    '<button type="button" class="cm-btn cm-read" aria-pressed="false"><i class="fa fa-volume-up"></i> <span>Read aloud</span></button>' +
                    '<button type="button" class="cm-btn cm-voice" aria-pressed="false" title="Say &quot;next&quot;, &quot;back&quot; or &quot;repeat&quot;"><i class="fa fa-microphone"></i> <span>Voice</span></button>' +
                    '<button type="button" class="cm-btn cm-close" aria-label="Close cook mode"><i class="fa fa-times"></i></button>' +
                '</span>' +
            '</div>' +
            '<div class="cm-ingredients" hidden></div>' +
            '<div class="cm-main">' +
                '<div class="cm-progress"></div>' +
                '<div class="cm-section"></div>' +
                '<p class="cm-step" aria-live="polite"></p>' +
                '<div class="cm-step-timers"></div>' +
            '</div>' +
            '<div class="cm-timers"></div>' +
            '<div class="cm-nav">' +
                '<button type="button" class="cm-nav-btn cm-prev"><i class="fa fa-chevron-left"></i> Back</button>' +
                '<button type="button" class="cm-nav-btn cm-repeat" title="Read this step again"><i class="fa fa-repeat"></i></button>' +
                '<button type="button" class="cm-nav-btn cm-next">Next <i class="fa fa-chevron-right"></i></button>' +
            '</div>' +
            '<div class="cm-hint"></div>' +
            '<div class="cm-celebrate" hidden>' +
                '<canvas class="cm-confetti" aria-hidden="true"></canvas>' +
                '<div class="cm-celebrate-box" role="status">' +
                    '<div class="cm-celebrate-icon" aria-hidden="true"><i class="fa fa-cutlery"></i></div>' +
                    '<h2>Enjoy your meal!</h2>' +
                    '<p>You cooked <strong class="cm-dish"></strong>.</p>' +
                    '<button type="button" class="passport-btn cm-stamp"><i class="fa fa-check-circle-o" aria-hidden="true"></i> <span>Stamp my passport</span></button>' +
                    '<div class="cm-celebrate-links">' +
                        '<button type="button" class="cm-again">Back to the steps</button>' +
                        '<button type="button" class="cm-finish">Close cook mode</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        ['title', 'ingredients', 'progress', 'section', 'step', 'step-timers', 'timers', 'prev', 'next', 'read', 'voice', 'hint']
            .forEach(function (k) { ui[k] = overlay.querySelector('.cm-' + k); });
        ui.title.textContent = (document.querySelector('.post-heading h1') || {}).textContent || '';

        var list = document.createElement('ul');
        ingredientItems.forEach(function (li, i) {
            var item = document.createElement('li');
            item.innerHTML = '<label><input type="checkbox" data-i="' + i + '"> <span></span></label>';
            item.querySelector('span').textContent = li.textContent;
            list.appendChild(item);
        });
        ui.ingredients.appendChild(list);

        if (!('speechSynthesis' in window)) { ui.read.style.display = 'none'; overlay.querySelector('.cm-repeat').style.display = 'none'; }
        if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) ui.voice.style.display = 'none';

        overlay.addEventListener('click', function (e) {
            var t = e.target;
            if (t.closest('.cm-close')) closeCookMode();
            else if (t.closest('.cm-next')) go(index + 1);
            else if (t.closest('.cm-prev')) go(index - 1);
            else if (t.closest('.cm-repeat')) speak(stepText(steps[index]), true);
            else if (t.closest('.cm-read')) setReadAloud(!readAloud);
            else if (t.closest('.cm-voice')) setVoice(!listening);
            else if (t.closest('.cm-ingredients-btn')) ui.ingredients.hidden = !ui.ingredients.hidden;
            else if (t.closest('.cm-timer-chip')) startTimer(+t.closest('.cm-timer-chip').getAttribute('data-secs'), t.closest('.cm-timer-chip').getAttribute('data-label'));
            else if (t.closest('.cm-timer-cancel')) cancelTimer(+t.closest('.cm-timer').getAttribute('data-id'));
            else if (t.closest('.cm-stamp')) stampFromCookMode();
            else if (t.closest('.cm-again')) { hideCelebration(); go(steps.length - 1); }
            else if (t.closest('.cm-finish')) closeCookMode();
        });
    }

    function openCookMode() {
        if (!overlay) buildOverlay();
        // Show the amounts as currently scaled
        [].forEach.call(ui.ingredients.querySelectorAll('li span'), function (span, i) {
            span.innerHTML = fairvopiaFractions.toHTML(fairvopiaFractions.esc(ingredientItems[i].innerText.trim()));   // visible text, in the chosen units
        });
        showChecks();
        overlay.classList.add('open');
        document.documentElement.classList.add('cook-mode-open');
        requestWakeLock();
        go(index);
    }
    // ---- Finished! Confetti, and a one-tap passport stamp ----
    function celebrate() {
        var box = overlay.querySelector('.cm-celebrate');
        overlay.querySelector('.cm-dish').textContent = ui.title.textContent;
        updateStampButton();
        box.hidden = false;
        speak('That was the last step. Enjoy your meal!', true);
        if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) confetti(overlay.querySelector('.cm-confetti'));
    }
    function hideCelebration() {
        var box = overlay && overlay.querySelector('.cm-celebrate');
        if (box) box.hidden = true;
    }
    function updateStampButton() {
        var btn = overlay.querySelector('.cm-stamp');
        var on = !!(window.fairvopiaPassport && window.fairvopiaPassport.has(location.pathname));
        btn.classList.toggle('stamped', on);
        btn.querySelector('span').textContent = on ? 'In your passport' : 'Stamp my passport';
        btn.querySelector('.fa').className = 'fa ' + (on ? 'fa-check-circle' : 'fa-check-circle-o');
    }
    function stampFromCookMode() {
        if (!window.fairvopiaPassport) return;
        if (!window.fairvopiaPassport.has(location.pathname)) window.fairvopiaPassport.add(location.pathname);
        updateStampButton();
    }
    // A short burst of paper confetti on a canvas (about three seconds)
    function confetti(canvas) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width = canvas.offsetWidth, h = canvas.height = canvas.offsetHeight;
        var colors = ['#e8772e', '#f2b705', '#1f7a63', '#3d6fd6', '#d9480f', '#f4a259'];
        var bits = [];
        for (var n = 0; n < 160; n++) {
            bits.push({ x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
                size: 6 + Math.random() * 6, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.4, color: colors[n % colors.length] });
        }
        var start = performance.now();
        (function frame(now) {
            var t = now - start;
            ctx.clearRect(0, 0, w, h);
            bits.forEach(function (b) {
                b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.rot += b.spin;
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - t / 3200);
                ctx.translate(b.x, b.y); ctx.rotate(b.rot);
                ctx.fillStyle = b.color;
                ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
                ctx.restore();
            });
            if (t < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
        })(start);
    }

    function closeCookMode() {
        hideCelebration();
        overlay.classList.remove('open');
        document.documentElement.classList.remove('cook-mode-open');
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        setVoice(false);
        if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
    }

    function go(i) {
        if (i >= steps.length) { celebrate(); return; }
        if (i < 0) return;
        hideCelebration();
        index = i;
        var step = steps[i];
        ui.progress.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
        ui.section.textContent = step.section;
        ui.section.style.display = step.section ? '' : 'none';
        ui.step.innerHTML = fairvopiaFractions.toHTML(fairvopiaFractions.esc(stepText(step)));
        ui['step-timers'].innerHTML = findTimers(step.text).map(function (t) {
            return '<button type="button" class="cm-timer-chip" data-secs="' + t.secs + '" data-label="' + t.label.replace(/"/g, '') + '">' +
                '<i class="fa fa-clock-o"></i> Start ' + t.label + ' timer</button>';
        }).join('');
        ui.prev.disabled = i === 0;
        ui.next.innerHTML = i === steps.length - 1 ? 'Done <i class="fa fa-check"></i>' : 'Next <i class="fa fa-chevron-right"></i>';
        if (readAloud) speak((step.section && (i === 0 || steps[i - 1].section !== step.section) ? step.section + '. ' : '') + stepText(step));
    }

    // ---- Read aloud (built into the browser, works offline) ----
    function speak(text, force) {
        if (!('speechSynthesis' in window) || (!readAloud && !force)) return;
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = document.documentElement.lang || 'en';
        u.rate = 0.95;
        // Don't let the microphone hear the page talking
        u.onstart = function () { pauseListening(true); };
        u.onend = u.onerror = function () { pauseListening(false); };
        speechSynthesis.speak(u);
    }
    function setReadAloud(on) {
        readAloud = on;
        ui.read.classList.toggle('on', on);
        ui.read.setAttribute('aria-pressed', on);
        if (on) speak(stepText(steps[index]));
        else if ('speechSynthesis' in window) speechSynthesis.cancel();
    }

    // ---- Keep the screen on while cooking ----
    function requestWakeLock() {
        if (!('wakeLock' in navigator) || wakeLock) return;
        navigator.wakeLock.request('screen').then(function (lock) {
            wakeLock = lock;
            lock.addEventListener('release', function () { wakeLock = null; });
        }).catch(function () {});
    }
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && overlay && overlay.classList.contains('open')) requestWakeLock();
    });

    // ---- Voice control: "next", "back", "repeat", "ingredients", "stop" ----
    function setVoice(on) {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR || !ui.voice) return;
        listening = on;
        ui.voice.classList.toggle('on', on);
        ui.voice.setAttribute('aria-pressed', on);
        ui.hint.textContent = on ? 'Listening… say "next", "back", "repeat" or "ingredients".' : '';
        if (!on) { if (recognition) { recognition.onend = null; recognition.abort(); recognition = null; } return; }
        recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = document.documentElement.lang || 'en';
        recognition.onresult = function (e) {
            var said = e.results[e.results.length - 1][0].transcript.toLowerCase();
            if (/\b(next|forward|continue)\b/.test(said)) go(index + 1);
            else if (/\b(back|previous|go back)\b/.test(said)) go(index - 1);
            else if (/\b(repeat|again|say that)\b/.test(said)) speak(stepText(steps[index]), true);
            else if (/\bingredients?\b/.test(said)) ui.ingredients.hidden = !ui.ingredients.hidden;
            else if (/\b(stop|quiet|pause)\b/.test(said) && 'speechSynthesis' in window) speechSynthesis.cancel();
        };
        recognition.onerror = function (e) {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                setVoice(false);
                ui.hint.textContent = 'Voice control needs microphone permission.';
            }
        };
        // The browser stops listening after a while; start again unless the page is talking
        recognition.onend = function () { if (listening && !speaking) startListening(); };
        startListening();
    }
    var speaking = false;
    function startListening() { try { recognition.start(); } catch (err) {} }
    function pauseListening(pause) {
        speaking = pause;
        if (!recognition || !listening) return;
        if (pause) { try { recognition.abort(); } catch (err) {} }
        else startListening();
    }

    // ---- Timers keep running while you move between steps ----
    var nextTimerId = 1;
    function startTimer(secs, label) {
        var t = { id: nextTimerId++, label: label, end: Date.now() + secs * 1000, done: false };
        timers.push(t);
        renderTimers();
    }
    function cancelTimer(id) {
        timers = timers.filter(function (t) { return t.id !== id; });
        renderTimers();
    }
    function renderTimers() {
        ui.timers.innerHTML = timers.map(function (t) {
            var left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
            return '<div class="cm-timer' + (t.done ? ' done' : '') + '" data-id="' + t.id + '">' +
                '<i class="fa fa-clock-o"></i> <span class="cm-timer-label">' + t.label + '</span> ' +
                '<strong>' + (t.done ? 'Done!' : fmtTime(left)) + '</strong>' +
                '<button type="button" class="cm-timer-cancel" aria-label="Remove timer"><i class="fa fa-times"></i></button></div>';
        }).join('');
    }
    setInterval(function () {
        if (!timers.length) return;
        timers.forEach(function (t) {
            if (!t.done && Date.now() >= t.end) {
                t.done = true;
                beep();
                if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
                speak('Timer done: ' + t.label, true);
            }
        });
        renderTimers();
    }, 1000);
    function beep() {
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            [0, 0.4, 0.8].forEach(function (at) {
                var o = ctx.createOscillator(), g = ctx.createGain();
                o.frequency.value = 880;
                g.gain.setValueAtTime(0.25, ctx.currentTime + at);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.3);
                o.connect(g); g.connect(ctx.destination);
                o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.3);
            });
        } catch (err) {}
    }

    // Typeset fractions in the rest of the recipe (amounts are handled by render() above)
    fairvopiaFractions.format(body, '.qty');

    // ---- Keyboard: arrows to move, space to repeat, Esc to close ----
    document.addEventListener('keydown', function (e) {
        if (!overlay || !overlay.classList.contains('open')) return;
        if (e.key === 'ArrowRight') go(index + 1);
        else if (e.key === 'ArrowLeft') go(index - 1);
        else if (e.key === 'Escape') closeCookMode();
        else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); speak(stepText(steps[index]), true); }
    });
})();
