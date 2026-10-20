/*
 * Long Beach eats page (eats.html): a map and a list of favorite restaurants and bars.
 *
 * The restaurants come from window.FAIRVOPIA_EATS, which Jekyll fills in from
 * _data/eats.yml. Nothing in this file needs editing to add a restaurant.
 */
(function () {
    // Each place gets a list of spots for the map: usually one, or several when it has
    // more than one location (a "locations" list in the data, each with its own area and pin)
    function addSpots(e) {
        var list = e.locations || [{ area: '', address: e.address, lat: e.lat, lng: e.lng }];
        e.spots = list.filter(function (s) { return typeof s.lat === 'number' && typeof s.lng === 'number'; });
        e.pinned = e.spots.length > 0;
        e.multi = e.spots.length > 1;
        // A location can sit in a different region from the others (Porto's: Orange County and LA)
        e.spots.forEach(function (s) { s.region = s.region || e.region; });
        e.regions = [e.region];
        e.spots.forEach(function (s) { if (e.regions.indexOf(s.region) === -1) e.regions.push(s.region); });
    }
    var eats = (window.FAIRVOPIA_EATS || []).map(function (e, i) {
        e.id = i;
        e.kind = 'eats';
        addSpots(e);
        return e;
    });
    // Bars (_data/bars.yml) have a single overall rating instead of food, price and atmosphere
    var bars = (window.FAIRVOPIA_BARS || []).map(function (b, i) {
        b.id = eats.length + i;
        b.kind = 'bars';
        addSpots(b);
        b.exact = b.score = b.rating;
        return b;
    });
    bars.slice().sort(function (a, b) { return b.rating - a.rating || a.name.localeCompare(b.name); })
        .forEach(function (b, i) { b.rank = i + 1; });
    var all = eats.concat(bars);

    // ---- Value score: a weighted mix of food, price and atmosphere ----
    // The default mix is set at the top of eats.html; visitors can try their own with the sliders.
    var DEFAULT_WEIGHTS = window.FAIRVOPIA_EATS_WEIGHTS || { food: 40, price: 40, atmosphere: 20 };
    var weights = {};
    function setWeights(w) { ['food', 'price', 'atmosphere'].forEach(function (k) { weights[k] = +w[k] || 0; }); }
    setWeights(DEFAULT_WEIGHTS);
    function rescore() {
        var total = weights.food + weights.price + weights.atmosphere || 1;
        eats.forEach(function (e) {
            // Rank by the exact mix; show it rounded. (Ranking by the rounded number left many ties.)
            e.exact = (weights.food * e.food + weights.price * e.price + weights.atmosphere * e.atmosphere) / total;
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
    var state = { kind: 'eats', region: 'Long Beach', meal: '', cuisine: '', sort: 'score', query: '' };
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
        if (e.atmosphere >= 8.5) b.push(['atmosphere', 'fa-music', 'Great atmosphere']);
        return b.map(function (x) {
            return '<span class="ec-badge ec-badge-' + x[0] + '"><i class="fa ' + x[1] + '" aria-hidden="true"></i> ' + x[2] + '</span>';
        }).join('');
    }
    function bar(label, n, kind) {
        return '<span class="ec-bar ec-bar-' + kind + '"><span class="ec-bar-label">' + label + '</span>' +
            '<span class="ec-bar-track"><span style="width:' + (n * 10) + '%"></span></span>' +
            '<span class="ec-bar-num">' + one(n) + '</span></span>';
    }
    function directions(e, spot) {
        var where = spot ? (spot.address || spot.area) : (e.address || e.area);
        return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.name + ', ' + where);
    }
    // "Directions", or one link per location ("Silver Lake", "Downtown LA") for places with several
    function directionLinks(e) {
        var icon = '<i class="fa fa-location-arrow" aria-hidden="true"></i> ';
        if (!e.multi) return '<a href="' + directions(e) + '" target="_blank" rel="noopener">' + icon + 'Directions</a>';
        return e.spots.map(function (s) {
            return '<a href="' + directions(e, s) + '" target="_blank" rel="noopener">' + icon + esc(s.area) + '</a>';
        }).join('');
    }
    function areaText(e) {
        if (!e.multi) return esc(e.area);
        var names = e.spots.map(function (s) { return esc(s.area); });
        return names.length + ' locations: ' + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
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
    all.forEach(function (e) { e.search = plain(e.name); });

    function visible() {
        var q = plain(state.query);
        var list = all.filter(function (e) {
            // A search looks at every restaurant and bar, whatever the other filters say
            if (q) return e.search.indexOf(q) !== -1 || e.search.replace(/ /g, '').indexOf(q.replace(/ /g, '')) !== -1;
            if (e.kind !== state.kind) return false;
            if (state.region && e.regions.indexOf(state.region) === -1) return false;
            if (e.kind === 'bars') return true;
            return (!state.meal || (e.meals || []).indexOf(state.meal) !== -1) &&
                (!state.cuisine || e.cuisine === state.cuisine);
        });
        var key = state.sort === 'score' ? 'exact' : state.sort;
        list.sort(function (a, b) {
            if (a.kind !== b.kind) return a.kind === 'eats' ? -1 : 1;
            if (key === 'name' || a[key] == null) return key === 'name' ? a.name.localeCompare(b.name) : b.exact - a.exact || a.rank - b.rank;
            return b[key] - a[key] || b.exact - a.exact || a.rank - b.rank;
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
            if (e.kind === 'bars') {
                return '<li class="eat-card bar-card" data-id="' + e.id + '" tabindex="-1">' +
                    '<div class="ec-top">' +
                        '<span class="ec-rank">#' + e.rank + '</span>' +
                        '<div class="ec-head">' +
                            '<h3 class="ec-name">' + esc(e.name) + '</h3>' +
                            '<p class="ec-meta"><i class="fa fa-glass" aria-hidden="true"></i> Bar &middot; ' + areaText(e) + '</p>' +
                        '</div>' +
                        '<div class="ec-score" title="Rating out of 10"><strong>' + one(e.score) + '</strong><span>' + praise(e.score) + '</span></div>' +
                    '</div>' +
                    '<div class="ec-links">' +
                        (e.pinned && map ? '<button type="button" class="ec-show"><i class="fa fa-map-marker" aria-hidden="true"></i> Show on map</button>' : '') +
                        directionLinks(e) +
                    '</div>' +
                '</li>';
            }
            return '<li class="eat-card" data-id="' + e.id + '" tabindex="-1">' +
                '<div class="ec-top">' +
                    '<span class="ec-rank">#' + e.rank + '</span>' +
                    '<div class="ec-head">' +
                        '<h3 class="ec-name">' + esc(e.name) + '</h3>' +
                        '<p class="ec-meta">' + esc(e.cuisine) + ' &middot; ' + areaText(e) + '</p>' +
                    '</div>' +
                    '<div class="ec-score" title="Value score"><strong>' + one(e.score) + '</strong><span>' + praise(e.score) + '</span></div>' +
                '</div>' +
                (badges(e) ? '<div class="ec-badges">' + badges(e) + '</div>' : '') +
                (e.order ? '<p class="ec-order"><i class="fa fa-star" aria-hidden="true"></i> <strong>Order:</strong> ' + esc(e.order) + '</p>' : '') +
                '<div class="ec-bars">' + bar('Food', e.food, 'food') + bar('Price', e.price, 'price') + bar('Atmosphere', e.atmosphere, 'atmosphere') + '</div>' +
                '<div class="ec-links">' +
                    (e.pinned && map ? '<button type="button" class="ec-show"><i class="fa fa-map-marker" aria-hidden="true"></i> Show on map</button>' : '') +
                    directionLinks(e) +
                    (visited(e) ? '<span class="ec-visited">Last visit ' + visited(e) + '</span>' : '') +
                '</div>' +
            '</li>';
        }).join('') || (state.query ? '' : '<li class="eats-empty">No favorites here yet. Try another area' + (state.kind === 'eats' ? ', meal or craving.' : '.') + '</li>');
        countEl.textContent = list.length + (state.kind === 'bars' && !state.query ? (list.length === 1 ? ' bar' : ' bars') : (list.length === 1 ? ' place' : ' places'));
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
            ? '<i class="fa fa-check-circle" aria-hidden="true"></i> ' + (list.length === 1 ? 'Yes! It\'s one of my favorites.' : list.length + ' of my favorites match.') + ' Searching every area, restaurants and bars.'
            : '<i class="fa fa-question-circle" aria-hidden="true"></i> &ldquo;' + esc(q) + '&rdquo; isn\'t on my favorites list (yet). Maybe I haven\'t been, or maybe it\'s my next stop!';
    }

    // ---- The formula line and the sliders ----
    var formula = document.getElementById('eats-formula');
    function showWeights() {
        var total = weights.food + weights.price + weights.atmosphere || 1;
        ['food', 'price', 'atmosphere'].forEach(function (k) {
            var pct = Math.round(weights[k] / total * 100) + '%';
            formula.querySelector('[data-share="' + k + '"]').textContent = pct;
            formula.querySelector('[data-out="' + k + '"]').textContent = pct;
            formula.querySelector('[data-weight="' + k + '"]').value = weights[k];
        });
        var mine = ['food', 'price', 'atmosphere'].every(function (k) { return weights[k] === (+DEFAULT_WEIGHTS[k] || 0); });
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
        eachMarker(function (m, k) { m.getElement().classList.toggle('active', k === id); });
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
        focusOn(all[id]);
        if (mapEl.getBoundingClientRect().top < 0) mapEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
    listEl.addEventListener('mouseover', function (ev) {
        var c = ev.target.closest('.eat-card');
        eachMarker(function (m, k) {
            m.getElement().classList.toggle('hover', !!c && k === +c.getAttribute('data-id'));
        });
    });
    listEl.addEventListener('mouseleave', function () {
        eachMarker(function (m) { m.getElement().classList.remove('hover'); });
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
    // Restaurants or bars: bars have no meals, cuisines or food/price/atmosphere scores to filter by
    var controlsEl = document.querySelector('.eats-controls');
    var pickLabel = document.querySelector('#eats-pick span');
    function setKind(kind) {
        state.kind = kind;
        [].forEach.call(document.querySelectorAll('.eats-kinds button'), function (b) {
            var on = b.getAttribute('data-kind') === kind;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        controlsEl.classList.toggle('kind-bars', kind === 'bars');
        [].forEach.call(sortEl.options, function (o) {
            o.hidden = kind === 'bars' && ['food', 'price', 'atmosphere'].indexOf(o.value) !== -1;
        });
        if (sortEl.selectedOptions[0] && sortEl.selectedOptions[0].hidden) { sortEl.value = 'score'; state.sort = 'score'; }
        sortEl.options[0].textContent = kind === 'bars' ? 'Top rated' : 'Best value';
        if (pickLabel) pickLabel.textContent = kind === 'bars' ? 'Where should I drink tonight?' : 'Where should I eat tonight?';
        closePopup();
        render();
        fitToPins(true);
    }
    [].forEach.call(document.querySelectorAll('.eats-kinds button'), function (btn) {
        btn.addEventListener('click', function () { setKind(btn.getAttribute('data-kind')); });
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
    // markers: place id -> its pins (one per location)
    var map = null, markers = {}, popup = null, shown = [];
    function eachMarker(fn) {
        Object.keys(markers).forEach(function (k) { markers[k].forEach(function (m) { fn(m, +k); }); });
    }
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

        all.forEach(function (e) {
            markers[e.id] = e.spots.map(function (spot) {
                var el = document.createElement('button');
                el.type = 'button';
                el.className = 'eats-pin' + (e.kind === 'bars' ? ' is-bar' : '');
                // MapLibre positions the marker with a transform, so the teardrop shape is its own element
                el.innerHTML = '<span class="ep-shape"></span><span class="ep-num"></span>';
                el.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    focusOn(e, true, spot);
                });
                return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([spot.lng, spot.lat]);
            });
        });

        // Follow the site's light/dark switch
        new MutationObserver(function () {
            var next = styleUrl();
            if (map.__style !== next) { map.__style = next; map.setStyle(next); }
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        map.__style = styleUrl();
    }

    // With an area picked, only that area's locations get pins (a search shows them all)
    function spotsInView(e) {
        if (!state.region || state.query.trim()) return e.spots;
        return e.spots.filter(function (s) { return s.region === state.region; });
    }
    function updatePins(list) {
        if (!map) return;
        shown = list.filter(function (e) { return e.pinned; });
        var keep = {};
        shown.forEach(function (e) {
            var inView = spotsInView(e);
            markers[e.id].forEach(function (m, i) {
                if (inView.indexOf(e.spots[i]) === -1) return;
                keep[e.id + ':' + i] = true;
                var el = m.getElement();
                el.classList.toggle('tier-1', e.score >= 8.5);
                el.classList.toggle('tier-2', e.score >= 8.2 && e.score < 8.5);
                el.setAttribute('aria-label', e.name + (e.multi ? ' (' + e.spots[i].area + ')' : '') + ', ' + one(e.score));
                el.querySelector('.ep-num').textContent = one(e.score);
                m.addTo(map);
            });
        });
        Object.keys(markers).forEach(function (k) {
            markers[k].forEach(function (m, i) { if (!keep[k + ':' + i]) m.remove(); });
        });
    }
    function fitSpots(spots, animate, maxZoom) {
        var b = new maplibregl.LngLatBounds();
        spots.forEach(function (s) { b.extend([s.lng, s.lat]); });
        map.fitBounds(b, { padding: { top: 60, bottom: 30, left: 40, right: 40 }, maxZoom: maxZoom || 14, duration: animate && !reduceMotion ? 900 : 0 });
    }
    function fitToPins(animate) {
        if (!map || !shown.length) return;
        fitSpots([].concat.apply([], shown.map(spotsInView)), animate);
    }
    function closePopup() { if (popup) popup.remove(); }
    function focusOn(e, fromPin, spot) {
        highlight(e.id, true);
        if (!map || !e.pinned) return;
        // A place with several locations: show them all, unless one pin was clicked
        if (e.multi && !spot) {
            var inView = spotsInView(e);
            if (inView.length > 1) {
                closePopup();
                fitSpots(inView, true, 13.5);
                return;
            }
            spot = inView[0];
        }
        spot = spot || e.spots[0];
        map.flyTo({ center: [spot.lng, spot.lat], zoom: Math.max(map.getZoom(), 13.5), duration: reduceMotion ? 0 : 1000, essential: true });
        popup.setLngLat([spot.lng, spot.lat]).setHTML(
            '<div class="eats-pop"><strong>' + esc(e.name) + '</strong>' +
            (e.multi ? '<span>' + esc(spot.area) + ' (one of ' + e.spots.length + ' locations)</span>' : '') +
            '<span>' + (e.kind === 'bars' ? 'Bar' : esc(e.cuisine)) + ' &middot; ' + one(e.score) + ' ' + praise(e.score).toLowerCase() + '</span>' +
            (e.order ? '<em>Order: ' + esc(e.order) + '</em>' : '') +
            '<a href="' + directions(e, e.multi ? spot : null) + '" target="_blank" rel="noopener">Directions <i class="fa fa-external-link" aria-hidden="true"></i></a></div>'
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
        if (!pool.length) pool = all.filter(function (e) { return e.kind === state.kind; }).filter(function (e) { return e.pinned; });
        var choice = pool[Math.floor(Math.random() * pool.length)];
        if (state.region && choice.regions.indexOf(state.region) === -1) {
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

    // A link like eats.html?q=Sophy's opens with that search filled in, handy for sharing a place
    var linked = '';
    try { linked = new URLSearchParams(location.search).get('q') || ''; } catch (err) {}
    if (linked) { queryEl.value = state.query = linked; }

    if (formula) showWeights();
    render();
    var linkedMatch = linked && visible().length === 1 ? visible()[0] : null;
    if (linkedMatch) highlight(linkedMatch.id, false);
    if (map) map.once('load', function () {
        fitToPins(false);
        if (linkedMatch) focusOn(linkedMatch);
    });
    if (linked) document.getElementById('eats').scrollIntoView();
})();
