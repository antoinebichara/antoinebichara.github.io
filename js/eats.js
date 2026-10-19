/*
 * Long Beach eats page (eats.html): a map and a list of favorite restaurants.
 *
 * The restaurants come from window.FAIRVOPIA_EATS, which Jekyll fills in from
 * _data/eats.yml. Nothing in this file needs editing to add a restaurant.
 */
(function () {
    var eats = (window.FAIRVOPIA_EATS || []).map(function (e, i) {
        e.id = i;
        e.pinned = typeof e.lat === 'number' && typeof e.lng === 'number';
        return e;
    });

    // ---- Value score: a weighted mix of food, price and vibe ----
    // The default mix is set at the top of eats.html; visitors can try their own with the sliders.
    var DEFAULT_WEIGHTS = window.FAIRVOPIA_EATS_WEIGHTS || { food: 40, price: 40, vibe: 20 };
    var weights = {};
    function setWeights(w) { ['food', 'price', 'vibe'].forEach(function (k) { weights[k] = +w[k] || 0; }); }
    setWeights(DEFAULT_WEIGHTS);
    function rescore() {
        var total = weights.food + weights.price + weights.vibe || 1;
        eats.forEach(function (e) {
            // Rank by the exact mix; show it rounded. (Ranking by the rounded number left many ties.)
            e.exact = (weights.food * e.food + weights.price * e.price + weights.vibe * e.vibe) / total;
            e.score = Math.round(e.exact * 10) / 10;
        });
        eats.slice().sort(function (a, b) { return b.exact - a.exact || b.food - a.food; })
            .forEach(function (e, i) { e.rank = i + 1; });
    }
    rescore();

    var listEl = document.getElementById('eats-list');
    var countEl = document.getElementById('eats-count');
    var cuisineEl = document.getElementById('eats-cuisine');
    var sortEl = document.getElementById('eats-sort');
    var mapEl = document.getElementById('eats-map');
    if (!listEl) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var state = { region: 'Long Beach', meal: '', cuisine: '', sort: 'score', query: '' };
    var queryEl = document.getElementById('eats-query');
    var noteEl = document.getElementById('eats-search-note');

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function one(n) { return n.toFixed(1); }
    function praise(score) {
        return score >= 8.5 ? 'Outstanding' : score >= 8.2 ? 'Excellent' : score >= 8 ? 'Great' : 'Really good';
    }
    function badges(e) {
        var b = [];
        if (e.rank <= 10) b.push(['top', 'fa-trophy', 'Top 10']);
        if (e.food >= 9) b.push(['food', 'fa-cutlery', 'Amazing food']);
        if (e.price >= 8.5) b.push(['price', 'fa-usd', 'Great price']);
        if (e.vibe >= 8.5) b.push(['vibe', 'fa-music', 'Great vibe']);
        return b.map(function (x) {
            return '<span class="ec-badge ec-badge-' + x[0] + '"><i class="fa ' + x[1] + '" aria-hidden="true"></i> ' + x[2] + '</span>';
        }).join('');
    }
    function bar(label, n, kind) {
        return '<span class="ec-bar ec-bar-' + kind + '"><span class="ec-bar-label">' + label + '</span>' +
            '<span class="ec-bar-track"><span style="width:' + (n * 10) + '%"></span></span>' +
            '<span class="ec-bar-num">' + one(n) + '</span></span>';
    }
    function directions(e) {
        return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.name + ', ' + (e.address || e.area));
    }
    function visited(e) {
        if (!e.visited) return '';
        var p = String(e.visited).split('-');
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[(+p[1] || 1) - 1] + ' ' + p[0];
    }

    // ---- Filters ----
    var cuisines = {};
    eats.forEach(function (e) { cuisines[e.cuisine] = true; });
    Object.keys(cuisines).sort().forEach(function (c) {
        var o = document.createElement('option');
        o.value = o.textContent = c;
        cuisineEl.appendChild(o);
    });

    // Lowercase, without accents or punctuation, so "republique" finds "République"
    function plain(s) {
        return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    eats.forEach(function (e) { e.search = plain(e.name); });

    function visible() {
        var q = plain(state.query);
        var list = eats.filter(function (e) {
            // A search looks at every place, whatever the other filters say
            if (q) return e.search.indexOf(q) !== -1 || e.search.replace(/ /g, '').indexOf(q.replace(/ /g, '')) !== -1;
            return (!state.region || e.region === state.region) &&
                (!state.meal || (e.meals || []).indexOf(state.meal) !== -1) &&
                (!state.cuisine || e.cuisine === state.cuisine);
        });
        var key = state.sort === 'score' ? 'exact' : state.sort;
        list.sort(function (a, b) {
            if (key === 'name') return a.name.localeCompare(b.name);
            return b[key] - a[key] || b.exact - a.exact;
        });
        return list;
    }

    // ---- List ----
    function render(animate) {
        var list = visible();
        // Remember where each card was, so a re-ranked card can glide to its new place
        var before = {};
        if (animate && !reduceMotion) {
            [].forEach.call(listEl.querySelectorAll('.eat-card'), function (c) {
                before[c.getAttribute('data-id')] = c.getBoundingClientRect().top;
            });
        }
        listEl.innerHTML = list.map(function (e) {
            return '<li class="eat-card" data-id="' + e.id + '" tabindex="-1">' +
                '<div class="ec-top">' +
                    '<span class="ec-rank">#' + e.rank + '</span>' +
                    '<div class="ec-head">' +
                        '<h3 class="ec-name">' + esc(e.name) + '</h3>' +
                        '<p class="ec-meta">' + esc(e.cuisine) + ' &middot; ' + esc(e.area) + '</p>' +
                    '</div>' +
                    '<div class="ec-score" title="Value score"><strong>' + one(e.score) + '</strong><span>' + praise(e.score) + '</span></div>' +
                '</div>' +
                (badges(e) ? '<div class="ec-badges">' + badges(e) + '</div>' : '') +
                (e.order ? '<p class="ec-order"><i class="fa fa-star" aria-hidden="true"></i> <strong>Order:</strong> ' + esc(e.order) + '</p>' : '') +
                '<div class="ec-bars">' + bar('Food', e.food, 'food') + bar('Price', e.price, 'price') + bar('Vibe', e.vibe, 'vibe') + '</div>' +
                '<div class="ec-links">' +
                    (e.pinned && map ? '<button type="button" class="ec-show"><i class="fa fa-map-marker" aria-hidden="true"></i> Show on map</button>' : '') +
                    '<a href="' + directions(e) + '" target="_blank" rel="noopener"><i class="fa fa-location-arrow" aria-hidden="true"></i> Directions</a>' +
                    (visited(e) ? '<span class="ec-visited">Last visit ' + visited(e) + '</span>' : '') +
                '</div>' +
            '</li>';
        }).join('') || (state.query ? '' : '<li class="eats-empty">No favorites here yet. Try another area, meal or craving.</li>');
        countEl.textContent = list.length + (list.length === 1 ? ' place' : ' places');
        showSearchNote(list);
        updatePins(list);
        if (animate && !reduceMotion) {
            [].forEach.call(listEl.querySelectorAll('.eat-card'), function (c) {
                var was = before[c.getAttribute('data-id')];
                if (was == null) return;
                var dy = was - c.getBoundingClientRect().top;
                if (Math.abs(dy) < 2) return;
                c.style.transition = 'none';
                c.style.transform = 'translateY(' + dy + 'px)';
                c.getBoundingClientRect();
                c.style.transition = 'transform 0.45s ease';
                c.style.transform = '';
            });
        }
    }

    function showSearchNote(list) {
        if (!noteEl) return;
        var q = state.query.trim();
        noteEl.hidden = !q;
        document.querySelector('.eats-controls').classList.toggle('searching', !!q);
        if (!q) return;
        noteEl.innerHTML = list.length
            ? '<i class="fa fa-check-circle" aria-hidden="true"></i> ' + (list.length === 1 ? 'Yes! It\'s one of my favorites.' : list.length + ' of my favorites match.') + ' Searching every area.'
            : '<i class="fa fa-question-circle" aria-hidden="true"></i> &ldquo;' + esc(q) + '&rdquo; isn\'t on my favorites list (yet). Maybe I haven\'t been, or maybe it\'s my next stop!';
    }

    // ---- The formula line and the sliders ----
    var formula = document.getElementById('eats-formula');
    function showWeights() {
        var total = weights.food + weights.price + weights.vibe || 1;
        ['food', 'price', 'vibe'].forEach(function (k) {
            var pct = Math.round(weights[k] / total * 100) + '%';
            formula.querySelector('[data-share="' + k + '"]').textContent = pct;
            formula.querySelector('[data-out="' + k + '"]').textContent = pct;
            formula.querySelector('[data-weight="' + k + '"]').value = weights[k];
        });
        var mine = ['food', 'price', 'vibe'].every(function (k) { return weights[k] === (+DEFAULT_WEIGHTS[k] || 0); });
        formula.classList.toggle('custom', !mine);
    }
    function reweigh() {
        rescore();
        showWeights();
        render(true);
        if (popup && popup.isOpen()) closePopup();
    }
    if (formula) {
        formula.addEventListener('input', function (ev) {
            var k = ev.target.getAttribute('data-weight');
            if (!k) return;
            weights[k] = +ev.target.value;
            reweigh();
        });
        formula.querySelector('.ef-reset').addEventListener('click', function () {
            setWeights(DEFAULT_WEIGHTS);
            reweigh();
        });
    }

    function card(id) { return listEl.querySelector('.eat-card[data-id="' + id + '"]'); }
    function highlight(id, scroll) {
        [].forEach.call(listEl.querySelectorAll('.eat-card.active'), function (c) { c.classList.remove('active'); });
        Object.keys(markers).forEach(function (k) { markers[k].getElement().classList.toggle('active', +k === id); });
        var c = card(id);
        if (!c) return;
        c.classList.add('active');
        if (scroll) {
            // The list scrolls on its own beside the map on wide screens, with the page on phones
            var wide = getComputedStyle(listEl).overflowY === 'auto';
            if (wide) listEl.scrollTo({ top: c.offsetTop - listEl.offsetTop - 12, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
    }

    listEl.addEventListener('click', function (ev) {
        var show = ev.target.closest('.ec-show');
        if (!show) return;
        var id = +show.closest('.eat-card').getAttribute('data-id');
        focusOn(eats[id]);
        if (mapEl.getBoundingClientRect().top < 0) mapEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
    listEl.addEventListener('mouseover', function (ev) {
        var c = ev.target.closest('.eat-card');
        Object.keys(markers).forEach(function (k) {
            markers[k].getElement().classList.toggle('hover', !!c && +k === +c.getAttribute('data-id'));
        });
    });
    listEl.addEventListener('mouseleave', function () {
        Object.keys(markers).forEach(function (k) { markers[k].getElement().classList.remove('hover'); });
    });

    [].forEach.call(document.querySelectorAll('.eats-regions .rf-filter'), function (btn) {
        btn.addEventListener('click', function () {
            [].forEach.call(document.querySelectorAll('.eats-regions .rf-filter'), function (b) { b.classList.toggle('active', b === btn); });
            state.region = btn.getAttribute('data-region');
            closePopup();
            render();
            fitToPins(true);
        });
    });
    [].forEach.call(document.querySelectorAll('.eats-meals .rf-filter'), function (btn) {
        btn.addEventListener('click', function () {
            [].forEach.call(document.querySelectorAll('.eats-meals .rf-filter'), function (b) { b.classList.toggle('active', b === btn); });
            state.meal = btn.getAttribute('data-meal');
            closePopup();
            render();
            fitToPins(true);
        });
    });
    cuisineEl.addEventListener('change', function () { state.cuisine = cuisineEl.value; closePopup(); render(); fitToPins(true); });
    sortEl.addEventListener('change', function () { state.sort = sortEl.value; render(true); });
    var searchTimer;
    queryEl.addEventListener('input', function () {
        state.query = queryEl.value;
        closePopup();
        render();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () { fitToPins(true); }, 350);
    });

    // ---- Map ----
    var map = null, markers = {}, popup = null, shown = [];
    function styleUrl() {
        return 'https://tiles.openfreemap.org/styles/' + (document.documentElement.classList.contains('dark') ? 'dark' : 'positron');
    }
    if (mapEl && window.maplibregl) {
        map = new maplibregl.Map({
            container: mapEl,
            style: styleUrl(),
            center: [-118.16, 33.79],
            zoom: 11.3,
            attributionControl: { compact: true },
            cooperativeGestures: window.matchMedia && window.matchMedia('(pointer: coarse)').matches
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: '260px', focusAfterOpen: false });

        eats.forEach(function (e) {
            if (!e.pinned) return;
            var el = document.createElement('button');
            el.type = 'button';
            el.className = 'eats-pin';
            // MapLibre positions the marker with a transform, so the teardrop shape is its own element
            el.innerHTML = '<span class="ep-shape"></span><span class="ep-num"></span>';
            el.addEventListener('click', function (ev) {
                ev.stopPropagation();
                focusOn(e, true);
            });
            markers[e.id] = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([e.lng, e.lat]);
        });

        // Follow the site's light/dark switch
        new MutationObserver(function () {
            var next = styleUrl();
            if (map.__style !== next) { map.__style = next; map.setStyle(next); }
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        map.__style = styleUrl();
    }

    function updatePins(list) {
        if (!map) return;
        var keep = {};
        shown = list.filter(function (e) { return e.pinned; });
        shown.forEach(function (e) {
            keep[e.id] = true;
            var el = markers[e.id].getElement();
            el.classList.toggle('tier-1', e.score >= 8.5);
            el.classList.toggle('tier-2', e.score >= 8.2 && e.score < 8.5);
            el.setAttribute('aria-label', e.name + ', value ' + one(e.score));
            el.querySelector('.ep-num').textContent = one(e.score);
            markers[e.id].addTo(map);
        });
        Object.keys(markers).forEach(function (k) { if (!keep[k]) markers[k].remove(); });
    }
    function fitToPins(animate) {
        if (!map || !shown.length) return;
        var b = new maplibregl.LngLatBounds();
        shown.forEach(function (e) { b.extend([e.lng, e.lat]); });
        map.fitBounds(b, { padding: { top: 60, bottom: 30, left: 40, right: 40 }, maxZoom: 14, duration: animate && !reduceMotion ? 900 : 0 });
    }
    function closePopup() { if (popup) popup.remove(); }
    function focusOn(e, fromPin) {
        highlight(e.id, true);
        if (!map || !e.pinned) return;
        map.flyTo({ center: [e.lng, e.lat], zoom: Math.max(map.getZoom(), 13.5), duration: reduceMotion ? 0 : 1000, essential: true });
        popup.setLngLat([e.lng, e.lat]).setHTML(
            '<div class="eats-pop"><strong>' + esc(e.name) + '</strong>' +
            '<span>' + esc(e.cuisine) + ' &middot; ' + one(e.score) + ' ' + praise(e.score).toLowerCase() + '</span>' +
            (e.order ? '<em>Order: ' + esc(e.order) + '</em>' : '') +
            '<a href="' + directions(e) + '" target="_blank" rel="noopener">Directions <i class="fa fa-external-link" aria-hidden="true"></i></a></div>'
        ).addTo(map);
        if (fromPin && getComputedStyle(listEl).overflowY !== 'auto') {
            var c = card(e.id);
            if (c) { c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }
        }
    }

    // ---- "Where should I eat tonight?" ----
    var pickBtn = document.getElementById('eats-pick');
    var picking = false;
    pickBtn.addEventListener('click', function () {
        if (picking) return;
        var pool = visible().filter(function (e) { return e.pinned; });
        if (!pool.length) pool = eats.filter(function (e) { return e.pinned; });
        var choice = pool[Math.floor(Math.random() * pool.length)];
        if (choice.region !== state.region && state.region) {
            document.querySelector('.eats-regions .rf-filter[data-region="' + choice.region + '"]').click();
        }
        document.getElementById('eats').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
        if (reduceMotion || !map) { focusOn(choice); return; }
        // Flash through a few pins like a roulette before landing on the pick
        picking = true;
        pickBtn.classList.add('spinning');
        closePopup();
        var steps = 14, n = 0;
        (function tick() {
            if (n < steps) {
                var e = pool[Math.floor(Math.random() * pool.length)];
                highlight(e.id, false);
                n++;
                setTimeout(tick, 60 + n * 14);
            } else {
                picking = false;
                pickBtn.classList.remove('spinning');
                focusOn(choice);
            }
        })();
    });

    if (formula) showWeights();
    render();
    if (map) map.once('load', function () { fitToPins(false); });
})();
