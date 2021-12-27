mapboxgl.accessToken = 'pk.eyJ1IjoibWlsZXNrcmVsbCIsImEiOiJja3hqNXlmY2gzazEyMnRxaDA1Y3J2MjJzIn0.Uz5PQwiiTDyv3fr8YTTwpA';
let routes, stops, vehicles, oldVehicleIdToVehicleMap;
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mileskrell/ckxl9zz5632ey14oafkathv0c', // style URL
    center: [-74.45, 40.5], // starting position [lng, lat]
    zoom: 15, // starting zoom
    maxBounds: [[xMin, yMin], [xMax, yMax]], // restrict pan and zoom area
    touchPitch: false, // disable pitch gesture
});

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

// Add zoom and rotation controls to the map.
map.addControl(new mapboxgl.NavigationControl());

function setSelectedPlace(placeType, feature, lngLat) {
    // TODO: If you click and then zoom in a lot, we should reselect the feature
    map.getSource('selected place').setData(feature);

    let html;
    switch (placeType) {
        case 'building': {
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
            html = `<h3 class='centerText'>${feature.properties['BldgName']}</h3>
            <div class='popup'>
                <a href=${photoUrl} target='_blank'><img width='100vh' height='100vh' style='margin: 1vh' src=${photoUrl}></a>
                <div>
                    <p class='centerText'>Building number: ${buildingNumber}</p>
                    <p class='centerText'>${feature.properties['BldgAddr']}<br>
                    ${feature.properties['City']}, ${feature.properties['State']}</p>
                </div>
            </div>
            ${extraInfoHtml}`;
            map.setPaintProperty('selected place', 'fill-opacity', 1);
            break;
        }
        case 'lot': {
            html = `<h3 style='text-align: center'>🅿 ${feature.properties['Lot_Name']}</h3>`;
            map.setPaintProperty('selected place', 'fill-opacity', 0.5);
            break;
        }
    }
    new mapboxgl.Popup({maxWidth: '300px'})
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(map)
        .on('close', () => {
            map.getSource('selected place').setData({type: 'Feature'}); // empty source
        });
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
    map.removeLayer('transit-label') // Remove layer for Mapbox Streets bus stop icons
    map.addSource('selected place', {type: 'geojson', data: {type: 'Feature'}});
    map.addLayer({
        id: 'selected place',
        type: 'fill',
        source: 'selected place',
        paint: {'fill-color': '#cc0033'},
    }); // TODO: Selected place layer should always be directly above whatever layer was selected
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
    map.on('mouseenter', 'Rutgers parking lots', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseenter', 'Rutgers buildings', () => map.getCanvas().style.cursor = 'pointer');
    map.on('click', 'Rutgers parking lots', e => setSelectedPlace('lot', e.features[0], e.lngLat));
    map.on('click', 'Rutgers buildings', e => setSelectedPlace('building', e.features[0], e.lngLat));

    async function fetchBusStuff() {
        routes = (await (await fetch('https://transloc-api-1-2.p.rapidapi.com/routes.json?agencies=1323', translocRequestInit)).json())['data'][1323];
        stops = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/stops.json?agencies=1323", translocRequestInit)).json())['data'];
        vehicles = (await (await fetch("https://transloc-api-1-2.p.rapidapi.com/vehicles.json?agencies=1323", translocRequestInit)).json())['data'];
        if (vehicles) {
            vehicles = vehicles[1323];
        } else {
            console.warn("no vehicles"); // TODO: Confirm that this is what happens when there are no vehicles
            vehicles = [];
        }
        console.log("fetched routes, stops, and vehicles");

        const routeIdToRouteMap = {};
        routes.forEach(route => routeIdToRouteMap[route.route_id] = route);
        const stopIdToStopMap = {};
        stops.forEach(stop => stopIdToStopMap[stop.stop_id] = stop);
        const vehicleIdToVehicleMap = {};
        vehicles.forEach(vehicle => vehicleIdToVehicleMap[vehicle.vehicle_id] = vehicle);

        vehicles.forEach(vehicle => vehicle.route = routeIdToRouteMap[vehicle.route_id]);

        const stopFeatures = stops.map(stop => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [stop.location.lng, stop.location.lat],
            },
            properties: {
                stop_id: stop.stop_id,
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
                    curVehicleFeatures.push({
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
                    });
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
