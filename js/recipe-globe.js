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
    if (!container || !window.maplibregl) return;

    var COLORS = {
        pin: '#e8772e',
        favorite: '#f2b705',
        cluster: '#c95f1a',
        country: '#f4a259'
    };
    var COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
    var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    // ---- Counter ("78 recipes from 45 countries") ----
    var countries = {};
    recipes.forEach(function (r) {
        (countries[r.country] = countries[r.country] || []).push(r);
    });
    var countEl = document.getElementById('recipe-globe-count');
    if (countEl) {
        countEl.textContent = recipes.length + ' recipes from ' + Object.keys(countries).length + ' countries';
    }

    // ---- Map ----
    var map = new maplibregl.Map({
        container: container,
        style: 'https://tiles.openfreemap.org/styles/positron',
        center: [20, 25],
        zoom: isTouch ? 1.0 : 1.8,
        attributionControl: { compact: true },
        // Scrolling the page past the globe shouldn't zoom it: zoom with Ctrl + scroll,
        // a trackpad pinch, the +/- buttons or a double-click; on phones use two fingers.
        cooperativeGestures: true
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    map.on('style.load', function () {
        map.setProjection({ type: 'globe' });
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
                    paint: { 'fill-color': COLORS.country, 'fill-opacity': 0.35 }
                }, beforeLayer);
                map.addLayer({
                    id: 'recipe-countries-line',
                    type: 'line',
                    source: 'recipe-countries',
                    paint: { 'line-color': COLORS.cluster, 'line-width': 0.6, 'line-opacity': 0.6 }
                }, beforeLayer);
                setPointer('recipe-countries-fill');
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
            data: {
                type: 'FeatureCollection',
                features: recipes.map(function (r, i) {
                    return {
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
                        properties: { index: i, favorite: !!r.favorite }
                    };
                })
            }
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
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
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
    var popup = new maplibregl.Popup({ offset: 12, maxWidth: '260px', className: 'recipe-globe-popup' });

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
                '<span class="rg-photo" style="background-image:url(\'img/' + esc(r.image) + '\')"></span>' +
                '<span class="rg-body">' +
                    '<span class="rg-title">' + esc(r.title) + (r.favorite ? ' <span class="rg-star" title="Favorite">&#9733;</span>' : '') + '</span>' +
                    '<span class="rg-meta">' + esc(r.location) + ' &middot; ' + esc(r.date) + '</span>' +
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

    // ---- "Surprise me": fly to a random recipe ----
    var surprise = document.getElementById('recipe-globe-surprise');
    if (surprise) {
        surprise.addEventListener('click', function () {
            if (!recipes.length) return;
            var r = recipes[Math.floor(Math.random() * recipes.length)];
            stopSpinning();
            popup.remove();
            map.flyTo({ center: [r.lng, r.lat], zoom: 5, speed: 0.9, essential: true });
            map.once('moveend', function () { showRecipe(r); });
        });
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
    function stopSpinning() {
        spinning = false;
        map.stop();
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
            if (!popup.isOpen()) startSpinning();
        }, RESUME_AFTER_MS);
    }
    map.on('moveend', spinStep);
    ['mousedown', 'touchstart', 'wheel'].forEach(function (evt) {
        container.addEventListener(evt, stopSpinning, { passive: true });
    });
})();
