const d3 = window.d3;
const topojson = window.topojson;

const container = document.getElementById("globe");

const sections = [
    {
        name: "Demographics",
        url: "demo.html",
        lon: -74.65,
        lat: 40.35
    },
    {
        name: "Lifestyle",
        url: "life.html",
        lon: 2.35,
        lat: 48.85
    },
    {
        name: "Academics",
        url: "academics.html",
        lon: 139.7,
        lat: 35.6
    },
    {
        name: "Views",
        url: "views.html",
        lon: -58.4,
        lat: -34.6
    },
    {
        name: "About",
        url: "about.html",
        lon: 151.2,
        lat: -33.8
    }
];

let width;
let height;
let projection;
let path;
let svg;
let globe;
let landmarkLayer;

let rotationTimer;
let dragging = false;


/* =========================================================
   SETUP
   ========================================================= */

function setup() {

    width = container.clientWidth;
    height = container.clientHeight;

    const size = Math.min(width, height);

    svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    projection = d3.geoOrthographic()
        .scale(size * 0.44)
        .translate([width / 2, height / 2])
        .rotate([74, -40])
        .clipAngle(90);

    path = d3.geoPath()
        .projection(projection);

    globe = svg.append("g");

    landmarkLayer = svg.append("g")
        .attr("class", "landmark-layer");

    /*
     * Actual sphere.
     */
    globe.append("path")
        .datum({ type: "Sphere" })
        .attr("class", "globe-ocean")
        .attr("d", path);

    /*
     * Latitude / longitude lines.
     */
    globe.append("path")
        .datum(d3.geoGraticule10())
        .attr("class", "globe-graticule")
        .attr("d", path);

    loadWorld();

    setupDragging();
}


/* =========================================================
   WORLD DATA
   ========================================================= */

async function loadWorld() {

    try {

        const response = await fetch(
            "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"
        );

        if (!response.ok) {
            throw new Error(
                `World data returned ${response.status}`
            );
        }

        const world = await response.json();

        /*
         * Convert TopoJSON → GeoJSON.
         */
        const land = topojson.feature(
            world,
            world.objects.land
        );

        /*
         * Add the continents.
         */
        globe.append("path")
            .datum(land)
            .attr("class", "globe-land")
            .attr("d", path);

        /*
         * Crisp outline around the Earth.
         */
        globe.append("path")
            .datum({ type: "Sphere" })
            .attr("class", "globe-outline")
            .attr("d", path);

        createLandmarks();

        render();

        startRotation();

    } catch (error) {

        console.error("Could not load globe:", error);

        /*
         * Give ourselves something visible if the
         * external geography file fails.
         */
        globe.append("circle")
            .attr("cx", width / 2)
            .attr("cy", height / 2)
            .attr("r", projection.scale())
            .attr("fill", "#e9e3d8")
            .attr("stroke", "#171717")
            .attr("stroke-width", 1);

    }
}


/* =========================================================
   LANDMARKS
   ========================================================= */

function createLandmarks() {

    sections.forEach(section => {

        const landmark = landmarkLayer
            .append("g")
            .attr("class", "landmark")
            .attr("tabindex", "0")
            .attr("role", "link")
            .attr(
                "aria-label",
                `Explore ${section.name}`
            );

        /*
         * Expanding hover ring.
         */
        landmark.append("circle")
            .attr("class", "landmark-ring")
            .attr("r", 8);

        /*
         * Main orange point.
         */
        landmark.append("circle")
            .attr("class", "landmark-dot")
            .attr("r", 5);

        /*
         * Interactions.
         */
        landmark
            .on("mouseenter", event => {

                stopRotation();

                showTooltip(
                    event,
                    section.name
                );

            })
            .on("mousemove", event => {

                moveTooltip(event);

            })
            .on("mouseleave", () => {

                hideTooltip();

                if (!dragging) {
                    startRotation();
                }

            })
            .on("click", () => {

                navigateTo(section);

            })
            .on("keydown", event => {

                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {

                    event.preventDefault();

                    navigateTo(section);
                }

            });

        section.element = landmark;
    });
}


/* =========================================================
   RENDER
   ========================================================= */

function render() {

    globe
        .selectAll("path")
        .attr("d", path);

    sections.forEach(section => {

        const coordinates = projection([
            section.lon,
            section.lat
        ]);

        /*
         * If the point is on the back of the globe,
         * hide it.
         */
        const visible =
            coordinates &&
            pointIsVisible(section);

        section.element
            .style(
                "display",
                visible ? null : "none"
            );

        if (visible) {

            section.element.attr(
                "transform",
                `translate(
                    ${coordinates[0]},
                    ${coordinates[1]}
                )`
            );
        }
    });
}


/* =========================================================
   FRONT/BACK TEST
   ========================================================= */

function pointIsVisible(section) {

    const center = projection.invert([
        width / 2,
        height / 2
    ]);

    if (!center) return false;

    const distance =
        d3.geoDistance(
            [section.lon, section.lat],
            center
        );

    return distance < Math.PI / 2;
}


/* =========================================================
   DRAGGING
   ========================================================= */

function setupDragging() {

    svg.call(

        d3.drag()

            .on("start", function() {

                dragging = true;

                stopRotation();

                hideTooltip();
            })

            .on("drag", function(event) {

                const rotation =
                    projection.rotate();

                projection.rotate([
                    rotation[0] +
                    event.dx * 0.4,

                    rotation[1] -
                    event.dy * 0.4,

                    rotation[2]
                ]);

                render();
            })

            .on("end", function() {

                dragging = false;

                startRotation();
            })
    );
}


/* =========================================================
   LANDMARK NAVIGATION
   ========================================================= */

function navigateTo(section) {

    stopRotation();

    const start =
        projection.rotate();

    const destination = [
        -section.lon,
        -section.lat,
        0
    ];

    let delta =
        destination[0] - start[0];

    /*
     * Always rotate the shortest way around.
     */
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const startTime = performance.now();

    const duration = 800;

    function animate(time) {

        const progress = Math.min(
            1,
            (time - startTime) / duration
        );

        const eased =
            d3.easeCubicInOut(progress);

        projection.rotate([
            start[0] + delta * eased,

            start[1] +
            (destination[1] - start[1]) * eased,

            0
        ]);

        render();

        if (progress < 1) {

            requestAnimationFrame(animate);

        } else {

            window.location.href =
                section.url;
        }
    }

    requestAnimationFrame(animate);
}


/* =========================================================
   TOOLTIP
   ========================================================= */

const tooltip =
    document.getElementById("tooltip");

const tooltipTitle =
    document.getElementById("tooltip-title");


function showTooltip(event, title) {

    tooltipTitle.textContent = title;

    tooltip.style.display = "block";

    moveTooltip(event);
}


function moveTooltip(event) {

    /*
     * Prevent the tooltip from running off the
     * right side of the screen.
     */

    const padding = 18;

    let x = event.clientX + padding;
    let y = event.clientY + padding;

    const tooltipWidth =
        tooltip.offsetWidth;

    if (
        x + tooltipWidth >
        window.innerWidth
    ) {

        x =
            event.clientX -
            tooltipWidth -
            padding;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}


function hideTooltip() {

    tooltip.style.display = "none";
}


/* =========================================================
   IDLE ROTATION
   ========================================================= */

function startRotation() {

    stopRotation();

    rotationTimer = d3.timer(() => {

        if (dragging) return;

        const rotation =
            projection.rotate();

        projection.rotate([
            rotation[0] + 0.018,
            rotation[1],
            rotation[2]
        ]);

        render();
    });
}


function stopRotation() {

    if (rotationTimer) {

        rotationTimer.stop();

        rotationTimer = null;
    }
}


/* =========================================================
   RESPONSIVE
   ========================================================= */

window.addEventListener(
    "resize",
    () => {

        width = container.clientWidth;
        height = container.clientHeight;

        const size =
            Math.min(width, height);

        projection
            .scale(size * 0.44)
            .translate([
                width / 2,
                height / 2
            ]);

        svg
            .attr("width", width)
            .attr("height", height)
            .attr(
                "viewBox",
                `0 0 ${width} ${height}`
            );

        render();
    }
);


/* =========================================================
   GO
   ========================================================= */

setup();
