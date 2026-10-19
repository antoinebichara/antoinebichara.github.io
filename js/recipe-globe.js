/*
 * Recipe globe on the home page.
 *
 * The list of recipes comes from window.FAIRVOPIA_RECIPES, which Jekyll fills in
 * on index.html from the "location", "country" and "coords" fields at the top of
 * each file in _recipes/. Nothing in this file needs editing to add a recipe.
 */
(function () {
    var recipes = window.FAIRVOPIA_RECIPES || [];
    var container = document.getElementById('recipe-globe-map');
    if (!container) return;

    // ---- Fallback: a friendly message when the globe can't be drawn ----
    // The globe is drawn with the graphics card (WebGL). If the browser can't do that, or the
    // drawing crashes and doesn't come back (Chrome then shows a blank box with a sad face),
    // show a message with a way to reload instead.
    function showFallback(crashed) {
        if (container.querySelector('.rg-fallback')) return;
        var box = document.createElement('div');
        box.className = 'rg-fallback';
        box.innerHTML =
            '<i class="fa fa-globe rg-fallback-icon" aria-hidden="true"></i>' +
            '<p class="rg-fallback-title">' + (crashed ? 'The globe took a little tumble' : 'The globe couldn\'t load here') + '</p>' +
            '<p class="rg-fallback-text">' + (crashed
                ? 'Your browser stopped drawing it. A reload usually brings it right back.'
                : 'Your browser couldn\'t draw the 3D globe, but every recipe is still just below.') + '</p>' +
            '<div class="rg-fallback-buttons">' +
                (crashed ? '<button type="button" class="btn-solid rg-fallback-reload"><i class="fa fa-refresh" aria-hidden="true"></i> Reload the globe</button>' : '') +
                '<a class="btn-ghost" href="#recipes">Browse recipes</a>' +
            '</div>';
        container.classList.add('has-fallback');
        container.appendChild(box);
        var reload = box.querySelector('.rg-fallback-reload');
        if (reload) reload.addEventListener('click', function () { location.reload(); });
    }

    if (!window.maplibregl) { showFallback(false); return; }

    var COLORS = {
        pin: '#e8772e',
        favorite: '#f2b705',
        cluster: '#c95f1a',
        country: '#f4a259',
        passport: '#3fbf9f'
    };

    // ---- Cooking passport (js/passport.js): recipes this visitor has cooked ----
    var passport = window.fairvopiaPassport;
    var countryShapes = null;
    function cooked(r) { return !!(passport && passport.has(r.url)); }
    function passportShapes() {
        var mine = {};
        recipes.forEach(function (r) { if (cooked(r)) mine[r.country] = true; });
        return { type: 'FeatureCollection', features: countryShapes ? countryShapes.features.filter(function (f) { return mine[f.properties.name]; }) : [] };
    }
    function refreshPassport() {
        var pins = map.getSource && map.getSource('recipes');
        if (pins) pins.setData(pinData());
        var lands = map.getSource && map.getSource('passport-countries');
        if (lands) lands.setData(passportShapes());
    }
    document.addEventListener('fairvopia:passport', refreshPassport);
    // Stamped in another tab: the passport is shared through the browser's storage
    window.addEventListener('storage', function (e) { if (e.key === 'fairvopia-passport') refreshPassport(); });
    var COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
    var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    // Options set on the map element in the HTML:
    //   data-theme="night"   dark map with a glowing atmosphere (for dark backgrounds)
    //   data-zoom="1.4"      starting zoom (desktop; phones start a little further out)
    //   data-no-controls     hide the +/- and full-screen buttons
    var night = container.getAttribute('data-theme') === 'night';
    var startZoom = parseFloat(container.getAttribute('data-zoom')) || 1.8;

    // ---- Counter ("78 recipes from 45 countries") ----
    var countries = {};
    recipes.forEach(function (r) {
        (countries[r.country] = countries[r.country] || []).push(r);
    });
    var countEl = document.getElementById('recipe-globe-count');
    function updateCount(list) {
        if (!countEl) return;
        var inCountries = {};
        list.forEach(function (r) { inCountries[r.country] = true; });
        countEl.textContent = list.length + (list.length === 1 ? ' recipe' : ' recipes') + ' from ' +
            Object.keys(inCountries).length + (Object.keys(inCountries).length === 1 ? ' country' : ' countries');
    }
    updateCount(recipes);

    // Used by the filter buttons (js/recipe-finder.js): show only these recipe URLs, or all with null
    var visible = null;
    window.recipeGlobe = {
        showOnly: function (urls) {
            visible = urls;
            updateCount(urls ? recipes.filter(function (r) { return urls[r.url]; }) : recipes);
            var source = map.getSource && map.getSource('recipes');
            if (source) source.setData(pinData());
        }
    };
    function pinData() {
        return {
            type: 'FeatureCollection',
            features: recipes.map(function (r, i) {
                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
                    properties: { index: i, favorite: !!r.favorite, cooked: cooked(r) }
                };
            }).filter(function (f) { return !visible || visible[recipes[f.properties.index].url]; })
        };
    }

    // ---- Map ----
    var map;
    try {
        map = new maplibregl.Map({
            container: container,
            style: 'https://tiles.openfreemap.org/styles/' + (night ? 'dark' : 'positron'),
            center: [20, 25],
            zoom: isTouch ? Math.min(startZoom, 1.0) : startZoom,
            attributionControl: { compact: true },
            // Scrolling the page past the globe shouldn't zoom it: zoom with Ctrl + scroll,
            // a trackpad pinch, the +/- buttons or a double-click; on phones use two fingers.
            cooperativeGestures: true
        });
    } catch (e) {
        showFallback(false);
        return;
    }
    // The drawing can be lost (e.g. the graphics driver resets). Give it a few seconds to
    // come back on its own before offering a reload.
    var lostTimer = null;
    map.on('webglcontextlost', function () {
        clearTimeout(lostTimer);
        lostTimer = setTimeout(function () { showFallback(true); }, 3000);
    });
    map.on('webglcontextrestored', function () { clearTimeout(lostTimer); });
    if (!container.hasAttribute('data-no-controls')) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    }

    // Once zoomed in past the whole-globe view: mark the map (for styling) and offer a way back
    var backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'rg-back';
    backButton.innerHTML = '<i class="fa fa-globe"></i> Back to globe';
    backButton.hidden = true;
    container.appendChild(backButton);
    backButton.addEventListener('click', function () {
        popup.remove();
        map.flyTo({ zoom: isTouch ? Math.min(startZoom, 1.0) : startZoom, speed: 1.4, essential: true });
        map.once('moveend', function () { startSpinning(); });
    });
    map.on('zoom', function () {
        var zoomed = map.getZoom() > 2.8;
        container.classList.toggle('is-zoomed', zoomed);
        backButton.hidden = !zoomed;
    });

    map.on('style.load', function () {
        map.setProjection({ type: 'globe' });
        if (night) {
            // Glowing blue atmosphere around the globe; space shows through from the page behind
            map.setSky({
                'sky-color': 'rgba(0, 0, 0, 0)',
                'horizon-color': '#3d6fd6',
                'fog-color': '#1b2c5a',
                'sky-horizon-blend': 0.6,
                'horizon-fog-blend': 0.6,
                'fog-ground-blend': 0.9,
                'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 4, 1, 7, 0]
            });
            var bg = map.getStyle().layers.filter(function (l) { return l.type === 'background'; })[0];
            if (bg) map.setPaintProperty(bg.id, 'background-color', '#0e1626');
        }
    });

    map.on('load', function () {
        var firstLabelLayer = (map.getStyle().layers.find(function (l) { return l.type === 'symbol'; }) || {}).id;
        addCountries(firstLabelLayer);
        addPins();
        startSpinning();
    });

    // ---- Countries with recipes are shaded; clicking one lists its recipes ----
    function addCountries(beforeLayer) {
        if (!window.topojson) return;
        fetch(COUNTRIES_URL)
            .then(function (res) { return res.json(); })
            .then(function (world) {
                var shapes = topojson.feature(world, world.objects.countries);
                shapes.features = shapes.features.filter(function (f) {
                    return countries[f.properties.name];
                }).map(dropDateLineSlivers);
                map.addSource('recipe-countries', { type: 'geojson', data: shapes });
                map.addLayer({
                    id: 'recipe-countries-fill',
                    type: 'fill',
                    source: 'recipe-countries',
                    paint: { 'fill-color': COLORS.country, 'fill-opacity': night ? 0.28 : 0.35 }
                }, beforeLayer);
                map.addLayer({
                    id: 'recipe-countries-line',
                    type: 'line',
                    source: 'recipe-countries',
                    paint: { 'line-color': COLORS.cluster, 'line-width': 0.6, 'line-opacity': 0.6 }
                }, beforeLayer);
                setPointer('recipe-countries-fill');
                // Countries in the visitor's cooking passport, drawn in green on top
                countryShapes = shapes;
                map.addSource('passport-countries', { type: 'geojson', data: passportShapes() });
                map.addLayer({
                    id: 'passport-countries-fill',
                    type: 'fill',
                    source: 'passport-countries',
                    paint: { 'fill-color': COLORS.passport, 'fill-opacity': night ? 0.38 : 0.42 }
                }, beforeLayer);
            })
            .catch(function () { /* the globe still works without country shading */ });
    }

    // Small pieces of Russia, the USA and others that cross the 180° line get drawn as a
    // band around the whole globe, so leave those few slivers unshaded.
    function dropDateLineSlivers(feature) {
        var g = feature.geometry;
        if (g.type !== 'MultiPolygon') return feature;
        var parts = g.coordinates.filter(function (polygon) {
            var ring = polygon[0];
            for (var i = 1; i < ring.length; i++) {
                if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) return false;
            }
            return true;
        });
        return { type: 'Feature', properties: feature.properties, geometry: { type: 'MultiPolygon', coordinates: parts } };
    }

    // ---- Recipe pins, grouped into numbered bubbles when close together ----
    function addPins() {
        map.addSource('recipes', {
            type: 'geojson',
            cluster: true,
            clusterRadius: 36,
            clusterMaxZoom: 7,
            data: pinData()
        });

        map.addLayer({
            id: 'recipe-clusters',
            type: 'circle',
            source: 'recipes',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': COLORS.cluster,
                'circle-radius': ['step', ['get', 'point_count'], 13, 5, 17, 10, 21],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
            }
        });
        map.addLayer({
            id: 'recipe-cluster-count',
            type: 'symbol',
            source: 'recipes',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': ['Noto Sans Bold'],
                'text-size': 12,
                'text-allow-overlap': true
            },
            paint: { 'text-color': '#fff' }
        });
        map.addLayer({
            id: 'recipe-pins',
            type: 'circle',
            source: 'recipes',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': ['case', ['get', 'favorite'], COLORS.favorite, COLORS.pin],
                'circle-radius': ['case', ['get', 'favorite'], 8, 6],
                // Dishes in the visitor's cooking passport get a thicker green ring
                'circle-stroke-width': ['case', ['get', 'cooked'], 3, 2],
                'circle-stroke-color': ['case', ['get', 'cooked'], COLORS.passport, '#fff']
            }
        });
        setPointer('recipe-clusters');
        setPointer('recipe-pins');
    }

    function setPointer(layer) {
        map.on('mouseenter', layer, function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, function () { map.getCanvas().style.cursor = ''; });
    }

    // ---- Clicks: pins first, then bubbles, then countries ----
    var popup = new maplibregl.Popup({ offset: 12, maxWidth: '260px', className: 'recipe-globe-popup', focusAfterOpen: false });

    map.on('click', function (e) {
        var layers = ['recipe-pins', 'recipe-clusters', 'recipe-countries-fill'].filter(function (id) {
            return map.getLayer(id);
        });
        var hit = map.queryRenderedFeatures(e.point, { layers: layers })[0];
        if (!hit) return;
        stopSpinning();

        if (hit.layer.id === 'recipe-pins') {
            showRecipe(recipes[hit.properties.index]);
        } else if (hit.layer.id === 'recipe-clusters') {
            map.getSource('recipes').getClusterExpansionZoom(hit.properties.cluster_id).then(function (zoom) {
                map.easeTo({ center: hit.geometry.coordinates, zoom: zoom + 0.5 });
            });
        } else {
            showCountry(hit.properties.name, e.lngLat);
        }
    });

    function showRecipe(r) {
        var html =
            '<a class="rg-card" href="' + esc(r.url) + '">' +
                '<span class="rg-photo" style="background-image:url(\'img/' + esc(r.thumb) + '\'), url(\'img/' + esc(r.image) + '\')"></span>' +
                '<span class="rg-body">' +
                    '<span class="rg-title">' + esc(r.title) + (r.favorite ? ' <span class="rg-star" title="Favorite">&#9733;</span>' : '') + '</span>' +
                    '<span class="rg-meta">' + esc(r.location) + ' &middot; ' + esc(r.date) + '</span>' +
                    (cooked(r) ? '<span class="rg-cooked"><i class="fa fa-check-circle" aria-hidden="true"></i> In your passport</span>' : '') +
                    '<span class="rg-link">View recipe &rarr;</span>' +
                '</span>' +
            '</a>';
        popup.setLngLat([r.lng, r.lat]).setHTML(html).addTo(map);
    }

    function showCountry(name, lngLat) {
        var list = countries[name] || [];
        var html = '<div class="rg-country"><strong>' + esc(name) + '</strong>' +
            '<span class="rg-meta">' + list.length + (list.length === 1 ? ' recipe' : ' recipes') + '</span><ul>' +
            list.map(function (r) {
                return '<li><a href="' + esc(r.url) + '">' + esc(r.title) + '</a>' + (r.favorite ? ' <span class="rg-star">&#9733;</span>' : '') + '</li>';
            }).join('') +
            '</ul></div>';
        popup.setLngLat(lngLat).setHTML(html).addTo(map);
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // ---- "Surprise me": spin the globe like a roulette wheel and land on a random recipe ----
    var surprise = document.getElementById('recipe-globe-surprise');
    var rouletteRunning = false, rouletteCancelled = false;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (surprise) {
        surprise.addEventListener('click', function () {
            if (rouletteRunning) return;
            var pool = visible ? recipes.filter(function (x) { return visible[x.url]; }) : recipes;
            if (!pool.length) return;
            var r = pool[Math.floor(Math.random() * pool.length)];
            stopSpinning();
            popup.remove();
            // Bring the globe into view first if the page is scrolled past it
            var box = container.getBoundingClientRect();
            if (box.bottom < 80 || box.top > window.innerHeight - 80) container.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
            if (reduceMotion) return land(r);
            roulette(r);
        });
    }
    function roulette(r) {
        rouletteRunning = true;
        rouletteCancelled = false;
        surprise.classList.add('spinning');
        var start = map.getCenter(), startZoom = map.getZoom();
        var globeZoom = isTouch ? Math.min(startZoom, 1.0) : Math.min(startZoom, startZoom > 2.5 ? 1.8 : startZoom);
        // Two full turns eastward plus however far it is to the chosen recipe
        var ahead = ((r.lng - start.lng) % 360 + 360) % 360;
        var turn = 720 + ahead;
        var duration = 3600, t0 = performance.now();
        (function frame(now) {
            if (rouletteCancelled) return finish(false);
            var t = Math.min(1, (now - t0) / duration);
            var e = 1 - Math.pow(1 - t, 3.2);           // fast at first, slowing down at the end
            map.jumpTo({
                center: [start.lng + turn * e, start.lat + (r.lat * 0.6 - start.lat) * e],
                zoom: startZoom + (globeZoom - startZoom) * Math.min(1, t * 4)
            });
            if (t < 1) requestAnimationFrame(frame); else finish(true);
        })(t0);
        function finish(landed) {
            rouletteRunning = false;
            surprise.classList.remove('spinning');
            if (landed) land(r);
        }
    }
    function land(r) {
        map.flyTo({ center: [r.lng, r.lat], zoom: 4.5, speed: 0.9, essential: true });
        map.once('moveend', function () { showRecipe(r); });
    }

    // ---- Slow spin until someone touches the globe; resumes after a while idle ----
    var spinning = false;
    var idleTimer = null;
    var SECONDS_PER_TURN = 120;
    var RESUME_AFTER_MS = 30000;

    function spinStep() {
        if (!spinning || map.getZoom() > 2.5) return;
        var center = map.getCenter();
        center.lng -= 360 / SECONDS_PER_TURN;
        map.easeTo({ center: center, duration: 1000, easing: function (n) { return n; } });
    }
    function startSpinning() {
        spinning = true;
        spinStep();
    }
    // Pause the spin when someone grabs, scrolls or pinches the globe. This must not call
    // map.stop(): that would also cancel the drag or zoom they are starting.
    function pauseSpinning() {
        spinning = false;
        if (rouletteRunning) rouletteCancelled = true;   // grabbing the globe stops the roulette too
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
            if (!popup.isOpen()) startSpinning();
        }, RESUME_AFTER_MS);
    }
    // For our own moves (clicking a pin, "Surprise me"): also cancel the spin's current step
    function stopSpinning() {
        pauseSpinning();
        map.stop();
    }
    map.on('moveend', spinStep);
    ['mousedown', 'touchstart', 'wheel'].forEach(function (evt) {
        container.addEventListener(evt, pauseSpinning, { passive: true });
    });
})();
