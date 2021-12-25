const xMin = -75.56;
const yMin = 38.92;
const xMax = -73.89;
const yMax = 41.36;
mapboxgl.accessToken = 'pk.eyJ1IjoibWlsZXNrcmVsbCIsImEiOiJja3hqNXlmY2gzazEyMnRxaDA1Y3J2MjJzIn0.Uz5PQwiiTDyv3fr8YTTwpA';
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
    map.removeLayer('transit-label') // Remove layer for Mapbox Streets bus stop icons
    map.addSource('selected place', {type: 'geojson', data: {type: 'Feature'}});
    map.addLayer({
        id: 'selected place',
        type: 'fill',
        source: 'selected place',
        paint: {'fill-color': '#cc0033'},
    });
    map.on('mouseleave', 'Rutgers parking lots', () => map.getCanvas().style.cursor = '');
    map.on('mouseleave', 'Rutgers buildings', () => map.getCanvas().style.cursor = '');
    map.on('mouseenter', 'Rutgers parking lots', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseenter', 'Rutgers buildings', () => map.getCanvas().style.cursor = 'pointer');
    map.on('click', 'Rutgers parking lots', e => setSelectedPlace('lot', e.features[0], e.lngLat));
    map.on('click', 'Rutgers buildings', e => setSelectedPlace('building', e.features[0], e.lngLat));
});
