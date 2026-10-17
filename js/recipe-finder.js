/*
 * Home page: filter buttons (Mains, Soups, ...) and "What can I make?".
 *
 * Uses window.FAIRVOPIA_RECIPES from index.html, which Jekyll builds from the
 * "type" and "vegetarian" fields and the "## Ingredients" list of each recipe.
 */
(function () {
    var recipes = window.FAIRVOPIA_RECIPES || [];
    var root = document.querySelector('.recipe-finder');
    if (!root) return;

    var input = document.getElementById('rf-input');
    var chipsEl = root.querySelector('.rf-chips');
    var resultsEl = root.querySelector('.rf-results');
    var entries = [].slice.call(document.querySelectorAll('.recipe-entry'));
    var noneEl = document.querySelector('.rf-none');
    var byUrl = {};
    recipes.forEach(function (r) { byUrl[r.url] = r; });

    // ---------------- Filters ----------------
    var filter = 'all';
    function matchesFilter(r) {
        if (!r) return filter === 'all';
        if (filter === 'all') return true;
        if (filter === 'vegetarian') return r.vegetarian;
        return r.type === filter;
    }
    function applyFilter() {
        var shown = {}, count = 0;
        entries.forEach(function (el) {
            var url = el.getAttribute('data-url');
            var ok = matchesFilter(byUrl[url]);
            el.hidden = !ok;
            if (ok) { shown[url] = true; count++; }
        });
        if (noneEl) noneEl.hidden = count > 0;
        if (window.recipeGlobe) window.recipeGlobe.showOnly(filter === 'all' ? null : shown);
        [].forEach.call(root.querySelectorAll('.rf-filter'), function (b) {
            b.classList.toggle('active', b.getAttribute('data-filter') === filter);
            b.setAttribute('aria-pressed', b.getAttribute('data-filter') === filter);
        });
        search();
    }
    root.querySelector('.rf-filters').addEventListener('click', function (e) {
        var b = e.target.closest('.rf-filter');
        if (!b) return;
        filter = b.getAttribute('data-filter');
        applyFilter();
    });

    // ---------------- "What can I make?" ----------------
    var STAPLES = toSet('salt pepper black white water warm cold boiling hot oil olive canola vegetable sunflower sugar kosher sea ice cooking spray');
    var FILLER = toSet('cup cups tbsp tsp tablespoon tablespoons teaspoon teaspoons lb lbs pound pounds oz ounce ounces g kg ml l can cans ' +
        'clove cloves bunch bunches handful pinch dash large small medium big chopped sliced minced diced grated finely thinly roughly ' +
        'fresh freshly ground for serving optional of and or a an to taste cut into pieces piece some plenty extra frying at least about ' +
        'the in with half whole peeled halved quartered cubed crushed packed melted softened room temperature heaping level');

    function toSet(s) { var o = {}; s.split(' ').forEach(function (w) { o[w] = true; }); return o; }
    function norm(s) {
        return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function singular(w) {
        if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
        if (w.length > 4 && /(oes|ches|shes|sses)$/.test(w)) return w.slice(0, -2);
        if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
        return w;
    }
    function words(s) { return norm(s).split(/[\s-]+/).filter(Boolean).map(singular); }
    function isStaple(line) {
        var main = words(line).filter(function (w) { return !FILLER[w]; });
        return main.length > 0 && main.every(function (w) { return STAPLES[w]; });
    }

    // Pre-process each recipe's ingredient lines once
    recipes.forEach(function (r) {
        r._lines = (r.ingredients || []).filter(function (l) { return l && !isStaple(l); }).map(function (l) {
            return { text: l, key: ' ' + words(l).join(' ') + ' ' };
        });
    });

    var terms = [];
    function addTerms(text) {
        text.split(/[,;\n]+/).forEach(function (t) {
            var key = words(t).join(' ');
            if (key && terms.every(function (x) { return x.key !== key; })) terms.push({ label: t.trim(), key: key });
        });
        renderChips();
        search();
    }
    function renderChips() {
        chipsEl.innerHTML = '';
        terms.forEach(function (t, i) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'rf-chip';
            chip.setAttribute('data-i', i);
            chip.setAttribute('aria-label', 'Remove ' + t.label);
            chip.textContent = t.label + ' ';
            var x = document.createElement('span');
            x.setAttribute('aria-hidden', 'true');
            x.innerHTML = '&times;';
            chip.appendChild(x);
            chipsEl.appendChild(chip);
        });
    }
    chipsEl.addEventListener('click', function (e) {
        var chip = e.target.closest('.rf-chip');
        if (!chip) return;
        terms.splice(+chip.getAttribute('data-i'), 1);
        renderChips();
        search();
        input.focus();
    });
    input.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
            e.preventDefault();
            addTerms(input.value);
            input.value = '';
        } else if (e.key === 'Backspace' && !input.value && terms.length) {
            terms.pop();
            renderChips();
            search();
        }
    });
    input.addEventListener('input', function () {
        if (/,/.test(input.value)) { addTerms(input.value); input.value = ''; }
        else search();
    });
    root.querySelector('.rf-box').addEventListener('click', function (e) { if (e.target === this) input.focus(); });

    function search() {
        var all = terms.slice();
        var typing = words(input.value).join(' ');
        if (typing.length >= 3) all.push({ label: input.value.trim(), key: typing });
        if (!all.length) { resultsEl.innerHTML = ''; return; }

        var results = recipes.filter(matchesFilter).map(function (r) {
            var have = [], missing = [];
            r._lines.forEach(function (line) {
                var hit = all.some(function (t) { return line.key.indexOf(' ' + t.key + ' ') !== -1; });
                (hit ? have : missing).push(line.text);
            });
            return { r: r, have: have.length, total: r._lines.length, missing: missing };
        }).filter(function (x) { return x.have > 0; }).sort(function (a, b) {
            return (b.have / b.total) - (a.have / a.total) || b.have - a.have;
        }).slice(0, 10);

        if (!results.length) {
            resultsEl.innerHTML = '<p class="rf-empty">No recipes use those yet. Try another ingredient.</p>';
            return;
        }
        resultsEl.innerHTML = '<ul class="rf-list">' + results.map(function (x) {
            var pct = Math.round(100 * x.have / x.total);
            return '<li class="rf-item">' +
                '<a href="' + esc(x.r.url) + '" class="rf-title">' + esc(x.r.title) + '</a>' +
                '<span class="rf-score">You have ' + x.have + ' of ' + x.total + ' ingredients</span>' +
                '<span class="rf-bar"><span style="width:' + pct + '%"></span></span>' +
                (x.missing.length ? '<span class="rf-missing">Still need: ' + x.missing.slice(0, 4).map(esc).join(' · ') +
                    (x.missing.length > 4 ? ' · and ' + (x.missing.length - 4) + ' more' : '') + '</span>' : '<span class="rf-missing rf-all">You have everything!</span>') +
                '</li>';
        }).join('') + '</ul>';
    }
    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
})();
