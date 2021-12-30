mapboxgl.accessToken = 'pk.eyJ1IjoibWlsZXNrcmVsbCIsImEiOiJja3hqNXlmY2gzazEyMnRxaDA1Y3J2MjJzIn0.Uz5PQwiiTDyv3fr8YTTwpA';
let routes, segments, stops, vehicles,
    routeIdToRouteMap, stopIdToStopMap, vehicleIdToVehicleMap, oldVehicleIdToVehicleMap,
    selectedLayerId, selectedFeature, selectedPlaceSheet;
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mileskrell/ckxl9zz5632ey14oafkathv0c', // style URL
    center: [-74.45, 40.5], // starting position [lng, lat]
    zoom: 12.5, // starting zoom
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

function setSelectedPlace(tappedLayerId, feature) {
    if (selectedPlaceSheet) {
        document.body.removeChild(selectedPlaceSheet); // remove place sheet
        selectedPlaceSheet = undefined;
    }
    if (!tappedLayerId) {
        map.getSource('selected place').setData({type: 'Feature'}); // empty source
        selectedLayerId = selectedFeature = undefined;
        return;
    }
    // TODO: If you click and then zoom in a lot, we should reselect the feature
    map.getSource('selected place').setData(feature);
    selectedLayerId = tappedLayerId;
    selectedFeature = feature;

    if (map.getLayer('selected place')) map.removeLayer('selected place');
    // Add selected place layer below tapped layer (b/c there's no method to add it above)
    map.addLayer(tappedLayerId === 'stops' ? {
        id: 'selected place',
        type: 'symbol',
        source: 'selected place',
        paint: {'icon-color': '#cc0033'},
        layout: {
            'icon-image': 'stop',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.25, 18, 1],
            'icon-allow-overlap': true,
        },
    } : tappedLayerId === 'vehicles' ? {
        id: 'selected place',
        type: 'symbol',
        source: 'selected place',
        paint: {'icon-color': '#cc0033'},
        layout: {
            'icon-image': 'vehicle',
            'icon-rotate': ['get', 'heading'],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 1],
            'icon-allow-overlap': true,
        },
    } : {
        id: 'selected place',
        type: 'fill',
        source: 'selected place',
        paint: {'fill-color': '#cc0033'},
    }, tappedLayerId);
    // Now move tapped layer below selected place layer
    map.moveLayer(tappedLayerId, 'selected place');

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
            html = `<div id="selectedPlaceSheet">
            <h3 class='centerText'>${feature.properties['BldgName']}</h3>
            <div id='buildingPhotoNumberAddress'>
                <a href=${photoUrl} target='_blank'><img width='100vh' height='100vh' style='margin: 1vh' src=${photoUrl}></a>
                <div>
                    <p class='centerText'>Building number: ${buildingNumber}</p>
                    <p class='centerText'>${feature.properties['BldgAddr']}<br>
                    ${feature.properties['City']}, ${feature.properties['State']}</p>
                </div>
            </div>
            ${extraInfoHtml}
            </div>`;
            break;
        }
        case 'Rutgers parking lots': {
            html = `<div id="selectedPlaceSheet"><h3 style='text-align: center'>🅿 ${feature.properties['Lot_Name']}</h3></div>`;
            map.setPaintProperty('selected place', 'fill-opacity', 0.5);
            break;
        }
        case 'stops': {
            // TODO: Update sheet whenever data updates
            const arrivalEstimates = JSON.parse(selectedFeature.properties.arrival_estimates);

            const arrivals = routes.filter(route => arrivalEstimates.some(it => it.route_id === route.route_id))
                .map(route => ({
                    routeName: route.short_name ? route.short_name : route.long_name,
                    routeColor: route.color,
                    arrivalEstimates: arrivalEstimates
                        .filter(it => it.route_id === route.route_id)
                        // .slice(0, 3) // only show next 3 arrivals per route
                        .map(it => secondsToString((new Date(it.arrival_at) - Date.now()) / 1000)),
                }))
                .map(route => `<div class="routeBlock"><b style="color: #${route.routeColor}">${route.routeName}</b>` + route.arrivalEstimates.join('<br>') + `</div>`);

            html = `<div id="selectedPlaceSheet">
                <h3 style='text-align: center'>${feature.properties['stop_name']}</h3>
                ${arrivals.length > 0 ? arrivals.join('<hr>') : '<div class="centerText">No pending arrivals</div>'}
            </div>`;
            break;
        }
        case 'vehicles': {
            html = `<div id="selectedPlaceSheet"><h3 style='text-align: center'>🚌 ID ${feature.properties['vehicle_id']}</h3></div>`;
            break;
        }
    }
    const template = document.createElement('template');
    template.innerHTML = html;
    selectedPlaceSheet = template.content.firstChild
    document.body.appendChild(selectedPlaceSheet);
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
    map.addSource('routes', {type: 'geojson', data: {type: 'Feature'}});
    map.addLayer({
        id: 'routes',
        type: 'line',
        source: 'routes',
        paint: {
            'line-color': ['get', 'route_color'],
            'line-width': 3,
        },
    }, 'Rutgers buildings');
    map.addSource('selected place', {type: 'geojson', data: {type: 'Feature'}});
    map.addSource('stops', {type: 'geojson', data: {type: 'Feature'}});
    map.addLayer({
        id: 'stops',
        type: 'symbol',
        source: 'stops',
        paint: {'icon-color': '#000000'},
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
        const tappedVehicles = map.queryRenderedFeatures(e.point, {layers: ['vehicles']});
        if (tappedVehicles.length > 0) {
            setSelectedPlace('vehicles', tappedVehicles[0]);
            return;
        }
        const tappedStops = map.queryRenderedFeatures(e.point, {layers: ['stops']});
        if (tappedStops.length > 0) {
            setSelectedPlace('stops', tappedStops[0]);
            return;
        }
        const tappedBuildings = map.queryRenderedFeatures(e.point, {layers: ['Rutgers buildings']});
        if (tappedBuildings.length > 0) {
            setSelectedPlace('Rutgers buildings', tappedBuildings[0]);
            return;
        }
        const tappedParkingLots = map.queryRenderedFeatures(e.point, {layers: ['Rutgers parking lots']});
        if (tappedParkingLots.length > 0) {
            setSelectedPlace('Rutgers parking lots', tappedParkingLots[0]);
            return;
        }
        setSelectedPlace(); // clear selection
    });

    async function fetchBusStuff() {
        routes = (await (await fetch('https://transloc-api-1-2.p.rapidapi.com/routes.json?agencies=1323', translocRequestInit)).json())['data'][1323];
        segments = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/segments.json?agencies=1323", translocRequestInit)).json())['data'];
        stops = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/stops.json?agencies=1323", translocRequestInit)).json())['data'];
        vehicles = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/vehicles.json?agencies=1323", translocRequestInit)).json())['data'];
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

        const segmentFeatures = routes
            .filter(route => vehicles.some(vehicle => vehicle.route_id === route.route_id))
            .map(route => ({
                type: 'Feature',
                properties: {
                    route_color: '#' + route.color,
                },
                geometry: {
                    type: 'MultiLineString',
                    // TODO: Do I need to care about whether a route says it includes a segment "forward" or "backward"?
                    coordinates: route.segments.map(route => polyline.decode(segments[route[0]]).map(latLng => [latLng[1], latLng[0]])),
                },
            }));
        map.getSource('routes').setData({type: 'FeatureCollection', features: segmentFeatures})

        const stopFeatures = stops.map(stop => ({
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
                    if (selectedLayerId === 'vehicles' && selectedFeature.properties.vehicle_id === newVehicle.vehicle_id) {
                        map.getSource('selected place').setData(curVehicleFeature);
                    }
                });
                map.getSource('vehicles').setData({type: 'FeatureCollection', features: curVehicleFeatures});
                await sleep(20);
            }
        }
        oldVehicleIdToVehicleMap = vehicleIdToVehicleMap;

        setTimeout(fetchBusStuff, 5000);
    }

    fetchBusStuff();
});
