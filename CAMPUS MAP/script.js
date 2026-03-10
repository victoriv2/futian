document.addEventListener('DOMContentLoaded', () => {
    const mapContainer = document.getElementById('map-container');
    const startSelect = document.getElementById('start-location');
    const endSelect = document.getElementById('end-location');
    const resetBtn = document.getElementById('reset-btn');
    const swapBtn = document.getElementById('swap-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const goBtn = document.getElementById('go-btn');
    const getDirectionModal = document.getElementById('get-direction-modal');
    const getDirectionModalClose = document.getElementById('get-direction-modal-close');
    const directionStartSelect = document.getElementById('direction-start-location');
    const directionEndSelect = document.getElementById('direction-end-location');
    const directionSwapBtn = document.getElementById('direction-swap-btn');
    const directionModalGo = document.getElementById('direction-modal-go');
    const directionModalClear = document.getElementById('direction-modal-clear');
    const svgUrl = 'school-mini-map.svg';

    let buildings = [];
    let roads = [];
    let roadGraph = {};
    let isRouteActive = false; // Track if a route is currently displayed

    // Zoom and Pan state
    let currentZoom = 1;
    let currentPanX = 0;
    let currentPanY = 0;
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;

    // Touch-specific state for mobile gestures (map)
    let isMapTouchPanning = false;
    let mapTouchStartX = 0;
    let mapTouchStartY = 0;
    let mapPinchDistance = 0;
    let mapPinchZoom = 1;
    let mapLastTapTime = 0;
    let mapLastTapX = 0;
    let mapLastTapY = 0;
    let mapTouchMoved = false; // Track if finger moved (to differentiate tap from pan)

    async function loadSVG() {
        try {
            const response = await fetch(svgUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const svgText = await response.text();
            mapContainer.innerHTML = svgText;
            initMapInteractions();
        } catch (error) {
            console.error('Error loading SVG:', error);
            mapContainer.innerHTML = `<div style="text-align:center; padding:2rem;">Error loading map. Please run a local server.</div>`;
        }
    }

    function initMapInteractions() {
        const svg = mapContainer.querySelector('svg');
        if (!svg) return;

        svg.setAttribute('width', '100%');
        svg.setAttribute('height', 'auto');

        // Initialize zoom and pan functionality
        initZoomAndPan(svg);

        const buildingElements = Array.from(svg.querySelectorAll('.cls-5, .cls-6, .cls-4'));
        const roadElements = Array.from(svg.querySelectorAll('.cls-3'));

        // 1. Process Roads (Nodes)
        roads = roadElements.map((el, index) => {
            const bbox = getBBox(el);
            return {
                id: index,
                element: el,
                ...bbox,
                centerX: bbox.x + bbox.width / 2,
                centerY: bbox.y + bbox.height / 2
            };
        });

        // 2. Build Graph (Edges) with Strict "Manhattan" Connectivity
        const BUFFER = 2;
        const MIN_OVERLAP = 5;

        roads.forEach((r1, i) => {
            roadGraph[i] = [];
            roads.forEach((r2, j) => {
                if (i === j) return;
                if (checkEdgeSharing(r1, r2, BUFFER, MIN_OVERLAP)) {
                    const dist = Math.sqrt(Math.pow(r1.centerX - r2.centerX, 2) + Math.pow(r1.centerY - r2.centerY, 2));
                    roadGraph[i].push({ node: j, weight: dist });
                }
            });
        });

        // 3. Process Buildings
        startSelect.innerHTML = '<option value="">Select Start Point</option>';
        endSelect.innerHTML = '<option value="">Select Destination</option>';
        buildings = [];

        buildingElements.forEach((el, index) => {
            const id = `building-${index}`;
            el.id = id;
            const bbox = getBBox(el);
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;

            const name = identifyBuilding(el, bbox);

            // Find the specific "entrance" road block
            let entranceRoad = findEntranceRoad(bbox);

            // Fix for Auditorium direction: Force path to end at the small road part in front
            if (name === "Auditorium") {
                const specificRoad = roads.find(r =>
                    Math.abs(r.x - 1563.31) < 5 && Math.abs(r.y - 1647.33) < 5
                );
                if (specificRoad) entranceRoad = specificRoad;
            }

            // Fix for Pavillon direction: Force path to end at the entrance road
            if (name === "Pavillon") {
                const specificRoad = roads.find(r =>
                    Math.abs(r.x - 2805.65) < 5 && Math.abs(r.y - 1963.78) < 5
                );
                if (specificRoad) entranceRoad = specificRoad;
            }


            const buildingData = {
                id: id,
                element: el,
                name: name,
                x: centerX,
                y: centerY,
                bbox: bbox,
                nearestRoad: entranceRoad
            };
            buildings.push(buildingData);
        });

        buildings.sort((a, b) => a.name.localeCompare(b.name));

        // Add empty first option to all selects
        addOption(startSelect, "", "Select Location");
        addOption(endSelect, "", "Select Location");
        if (directionStartSelect) addOption(directionStartSelect, "", "Select Location");
        if (directionEndSelect) addOption(directionEndSelect, "", "Select Location");

        buildings.forEach(b => {
            // Skip School Field from dropdowns
            if (b.name !== "School Field") {
                addOption(startSelect, b.id, b.name);
                addOption(endSelect, b.id, b.name);
                // Also populate the modal's hidden selects
                if (directionStartSelect) addOption(directionStartSelect, b.id, b.name);
                if (directionEndSelect) addOption(directionEndSelect, b.id, b.name);
            }
        });

        // Initialize UI for both old and new planners
        if (typeof populateDirectionDropdowns === 'function') {
            populateDirectionDropdowns();
        } else if (typeof updatePlannerUI === 'function') {
            updatePlannerUI();
        }


        // Add event listeners to filter dropdowns
        startSelect.addEventListener('change', () => {
            // If a route is active and we're changing start, reset the route
            if (isRouteActive) {
                clearHighlights();
                isRouteActive = false;
            }
            updateDropdownOptions();

            // If both are selected, calculate path immediately
            if (startSelect.value && endSelect.value) {
                calculateAndHighlightPath(startSelect.value, endSelect.value);
                isRouteActive = true;
            }
        });
        endSelect.addEventListener('change', () => {
            updateDropdownOptions();
            // If both are selected, auto-update the path and close modal
            if (startSelect.value && endSelect.value) {
                calculateAndHighlightPath(startSelect.value, endSelect.value);
                isRouteActive = true;
            }
        });

        // Initialize click handlers and rename buildings based on text
        addBuildingClickHandlers();

        // Create invisible hitbox layer mainly for touch/click reliability
        createHitboxLayer();
    }

    function createHitboxLayer() {
        const svg = mapContainer.querySelector('svg');
        if (!svg) return;

        // Create a group for hitboxes if it doesn't exist
        let hitboxGroup = document.getElementById('hitbox-layer');
        if (!hitboxGroup) {
            hitboxGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            hitboxGroup.id = 'hitbox-layer';
            // Append to end of SVG to ensure it's on top of everything
            svg.appendChild(hitboxGroup);
        } else {
            hitboxGroup.innerHTML = ''; // Clear for update
        }

        console.log('Creating simple hitbox layer for', buildings.length, 'buildings');

        buildings.forEach(building => {
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");

            // Use the building's bbox
            rect.setAttribute('x', building.bbox.x);
            rect.setAttribute('y', building.bbox.y);
            rect.setAttribute('width', building.bbox.width);
            rect.setAttribute('height', building.bbox.height);

            // Make it invisible but interactive
            rect.setAttribute('fill', 'transparent');
            rect.style.cursor = 'pointer';
            rect.style.pointerEvents = 'all'; // Ensure it catches events

            // Add click listener
            rect.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop map panning/dragging
                e.preventDefault();
                console.log('Hitbox clicked:', building.name);
                openGallery(building.name);
            });

            // Prevent panning when starting click on a building hitbox
            rect.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            hitboxGroup.appendChild(rect);
        });
    }

    function createHitboxLayer() {
        const svg = mapContainer.querySelector('svg');
        if (!svg) return;

        // Remove ALL existing title tags to stop default browser tooltips
        svg.querySelectorAll('title').forEach(el => el.remove());

        let hitboxGroup = document.getElementById('hitbox-layer');
        if (!hitboxGroup) {
            hitboxGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            hitboxGroup.id = 'hitbox-layer';
            svg.appendChild(hitboxGroup);
        } else {
            hitboxGroup.innerHTML = '';
        }

        console.log('Creating shaped hitbox layer for', buildings.length, 'buildings');

        buildings.forEach(building => {
            // Clone the original building element to get exact shape (L-shape, etc.)
            const hitbox = building.element.cloneNode(true);

            // Allow pointer events on hitbox, make completely transparent
            hitbox.style.opacity = '0'; // Use opacity 0 instead of transparent fill to ensure it exists
            hitbox.style.cursor = 'pointer';
            hitbox.style.pointerEvents = 'all';

            // Remove ID to avoid duplicates, remove original classes
            hitbox.removeAttribute('id');
            hitbox.setAttribute('class', 'building-hitbox'); // Class for debugging if needed

            // Add events
            hitbox.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Hitbox clicked:', building.name);
                openGallery(building.name);
            });

            hitbox.addEventListener('mousedown', (e) => e.stopPropagation());

            // Touch events - prevent map panning when touching buildings
            hitbox.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                // Highlight building on touch start (visual feedback)
                building.element.classList.add('building-hover-active');
            }, { passive: true });

            hitbox.addEventListener('touchend', (e) => {
                e.stopPropagation();
                // Remove highlight
                building.element.classList.remove('building-hover-active');
            }, { passive: true });

            // Hover Effects: Highlight the ORIGINAL building when hovering the hitbox
            hitbox.addEventListener('mouseenter', () => {
                building.element.classList.add('building-hover-active');
            });
            hitbox.addEventListener('mouseleave', () => {
                building.element.classList.remove('building-hover-active');
            });

            hitboxGroup.appendChild(hitbox);
        });
    }

    // Creative CSS Toast Notification
    function showToast(message, type = 'warning') {
        // Remove existing toasts
        const existingToken = document.querySelector('.custom-toast');
        if (existingToken) existingToken.remove();

        const toast = document.createElement('div');
        toast.className = `custom-toast ${type}`;

        // Icon based on type
        let icon = '';
        if (type === 'warning') icon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-alert-icon lucide-circle-alert toast-icon"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`;
        if (type === 'error') icon = `<svg viewBox="0 0 24 24" fill="none" class="toast-icon" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

        toast.innerHTML = `
            ${icon}
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Replace other alert calls if needed
    // In highlight path:
    /* if (!startRoad || !endRoad) { showToast("Could not connect buildings to road network.", "error"); return; } */

    function identifyBuilding(el, bbox) {
        const x = bbox.x;
        const y = bbox.y;
        const cls = el.getAttribute('class');

        if (cls.includes('cls-6')) return "School Field";
        if (cls.includes('cls-4')) return "School Gate";

        if (el.tagName === 'path') return "New Uncompleted Admin Block";
        if (el.tagName === 'polygon') return "VC's Office";

        if (x < 400) {
            if (y < 800) return "Academic Block";
            return "SPAS";
        }
        if (y < 1000) {
            if (x > 1100 && x < 1200) return "Store";
            if (x > 900 && x < 1100) return "ETEC";
        }
        if (x > 500 && x < 700) return "Library";
        if (x > 1000 && x < 1200 && y > 1200) return "Toilet";
        if (x > 1300 && x < 1500 && y > 1400 && y < 1800) return "Auditorium";
        if (y > 1800) {
            if (x > 1300 && x < 1400) return "Workshop";
            if (x > 1500 && x < 1700) return "SCIT";
            if (x > 1900 && x < 2100) return "Security Office";
        }
        if (x > 2800 && x < 3000) return "Pavillon";
        if (x > 3100) {
            if (y < 1600) return "Girl's Hostel Block B";
            return "Girl's Hostel Block A";
        }
        return `Building ${Math.round(x)},${Math.round(y)}`;
    }

    function getBBox(el) {
        if (el.tagName === 'polygon') {
            const points = el.getAttribute('points').split(' ').map(Number);
            const xCoords = points.filter((_, i) => i % 2 === 0);
            const yCoords = points.filter((_, i) => i % 2 !== 0);
            return { x: Math.min(...xCoords), y: Math.min(...yCoords), width: Math.max(...xCoords) - Math.min(...xCoords), height: Math.max(...yCoords) - Math.min(...yCoords) };
        } else if (el.tagName === 'path') {
            return { x: 1330, y: 443, width: 400, height: 500 };
        } else {
            return {
                x: parseFloat(el.getAttribute('x')),
                y: parseFloat(el.getAttribute('y')),
                width: parseFloat(el.getAttribute('width')),
                height: parseFloat(el.getAttribute('height'))
            };
        }
    }

    function checkEdgeSharing(r1, r2, buffer, minOverlap) {
        // First check if they're touching at all
        const isTouching = !(r2.x > r1.x + r1.width + buffer ||
            r2.x + r2.width + buffer < r1.x ||
            r2.y > r1.y + r1.height + buffer ||
            r2.y + r2.height + buffer < r1.y);

        if (!isTouching) return false;

        // Calculate overlaps
        const xOverlapStart = Math.max(r1.x, r2.x);
        const xOverlapEnd = Math.min(r1.x + r1.width, r2.x + r2.width);
        const xOverlap = Math.max(0, xOverlapEnd - xOverlapStart);

        const yOverlapStart = Math.max(r1.y, r2.y);
        const yOverlapEnd = Math.min(r1.y + r1.height, r2.y + r2.height);
        const yOverlap = Math.max(0, yOverlapEnd - yOverlapStart);

        // For Manhattan connectivity, we need EITHER:
        // 1. Significant horizontal overlap (roads stacked vertically) OR
        // 2. Significant vertical overlap (roads side by side)
        // But NOT both (that would be overlapping roads)

        const hasHorizontalOverlap = xOverlap > minOverlap;
        const hasVerticalOverlap = yOverlap > minOverlap;

        // They should share an edge in ONE direction, not both
        // If both overlaps are large, they're probably overlapping, not adjacent
        if (hasHorizontalOverlap && hasVerticalOverlap) {
            // Both overlaps are significant - check if one is much larger
            // This handles the case where roads overlap slightly at corners
            const maxOverlap = Math.max(xOverlap, yOverlap);
            const minOverlapValue = Math.min(xOverlap, yOverlap);

            // If one overlap is much larger, use that direction
            if (maxOverlap > minOverlapValue * 3) {
                return true;
            }
            return false; // Too much overlap in both directions
        }

        return hasHorizontalOverlap || hasVerticalOverlap;
    }

    function addOption(select, value, text) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
    }

    function clearHighlights() {
        buildings.forEach(b => {
            b.element.classList.remove('building-active');
            b.element.classList.remove('building-start');
            b.element.classList.remove('building-end');
        });
        roads.forEach(r => {
            r.element.classList.remove('path-active');
            r.element.style.animationDelay = '0s';
        });
        document.querySelectorAll('.map-marker').forEach(m => m.remove());
    }

    // Improved Entrance Finder
    // Finds the road segment that's actually at the building's entrance
    // Prioritizes small road blocks touching the building's edge
    function findEntranceRoad(buildingBBox) {
        let bestRoad = null;
        let minScore = Infinity;

        // Calculate building edges
        const buildingLeft = buildingBBox.x;
        const buildingRight = buildingBBox.x + buildingBBox.width;
        const buildingTop = buildingBBox.y;
        const buildingBottom = buildingBBox.y + buildingBBox.height;
        const buildingCenterX = buildingBBox.x + buildingBBox.width / 2;
        const buildingCenterY = buildingBBox.y + buildingBBox.height / 2;

        roads.forEach(road => {
            // Calculate road edges
            const roadLeft = road.x;
            const roadRight = road.x + road.width;
            const roadTop = road.y;
            const roadBottom = road.y + road.height;

            // Check if road touches any edge of the building (with larger buffer for rotated buildings)
            const buffer = 50; // Increased to handle rotated buildings better

            // Check edge proximity
            const touchesLeft = Math.abs(roadRight - buildingLeft) < buffer;
            const touchesRight = Math.abs(roadLeft - buildingRight) < buffer;
            const touchesTop = Math.abs(roadBottom - buildingTop) < buffer;
            const touchesBottom = Math.abs(roadTop - buildingBottom) < buffer;

            // Check if there's alignment (overlapping in perpendicular direction)
            const verticalOverlap = Math.max(0, Math.min(roadBottom, buildingBottom) - Math.max(roadTop, buildingTop));
            const horizontalOverlap = Math.max(0, Math.min(roadRight, buildingRight) - Math.max(roadLeft, buildingLeft));

            const touchesEdge = (touchesLeft || touchesRight) && verticalOverlap > 10 ||
                (touchesTop || touchesBottom) && horizontalOverlap > 10;

            // 1. Distance from road center to building center
            const dist = Math.sqrt(
                Math.pow(road.centerX - buildingCenterX, 2) +
                Math.pow(road.centerY - buildingCenterY, 2)
            );

            // 2. Size score: Prefer smaller road segments (entrance connectors are usually small)
            const roadArea = road.width * road.height;
            const sizeScore = roadArea / 500; // Smaller roads get lower scores

            // 3. Edge touching bonus: Heavily favor roads that touch building edges
            const edgeBonus = touchesEdge ? -1000 : 2000; // Changed to negative bonus for touching

            // 4. Prefer roads that are very small (likely entrance connectors)
            const isSmallConnector = roadArea < 2000; // Increased threshold
            const connectorBonus = isSmallConnector ? -500 : 0;

            const totalScore = dist + sizeScore + edgeBonus + connectorBonus;

            if (totalScore < minScore) {
                minScore = totalScore;
                bestRoad = road;
            }
        });
        return bestRoad;
    }

    function findShortestPath(startNodeId, endNodeId) {
        const distances = {};
        const previous = {};
        const direction = {}; // Track direction to penalize turns
        const pq = new PriorityQueue();

        distances[startNodeId] = 0;
        direction[startNodeId] = null;
        pq.enqueue(startNodeId, 0);

        roads.forEach(r => {
            if (r.id !== startNodeId) distances[r.id] = Infinity;
            previous[r.id] = null;
            direction[r.id] = null;
        });

        while (!pq.isEmpty()) {
            const { element: currentNodeId } = pq.dequeue();

            if (currentNodeId === endNodeId) {
                const path = [];
                let curr = endNodeId;
                while (curr !== null) {
                    path.unshift(curr);
                    curr = previous[curr];
                }
                return path;
            }

            if (distances[currentNodeId] === Infinity) break;

            const currentRoad = roads[currentNodeId];
            const neighbors = roadGraph[currentNodeId] || [];

            for (let neighbor of neighbors) {
                const neighborRoad = roads[neighbor.node];

                // Calculate direction of movement
                const dx = neighborRoad.centerX - currentRoad.centerX;
                const dy = neighborRoad.centerY - currentRoad.centerY;
                const newDirection = getDirection(dx, dy);

                // Base cost is the distance
                let cost = neighbor.weight;

                // Add turn penalty if we're changing direction
                const prevDirection = direction[currentNodeId];
                if (prevDirection !== null && prevDirection !== newDirection) {
                    // Penalize turns to prefer straight paths
                    cost += 50; // Turn penalty
                }

                const alt = distances[currentNodeId] + cost;

                if (alt < distances[neighbor.node]) {
                    distances[neighbor.node] = alt;
                    previous[neighbor.node] = currentNodeId;
                    direction[neighbor.node] = newDirection;
                    pq.enqueue(neighbor.node, alt);
                }
            }
        }
        return null;
    }

    // Helper function to determine direction of movement
    function getDirection(dx, dy) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Determine if movement is primarily horizontal or vertical
        if (absDx > absDy) {
            return dx > 0 ? 'right' : 'left';
        } else {
            return dy > 0 ? 'down' : 'up';
        }
    }

    function fillPathGaps(pathIndices) {
        const fullPath = new Set(pathIndices);

        for (let i = 0; i < pathIndices.length - 1; i++) {
            const start = roads[pathIndices[i]];
            const end = roads[pathIndices[i + 1]];

            // Calculate if this is a horizontal or vertical move
            const deltaX = Math.abs(end.centerX - start.centerX);
            const deltaY = Math.abs(end.centerY - start.centerY);

            // Check if this is an L-shaped path (both horizontal and vertical change)
            const isLShaped = deltaX > 30 && deltaY > 30; // More lenient threshold

            // Only fill if the gap is small (they should be adjacent or very close)
            const distance = Math.sqrt(
                Math.pow(start.centerX - end.centerX, 2) +
                Math.pow(start.centerY - end.centerY, 2)
            );

            // If distance is large, don't try to fill - trust the pathfinding
            if (distance > 250) continue; // Increased to allow more corner fills

            // For L-shaped paths, find the corner piece
            if (isLShaped) {
                // Find roads that could be the corner connector
                roads.forEach(road => {
                    if (fullPath.has(road.id)) return;

                    // Check if this road is in the corner area (between start and end)
                    const inXRange = (road.centerX >= Math.min(start.centerX, end.centerX) - 50) &&
                        (road.centerX <= Math.max(start.centerX, end.centerX) + 50);
                    const inYRange = (road.centerY >= Math.min(start.centerY, end.centerY) - 50) &&
                        (road.centerY <= Math.max(start.centerY, end.centerY) + 50);

                    if (inXRange && inYRange) {
                        // Check if it's connected to either start or end
                        const connectedToStart = roadGraph[pathIndices[i]]?.some(n => n.node === road.id);
                        const connectedToEnd = roadGraph[pathIndices[i + 1]]?.some(n => n.node === road.id);

                        // Also check if it forms an L-corner (connects to both directions)
                        const roadArea = road.width * road.height;
                        if ((connectedToStart || connectedToEnd) && roadArea < 15000) {
                            fullPath.add(road.id);
                        }
                    }
                });
            }

            // Only add roads that are actually between these two segments
            // and are connected to at least one of them
            roads.forEach(road => {
                if (fullPath.has(road.id)) return;

                // Check if this road is connected to either start or end in the graph
                const connectedToStart = roadGraph[pathIndices[i]]?.some(n => n.node === road.id);
                const connectedToEnd = roadGraph[pathIndices[i + 1]]?.some(n => n.node === road.id);

                // Must be connected AND between the segments AND small enough
                const roadArea = road.width * road.height;
                if ((connectedToStart || connectedToEnd) && isBetween(road, start, end) && roadArea < 8000) {
                    fullPath.add(road.id);
                }
            });
        }

        return Array.from(fullPath);
    }

    function isBetween(target, start, end) {
        const padding = 2;
        const tMinX = target.x - padding;
        const tMaxX = target.x + target.width + padding;
        const tMinY = target.y - padding;
        const tMaxY = target.y + target.height + padding;

        const sMinX = Math.min(start.centerX, end.centerX);
        const sMaxX = Math.max(start.centerX, end.centerX);
        const sMinY = Math.min(start.centerY, end.centerY);
        const sMaxY = Math.max(start.centerY, end.centerY);

        if (sMaxX < tMinX || sMinX > tMaxX || sMaxY < tMinY || sMinY > tMaxY) return false;

        return lineIntersectsRect(
            start.centerX, start.centerY,
            end.centerX, end.centerY,
            { x: tMinX, y: tMinY, width: tMaxX - tMinX, height: tMaxY - tMinY }
        );
    }

    function lineIntersectsRect(x1, y1, x2, y2, rect) {
        const minX = rect.x;
        const maxX = rect.x + rect.width;
        const minY = rect.y;
        const maxY = rect.y + rect.height;
        if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY &&
            x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true;
        if (lineIntersectsLine(x1, y1, x2, y2, minX, minY, maxX, minY)) return true;
        if (lineIntersectsLine(x1, y1, x2, y2, maxX, minY, maxX, maxY)) return true;
        if (lineIntersectsLine(x1, y1, x2, y2, maxX, maxY, minX, maxY)) return true;
        if (lineIntersectsLine(x1, y1, x2, y2, minX, maxY, minX, minY)) return true;
        return false;
    }

    function lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
        const uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
        return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
    }

    class PriorityQueue {
        constructor() { this.items = []; }
        enqueue(element, priority) {
            const qElement = { element, priority };
            let added = false;
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i].priority > qElement.priority) {
                    this.items.splice(i, 0, qElement);
                    added = true;
                    break;
                }
            }
            if (!added) this.items.push(qElement);
        }
        dequeue() { return this.items.shift(); }
        isEmpty() { return this.items.length === 0; }
    }

    function addMarker(x, y, type) {
        const svg = mapContainer.querySelector('svg');
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
        marker.classList.add('map-marker');

        // Determine colors
        const isStart = type === 'start';
        const mainColor = isStart ? '#27ae60' : '#ff6600'; // Green vs Orange
        const strokeColor = isStart ? '#1e8449' : '#cc5200';

        // Using the Lucide map-pin SVG path matching the legend icons - LARGE SIZE
        const pinPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pinPath.setAttribute("d", "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0");
        pinPath.setAttribute("fill", mainColor);
        pinPath.setAttribute("stroke", strokeColor);
        pinPath.setAttribute("stroke-width", "0.8");

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "10");
        circle.setAttribute("r", "3");
        circle.setAttribute("fill", "white");
        circle.setAttribute("stroke", strokeColor);
        circle.setAttribute("stroke-width", "0.4");

        marker.appendChild(pinPath);
        marker.appendChild(circle);

        // HUGE SCALE (3x larger than previous baseline) - STRAIGHT
        // Previous scale was 4, user asked for 3x relative to "indicator icon"
        // Let's use scale 8 for high visibility, NO rotation
        const scale = 8;
        marker.setAttribute("transform", `translate(${x - (12 * scale)}, ${y - (22 * scale)}) scale(${scale})`);

        svg.appendChild(marker);
    }

    function calculateAndHighlightPath(startId, endId) {
        clearHighlights();

        const startBuilding = buildings.find(b => b.id === startId);
        const endBuilding = buildings.find(b => b.id === endId);

        if (!startBuilding || !endBuilding) return;

        startBuilding.element.classList.add('building-active');
        endBuilding.element.classList.add('building-active');

        // Place markers at the ENTRANCE road, not the building center
        // This makes it clear where the path actually starts/ends
        const startRoad = startBuilding.nearestRoad;
        const endRoad = endBuilding.nearestRoad;

        if (!startRoad || !endRoad) {
            showToast("Could not connect buildings to the road network.", "error");
            return;
        }

        // Use COLORED BORDERS for destination only (not starting point)
        // startBuilding - no highlight
        endBuilding.element.classList.add('building-end');

        // Note: Markers are no longer added
        // addMarker(startBuilding.x, startBuilding.y - 80, 'start');
        // addMarker(endBuilding.x, endBuilding.y - 80, 'end');

        let pathIndices = findShortestPath(startRoad.id, endRoad.id);

        if (pathIndices) {
            // Fill gaps with improved logic
            const filledPathIndices = fillPathGaps(pathIndices);

            // Ensure entrance roads are included (they might be missed by fillPathGaps)
            if (!filledPathIndices.includes(startRoad.id)) {
                filledPathIndices.push(startRoad.id);
            }
            if (!filledPathIndices.includes(endRoad.id)) {
                filledPathIndices.push(endRoad.id);
            }

            // Sort by distance from START ROAD center
            filledPathIndices.sort((a, b) => {
                const distA = Math.sqrt(Math.pow(roads[a].centerX - startRoad.centerX, 2) + Math.pow(roads[a].centerY - startRoad.centerY, 2));
                const distB = Math.sqrt(Math.pow(roads[b].centerX - startRoad.centerX, 2) + Math.pow(roads[b].centerY - startRoad.centerY, 2));
                return distA - distB;
            });

            filledPathIndices.forEach((index, i) => {
                const road = roads[index];
                road.element.classList.add('path-active');
                road.element.style.animationDelay = `${i * 0.05}s`;
            });
        } else {
            console.warn("No path found.");
            showToast("No connected path found between these locations.", "error");
        }
    }

    resetBtn.addEventListener('click', () => {
        // Reset select values
        startSelect.value = "";
        endSelect.value = "";

        // Reset display text
        const startText = document.getElementById('start-location-text');
        const endText = document.getElementById('end-location-text');
        if (startText) startText.textContent = 'Starting Point';
        if (endText) endText.textContent = 'Destination';

        // Clear all highlights
        clearHighlights();
        isRouteActive = false;

        // Restore all dropdown options
        updateDropdownOptions();
    });

    // Swap button functionality - PROPERLY SWAP START AND END
    swapBtn.addEventListener('click', () => {
        const startValue = startSelect.value;
        const endValue = endSelect.value;
        const startText = document.getElementById('start-location-text');
        const endText = document.getElementById('end-location-text');

        // Only swap if at least one has a value
        if (startValue || endValue) {
            // 1. Get the option text BEFORE repopulating/swapping
            // We need to look in the hidden selects to find the text for the value
            // We search in BOTH lists in case it's hidden in one
            let startOptionText = 'Starting Point';
            let endOptionText = 'Destination';

            if (startValue) {
                const sOpt = startSelect.querySelector(`option[value="${startValue}"]`) ||
                    endSelect.querySelector(`option[value="${startValue}"]`);
                if (sOpt) startOptionText = sOpt.textContent;
            }

            if (endValue) {
                const eOpt = endSelect.querySelector(`option[value="${endValue}"]`) ||
                    startSelect.querySelector(`option[value="${endValue}"]`);
                if (eOpt) endOptionText = eOpt.textContent;
            }

            // 2. CRITICAL: Unhide all options first so the values can actually be set
            // Passing null as second arg means "don't exclude anything"
            if (typeof populateDropdown === 'function') {
                populateDropdown(startSelect, null);
                populateDropdown(endSelect, null);
            }

            // 3. Swap the values
            startSelect.value = endValue;
            endSelect.value = startValue;

            // 4. Update the visual text
            if (startText) startText.textContent = endValue ? endOptionText : 'Starting Point';
            if (endText) endText.textContent = startValue ? startOptionText : 'Destination';

            // 5. Re-apply the filtering (hide Start in End list, hide End in Start list)
            updateDropdownOptions();

            // 6. Recalculate route if both present
            if (startSelect.value && endSelect.value) {
                clearHighlights();
                calculateAndHighlightPath(startSelect.value, endSelect.value);
                isRouteActive = true;
            } else {
                clearHighlights();
                isRouteActive = false;
            }
        }
    });

    // ... (Zoom functions remain same) ...

    // Add click handlers to buildings after they are loaded
    function addBuildingClickHandlers() {
        buildings.forEach(building => {
            building.element.addEventListener('click', (e) => {
                // Don't open gallery if we're in the middle of panning
                if (isPanning) return;

                console.log('Building clicked:', building.name);
                openGallery(building.name);
            });
        });

        // Explicit text-to-building mapping
        // ORDER MATTERS: Longer/More Specific keys first!
        const textToBuildingMap = {
            "girl's hostel block a": "Girl's Hostel Block A",
            "girl's hostel block b": "Girl's Hostel Block B",
            "girls hostel block a": "Girl's Hostel Block A",
            "girls hostel block b": "Girl's Hostel Block B",
            "new uncompleted admin block": 'New Uncompleted Admin Block',
            "academic block": 'Academic Block',
            "school field": 'School Field',
            "school gate": 'School Gate',
            "security office": 'Security Office',
            "vc's office": "VC's Office",
            'hostel a': "Girl's Hostel Block A",
            'hostel b': "Girl's Hostel Block B",
            'block a': "Girl's Hostel Block A",
            'block b': "Girl's Hostel Block B",
            'security': 'Security Office',
            'field': 'School Field',
            'gate': 'School Gate',
            'library': 'Library',
            'auditorium': 'Auditorium',
            'toilet': 'Toilet',
            'store': 'Store',
            'workshop': 'Workshop',
            'scit': 'SCIT',
            'etec': 'ETEC',
            'spas': 'SPAS',
            'pavillon': 'Pavillon',
            'pavilion': 'Pavillon',
            'vc': "VC's Office",
            "vc's": "VC's Office",
            'admin': 'New Uncompleted Admin Block',
            'academic': 'Academic Block',
            'girl': "Girl's Hostel Block A", // Fallback
            'girls': "Girl's Hostel Block A", // Fallback
            "girl's": "Girl's Hostel Block A", // Fallback
            'hostel': "Girl's Hostel Block A" // Fallback
        };

        // Add click handlers to ALL text elements in the SVG
        const svg = mapContainer.querySelector('svg');
        if (svg) {
            const textElements = svg.querySelectorAll('text, tspan');
            console.log(`Found ${textElements.length} text elements in SVG`);

            textElements.forEach(textEl => {
                const textContent = textEl.textContent.replace(/[\n\r\t\s]+/g, ' ').trim();
                const textLower = textContent.toLowerCase();

                if (!textContent || textContent.length < 1) return;

                let matchingBuilding = null;

                // 1. Try Exact Name Match (Case Insensitive)
                matchingBuilding = buildings.find(b => b.name.toLowerCase() === textLower);

                // 2. Try Explicit Mapping (Longest Key Match)
                if (!matchingBuilding) {
                    let bestMatchLength = 0;
                    for (const [key, buildingName] of Object.entries(textToBuildingMap)) {
                        // Check if text contains the key OR key contains the text
                        if (textLower.includes(key) || key.includes(textLower)) {
                            // Prefer the match where the key length is longer (more specific)
                            if (key.length > bestMatchLength) {
                                const candidate = buildings.find(b => b.name === buildingName);
                                if (candidate) {
                                    matchingBuilding = candidate;
                                    bestMatchLength = key.length;
                                }
                            }
                        }
                    }
                }

                // 3. Fallback: Word intersection
                if (!matchingBuilding) {
                    matchingBuilding = buildings.find(b => {
                        const bName = b.name.toLowerCase();
                        const textWords = textLower.split(/[\s,'-]+/).filter(w => w.length > 3);
                        const bWords = bName.split(/[\s,'-]+/).filter(w => w.length > 3);
                        // Require significant overlap
                        return textWords.some(tw => bWords.includes(tw));
                    });
                }

                // 4. Fallback: Spatial Matching (Check if text is visually ON TOP of a building)
                if (!matchingBuilding) {
                    try {
                        // Get approximate position of text
                        let tx = 0, ty = 0;

                        // Try native attributes first
                        if (textEl.hasAttribute('x')) tx = parseFloat(textEl.getAttribute('x'));
                        if (textEl.hasAttribute('y')) ty = parseFloat(textEl.getAttribute('y'));

                        // If no attributes (e.g. relative tspan), assume parent's position
                        if (!tx && !ty && textEl.parentNode && textEl.parentNode.tagName === 'text') {
                            if (textEl.parentNode.hasAttribute('x')) tx = parseFloat(textEl.parentNode.getAttribute('x'));
                            if (textEl.parentNode.hasAttribute('y')) ty = parseFloat(textEl.parentNode.getAttribute('y'));
                        }

                        if (tx && ty) {
                            // Find building containing this point
                            matchingBuilding = buildings.find(b => {
                                return tx >= b.bbox.x && tx <= b.bbox.x + b.bbox.width &&
                                    ty >= b.bbox.y && ty <= b.bbox.y + b.bbox.height;
                            });

                            if (matchingBuilding) {
                                console.log(`Spatial match: "${textContent}" is over building "${matchingBuilding.name}"`);

                                // CRITICAL: If the building has a generic name, RENAME it to the label!
                                // This fixes "Building 123" issues and makes gallery work
                                if (matchingBuilding.name.startsWith('Building') && textContent.length > 3) {
                                    console.log(`Renaming "${matchingBuilding.name}" to "${textContent}" based on label`);
                                    matchingBuilding.name = textContent;

                                    // Also update the DOM title if possible
                                    const titleEl = matchingBuilding.element.querySelector('title');
                                    if (titleEl) titleEl.textContent = textContent;
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Spatial matching failed', err);
                    }
                }

                if (matchingBuilding) {
                    // Make the text element clickable - Cursor change only
                    textEl.style.cursor = 'pointer';

                    // Clone to remove old listeners
                    const newEl = textEl.cloneNode(true);
                    textEl.parentNode.replaceChild(newEl, textEl);
                    newEl.style.cursor = 'pointer';

                    newEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (isPanning) return;
                        console.log('Text label clicked:', textContent, '->', matchingBuilding.name);
                        openGallery(matchingBuilding.name);
                    });
                }
            });
        }
    }

    // Zoom and Pan Functions
    function initZoomAndPan(svg) {
        // Mouse wheel zoom - zooms toward cursor position
        mapContainer.addEventListener('wheel', (e) => {
            e.preventDefault();

            const svg = mapContainer.querySelector('svg');
            if (!svg) return;

            // Get mouse position relative to the map container
            const containerRect = mapContainer.getBoundingClientRect();
            const mouseX = e.clientX - containerRect.left;
            const mouseY = e.clientY - containerRect.top;

            // Calculate zoom delta
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newZoom = Math.max(0.5, Math.min(3, currentZoom + delta));

            // Only update if zoom actually changed
            if (newZoom !== currentZoom) {
                const zoomRatio = newZoom / currentZoom;

                // Adjust pan to keep mouse position stationary on the map
                // Formula: newPan = mousePos - (mousePos - currentPan) * zoomRatio
                currentPanX = mouseX - (mouseX - currentPanX) * zoomRatio;
                currentPanY = mouseY - (mouseY - currentPanY) * zoomRatio;
                currentZoom = newZoom;

                updateTransform(svg);
            }
        }, { passive: false });

        // Click and drag panning
        mapContainer.addEventListener('mousedown', (e) => {
            // Don't pan when clicking buildings or text labels
            if (e.target.closest('.cls-5, .cls-6, .cls-4') ||
                e.target.tagName === 'text' ||
                e.target.tagName === 'tspan') return;
            isPanning = true;
            startPanX = e.clientX - currentPanX;
            startPanY = e.clientY - currentPanY;
            mapContainer.classList.add('grabbing');
        });

        mapContainer.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            currentPanX = e.clientX - startPanX;
            currentPanY = e.clientY - startPanY;
            updateTransform(svg);
        });

        mapContainer.addEventListener('mouseup', () => {
            isPanning = false;
            mapContainer.classList.remove('grabbing');
        });

        mapContainer.addEventListener('mouseleave', () => {
            isPanning = false;
            mapContainer.classList.remove('grabbing');
        });

        // Zoom button controls
        zoomInBtn.addEventListener('click', () => zoom(0.2));
        zoomOutBtn.addEventListener('click', () => zoom(-0.2));
        zoomResetBtn.addEventListener('click', resetZoom);

        // ===== TOUCH SUPPORT FOR MOBILE DEVICES =====

        // Helper function to get distance between two touch points
        function getTouchDistance(touch1, touch2) {
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        // Helper function to get midpoint between two touch points
        function getTouchMidpoint(touch1, touch2) {
            return {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }

        // Touch Start - Detect single finger pan or two-finger pinch
        mapContainer.addEventListener('touchstart', (e) => {
            // Don't handle if touching a building or text
            if (e.target.closest('.cls-5, .cls-6, .cls-4, .building-hitbox') ||
                e.target.tagName === 'text' ||
                e.target.tagName === 'tspan') {
                return;
            }

            mapTouchMoved = false;

            if (e.touches.length === 1) {
                // Single finger - prepare for panning
                isMapTouchPanning = true;
                mapTouchStartX = e.touches[0].clientX - currentPanX;
                mapTouchStartY = e.touches[0].clientY - currentPanY;
                mapContainer.classList.add('grabbing');
                mapContainer.classList.add('touch-active'); // Disable transition during touch
            } else if (e.touches.length === 2) {
                // Two fingers - prepare for pinch zoom
                isMapTouchPanning = false;
                mapPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
                mapPinchZoom = currentZoom;
                mapContainer.classList.add('touch-active'); // Disable transition during pinch
            }
        }, { passive: true });

        // Touch Move - Pan or Pinch Zoom
        mapContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && isMapTouchPanning) {
                // Single finger panning
                e.preventDefault(); // Prevent page scroll while panning map
                mapTouchMoved = true;
                currentPanX = e.touches[0].clientX - mapTouchStartX;
                currentPanY = e.touches[0].clientY - mapTouchStartY;
                updateTransform(svg);
            } else if (e.touches.length === 2) {
                // Two finger pinch zoom
                e.preventDefault();
                mapTouchMoved = true;
                isMapTouchPanning = false;

                const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
                const scale = currentDistance / mapPinchDistance;

                // Calculate new zoom (clamped to min/max)
                const newZoom = Math.max(0.5, Math.min(3, mapPinchZoom * scale));

                // Get the midpoint between the two fingers for zoom center
                const midpoint = getTouchMidpoint(e.touches[0], e.touches[1]);
                const containerRect = mapContainer.getBoundingClientRect();

                // Calculate the point in the map that's under the pinch center
                const pinchX = midpoint.x - containerRect.left;
                const pinchY = midpoint.y - containerRect.top;

                // Adjust pan to keep the pinch center point stationary
                if (currentZoom !== newZoom) {
                    const zoomRatio = newZoom / currentZoom;

                    // Calculate the new pan position to keep pinch center fixed
                    currentPanX = pinchX - (pinchX - currentPanX) * zoomRatio;
                    currentPanY = pinchY - (pinchY - currentPanY) * zoomRatio;
                    currentZoom = newZoom;

                    updateTransform(svg);
                }
            }
        }, { passive: false }); // passive: false to allow preventDefault

        // Touch End - End panning/zooming and detect double-tap
        mapContainer.addEventListener('touchend', (e) => {
            const now = Date.now();

            // Check for double-tap to zoom (only if no movement occurred)
            if (e.changedTouches.length === 1 && !mapTouchMoved) {
                const touch = e.changedTouches[0];
                const timeSinceLastTap = now - mapLastTapTime;
                const distanceFromLastTap = Math.sqrt(
                    Math.pow(touch.clientX - mapLastTapX, 2) +
                    Math.pow(touch.clientY - mapLastTapY, 2)
                );

                // Double-tap detected (within 300ms and 50px of last tap)
                if (timeSinceLastTap < 300 && distanceFromLastTap < 50) {
                    e.preventDefault();

                    // Get tap position relative to container
                    const containerRect = mapContainer.getBoundingClientRect();
                    const tapX = touch.clientX - containerRect.left;
                    const tapY = touch.clientY - containerRect.top;

                    // Define zoom levels to cycle through
                    const zoomLevels = [1, 1.5, 2, 2.5];

                    // Find the next zoom level
                    let nextZoom;
                    if (currentZoom >= 2.5 || currentZoom >= zoomLevels[zoomLevels.length - 1] - 0.1) {
                        // At max or near max, reset to 1x
                        nextZoom = 1;
                    } else {
                        // Find the next zoom level up
                        nextZoom = zoomLevels.find(z => z > currentZoom + 0.1) || 1;
                    }

                    // Create visual ripple effect at tap point with zoom level indicator
                    createDoubleTapRipple(touch.clientX, touch.clientY, nextZoom);

                    // Animate the zoom transition smoothly
                    animateDoubleTapZoom(tapX, tapY, currentZoom, nextZoom, svg);

                    mapLastTapTime = 0; // Reset to prevent triple-tap
                } else {
                    // Record this tap for potential double-tap
                    mapLastTapTime = now;
                    mapLastTapX = touch.clientX;
                    mapLastTapY = touch.clientY;
                }
            }

            isMapTouchPanning = false;
            mapContainer.classList.remove('grabbing');
            mapContainer.classList.remove('touch-active'); // Restore transitions
        }, { passive: false });

        // Animated double-tap zoom with easing
        function animateDoubleTapZoom(tapX, tapY, fromZoom, toZoom, svg) {
            const duration = 300; // Animation duration in ms
            const startTime = performance.now();
            const startPanX = currentPanX;
            const startPanY = currentPanY;

            // Calculate target pan position to center on tap point
            let targetPanX, targetPanY;

            if (toZoom === 1) {
                // Reset to center
                targetPanX = 0;
                targetPanY = 0;
            } else {
                // Calculate pan to keep tap point stationary
                const zoomRatio = toZoom / fromZoom;
                targetPanX = tapX - (tapX - startPanX) * zoomRatio;
                targetPanY = tapY - (tapY - startPanY) * zoomRatio;
            }

            // Easing function (ease-out cubic)
            function easeOutCubic(t) {
                return 1 - Math.pow(1 - t, 3);
            }

            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeOutCubic(progress);

                // Interpolate zoom and pan
                currentZoom = fromZoom + (toZoom - fromZoom) * easedProgress;
                currentPanX = startPanX + (targetPanX - startPanX) * easedProgress;
                currentPanY = startPanY + (targetPanY - startPanY) * easedProgress;

                updateTransform(svg);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            }

            requestAnimationFrame(animate);
        }

        // Create ripple effect for double-tap visual feedback
        function createDoubleTapRipple(x, y, zoomLevel) {
            const ripple = document.createElement('div');
            ripple.className = 'double-tap-ripple';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            // Add zoom level indicator inside ripple
            if (zoomLevel !== undefined) {
                const zoomIndicator = document.createElement('span');
                zoomIndicator.className = 'ripple-zoom-level';
                zoomIndicator.textContent = zoomLevel === 1 ? '1×' : zoomLevel + '×';
                ripple.appendChild(zoomIndicator);
            }

            document.body.appendChild(ripple);

            // Remove after animation completes
            ripple.addEventListener('animationend', () => {
                ripple.remove();
            });
        }

        // Touch Cancel - Clean up state
        mapContainer.addEventListener('touchcancel', () => {
            isMapTouchPanning = false;
            mapContainer.classList.remove('grabbing');
            mapContainer.classList.remove('touch-active'); // Restore transitions
        }, { passive: true });
    }

    function zoom(delta) {
        const svg = mapContainer.querySelector('svg');
        if (!svg) return;

        const newZoom = Math.max(0.5, Math.min(3, currentZoom + delta));

        // Only update if zoom actually changed
        if (newZoom !== currentZoom) {
            // Get center of viewport as the zoom target
            const containerRect = mapContainer.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;

            const zoomRatio = newZoom / currentZoom;

            // Adjust pan to keep center stationary
            currentPanX = centerX - (centerX - currentPanX) * zoomRatio;
            currentPanY = centerY - (centerY - currentPanY) * zoomRatio;
            currentZoom = newZoom;

            updateTransform(svg);
        }
    }

    function resetZoom() {
        const svg = mapContainer.querySelector('svg');
        if (!svg) return;

        currentZoom = 1;
        currentPanX = 0;
        currentPanY = 0;
        updateTransform(svg);
    }

    function updateTransform(svg) {
        svg.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentZoom})`;

        // Toggle zoomed class on map-wrapper based on zoom level
        // When zoomed in (>1) or panned, allow map to extend under zoom controls
        const mapWrapper = document.querySelector('.map-wrapper');
        if (mapWrapper) {
            if (currentZoom > 1 || currentPanX !== 0 || currentPanY !== 0) {
                mapWrapper.classList.add('zoomed');
            } else {
                mapWrapper.classList.remove('zoomed');
            }
        }
    }

    // ===== REDESIGNED DIRECTION PLANNER & PICKER MODULA =====

    // New UI Elements
    const directionStartTrigger = document.getElementById('direction-start-trigger');
    const directionEndTrigger = document.getElementById('direction-end-trigger');
    const directionStartDisplay = document.getElementById('direction-start-display');
    const directionEndDisplay = document.getElementById('direction-end-display');
    const pickerSearchInput = document.getElementById('picker-search-input');
    const pickerEmptyState = document.getElementById('picker-empty-state');

    let currentPickingType = 'start'; // Track if we're picking for Start or End

    function updatePlannerUI() {
        const startVal = directionStartSelect.value;
        const endVal = directionEndSelect.value;

        // Update Start Trigger
        if (startVal) {
            const b = buildings.find(b => b.id === startVal);
            directionStartDisplay.textContent = b ? b.name : "Select Location";
            directionStartTrigger.classList.add('has-value');
        } else {
            directionStartDisplay.textContent = "Select Location";
            directionStartTrigger.classList.remove('has-value');
        }

        // Update End Trigger
        if (endVal) {
            const b = buildings.find(b => b.id === endVal);
            directionEndDisplay.textContent = b ? b.name : "Select Location";
            directionEndTrigger.classList.add('has-value');
        } else {
            directionEndDisplay.textContent = "Select Location";
            directionEndTrigger.classList.remove('has-value');
        }

        // Toggle Go Button
        directionModalGo.classList.toggle('incomplete', !(startVal && endVal));

        // Check for overflowing trigger-value text and add sliding animation
        setTimeout(() => {
            [directionStartDisplay, directionEndDisplay].forEach(el => {
                el.classList.remove('sliding');
                el.style.removeProperty('--slide-distance');
                const parentWidth = el.parentElement ? el.parentElement.clientWidth : el.clientWidth;
                if (el.scrollWidth > parentWidth && parentWidth > 0) {
                    const overflow = el.scrollWidth - parentWidth;
                    el.style.setProperty('--slide-distance', `-${overflow + 12}px`);
                    el.classList.add('sliding');
                }
            });
        }, 100);
    }

    // Initialize triggers
    directionStartTrigger.addEventListener('click', () => openLocationPicker('start'));
    directionEndTrigger.addEventListener('click', () => openLocationPicker('end'));

    async function openLocationPicker(type) {
        currentPickingType = type;
        const modalTitle = document.getElementById('location-modal-title');
        modalTitle.textContent = type === 'start' ? 'Select Starting Point' : 'Select Destination';

        // Clear search
        pickerSearchInput.value = '';

        // Open modal
        const locationModal = document.getElementById('location-modal');
        locationModal.classList.add('active');

        // Initial render
        renderPickerList('');

        // Focus search after animation
        setTimeout(() => pickerSearchInput.focus(), 300);
    }

    function closeLocationPicker() {
        const locationModal = document.getElementById('location-modal');
        locationModal.classList.remove('active');
    }

    document.getElementById('location-modal-close').addEventListener('click', closeLocationPicker);
    pickerSearchInput.addEventListener('input', (e) => renderPickerList(e.target.value));

    async function renderPickerList(filterText = '') {
        const listContainer = document.getElementById('location-list');
        listContainer.innerHTML = '';
        const query = filterText.toLowerCase().trim();

        // Current values to handle exclusion and active state
        const startVal = directionStartSelect.value;
        const endVal = directionEndSelect.value;
        const otherVal = currentPickingType === 'start' ? endVal : startVal;
        const currentVal = currentPickingType === 'start' ? startVal : endVal;

        const filtered = buildings.filter(b => {
            if (b.name === "School Field" || b.id === otherVal) return false;
            return b.name.toLowerCase().includes(query);
        });

        if (filtered.length === 0) {
            pickerEmptyState.classList.remove('hidden');
        } else {
            pickerEmptyState.classList.add('hidden');

            filtered.forEach((b, index) => {
                const item = document.createElement('div');
                item.className = 'building-picker-item';
                if (b.id === currentVal) item.classList.add('active-selection');

                // Staggered entry animation (no movement)
                item.style.animation = `simpleFadeIn 0.3s ease-out backwards ${index * 0.05}s`;

                const folderName = buildingFolderMap[b.name] || b.name;
                const thumbPath = `LOCATION DATA/${folderName}/1.jpg`;

                item.innerHTML = `
                    <div class="picker-thumb">
                        <img src="${thumbPath}" onerror="this.src='Futia_LogoX.png'; this.style.opacity='0.2'; this.style.padding='10px';" alt="">
                    </div>
                    <div class="picker-item-info">
                        <span class="picker-item-name">${b.name}</span>
                        <span class="picker-item-action">${b.id === currentVal ? 'Already Selected' : 'Tap to Select'}</span>
                    </div>
                    <div class="selection-indicator">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                `;

                item.addEventListener('click', () => {
                    if (currentPickingType === 'start') {
                        directionStartSelect.value = b.id;
                    } else {
                        directionEndSelect.value = b.id;
                    }

                    // Sync with navigation bar selects too for consistency
                    if (currentPickingType === 'start') {
                        startSelect.value = b.id;
                        updateDropdownOptions();
                    } else {
                        endSelect.value = b.id;
                        updateDropdownOptions();
                    }

                    updatePlannerUI();
                    closeLocationPicker();
                });

                listContainer.appendChild(item);

                // Detect overflow and add sliding for picker item names
                const nameEl = item.querySelector('.picker-item-name');
                const infoEl = item.querySelector('.picker-item-info');
                if (nameEl && infoEl) {
                    // Small delay to ensure render is complete
                    setTimeout(() => {
                        if (nameEl.scrollWidth > infoEl.clientWidth && infoEl.clientWidth > 0) {
                            const overflow = nameEl.scrollWidth - infoEl.clientWidth;
                            nameEl.style.setProperty('--slide-distance', `-${overflow + 12}px`);
                            nameEl.classList.add('sliding');
                        }
                    }, 200 + (index * 20)); // Stagger slightly based on index
                }
            });
        }
    }


    // Original functional buttons
    goBtn.addEventListener('click', () => {
        // Sync triggers with current selects (in case they were changed elsewhere)
        updatePlannerUI();
        getDirectionModal.classList.add('active');
    });

    getDirectionModalClose.addEventListener('click', () => {
        getDirectionModal.classList.remove('active');
    });

    // Close Modals on Outer Click (Overlay)
    const directionOverlay = getDirectionModal.querySelector('.route-modal-overlay');
    const locationOverlay = document.querySelector('.location-modal-overlay');

    if (directionOverlay) {
        directionOverlay.addEventListener('click', () => {
            getDirectionModal.classList.remove('active');
        });
    }

    if (locationOverlay) {
        locationOverlay.addEventListener('click', (e) => {
            // Only close the picker, not the underlying direction planner
            e.stopPropagation();
            closeLocationPicker();
        });
    }


    directionModalGo.addEventListener('click', () => {
        const startId = directionStartSelect.value;
        const endId = directionEndSelect.value;

        if (startId && endId) {
            if (startId === endId) {
                showToast("Start and End locations cannot be the same.", "warning");
                return;
            }
            calculateAndHighlightPath(startId, endId);
            getDirectionModal.classList.remove('active');
        } else {
            showToast("Please select both a starting point and a destination.", "warning");
        }
    });

    directionSwapBtn.addEventListener('click', () => {
        const startValue = directionStartSelect.value;
        directionStartSelect.value = directionEndSelect.value;
        directionEndSelect.value = startValue;
        updatePlannerUI();

        // Visual feedback for swap
        const pip = directionSwapBtn.querySelector('svg');
        pip.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        pip.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            pip.style.transition = 'none';
            pip.style.transform = 'rotate(0deg)';
        }, 500);
    });

    directionModalClear.addEventListener('click', () => {
        directionStartSelect.value = "";
        directionEndSelect.value = "";
        updatePlannerUI();
        clearHighlights();
    });


    // ===== IMAGE GALLERY FUNCTIONALITY =====
    const galleryModal = document.getElementById('gallery-modal');
    const galleryContainer = document.getElementById('gallery-container');
    const galleryClose = document.getElementById('gallery-close');
    const galleryOverlay = document.querySelector('.gallery-overlay');
    const galleryTitle = document.getElementById('gallery-title');
    const galleryGrid = document.getElementById('gallery-grid');
    const galleryNoImages = document.getElementById('gallery-no-images');

    // Mapping building names to folder names
    const buildingFolderMap = {
        'Academic Block': 'Academic Block',
        'Auditorium': 'Auditorium',
        'ETEC': 'ETEC',
        "Girl's Hostel Block A": "Girl's Hostel Block A",
        "Girl's Hostel Block B": "Girl's Hostel Block B",
        'Library': 'Library',
        'New Uncompleted Admin Block': 'New Uncompleted Administrative Block',
        'Pavillon': 'Pavilion',
        'SCIT': 'SCIT',
        'SPAS': 'SPAS',
        'School Field': 'School Field',
        'School Gate': 'School Gate',
        'Security Office': 'Security Office',
        'Store': 'Store',
        'Toilet': 'Toilet',
        "VC's Office": "VC's Office",
        'Workshop': 'Workshop'
    };

    // Add click handlers to buildings after they are loaded
    function addBuildingClickHandlers() {
        buildings.forEach(building => {
            building.element.addEventListener('click', (e) => {
                // Don't open gallery if we're in the middle of panning
                if (isPanning) return;

                console.log('Building clicked:', building.name);
                openGallery(building.name);
            });
        });

        // Explicit text-to-building mapping for hard-to-match labels
        const textToBuildingMap = {
            'girl': "Girl's Hostel Block A",
            'girls': "Girl's Hostel Block A",
            "girl's": "Girl's Hostel Block A",
            'hostel': "Girl's Hostel Block A",
            'hostel a': "Girl's Hostel Block A",
            'hostel b': "Girl's Hostel Block B",
            'block a': "Girl's Hostel Block A",
            'block b': "Girl's Hostel Block B",
            'security': 'Security Office',
            'security office': 'Security Office',
            'field': 'School Field',
            'school field': 'School Field',
            'gate': 'School Gate',
            'school gate': 'School Gate',
            'library': 'Library',
            'auditorium': 'Auditorium',
            'toilet': 'Toilet',
            'store': 'Store',
            'workshop': 'Workshop',
            'scit': 'SCIT',
            'etec': 'ETEC',
            'spas': 'SPAS',
            'pavillon': 'Pavillon',
            'pavilion': 'Pavillon',
            'vc': "VC's Office",
            "vc's": "VC's Office",
            "vc's office": "VC's Office",
            'admin': 'New Uncompleted Admin Block',
            'academic': 'Academic Block',
            'academic block': 'Academic Block'
        };

        // Add click handlers to ALL text elements in the SVG
        const svg = mapContainer.querySelector('svg');
        if (svg) {
            const textElements = svg.querySelectorAll('text, tspan');
            console.log(`Found ${textElements.length} text elements in SVG`);

            textElements.forEach(textEl => {
                const textContent = textEl.textContent.trim();
                const textLower = textContent.toLowerCase();

                if (!textContent || textContent.length < 1) return;

                let matchingBuilding = null;

                // First try explicit mapping
                for (const [key, buildingName] of Object.entries(textToBuildingMap)) {
                    if (textLower === key || textLower.includes(key) || key.includes(textLower)) {
                        matchingBuilding = buildings.find(b => b.name === buildingName);
                        if (matchingBuilding) break;
                    }
                }

                // If no explicit match, try flexible matching
                if (!matchingBuilding) {
                    matchingBuilding = buildings.find(b => {
                        const bName = b.name.toLowerCase();
                        // Exact match
                        if (bName === textLower) return true;
                        // Text contains building name
                        if (textLower.includes(bName)) return true;
                        // Building name contains text
                        if (bName.includes(textLower)) return true;
                        // Any word match (for multi-word names)
                        const textWords = textLower.split(/[\s,'-]+/).filter(w => w.length > 2);
                        const bWords = bName.split(/[\s,'-]+/).filter(w => w.length > 2);
                        return textWords.some(tw => bWords.some(bw => bw.includes(tw) || tw.includes(bw)));
                    });
                }

                if (matchingBuilding) {
                    // Make the text element clickable - NO hover effect, just cursor change
                    textEl.style.cursor = 'pointer';

                    // Remove any existing click handler
                    const newEl = textEl.cloneNode(true);
                    textEl.parentNode.replaceChild(newEl, textEl);
                    newEl.style.cursor = 'pointer';

                    newEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (isPanning) return;
                        console.log('Text label clicked:', textContent, '->', matchingBuilding.name);
                        openGallery(matchingBuilding.name);
                    });
                }
            });
        }
    }

    // Gallery Loading Element
    const galleryLoading = document.getElementById('gallery-loading');

    // Track current gallery images for the viewer
    let currentGalleryImages = [];
    let currentBuildingName = '';
    let openedFromAllBuildings = false; // Track if gallery was opened from All Buildings Modal

    async function openGallery(buildingName) {
        const folderName = buildingFolderMap[buildingName] || buildingName;
        const folderPath = `LOCATION DATA/${folderName}`;

        // Update title
        galleryTitle.textContent = `${buildingName} - Images`;
        currentBuildingName = buildingName;

        // Show loading spinner, hide other content
        galleryGrid.innerHTML = '';
        galleryNoImages.style.display = 'none';
        galleryLoading.classList.add('visible');

        // Show modal
        galleryModal.classList.add('active');

        try {
            // Try to load images from the folder
            const images = await loadBuildingImages(folderPath);
            currentGalleryImages = images;

            // Reset container width classes
            galleryContainer.classList.remove('count-1', 'count-2');
            if (images.length === 1) galleryContainer.classList.add('count-1');
            if (images.length === 2) galleryContainer.classList.add('count-2');

            // Hide loading spinner
            galleryLoading.classList.remove('visible');

            if (images.length === 0) {
                galleryNoImages.style.display = 'flex';
            } else {
                galleryNoImages.style.display = 'none';
                images.forEach((imagePath, index) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'gallery-image-wrapper';
                    wrapper.style.animationDelay = `${index * 0.1}s`;
                    wrapper.dataset.index = index;

                    const img = document.createElement('img');
                    img.src = imagePath;
                    img.alt = `${buildingName} - Image ${index + 1}`;
                    img.loading = 'lazy';

                    const label = document.createElement('div');
                    label.className = 'gallery-image-label';
                    label.textContent = `Image ${index + 1}`;

                    // Add zoom icon for hover effect
                    const zoomIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    zoomIcon.setAttribute('class', 'zoom-icon');
                    zoomIcon.setAttribute('viewBox', '0 0 24 24');
                    zoomIcon.setAttribute('fill', 'none');
                    zoomIcon.setAttribute('stroke', 'currentColor');
                    zoomIcon.setAttribute('stroke-width', '2');
                    zoomIcon.innerHTML = `
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="11" y1="8" x2="11" y2="14"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    `;

                    wrapper.appendChild(img);
                    wrapper.appendChild(label);
                    wrapper.appendChild(zoomIcon);
                    galleryGrid.appendChild(wrapper);

                    // Click to open image viewer
                    wrapper.addEventListener('click', () => {
                        openImageViewer(index);
                    });

                    // Handle image errors
                    img.onerror = () => {
                        wrapper.style.display = 'none';
                    };
                });
            }
        } catch (error) {
            console.error('Error loading images:', error);
            galleryLoading.classList.remove('visible');
            galleryGrid.innerHTML = '';
            galleryNoImages.style.display = 'flex';
        }
    }

    async function loadBuildingImages(folderPath) {
        // Common image extensions
        const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const images = [];
        const checkPromises = [];

        // Try to load images numbered from 1 to 20 - use parallel checking for speed
        for (let i = 1; i <= 20; i++) {
            for (const ext of extensions) {
                const imagePath = `${folderPath}/${i}.${ext}`;
                checkPromises.push(
                    checkImageExists(imagePath).then(exists => {
                        if (exists) {
                            return { path: imagePath, index: i };
                        }
                        return null;
                    })
                );
            }
        }

        // Wait for all checks to complete
        const results = await Promise.all(checkPromises);

        // Filter valid images and sort by index
        const validImages = results.filter(r => r !== null);

        // Remove duplicates (same index different extension)
        const uniqueImages = [];
        const seenIndices = new Set();
        validImages.forEach(img => {
            if (!seenIndices.has(img.index)) {
                seenIndices.add(img.index);
                uniqueImages.push(img);
            }
        });

        // Sort by index and return paths
        uniqueImages.sort((a, b) => a.index - b.index);
        return uniqueImages.map(img => img.path);
    }

    function checkImageExists(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    }

    function closeGallery() {
        galleryModal.classList.remove('active');
        galleryLoading.classList.remove('visible');

        // If gallery was opened from All Buildings Modal, reopen it
        if (openedFromAllBuildings) {
            openedFromAllBuildings = false;
            setTimeout(() => {
                openAllBuildingsModal();
            }, 150); // Small delay for smooth transition
        }
    }

    // Event listeners for closing the gallery
    galleryClose.addEventListener('click', closeGallery);
    galleryOverlay.addEventListener('click', closeGallery);

    // ===== FULL-SCREEN IMAGE VIEWER =====
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const imageViewerOverlay = document.querySelector('.image-viewer-overlay');
    const viewerImage = document.getElementById('viewer-image');
    const viewerContainer = document.getElementById('image-viewer-container');
    const viewerCounter = document.getElementById('viewer-image-counter');
    const viewerTitle = document.getElementById('viewer-image-title');
    const viewerZoomLevel = document.getElementById('viewer-zoom-level');
    const viewerThumbnails = document.getElementById('viewer-thumbnails');

    // Viewer buttons
    const viewerClose = document.getElementById('viewer-close');
    const viewerZoomIn = document.getElementById('viewer-zoom-in');
    const viewerZoomOut = document.getElementById('viewer-zoom-out');
    const viewerFit = document.getElementById('viewer-fit');
    const viewerPrev = document.getElementById('viewer-prev');
    const viewerNext = document.getElementById('viewer-next');

    // Viewer state
    let currentViewerIndex = 0;
    let viewerZoom = 1;
    let viewerPanX = 0;
    let viewerPanY = 0;
    let isViewerPanning = false;
    let viewerStartPanX = 0;
    let viewerStartPanY = 0;
    let imageNaturalWidth = 0;
    let imageNaturalHeight = 0;

    function openImageViewer(index) {
        if (currentGalleryImages.length === 0) return;

        currentViewerIndex = index;
        viewerZoom = 1;
        viewerPanX = 0;
        viewerPanY = 0;

        // Build thumbnails
        buildThumbnails();

        // Load the image
        loadViewerImage(index);

        // Show the viewer
        imageViewerModal.classList.add('active');

        // Update navigation state
        updateNavigationState();
    }

    function buildThumbnails() {
        viewerThumbnails.innerHTML = '';
        currentGalleryImages.forEach((imagePath, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'viewer-thumbnail';
            if (index === currentViewerIndex) {
                thumbnail.classList.add('active');
            }

            const img = document.createElement('img');
            img.src = imagePath;
            img.alt = `Thumbnail ${index + 1}`;

            thumbnail.appendChild(img);
            thumbnail.addEventListener('click', () => {
                navigateToImage(index);
            });

            viewerThumbnails.appendChild(thumbnail);
        });
    }

    function loadViewerImage(index) {
        const imagePath = currentGalleryImages[index];

        // Show loading state
        viewerContainer.classList.add('image-loading');
        viewerImage.classList.add('loading');

        // Update info
        viewerCounter.textContent = `${index + 1} / ${currentGalleryImages.length}`;
        viewerTitle.textContent = `${currentBuildingName} - Image ${index + 1}`;

        // Load image
        const newImg = new Image();
        newImg.onload = () => {
            viewerImage.src = imagePath;
            imageNaturalWidth = newImg.naturalWidth;
            imageNaturalHeight = newImg.naturalHeight;

            // Reset zoom and pan
            viewerZoom = 1;
            viewerPanX = 0;
            viewerPanY = 0;
            updateViewerTransform();

            // Hide loading state
            viewerContainer.classList.remove('image-loading');
            viewerImage.classList.remove('loading');
        };
        newImg.onerror = () => {
            viewerContainer.classList.remove('image-loading');
            viewerImage.classList.remove('loading');
            console.error('Failed to load image:', imagePath);
        };
        newImg.src = imagePath;

        // Update thumbnail active state
        updateThumbnailActive(index);
    }

    function updateThumbnailActive(index) {
        const thumbnails = viewerThumbnails.querySelectorAll('.viewer-thumbnail');
        thumbnails.forEach((thumb, i) => {
            if (i === index) {
                thumb.classList.add('active');
                // Scroll into view
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                thumb.classList.remove('active');
            }
        });
    }

    function navigateToImage(index) {
        if (index < 0 || index >= currentGalleryImages.length) return;
        currentViewerIndex = index;
        loadViewerImage(index);
        updateNavigationState();
    }

    function updateNavigationState() {
        viewerPrev.disabled = currentViewerIndex === 0;
        viewerNext.disabled = currentViewerIndex === currentGalleryImages.length - 1;
    }

    function updateViewerTransform() {
        viewerImage.style.transform = `translate(${viewerPanX}px, ${viewerPanY}px) scale(${viewerZoom})`;
        viewerZoomLevel.textContent = `${Math.round(viewerZoom * 100)}%`;
    }

    function zoomViewer(delta) {
        const oldZoom = viewerZoom;
        viewerZoom = Math.max(0.1, Math.min(5, viewerZoom + delta));

        // Adjust pan to keep image centered when zooming
        if (oldZoom !== viewerZoom) {
            const zoomRatio = viewerZoom / oldZoom;
            viewerPanX *= zoomRatio;
            viewerPanY *= zoomRatio;
        }

        updateViewerTransform();
    }

    function fitToScreen() {
        const containerRect = viewerContainer.getBoundingClientRect();
        const padding = 40; // Some padding

        const maxWidth = containerRect.width - padding * 2;
        const maxHeight = containerRect.height - padding * 2;

        const widthRatio = maxWidth / imageNaturalWidth;
        const heightRatio = maxHeight / imageNaturalHeight;

        viewerZoom = Math.min(widthRatio, heightRatio, 1); // Don't enlarge beyond 100%
        viewerPanX = 0;
        viewerPanY = 0;
        updateViewerTransform();
    }

    function actualSize() {
        viewerZoom = 1;
        viewerPanX = 0;
        viewerPanY = 0;
        updateViewerTransform();
    }

    function closeImageViewer() {
        imageViewerModal.classList.remove('active');
        viewerZoom = 1;
        viewerPanX = 0;
        viewerPanY = 0;
    }

    // Viewer button event listeners
    viewerClose.addEventListener('click', closeImageViewer);
    viewerZoomIn.addEventListener('click', () => zoomViewer(0.25));
    viewerZoomOut.addEventListener('click', () => zoomViewer(-0.25));
    viewerFit.addEventListener('click', actualSize);
    viewerPrev.addEventListener('click', () => navigateToImage(currentViewerIndex - 1));
    viewerNext.addEventListener('click', () => navigateToImage(currentViewerIndex + 1));
    imageViewerOverlay.addEventListener('click', closeImageViewer);

    // Wheel zoom on image viewer
    viewerContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        zoomViewer(delta);
    }, { passive: false });

    // Pan functionality
    viewerContainer.addEventListener('mousedown', (e) => {
        if (e.target === viewerImage || e.target === viewerContainer) {
            isViewerPanning = true;
            viewerStartPanX = e.clientX - viewerPanX;
            viewerStartPanY = e.clientY - viewerPanY;
            viewerContainer.classList.add('grabbing');
        }
    });

    viewerContainer.addEventListener('mousemove', (e) => {
        if (!isViewerPanning) return;
        viewerPanX = e.clientX - viewerStartPanX;
        viewerPanY = e.clientY - viewerStartPanY;
        updateViewerTransform();
    });

    viewerContainer.addEventListener('mouseup', () => {
        isViewerPanning = false;
        viewerContainer.classList.remove('grabbing');
    });

    viewerContainer.addEventListener('mouseleave', () => {
        isViewerPanning = false;
        viewerContainer.classList.remove('grabbing');
    });

    // Touch support for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let initialDistance = 0;
    let initialZoom = 1;

    viewerContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isViewerPanning = true;
            touchStartX = e.touches[0].clientX - viewerPanX;
            touchStartY = e.touches[0].clientY - viewerPanY;
        } else if (e.touches.length === 2) {
            // Pinch zoom
            initialDistance = getDistance(e.touches[0], e.touches[1]);
            initialZoom = viewerZoom;
        }
    }, { passive: true });

    viewerContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isViewerPanning) {
            viewerPanX = e.touches[0].clientX - touchStartX;
            viewerPanY = e.touches[0].clientY - touchStartY;
            updateViewerTransform();
        } else if (e.touches.length === 2) {
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const scale = currentDistance / initialDistance;
            viewerZoom = Math.max(0.1, Math.min(5, initialZoom * scale));
            updateViewerTransform();
        }
    }, { passive: true });

    viewerContainer.addEventListener('touchend', () => {
        isViewerPanning = false;
    });

    function getDistance(touch1, touch2) {
        return Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        // Image viewer is open
        if (imageViewerModal.classList.contains('active')) {
            switch (e.key) {
                case 'Escape':
                    closeImageViewer();
                    break;
                case 'ArrowLeft':
                    navigateToImage(currentViewerIndex - 1);
                    break;
                case 'ArrowRight':
                    navigateToImage(currentViewerIndex + 1);
                    break;
                case '+':
                case '=':
                    zoomViewer(0.25);
                    break;
                case '-':
                case '_':
                    zoomViewer(-0.25);
                    break;
                case 'f':
                case 'F':
                    fitToScreen();
                    break;
                case 'a':
                case 'A':
                    actualSize();
                    break;
                case '0':
                    actualSize();
                    break;
            }
        }
        // Gallery is open but viewer is not
        else if (galleryModal.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeGallery();
            }
        }
    });

    // Modify initMapInteractions to add click handlers after buildings are processed
    const originalInitMapInteractions = initMapInteractions;
    initMapInteractions = function () {
        originalInitMapInteractions();
        // Add click handlers after a short delay to ensure buildings are fully processed
        setTimeout(() => {
            addBuildingClickHandlers();
        }, 100);
    };

    function updateDropdownOptions() {
        const startValue = startSelect.value;
        const endValue = endSelect.value;

        // Repopulate both dropdowns
        populateDropdown(startSelect, endValue);
        populateDropdown(endSelect, startValue);
    }

    function populateDropdown(selectElement, excludeValue) {
        const currentValue = selectElement.value;
        selectElement.innerHTML = selectElement === startSelect
            ? '<option value="">Select Start Point</option>'
            : '<option value="">Select Destination</option>';

        buildings.forEach(b => {
            // Skip School Field from dropdowns
            if (b.id !== excludeValue && b.name !== "School Field") {
                addOption(selectElement, b.id, b.name);
            }
        });

        // Restore the current selection if it's still valid
        if (currentValue && currentValue !== excludeValue) {
            selectElement.value = currentValue;
        }
    }

    // ===== ALL BUILDINGS MODAL FUNCTIONALITY =====
    const allBuildingsModal = document.getElementById('all-buildings-modal');
    const allBuildingsClose = document.getElementById('all-buildings-close');
    const allBuildingsOverlay = document.querySelector('.all-buildings-overlay');
    const allBuildingsGrid = document.getElementById('all-buildings-grid');
    const allBuildingsLoading = document.getElementById('all-buildings-loading');

    // All buildings data with display names and folder names
    const allBuildingsData = [
        { name: 'Academic Block', folder: 'Academic Block' },
        { name: 'Auditorium', folder: 'Auditorium' },
        { name: 'ETEC', folder: 'ETEC' },
        { name: "Girl's Hostel Block A", folder: "Girl's Hostel Block A" },
        { name: "Girl's Hostel Block B", folder: "Girl's Hostel Block B" },
        { name: 'Library', folder: 'Library' },
        { name: 'New Admin Block', folder: 'New Uncompleted Administrative Block' },
        { name: 'Pavilion', folder: 'Pavilion' },
        { name: 'SCIT', folder: 'SCIT' },
        { name: 'SPAS', folder: 'SPAS' },
        { name: 'School Field', folder: 'School Field' },
        { name: 'School Gate', folder: 'School Gate' },
        { name: 'Security Office', folder: 'Security Office' },
        { name: 'Store', folder: 'Store' },
        { name: 'Toilet', folder: 'Toilet' },
        { name: "VC's Office", folder: "VC's Office" },
        { name: 'Workshop', folder: 'Workshop' }
    ];

    // Try to load the first available image for a building
    async function loadBuildingThumbnail(folderPath) {
        const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

        for (const ext of extensions) {
            const imagePath = `${folderPath}/1.${ext}`;
            const exists = await checkImageExists(imagePath);
            if (exists) {
                return imagePath;
            }
        }
        return null;
    }

    // Count images in a folder
    async function countBuildingImages(folderPath) {
        const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        let count = 0;

        for (let i = 1; i <= 20; i++) {
            let found = false;
            for (const ext of extensions) {
                const imagePath = `${folderPath}/${i}.${ext}`;
                const exists = await checkImageExists(imagePath);
                if (exists) {
                    count++;
                    found = true;
                    break;
                }
            }
            if (!found && i > 5) break; // Stop early if no images found after index 5
        }
        return count;
    }

    // Open All Buildings Modal
    async function openAllBuildingsModal() {
        // Show modal
        allBuildingsModal.classList.add('active');

        // Show loading, hide grid
        allBuildingsLoading.classList.add('visible');
        allBuildingsGrid.innerHTML = '';

        // Load all building cards
        const cardPromises = allBuildingsData.map(async (building, index) => {
            const folderPath = `LOCATION DATA/${building.folder}`;
            const thumbnail = await loadBuildingThumbnail(folderPath);
            const imageCount = await countBuildingImages(folderPath);

            return {
                ...building,
                thumbnail,
                imageCount,
                index
            };
        });

        const buildingsWithData = await Promise.all(cardPromises);

        // Hide loading
        allBuildingsLoading.classList.remove('visible');

        // Create building cards
        buildingsWithData.forEach((building, i) => {
            const card = document.createElement('div');
            card.className = 'building-card';
            card.style.animationDelay = `${i * 0.05}s`;

            if (building.thumbnail) {
                card.innerHTML = `
                    <img class="building-card-image" src="${building.thumbnail}" alt="${building.name}" loading="lazy">
                    <div class="building-card-overlay">
                        <h3 class="building-card-name">${building.name}</h3>
                        <div class="building-card-count">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            <span>${building.imageCount} image${building.imageCount !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <div class="building-card-badge">View</div>
                `;
            } else {
                card.innerHTML = `
                    <div class="building-card-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                    </div>
                    <div class="building-card-overlay">
                        <h3 class="building-card-name">${building.name}</h3>
                        <div class="building-card-count">
                            <span>No images yet</span>
                        </div>
                    </div>
                `;
            }

            // Click to open gallery for this building
            card.addEventListener('click', () => {
                // Map folder name back to building name for openGallery
                const buildingName = Object.keys(buildingFolderMap).find(
                    key => buildingFolderMap[key] === building.folder
                ) || building.name;

                // Close All Buildings Modal first, then open the gallery
                closeAllBuildingsModal();
                openedFromAllBuildings = true; // Mark that we came from All Buildings Modal
                openGallery(buildingName);
            });

            allBuildingsGrid.appendChild(card);
        });
    }

    // Close All Buildings Modal
    function closeAllBuildingsModal() {
        allBuildingsModal.classList.remove('active');
    }

    // Event listeners for All Buildings Modal
    if (allBuildingsClose) {
        allBuildingsClose.addEventListener('click', closeAllBuildingsModal);
    }
    if (allBuildingsOverlay) {
        allBuildingsOverlay.addEventListener('click', closeAllBuildingsModal);
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && allBuildingsModal && allBuildingsModal.classList.contains('active')) {
            closeAllBuildingsModal();
        }
    });

    // See Images Button - Opens All Buildings Modal
    const seeImagesBtn = document.getElementById('see-images-btn');
    if (seeImagesBtn) {
        seeImagesBtn.addEventListener('click', () => {
            openAllBuildingsModal();
        });
    }

    // ===== SIDEBAR FUNCTIONALITY =====
    const sidebar = document.getElementById('sidebar');
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebarGrid = document.getElementById('sidebar-building-grid');
    const sidebarLoading = document.getElementById('sidebar-loading');

    function toggleSidebar() {
        sidebar.classList.toggle('active');
        document.body.classList.toggle('sidebar-active');
    }

    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', toggleSidebar);
    }

    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', () => {
            toggleSidebar();
            // Call the visibility update if it exists in the global scope (defined in index.html)
            if (typeof updateSidebarTabVisibility === 'function') {
                updateSidebarTabVisibility();
            }
        });
    }

    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // Swipe to Close functionality for Sidebar
    let sidebarTouchStartX = 0;
    let sidebarTouchEndX = 0;

    const handleSwipe = () => {
        const swipeDistance = sidebarTouchStartX - sidebarTouchEndX;
        const threshold = 50; // Minimum distance for swipe
        if (swipeDistance > threshold && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    };

    sidebar.addEventListener('touchstart', (e) => {
        sidebarTouchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
        sidebarTouchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('touchstart', (e) => {
            sidebarTouchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        sidebarOverlay.addEventListener('touchend', (e) => {
            sidebarTouchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    }

    // Populate Sidebar with Building Images (Grid)
    async function populateSidebarGrid() {
        if (!sidebarGrid) return;

        // Show loading, hide grid
        sidebarLoading.classList.remove('hidden');
        sidebarGrid.innerHTML = '';

        // Load all building cards (parallel for speed)
        const cardPromises = allBuildingsData.map(async (building) => {
            const folderPath = `LOCATION DATA/${building.folder}`;
            const thumbnail = await loadBuildingThumbnail(folderPath);
            return {
                ...building,
                thumbnail
            };
        });

        const buildingsWithThumbnails = await Promise.all(cardPromises);

        // Hide loading
        sidebarLoading.classList.add('hidden');

        // Create building cards for sidebar
        buildingsWithThumbnails.forEach((building) => {
            const card = document.createElement('div');
            card.className = 'building-card';

            if (building.thumbnail) {
                card.innerHTML = `
                    <img src="${building.thumbnail}" alt="${building.name}" loading="lazy">
                    <div class="building-card-name"><span class="card-name-inner">${building.name}</span></div>
                    <div class="building-card-badge">View</div>
                `;
            } else {
                card.innerHTML = `
                    <div class="building-card-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                    </div>
                    <div class="building-card-name"><span class="card-name-inner">${building.name}</span></div>
                `;
            }

            // Click to open gallery for this building from sidebar
            card.addEventListener('click', () => {
                const buildingNameForGallery = Object.keys(buildingFolderMap).find(
                    key => buildingFolderMap[key] === building.folder
                ) || building.name;

                openGallery(buildingNameForGallery);
            });

            sidebarGrid.appendChild(card);
        });
    }

    // Initialize sidebar grid
    populateSidebarGrid().then(() => {
        // After grid is populated, detect overflowing names and enable sliding
        setTimeout(() => {
            const nameEls = document.querySelectorAll('.sidebar-grid .building-card-name');
            nameEls.forEach(nameEl => {
                const inner = nameEl.querySelector('.card-name-inner');
                if (inner && inner.scrollWidth > nameEl.clientWidth) {
                    const overflow = inner.scrollWidth - nameEl.clientWidth;
                    inner.style.setProperty('--slide-distance', `-${overflow + 8}px`);
                    inner.classList.add('sliding');
                }
            });
        }, 200);
    });

    loadSVG();

    // Make key functions globally accessible
    window.calculateAndHighlightPath = calculateAndHighlightPath;
    window.clearHighlights = clearHighlights;
    window.showToast = showToast;
    window.openAllBuildingsModal = openAllBuildingsModal;
    window.toggleSidebar = toggleSidebar;
});
