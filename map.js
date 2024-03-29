let routes, segments, stops, vehicles, lastFullTransLocFetchTime,
    routeIdToRouteMap, stopIdToStopMap, vehicleIdToVehicleMap, oldVehicleIdToVehicleMap,
    selectedLayerId, selectedFeature, selectedPlaceSheet, shownRouteIds,
    buildingsGeoJSON, parkingLotsGeoJSON, stopsGeoJSON,
    announcements;
let startPos = nbPos;
if (document.cookie) {
    const campusCookie = document.cookie.split('; ').find(it => it.startsWith('campus'));
    if (campusCookie) {
        switch (campusCookie.split('=')[1]) {
            case 'NWK':
                startPos = nwkPos;
                break;
            case 'CMDN':
                startPos = cmdnPos;
                break;
        }
    }
    const routesCookie = document.cookie.split('; ').find(it => it.startsWith('routes'));
    if (routesCookie) {
        shownRouteIds = JSON.parse(routesCookie.split('=')[1]);
    }
}

class SearchControl {
    constructor() {
        this.buildings = buildingsGeoJSON.features
            .map(it => ({
                layerID: 'Rutgers buildings',
                featureID: it.id,
                display: `🏢 ${it.properties['BldgName']}`,
            }))
            .sort((a, b) => a.display > b.display ? 1 : -1);
        this.lots = parkingLotsGeoJSON.features
            .map(it => ({
                layerID: 'Rutgers parking lots',
                featureID: it.id,
                display: `🅿️ ${it.properties['Lot_Name']}`,
            }))
            .sort((a, b) => a.display > b.display ? 1 : -1);
        this.stops = [];
    }

    onAdd(map) {
        this._container = document.createElement('div');
        this._container.classList.add('mapboxgl-ctrl');

        const input = domCreate('input', 'search-box', undefined, this._container);
        input.placeholder = 'Stop/building/parking lot';
        input.setAttribute('onfocus', 'this.select()');

        const updateDropdownResults = () => {
            if (this.stops.length === 0) {
                this.stops = stopsGeoJSON
                    ? stopsGeoJSON.features
                        .map(it => ({layerID: 'stops', featureID: it.id, display: `🚏 ${it.properties['stop_name']}`}))
                        .sort((a, b) => a.display > b.display ? 1 : -1)
                    : [];
                this.options = this.stops.concat(this.buildings).concat(this.lots);
                $('input').autocomplete({
                    source: this.options.map(it => it.display),
                    select: (event, ui) => {
                        // check if text matches an entry
                        const matchingItem = this.options.find(it => `${it.display}` === ui.item.value);
                        if (matchingItem) { // should always be true
                            onSearchClick(matchingItem.layerID, matchingItem.featureID);
                        }
                    }
                });
            } else {
                input.removeEventListener('input', updateDropdownResults);
            }
        }

        input.addEventListener('input', updateDropdownResults);

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this.buildings = undefined;
        this.lots = undefined;
        this.stops = undefined;
    }
}

class RouteFilterControl {
    onAdd(map) {
        this._container = document.createElement('div');
        this._container.classList.add('mapboxgl-ctrl', 'mapboxgl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        const button = domCreate('button', 'routesButton', 'custom-map-control-button', this._container);
        button.type = 'button';
        button.textContent = 'Routes';
        button.disabled = true;
        button.addEventListener('click', () => {
            const routeHtml = routes.sort((a, b) => (a.short_name || a.long_name) > (b.short_name || b.long_name) ? 1 : -1)
                .map(route => {
                        const checked = !shownRouteIds || (shownRouteIds.includes(route.route_id));
                        return `<input type="checkbox" id="${route.route_id}" name="route" value="${route.route_id}" ${checked ? 'checked' : ''}>
                                <label for="${route.route_id}" style="color: #${route.color}">${route.short_name || route.long_name}</label>`;
                    }
                ).join('<br>');
            $("#dialog")
                .html(routeHtml)
                .dialog({
                    autoOpen: false,
                    draggable: false,
                    maxHeight: window.innerHeight * 0.9,
                    modal: true,
                    resizable: false,
                    title: 'Routes',
                    buttons: {
                        'None': () => {
                            document.querySelectorAll('input[name="route"]').forEach(it => it.checked = false);
                        },
                        'All': () => {
                            document.querySelectorAll('input[name="route"]').forEach(it => it.checked = true);
                        },
                        'Save': () => {
                            const selectedRoutesCheckBoxes = document.querySelectorAll('input[name="route"]:checked');
                            const selectedRouteIds = [];
                            for (const route of selectedRoutesCheckBoxes) {
                                selectedRouteIds.push(route.value);
                            }
                            shownRouteIds = selectedRouteIds;
                            document.cookie = `routes=${JSON.stringify(shownRouteIds)}; SameSite=Strict; expires=${new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)}; path=/`;
                            refreshRoutesButton();
                            refreshSegmentsVehiclesAndSelectedPlace(true);
                            $("#dialog").dialog('close');
                        },
                    },
                })
                .dialog('open');
        });
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
    }
}

class AnnouncementsControl {
    onAdd(map) {
        this._container = document.createElement('div');
        this._container.classList.add('mapboxgl-ctrl', 'mapboxgl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        const button = domCreate('button', 'announcementsButton', 'custom-map-control-button', this._container);
        button.type = 'button';
        button.style.display = 'none';
        button.addEventListener('click', () => {
            const announcementsHtml = announcements.map(it => `<h3>${it.title}</h3>${it.html}`)
                .join('<br><hr><br>');
            $("#dialog")
                .html(announcementsHtml)
                .dialog({
                    autoOpen: false,
                    draggable: false,
                    maxHeight: window.innerHeight * 0.9,
                    modal: true,
                    resizable: false,
                    title: 'Announcements',
                    buttons: {
                        'Close': () => {
                            $("#dialog").dialog('close');
                        },
                    },
                })
                .dialog('open');
        });
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
    }
}

function onSearchClick(layerID, featureID) {
    const geoJsonToSearch = layerID === 'Rutgers buildings' ? buildingsGeoJSON
        : layerID === 'Rutgers parking lots' ? parkingLotsGeoJSON
            : stopsGeoJSON;
    const feature = geoJsonToSearch.features.find(it => it.id === featureID)
    if (!feature) {
        alert(`Ran into an error finding that place, sorry!`);
        return;
    }
    const lng = layerID === 'stops' ? feature.geometry.coordinates[0] : feature.properties['Longitude'];
    const lat = layerID === 'stops' ? feature.geometry.coordinates[1] : feature.properties['Latitude'];
    map.flyTo({zoom: 16, center: [lng, lat]});
    setSelectedPlace(layerID, feature);
    document.getElementsByClassName('mapboxgl-canvas')[0].focus();
}

function setSelectedPlace(tappedLayerId, feature, reselecting) {
    const oldSheetScrollTop = selectedPlaceSheet ? selectedPlaceSheet.scrollTop : 0; // save old sheet scroll position
    if (selectedPlaceSheet) {
        document.body.removeChild(selectedPlaceSheet); // remove place sheet
        selectedPlaceSheet = undefined;
    }

    if (!reselecting) {
        if (selectedLayerId && selectedLayerId !== 'vehicles') {
            // unselect old feature
            map.setFeatureState(
                {source: selectedLayerId, id: selectedFeature.id},
                {selected: false}
            );
        }
        if (tappedLayerId && tappedLayerId !== 'vehicles') {
            // select new feature
            map.setFeatureState(
                {source: tappedLayerId, id: feature.id},
                {selected: true}
            );
        }
        // We can't use feature state for layout properties (i.e. icon-image), so instead we do this to unselect+select vehicles.
        // Visible lag compared to feature state updates :(
        if (selectedLayerId === 'vehicles' || tappedLayerId === 'vehicles') {
            map.setLayoutProperty(
                'vehicles',
                'icon-image',
                tappedLayerId === 'vehicles' ?
                    ['case',
                        ['==', ['get', 'vehicle_id'], feature && feature.properties['vehicle_id'] || 'x'],
                        'selected-vehicle',
                        'vehicle'
                    ] : 'vehicle'
            );
        }
        selectedLayerId = tappedLayerId;
        selectedFeature = feature;
        if (!tappedLayerId) {
            return;
        }
    }

    let html;
    switch (tappedLayerId) {
        case 'Rutgers buildings': {
            const buildingNumber = feature.properties['BldgNum'];
            const photoUrl = `https://storage.googleapis.com/rutgers-campus-map-building-images-prod/${buildingNumber}/00.jpg`;
            let extraInfoHtml = '';
            if (feature.properties['Description']) {
                extraInfoHtml += `<p class="center-text">${feature.properties['Description']}</p>`;
            }
            if (feature.properties['Website']) {
                extraInfoHtml += `<p class="center-text"><b>Website:</b><br><a href='${feature.properties['Website']}' target='_blank'>${feature.properties['Website']}</a></p>`;
            }
            if (feature.properties['departments']) {
                const departments = JSON.parse(feature.properties['departments']);
                extraInfoHtml += `<div id="departments">
                <b>Departments:</b>
                <ul>${departments.map(it => `<li>${it}</li>`).join('')}</ul>
                </div>`;
            }
            html = `<div id="selected-place-sheet">
            <h3 class='center-text'>${feature.properties['BldgName']}</h3>
            <div id='building-photo-number-address'>
                <img width='100vh' height='100vh' style='margin: 1vh' src=${photoUrl}>
                <div class='center-text'>
                    <p>Building number: ${buildingNumber}</p>
                    <p>${feature.properties['BldgAddr']}<br>
                    ${feature.properties['City']}, ${feature.properties['State']} ${feature.properties['zip'] || ''}</p>
                </div>
            </div>
            ${extraInfoHtml}
            </div>`;
            break;
        }
        case 'Rutgers parking lots': {
            let extraProps = '';
            if (feature.properties['Contact']) {
                const contact = feature.properties['Contact'].trim();
                extraProps += `<p class="center-text"><b>Contact number:</b><br><a href='tel:${contact}'>${contact}</a></p>`;
            }
            if (feature.properties['Website']) {
                const website = feature.properties['Website'].trim();
                extraProps += `<p class="center-text"><b>Website:</b><br><a href='${website}'>${website}</a></p>`;
            }
            html = `<div id="selected-place-sheet">
                <h3 class='center-text'>${feature.properties['Lot_Name'].trim()}</h3>
                ${extraProps}
            </div>`;
            break;
        }
        case 'stops': {
            const arrivalEstimates = typeof selectedFeature.properties.arrival_estimates === 'string'
                ? JSON.parse(selectedFeature.properties.arrival_estimates)
                : selectedFeature.properties.arrival_estimates;

            const arrivals = routes.filter(route => (!shownRouteIds || shownRouteIds.includes(route.route_id)) && arrivalEstimates.some(it => it.route_id === route.route_id))
                .map(route => ({
                    routeName: route.short_name || route.long_name,
                    routeColor: route.color,
                    arrivalEstimates: arrivalEstimates
                        .filter(it => it.route_id === route.route_id)
                        .sort((a, b) => a.arrival_at > b.arrival_at ? 1 : -1)
                        .slice(0, 3)
                        .map(it => secondsToString((new Date(it.arrival_at) - Date.now()) / 1000)),
                }))
                .sort((a, b) => a.routeName > b.routeName ? 1 : -1)
                .map(route => `<div class="sheet-list-entry"><b style="color: #${route.routeColor}">${route.routeName}</b>` + route.arrivalEstimates.join('<br>') + `</div>`);

            html = `<div id="selected-place-sheet">
                <h3 class="center-text">${feature.properties['stop_name']}</h3>
                ${arrivals.length > 0 ? '<div style="text-align: right">' + arrivals.join('<hr>') + '</div>' : '<div class="center-text">No pending arrivals</div>'}
            </div>`;
            break;
        }
        case 'vehicles': {
            const vehicle = vehicleIdToVehicleMap[selectedFeature.properties.vehicle_id];
            const routeName = vehicle.route.short_name || vehicle.route.long_name;
            const arrivalEstimates = vehicle.arrival_estimates
                .sort((a, b) => a.arrival_at > b.arrival_at ? 1 : -1)
                .map(it => ({
                    stopName: stopIdToStopMap[it.stop_id].name,
                    arrivingIn: secondsToString((new Date(it.arrival_at) - Date.now()) / 1000),
                }))
                .map(it => `<div class="sheet-list-entry"><b>${it.stopName}</b><div style="flex-shrink: 0">${it.arrivingIn}</div></div>`);
            html = `<div id="selected-place-sheet">
                <h3 class="center-text">${routeName} - bus #${vehicle.call_name}</h3>
                ${arrivalEstimates.length > 0 ? arrivalEstimates.join('<br>') : '<div class="center-text">No pending arrivals</div>'}
            </div>`;
            break;
        }
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    selectedPlaceSheet = template.content.firstChild
    document.body.appendChild(selectedPlaceSheet);
    if (reselecting) {
        selectedPlaceSheet.scrollTop = oldSheetScrollTop;
    }
}

function refreshRoutesButton() {
    const routesButton = document.getElementById('routesButton');
    routesButton.disabled = false;
    routesButton.textContent = `Routes (${shownRouteIds !== undefined ? shownRouteIds.length : routes.length}/${routes.length})`;
    routesButton.style['white-space'] = 'nowrap';
}

async function refreshSegmentsVehiclesAndSelectedPlace(userChangedRoutesShown) {
    const newVehiclesToShow = !shownRouteIds ? vehicles : vehicles.filter(it => shownRouteIds.includes(it.route_id));
    let dashLength = 1;
    const segmentFeatures = routes
        .filter(route => newVehiclesToShow.some(vehicle => vehicle.route_id === route.route_id))
        .map(route => ({
            type: 'Feature',
            properties: {
                route_color: '#' + route.color,
                line_dasharray: [dashLength, dashLength++],
            },
            geometry: {
                type: 'MultiLineString',
                // TODO: Do I need to care about whether a route says it includes a segment "forward" or "backward"?
                coordinates: route.segments.map(route => polyline.decode(segments[route[0]] || '').map(latLng => [latLng[1], latLng[0]])),
            },
        }));
    map.getSource('routes').setData({type: 'FeatureCollection', features: segmentFeatures})

    if (!oldVehicleIdToVehicleMap || userChangedRoutesShown) {
        const vehicleFeatures = newVehiclesToShow.map(vehicle => ({
            id: vehicle.vehicle_id,
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [vehicle.location.lng, vehicle.location.lat],
            },
            properties: {
                vehicle_id: vehicle.vehicle_id,
                heading: vehicle.heading,
                route_id: vehicle.route_id,
                route_color: '#' + vehicle.route.color,
            },
        }));
        map.getSource('vehicles').setData({type: 'FeatureCollection', features: vehicleFeatures});
    } else {
        // animate from old vehicles
        const steps = 50; // animation steps
        for (let counter = 0; counter < steps; counter++) {
            const curVehicleFeatures = newVehiclesToShow.map(newVehicle => {
                const oldVehicle = oldVehicleIdToVehicleMap[newVehicle.vehicle_id] || newVehicle;
                const latDiff = newVehicle.location.lat - oldVehicle.location.lat;
                const curLat = oldVehicle.location.lat + counter / steps * latDiff;
                const lngDiff = newVehicle.location.lng - oldVehicle.location.lng;
                const curLng = oldVehicle.location.lng + counter / steps * lngDiff;
                let headingDiff = newVehicle.heading - oldVehicle.heading;
                if (headingDiff > 180) {
                    headingDiff -= 360;
                } else if (headingDiff < -180) {
                    headingDiff += 360;
                }
                let curHeading = oldVehicle.heading + counter / steps * headingDiff;
                if (curHeading >= 360) {
                    curHeading -= 360;
                } else if (curHeading < 0) {
                    curHeading += 360;
                }
                return {
                    id: newVehicle.vehicle_id,
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [curLng, curLat],
                    },
                    properties: {
                        vehicle_id: newVehicle.vehicle_id,
                        heading: curHeading,
                        route_id: newVehicle.route_id,
                        route_color: '#' + newVehicle.route.color,
                    },
                };
            });
            map.getSource('vehicles').setData({type: 'FeatureCollection', features: curVehicleFeatures});
            await sleep(20);
        }
    }
    oldVehicleIdToVehicleMap = vehicleIdToVehicleMap;
    if (selectedLayerId === 'vehicles' && shownRouteIds && !shownRouteIds.includes(selectedFeature.properties.route_id)) {
        setSelectedPlace(); // clear selection
    } else if (selectedLayerId === 'stops' || selectedLayerId === 'vehicles') {
        setSelectedPlace(selectedLayerId, selectedFeature, true); // update "selected place" sheet
    }
}

function refreshAnnouncementsButton() {
    const announcementsButton = document.getElementById('announcementsButton');
    if (announcements && announcements.length > 0) {
        announcementsButton.textContent = `Announcements (${announcements.length})`;
        announcementsButton.style.display = 'block';
    } else {
        announcementsButton.style.display = 'none';
    }
}

mapboxgl.accessToken = mapboxKey;
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mileskrell/ckxl9zz5632ey14oafkathv0c', // style URL
    ...startPos,
    maxBounds: [[xMin, yMin], [xMax, yMax]], // restrict pan and zoom area
    touchPitch: false, // disable pitch gesture
    customAttribution: '<a href="https://github.com/mileskrell/xbus" target="_blank">About XBus</a>',
});

// disable map rotation using right click + drag
map.dragRotate.disable();
// disable map rotation using touch rotation gesture
map.touchZoomRotate.disableRotation();

// Add geolocate control to the map.
map.addControl(
    new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        // When active the map will receive updates to the device's location as it changes.
        trackUserLocation: true,
        // Draw an arrow next to the location dot to indicate which direction the device is heading.
        showUserHeading: true
    })
);

map.on('load', async () => {
    map.loadImage('images/stop.png', (error, image) => {
        if (error) throw error;
        return map.addImage('stop', image, {sdf: true});
    });
    map.loadImage('images/navigation.png', (error, image) => {
        if (error) throw error;
        return map.addImage('vehicle', image, {sdf: true});
    });
    map.loadImage('images/navigation_with_circle.png', (error, image) => {
        if (error) throw error;
        return map.addImage('selected-vehicle', image, {sdf: true});
    });
    buildingsGeoJSON = await (await fetch('geojson/Rutgers buildings.geojson')).json();
    buildingsGeoJSON.features.forEach(it => it.id = it.properties['BldgNum']);
    parkingLotsGeoJSON = await (await fetch('geojson/Rutgers parking lots.geojson')).json();
    parkingLotsGeoJSON.features.forEach(it => it.id = it.properties['Parking_ID']);
    map.addSource('Rutgers buildings', {type: 'geojson', data: buildingsGeoJSON});
    map.addSource('Rutgers parking lots', {type: 'geojson', data: parkingLotsGeoJSON});

    // Add building/parking lot/stop search box
    map.addControl(new SearchControl(), 'top-left');

    map.addControl(new RouteFilterControl(), 'top-left');

    map.addControl(new AnnouncementsControl(), 'top-left');

    // Add controls to fly to NB/NWK/CMDN
    map.addControl(new FlyToCampusControl());

    map.addLayer({
        id: 'Rutgers buildings',
        type: 'fill',
        source: 'Rutgers buildings',
        paint: {
            'fill-color': ['case',
                ['boolean', ['feature-state', 'selected'], false],
                '#cc0033',
                '#6e767c'
            ],
        },
    }, 'admin-1-boundary-bg');
    map.addLayer({
        id: 'Rutgers parking lots',
        type: 'fill',
        source: 'Rutgers parking lots',
        paint: {
            'fill-color': ['case',
                ['boolean', ['feature-state', 'selected'], false],
                '#cc0033',
                '#878787'
            ],
            'fill-opacity': 0.5,
        },
    }, 'Camden walkways');
    map.addSource('routes', {type: 'geojson', data: {type: 'Feature'}});
    map.addLayer({
        id: 'routes',
        type: 'line',
        source: 'routes',
        paint: {
            'line-color': ['get', 'route_color'],
            'line-width': 5,
            'line-dasharray': ['get', 'line_dasharray'],
        },
    }, 'Rutgers buildings');
    map.addSource('stops', {type: 'geojson', data: {type: 'Feature'}});
    map.addLayer({
        id: 'stops',
        type: 'symbol',
        source: 'stops',
        paint: {
            'icon-color': ['case',
                ['boolean', ['feature-state', 'selected'], false],
                '#cc0033',
                '#000000'
            ],
        },
        layout: {
            'icon-image': 'stop',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.25, 18, 1],
            'icon-allow-overlap': true,
        },
    });
    map.addSource('vehicles', {type: 'geojson', data: {type: 'Feature'}});
    map.addLayer({
        id: 'vehicles',
        type: 'symbol',
        source: 'vehicles',
        paint: {'icon-color': ['get', 'route_color']},
        layout: {
            'icon-image': 'vehicle',
            'icon-rotate': ['get', 'heading'],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 1],
            'icon-allow-overlap': true,
        },
    });
    map.on('mouseleave', 'Rutgers parking lots', () => map.getCanvas().style.cursor = '');
    map.on('mouseleave', 'Rutgers buildings', () => map.getCanvas().style.cursor = '');
    map.on('mouseleave', 'stops', () => map.getCanvas().style.cursor = '');
    map.on('mouseleave', 'vehicles', () => map.getCanvas().style.cursor = '');
    map.on('mouseenter', 'Rutgers parking lots', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseenter', 'Rutgers buildings', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseenter', 'stops', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseenter', 'vehicles', () => map.getCanvas().style.cursor = 'pointer');
    map.on('click', e => {
        let somethingWasTapped = false;
        for (const layerID of ['vehicles', 'stops', 'Rutgers buildings', 'Rutgers parking lots']) {
            const tappedFeaturesInLayer = map.queryRenderedFeatures(e.point, {layers: [layerID]});
            const featureToSelect = tappedFeaturesInLayer.find(it => !selectedFeature || selectedFeature.id !== it.id);
            if (featureToSelect) {
                setSelectedPlace(layerID, featureToSelect);
                return;
            }
            if (tappedFeaturesInLayer.length > 0) {
                somethingWasTapped = true;
            }
        }
        if (!somethingWasTapped) {
            setSelectedPlace(); // clear selection
        }
    });

    async function fetchBusStuff() {
        try {
            vehicles = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/vehicles.json?agencies=1323", translocRequestInit)).json())['data'];
        } catch (error) {
            setTimeout(fetchBusStuff, 5000);
            return;
        }
        if (!lastFullTransLocFetchTime || (new Date().getTime() - lastFullTransLocFetchTime > 1000 * 60 * 5)) {
            try {
                routes = (await (await fetch('https://transloc-api-1-2.p.rapidapi.com/routes.json?agencies=1323', translocRequestInit)).json())['data'][1323];
                segments = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/segments.json?agencies=1323", translocRequestInit)).json())['data'];
                stops = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/stops.json?agencies=1323", translocRequestInit)).json())['data'];
                lastFullTransLocFetchTime = new Date().getTime();
            } catch (error) {
                setTimeout(fetchBusStuff, 5000);
                return;
            }
        }
        vehicles = vehicles[1323] || []; // undefined when there are no vehicles

        routeIdToRouteMap = {};
        routes.forEach(route => routeIdToRouteMap[route.route_id] = route);
        stopIdToStopMap = {};
        stops.forEach(stop => stopIdToStopMap[stop.stop_id] = stop);
        vehicleIdToVehicleMap = {};
        vehicles.forEach(vehicle => vehicleIdToVehicleMap[vehicle.vehicle_id] = vehicle);

        vehicles.forEach(vehicle => vehicle.route = routeIdToRouteMap[vehicle.route_id]);

        const stopFeatures = stops.map(stop => ({
            id: stop.stop_id,
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [stop.location.lng, stop.location.lat],
            },
            properties: {
                stop_id: stop.stop_id,
                stop_name: stop.name,
                arrival_estimates: vehicles
                    .flatMap(vehicle => vehicle.arrival_estimates)
                    .filter(it => it.stop_id === stop.stop_id)
                    .map(it => ({route_id: it.route_id, arrival_at: it.arrival_at}))
            },
        }));
        stopsGeoJSON = {type: 'FeatureCollection', features: stopFeatures};
        map.getSource('stops').setData(stopsGeoJSON);

        refreshRoutesButton();
        await refreshSegmentsVehiclesAndSelectedPlace(false);

        setTimeout(fetchBusStuff, 5000);
    }

    async function fetchAnnouncements() {
        try {
            announcements = (await (await fetch('https://feeds.transloc.com/3/announcements?contents=true&agencies=1323')).json()).announcements;
        } catch (error) {
            setTimeout(fetchAnnouncements, 5 * 60 * 1000);
            return;
        }

        refreshAnnouncementsButton();

        setTimeout(fetchAnnouncements, 5 * 60 * 1000);
    }

    fetchBusStuff();
    fetchAnnouncements();
});

$('#dialog')
    .html("Rutgers has switched from <a href='https://transloc.com' target='_blank'>TransLoc</a> to <a href='https://passiotech.com' target='_blank'>Passio</a> for its bus data and it's unclear whether Passio makes this data available to third-party apps like XBus.<br><br>You can still use XBus to view buildings and parking lots, but you'll have to use Passio's app to track buses for now.<br><br>I've sent Passio an email and will update when I hear back.<br><br>— Miles, 2023-09-04")
    .dialog({
        draggable: false,
        maxHeight: window.innerHeight * 0.9,
        modal: true,
        resizable: false,
        title: 'No bus data available',
    });
document.activeElement.blur()
