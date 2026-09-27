/* =========================================================
   FROSH SURVEY 2030
   Interactive globe: spin to find Princeton, click to open
   the section menu. Only one landmark exists on the sphere —
   Princeton itself — everything else lives in the menu.
   ========================================================= */

   (function () {
    'use strict';

    const stage = document.getElementById('globe');
    if (!stage || typeof d3 === 'undefined') return;

    const WORLD_LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';

    const PRINCETON = {
        name: 'Princeton, NJ',
        lon: -74.6672,
        lat: 40.3573
    };

    const width = stage.clientWidth || 700;
    const height = stage.clientHeight || 700;
    const radius = Math.min(width, height) / 2 - 6;

    const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([width / 2, height / 2])
        .clipAngle(90)
        // start rotated a little off from Princeton so there's
        // actually something to spin and find
        .rotate([100, -18, 0]);

    const path = d3.geoPath(projection);
    const sphere = { type: 'Sphere' };
    const graticule = d3.geoGraticule10();

    const svg = d3.select(stage)
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .attr('role', 'img')
        .attr('aria-label', 'Draggable globe. Find and click Princeton to open the survey sections.');

    svg.append('path').datum(sphere).attr('class', 'globe-ocean').attr('d', path);
    svg.append('path').datum(graticule).attr('class', 'globe-graticule').attr('d', path);

    const landLayer = svg.append('g').attr('class', 'globe-land-layer');

    svg.append('path').datum(sphere).attr('class', 'globe-outline').attr('d', path);

    const landmarkLayer = svg.append('g').attr('class', 'globe-landmark-layer');

    let landFeatures = null;

    fetch(WORLD_LAND_URL)
        .then((response) => response.json())
        .then((worldData) => {
            landFeatures = topojson.feature(worldData, worldData.objects.land).features;

            landLayer.selectAll('path')
                .data(landFeatures)
                .join('path')
                .attr('class', 'globe-land')
                .attr('d', path);

            drawLandmark();
        })
        .catch(() => {
            // If the map data can't load, the sphere and Princeton
            // marker still work fine on their own.
            drawLandmark();
        });

    function drawLandmark() {
        const marker = landmarkLayer.selectAll('.landmark')
            .data([PRINCETON])
            .join((enter) => {
                const group = enter.append('g').attr('class', 'landmark');

                // Hit rect is drawn first (so it sits invisibly behind the
                // dot and label) and is sized below to cover both, plus
                // some breathing room — not just the tiny dot.
                const hit = group.append('rect').attr('class', 'landmark-hit');

                group.append('circle').attr('class', 'landmark-dot').attr('r', 5);
                group.append('text')
                    .attr('class', 'landmark-label')
                    .attr('x', 13)
                    .attr('y', 4)
                    .text(PRINCETON.name);

                const bbox = group.node().getBBox();
                const pad = 16;

                hit
                    .attr('x', bbox.x - pad)
                    .attr('y', bbox.y - pad)
                    .attr('width', bbox.width + pad * 2)
                    .attr('height', bbox.height + pad * 2);

                return group;
            });

        marker
            .style('cursor', 'pointer')
            .on('mouseenter', (event) => showTooltip(event))
            .on('mousemove', moveTooltip)
            .on('mouseleave', hideTooltip)
            .on('click', (event) => {
                event.stopPropagation();
                hideTooltip();
                openMenu();
            });

        updateLandmark();
    }

    function updateLandmark() {
        const coords = [PRINCETON.lon, PRINCETON.lat];
        const projected = projection(coords);
        const visible = isFrontFacing(coords);

        landmarkLayer.selectAll('.landmark')
            .classed('is-hidden', !projected || !visible)
            .attr('transform', projected ? `translate(${projected[0]}, ${projected[1]})` : null);
    }

    function isFrontFacing([lon, lat]) {
        const rotation = projection.rotate();
        const center = [-rotation[0], -rotation[1]];
        return d3.geoDistance([lon, lat], center) < Math.PI / 2;
    }

    function render() {
        svg.select('.globe-ocean').attr('d', path);
        svg.select('.globe-graticule').attr('d', path);
        svg.select('.globe-outline').attr('d', path);

        if (landFeatures) {
            landLayer.selectAll('path').attr('d', path);
        }

        updateLandmark();
    }

    /* ---------------------------------------------------
       Drag to rotate
       --------------------------------------------------- */

    let lastPointer = null;
    let autoRotate = true;
    const ROTATE_SENSITIVITY = 0.3;

    const drag = d3.drag()
        .on('start', (event) => {
            autoRotate = false;
            lastPointer = [event.x, event.y];
            stage.classList.add('is-grabbing');
            hideTooltip();
        })
        .on('drag', (event) => {
            const [rx, ry, rz] = projection.rotate();
            const dx = event.x - lastPointer[0];
            const dy = event.y - lastPointer[1];

            projection.rotate([
                rx + dx * ROTATE_SENSITIVITY,
                clampLatitude(ry - dy * ROTATE_SENSITIVITY),
                rz
            ]);

            lastPointer = [event.x, event.y];
            render();
        })
        .on('end', () => {
            stage.classList.remove('is-grabbing');
        });

    svg.call(drag);

    function clampLatitude(value) {
        return Math.max(-90, Math.min(90, value));
    }

    // Gentle idle spin invites the first drag; stops the moment
    // someone takes control.
    d3.timer(() => {
        if (!autoRotate) return;
        const [rx, ry, rz] = projection.rotate();
        projection.rotate([rx + 0.05, ry, rz]);
        render();
    });

    /* ---------------------------------------------------
       Tooltip
       --------------------------------------------------- */

    const tooltip = document.getElementById('tooltip');
    const tooltipTitle = document.getElementById('tooltip-title');

    function showTooltip(event) {
        if (!tooltip) return;
        tooltipTitle.textContent = PRINCETON.name;
        tooltip.style.display = 'block';
        moveTooltip(event);
    }

    function moveTooltip(event) {
        if (!tooltip) return;
        tooltip.style.left = `${event.clientX + 18}px`;
        tooltip.style.top = `${event.clientY + 18}px`;
    }

    function hideTooltip() {
        if (!tooltip) return;
        tooltip.style.display = 'none';
    }

    /* ---------------------------------------------------
       Section menu
       --------------------------------------------------- */

    const menu = document.getElementById('section-menu');
    const menuClose = menu ? menu.querySelector('.section-menu-close') : null;
    const menuBackdrop = menu ? menu.querySelector('.section-menu-backdrop') : null;

    function openMenu() {
        if (!menu) return;
        menu.classList.add('is-open');
        menu.setAttribute('aria-hidden', 'false');
        if (menuClose) menuClose.focus();
    }

    function closeMenu() {
        if (!menu) return;
        menu.classList.remove('is-open');
        menu.setAttribute('aria-hidden', 'true');
    }

    if (menuClose) menuClose.addEventListener('click', closeMenu);
    if (menuBackdrop) menuBackdrop.addEventListener('click', closeMenu);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu();
    });
})();