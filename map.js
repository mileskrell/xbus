const xMin = -75.56;
const yMin = 38.92;
const xMax = -73.89;
const yMax = 41.36;
const arcgisBaseUrl = 'https://services1.arcgis.com/ze0XBzU1FXj94DJq/arcgis/rest/services/';
const commonParams = `f=geojson&geometry=%7B%22xmin%22%3A${xMin}%2C%22ymin%22%3A${yMin}%2C%22xmax%22%3A${xMax}%2C%22ymax%22%3A${yMax}%7D`;
const parkingLotsUrl = arcgisBaseUrl + `Rutgers_University_Parking/FeatureServer/0/query?${commonParams}&outFields=Parking_ID%2CLot_Name%2CContact%2CWebsite%2CLatitude%2CLongitude`;
const buildingsUrl = arcgisBaseUrl + `Rutgers_University_Buildings/FeatureServer/0/query?${commonParams}&outFields=BldgName%2CBldgNum%2CBldgAddr%2CCity%2CState%2CLatitude%2CLongitude`;
mapboxgl.accessToken = 'pk.eyJ1IjoibWlsZXNrcmVsbCIsImEiOiJja3hqNXlmY2gzazEyMnRxaDA1Y3J2MjJzIn0.Uz5PQwiiTDyv3fr8YTTwpA';
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mapbox/streets-v11', // style URL
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

map.on('load', () => {
    // Remove layers for Mapbox Streets buildings, pedestrian paths, stairs, and bus stop icons
    ['building', 'building-outline', 'building-number-label', 'poi-label',
        'road-path', 'road-path-bg', 'road-steps', 'road-steps-bg', 'transit-label'].forEach(it => map.removeLayer(it));
    map.addSource('rParkingLots-source', {type: 'geojson', data: parkingLotsUrl});
    map.addLayer({
        id: 'rParkingLots-layer',
        type: 'fill',
        source: 'rParkingLots-source',
        paint: {
            'fill-color': '#888888',
            'fill-opacity': 0.5,
        },
    });
    map.addSource('rBuildings-source', {type: 'geojson', data: buildingsUrl});
    map.addLayer({
        id: 'rBuildings-layer',
        type: 'fill',
        source: 'rBuildings-source',
        paint: {
            'fill-color': '#6d757c',
        },
    });
});
