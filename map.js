mapboxgl.accessToken = 'pk.eyJ1IjoibWlsZXNrcmVsbCIsImEiOiJja3hqNXlmY2gzazEyMnRxaDA1Y3J2MjJzIn0.Uz5PQwiiTDyv3fr8YTTwpA';
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mapbox/streets-v11', // style URL
    center: [-74.45, 40.5], // starting position [lng, lat]
    zoom: 15, // starting zoom
    maxBounds: [[-75.56, 38.92], [-73.89, 41.36]], // restrict pan and zoom area
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
