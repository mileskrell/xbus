mapboxgl.accessToken = 'pk.eyJ1IjoibWlsZXNrcmVsbCIsImEiOiJja3hqNXlmY2gzazEyMnRxaDA1Y3J2MjJzIn0.Uz5PQwiiTDyv3fr8YTTwpA';
let startPos = nbPos;
switch (document.cookie.substring(7)) {
    case 'NWK': startPos = nwkPos; break;
    case 'CMDN': startPos = cmdnPos; break;
}
let routes, segments, stops, vehicles,
    routeIdToRouteMap, stopIdToStopMap, vehicleIdToVehicleMap, oldVehicleIdToVehicleMap,
    selectedLayerId, selectedFeature, selectedPlaceSheet;
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mileskrell/ckxl9zz5632ey14oafkathv0c', // style URL
    ...startPos,
    maxBounds: [[xMin, yMin], [xMax, yMax]], // restrict pan and zoom area
    touchPitch: false, // disable pitch gesture
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

// Add controls to fly to NB/NWK/CMDN
map.addControl(new FlyToCampusControl());

function setSelectedPlace(tappedLayerId, feature, reselecting) {
    const oldSheetScrollTop = selectedPlaceSheet ? selectedPlaceSheet.scrollTop : 0; // save old sheet scroll position
    if (selectedPlaceSheet) {
        document.body.removeChild(selectedPlaceSheet); // remove place sheet
        selectedPlaceSheet = undefined;
    }

    if (!reselecting) {
        // unselect any old feature
        if (selectedLayerId === 'Rutgers buildings') {
            map.setFeatureState(
                {source: 'composite', sourceLayer: buildingsSourceLayerName, id: selectedFeature.id},
                {selected: false}
            );
        } else if (selectedLayerId === 'Rutgers parking lots') {
            map.setFeatureState(
                {source: 'composite', sourceLayer: parkingLotsSourceLayerName, id: selectedFeature.id},
                {selected: false}
            );
        } else if (selectedLayerId === 'stops') {
            map.setFeatureState(
                {source: 'stops', id: selectedFeature.id},
                {selected: false}
            );
        }
        if (feature) {
            // select new feature
            if (tappedLayerId === 'Rutgers buildings') {
                map.setFeatureState(
                    {source: 'composite', sourceLayer: buildingsSourceLayerName, id: feature.id},
                    {selected: true}
                );
            } else if (tappedLayerId === 'Rutgers parking lots') {
                map.setFeatureState(
                    {source: 'composite', sourceLayer: parkingLotsSourceLayerName, id: feature.id},
                    {selected: true}
                );
            } else if (tappedLayerId === 'stops') {
                map.setFeatureState(
                    {source: 'stops', id: feature.id},
                    {selected: true}
                );
            }
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
            if (feature.properties['AlertLinks']) {
                extraInfoHtml += `<p><b>Alert:</b> ${feature.properties['AlertLinks']}</p>`;
            }
            if (feature.properties['Description']) {
                extraInfoHtml += `<p>${feature.properties['Description']}</p>`;
            }
            if (feature.properties['Website']) {
                extraInfoHtml += `<p><b>Website:</b> <a href='${feature.properties['Website']}' target='_blank'>${feature.properties['Website']}</a></p>`;
            }
            if (feature.properties['departments']) {
                const departments = JSON.parse(feature.properties['departments']);
                extraInfoHtml += '<p><b>Departments:</b><ul>' + departments.map(it => `<li>${it}</li>`).join('') + '</ul></p>';
            }
            html = `<div id="selectedPlaceSheet">
            <h3 class='centerText'>${feature.properties['BldgName']}</h3>
            <div id='buildingPhotoNumberAddress'>
                <img width='100vh' height='100vh' style='margin: 1vh' src=${photoUrl}>
                <div>
                    <p class='centerText'>Building number: ${buildingNumber}</p>
                    <p class='centerText'>${feature.properties['BldgAddr']}<br>
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
                extraProps += `<p><b>Contact number:</b> <a href='tel:${contact}'>${contact}</a></p>`;
            }
            if (feature.properties['Website']) {
                const website = feature.properties['Website'].trim();
                extraProps += `<p><b>Website:</b> <a href='${website}'>${website}</a></p>`;
            }
            html = `<div id="selectedPlaceSheet">
                <h3 class='centerText'>${feature.properties['Lot_Name'].trim()}</h3>
                ${extraProps}
            </div>`;
            break;
        }
        case 'stops': {
            const arrivalEstimates = JSON.parse(selectedFeature.properties.arrival_estimates);

            const arrivals = routes.filter(route => arrivalEstimates.some(it => it.route_id === route.route_id))
                .map(route => ({
                    routeName: route.short_name ? route.short_name : route.long_name,
                    routeColor: route.color,
                    arrivalEstimates: arrivalEstimates
                        .filter(it => it.route_id === route.route_id)
                        .sort((a, b) => a.arrival_at > b.arrival_at ? 1 : -1)
                        .slice(0, 3)
                        .map(it => secondsToString((new Date(it.arrival_at) - Date.now()) / 1000)),
                }))
                .sort((a, b) => a.routeName > b.routeName ? 1 : -1)
                .map(route => `<div class="sheetListEntry"><b style="color: #${route.routeColor}">${route.routeName}</b>` + route.arrivalEstimates.join('<br>') + `</div>`);

            html = `<div id="selectedPlaceSheet">
                <h3 class="centerText">${feature.properties['stop_name']}</h3>
                ${arrivals.length > 0 ? arrivals.join('<hr>') : '<div class="centerText">No pending arrivals</div>'}
            </div>`;
            break;
        }
        case 'vehicles': {
            const route = vehicleIdToVehicleMap[feature.properties['vehicle_id']].route;
            const routeName = route.short_name ? route.short_name : route.long_name;
            const arrivalEstimates = vehicleIdToVehicleMap[selectedFeature.properties.vehicle_id].arrival_estimates
                .sort((a, b) => a.arrival_at > b.arrival_at ? 1 : -1)
                .map(it => ({
                    stopName: stopIdToStopMap[it.stop_id].name,
                    arrivingIn: secondsToString((new Date(it.arrival_at) - Date.now()) / 1000),
                }))
                .map(it => `<div class="sheetListEntry"><b>${it.stopName}</b><div style="flex-shrink: 0">${it.arrivingIn}</div></div>`);
            html = `<div id="selectedPlaceSheet">
                <h3 class="centerText">${routeName}</h3>
                ${arrivalEstimates.length > 0 ? arrivalEstimates.join('<br>') : '<div class="centerText">No pending arrivals</div>'}
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

function featureIsSelectedFeature(feature) {
    return selectedFeature &&
        (selectedFeature.properties['vehicle_id'] === (feature.properties['vehicle_id'] || 'x')
            || selectedFeature.properties['stop_id'] === (feature.properties['stop_id'] || 'x')
            || selectedFeature.properties['BldgNum'] === (feature.properties['BldgNum'] || 'x')
            || selectedFeature.properties['Parking_ID'] === (feature.properties['Parking_ID'] || 'x'));
}

map.on('load', () => {
    map.loadImage('stop.png', (error, image) => {
        if (error) throw error;
        return map.addImage('stop', image, {sdf: true});
    });
    map.loadImage('navigation.png', (error, image) => {
        if (error) throw error;
        return map.addImage('vehicle', image, {sdf: true});
    });
    map.loadImage('navigation_with_circle.png', (error, image) => {
        if (error) throw error;
        return map.addImage('selected-vehicle', image, {sdf: true});
    });
    map.setPaintProperty(
        'Rutgers buildings',
        'fill-color',
        ['case',
            ['boolean', ['feature-state', 'selected'], false],
            '#cc0033',
            '#6e767c'
        ]
    );
    map.setPaintProperty(
        'Rutgers parking lots',
        'fill-color',
        ['case',
            ['boolean', ['feature-state', 'selected'], false],
            '#cc0033',
            '#878787'
        ]
    );
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
            const featureToSelect = tappedFeaturesInLayer.find(it => !featureIsSelectedFeature(it));
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
            routes = (await (await fetch('https://transloc-api-1-2.p.rapidapi.com/routes.json?agencies=1323', translocRequestInit)).json())['data'][1323];
            segments = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/segments.json?agencies=1323", translocRequestInit)).json())['data'];
            stops = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/stops.json?agencies=1323", translocRequestInit)).json())['data'];
            vehicles = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/vehicles.json?agencies=1323", translocRequestInit)).json())['data'];
        } catch (error) {
            setTimeout(fetchBusStuff, 5000);
            return;
        }
        if (vehicles) {
            vehicles = vehicles[1323];
        } else {
            console.warn("no vehicles"); // TODO: Confirm that this is what happens when there are no vehicles
            vehicles = [];
        }
        console.log("fetched routes, stops, and vehicles");

        routeIdToRouteMap = {};
        routes.forEach(route => routeIdToRouteMap[route.route_id] = route);
        stopIdToStopMap = {};
        stops.forEach(stop => stopIdToStopMap[stop.stop_id] = stop);
        vehicleIdToVehicleMap = {};
        vehicles.forEach(vehicle => vehicleIdToVehicleMap[vehicle.vehicle_id] = vehicle);

        vehicles.forEach(vehicle => vehicle.route = routeIdToRouteMap[vehicle.route_id]);

        let dashLength = 1;
        const segmentFeatures = routes
            .filter(route => vehicles.some(vehicle => vehicle.route_id === route.route_id))
            .map(route => ({
                type: 'Feature',
                properties: {
                    route_color: '#' + route.color,
                    line_dasharray: [dashLength, dashLength++],
                },
                geometry: {
                    type: 'MultiLineString',
                    // TODO: Do I need to care about whether a route says it includes a segment "forward" or "backward"?
                    coordinates: route.segments.map(route => polyline.decode(segments[route[0]]).map(latLng => [latLng[1], latLng[0]])),
                },
            }));
        map.getSource('routes').setData({type: 'FeatureCollection', features: segmentFeatures})

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
        map.getSource('stops').setData({type: 'FeatureCollection', features: stopFeatures});

        if (!oldVehicleIdToVehicleMap) {
            const vehicleFeatures = vehicles.map(vehicle => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [vehicle.location.lng, vehicle.location.lat],
                },
                properties: {
                    vehicle_id: vehicle.vehicle_id,
                    heading: vehicle.heading,
                    route_color: '#' + vehicle.route.color,
                },
            }));
            map.getSource('vehicles').setData({type: 'FeatureCollection', features: vehicleFeatures});
        } else {
            // animate from old vehicles
            const steps = 50; // animation steps
            for (let counter = 0; counter < steps; counter++) {
                const curVehicleFeatures = [];
                vehicles.forEach(newVehicle => {
                    const oldVehicle = oldVehicleIdToVehicleMap[newVehicle.vehicle_id] ? oldVehicleIdToVehicleMap[newVehicle.vehicle_id] : newVehicle;
                    const latDiff = newVehicle.location.lat - oldVehicle.location.lat;
                    const curLat = oldVehicle.location.lat + counter / steps * latDiff;
                    const lngDiff = newVehicle.location.lng - oldVehicle.location.lng;
                    const curLng = oldVehicle.location.lng + counter / steps * lngDiff;
                    const headingDiff = newVehicle.heading - oldVehicle.heading;
                    const curHeading = oldVehicle.heading + counter / steps * headingDiff;
                    const curVehicleFeature = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [curLng, curLat],
                        },
                        properties: {
                            vehicle_id: newVehicle.vehicle_id,
                            heading: curHeading,
                            route_color: '#' + newVehicle.route.color,
                        },
                    };
                    curVehicleFeatures.push(curVehicleFeature);
                });
                map.getSource('vehicles').setData({type: 'FeatureCollection', features: curVehicleFeatures});
                await sleep(20);
            }
        }
        oldVehicleIdToVehicleMap = vehicleIdToVehicleMap;

        setSelectedPlace(selectedLayerId, selectedFeature, true); // update "selected place" sheet

        setTimeout(fetchBusStuff, 5000);
    }

    fetchBusStuff();
});
