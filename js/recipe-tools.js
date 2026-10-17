/*
 * Recipe page tools: serving scaler and cook mode.
 *
 * Works on any recipe written with "## Ingredients" and "## Steps" sections
 * (see README.md). Pages without them are left alone.
 */
(function () {
    var body = document.querySelector('.recipe-body');
    var ingHeading = document.getElementById('ingredients');
    var stepsHeading = document.getElementById('steps');
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
    var UNICODE_FRACTIONS = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅕': 0.2, '⅘': 0.8 };
    // "1 1/2", "1/2", "2.5", "3 ¾", "½" (longest forms first)
    var NUM = '(?:\\d+\\s+\\d+\\s*[\\/⁄]\\s*\\d+|\\d+\\s*[\\/⁄]\\s*\\d+|\\d+(?:\\.\\d+)?(?:\\s*[¼½¾⅓⅔⅛⅕⅘])?|[¼½¾⅓⅔⅛⅕⅘])';
    var QTY = new RegExp('^(\\s*(?:at least|about|approx\\.?|~)?\\s*)(' + NUM + ')(\\s*(?:-|to)\\s*(' + NUM + '))?', 'i');
    // Later in a line, "1-2 cm thick" or "350 degrees" describe the method, not an amount
    var NOT_AMOUNT = /^\s*(cm|mm|inch|inches|in\b|degrees|°|minutes?|mins?|hours?|hrs?|seconds?)/i;

    function parseNum(s) {
        s = s.trim().replace(/\s*[\/⁄]\s*/g, '/');
        var total = 0;
        s.replace(/[¼½¾⅓⅔⅛⅕⅘]/g, function (c) { total += UNICODE_FRACTIONS[c]; return ''; })
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
                    var w = rest.match(/^(\s*)([A-Za-z]+)/);
                    var forms = w && unitForms(w[2]);
                    if (forms) {
                        // "1 cup" -> "2 cups": wrap the word so it can change with the amount
                        frag.appendChild(document.createTextNode(w[1]));
                        var unit = document.createElement('span');
                        unit.className = 'unit';
                        unit.textContent = w[2];
                        unit.setAttribute('data-one', forms[0]);
                        unit.setAttribute('data-many', forms[1]);
                        frag.appendChild(unit);
                        rest = rest.slice(w[0].length);
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

    ingredientItems.forEach(markQuantities);

    function scaleTo(factor) {
        [].forEach.call(body.querySelectorAll('.qty'), function (span) {
            var unit = span.nextSibling && span.nextSibling.nextSibling;
            if (factor === 1) {
                span.textContent = span.getAttribute('data-original');
                if (unit && unit.className === 'unit') unit.textContent = unit.getAttribute('data-original') || unit.textContent;
                return;
            }
            var from = +span.getAttribute('data-from') * factor;
            var to = span.getAttribute('data-to');
            span.textContent = formatNum(from) + (to ? '–' + formatNum(+to * factor) : '');
            if (unit && unit.className === 'unit') {
                if (!unit.getAttribute('data-original')) unit.setAttribute('data-original', unit.textContent);
                var amount = to ? +to * factor : from;
                unit.textContent = unit.getAttribute(amount > 1 ? 'data-many' : 'data-one');
            }
        });
        [].forEach.call(document.querySelectorAll('.scale-btn'), function (b) {
            b.classList.toggle('active', +b.getAttribute('data-factor') === factor);
        });
        body.classList.toggle('is-scaled', factor !== 1);
    }

    var tools = document.createElement('div');
    tools.className = 'recipe-tools';
    tools.innerHTML =
        '<div class="scale-group" role="group" aria-label="Scale the recipe">' +
            '<span class="scale-label">Amounts</span>' +
            [0.5, 1, 2, 3].map(function (f) {
                return '<button type="button" class="scale-btn' + (f === 1 ? ' active' : '') + '" data-factor="' + f + '">' +
                    (f === 0.5 ? '½×' : f + '×') + '</button>';
            }).join('') +
        '</div>' +
        '<button type="button" class="cook-start"><i class="fa fa-cutlery"></i> Start cooking</button>';
    ingHeading.parentNode.insertBefore(tools, ingHeading);
    tools.addEventListener('click', function (e) {
        var b = e.target.closest('.scale-btn');
        if (b) scaleTo(+b.getAttribute('data-factor'));
        if (e.target.closest('.cook-start')) openCookMode();
    });

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
            '<div class="cm-hint"></div>';
        document.body.appendChild(overlay);
        ['title', 'ingredients', 'progress', 'section', 'step', 'step-timers', 'timers', 'prev', 'next', 'read', 'voice', 'hint']
            .forEach(function (k) { ui[k] = overlay.querySelector('.cm-' + k); });
        ui.title.textContent = (document.querySelector('.post-heading h1') || {}).textContent || '';

        var list = document.createElement('ul');
        ingredientItems.forEach(function (li) {
            var item = document.createElement('li');
            item.innerHTML = '<label><input type="checkbox"> <span></span></label>';
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
            else if (t.closest('.cm-repeat')) speak(steps[index].text, true);
            else if (t.closest('.cm-read')) setReadAloud(!readAloud);
            else if (t.closest('.cm-voice')) setVoice(!listening);
            else if (t.closest('.cm-ingredients-btn')) ui.ingredients.hidden = !ui.ingredients.hidden;
            else if (t.closest('.cm-timer-chip')) startTimer(+t.closest('.cm-timer-chip').getAttribute('data-secs'), t.closest('.cm-timer-chip').getAttribute('data-label'));
            else if (t.closest('.cm-timer-cancel')) cancelTimer(+t.closest('.cm-timer').getAttribute('data-id'));
        });
    }

    function openCookMode() {
        if (!overlay) buildOverlay();
        // Show the amounts as currently scaled
        [].forEach.call(ui.ingredients.querySelectorAll('li span'), function (span, i) {
            span.textContent = ingredientItems[i].textContent;
        });
        overlay.classList.add('open');
        document.documentElement.classList.add('cook-mode-open');
        requestWakeLock();
        go(index);
    }
    function closeCookMode() {
        overlay.classList.remove('open');
        document.documentElement.classList.remove('cook-mode-open');
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        setVoice(false);
        if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
    }

    function go(i) {
        if (i < 0 || i >= steps.length) {
            if (i >= steps.length) speak('That was the last step. Enjoy your meal!', true);
            return;
        }
        index = i;
        var step = steps[i];
        ui.progress.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
        ui.section.textContent = step.section;
        ui.section.style.display = step.section ? '' : 'none';
        ui.step.textContent = step.text;
        ui['step-timers'].innerHTML = findTimers(step.text).map(function (t) {
            return '<button type="button" class="cm-timer-chip" data-secs="' + t.secs + '" data-label="' + t.label.replace(/"/g, '') + '">' +
                '<i class="fa fa-clock-o"></i> Start ' + t.label + ' timer</button>';
        }).join('');
        ui.prev.disabled = i === 0;
        ui.next.innerHTML = i === steps.length - 1 ? 'Done <i class="fa fa-check"></i>' : 'Next <i class="fa fa-chevron-right"></i>';
        if (readAloud) speak((step.section && (i === 0 || steps[i - 1].section !== step.section) ? step.section + '. ' : '') + step.text);
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
        if (on) speak(steps[index].text);
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
            else if (/\b(repeat|again|say that)\b/.test(said)) speak(steps[index].text, true);
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

    // ---- Keyboard: arrows to move, space to repeat, Esc to close ----
    document.addEventListener('keydown', function (e) {
        if (!overlay || !overlay.classList.contains('open')) return;
        if (e.key === 'ArrowRight') go(index + 1);
        else if (e.key === 'ArrowLeft') go(index - 1);
        else if (e.key === 'Escape') closeCookMode();
        else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); speak(steps[index].text, true); }
    });
})();
