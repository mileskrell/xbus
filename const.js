function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function secondsToString(seconds) {
    if (seconds <= 0) return 'Now';
    if (seconds < 60) return '<1 min';
    return `${Math.round(seconds / 60)} min`;
}

// https://github.com/mapbox/mapbox-gl-js/blob/7afee477ba26ccf539a1d35e3ca781691c548536/src/util/dom.js#L11-L16
function domCreate(tagName, className, container) {
    const el = window.document.createElement(tagName);
    if (className !== undefined) el.className = className;
    if (container) container.appendChild(el);
    return el;
}

const nbPos = {center: [-74.45, 40.5], zoom: 12.5};
const nwkPos = {center: [-74.18, 40.74], zoom: 13};
const cmdnPos = {center: [-75.125, 39.948], zoom: 14};

// For controls to fly to NB/NWK/CMDN. Depends on some Mapbox stuff (internals? maybe, oops)
class FlyToCampusControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.classList.add('mapboxgl-ctrl', 'mapboxgl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        this._createFlyToButton('NB', nbPos);
        this._createFlyToButton('NWK', nwkPos);
        this._createFlyToButton('CMDN', cmdnPos);

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    // https://github.com/mapbox/mapbox-gl-js/blob/7afee477ba26ccf539a1d35e3ca781691c548536/src/ui/control/navigation_control.js#L143-L148
    _createFlyToButton(buttonText, flyToOptions) {
        const button = domCreate('button', undefined, this._container);
        button.classList.add('flyToCampusButton');
        button.type = 'button';
        button.textContent = buttonText;
        button.addEventListener('click', () => {
            document.cookie = `campus=${buttonText}; expires=${new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)}; path=/`;
            this._map.flyTo(flyToOptions);
        });
        return button;
    }

}

const xMin = -75.56;
const yMin = 38.92;
const xMax = -73.89;
const yMax = 41.36;
const translocRequestInit = {
    method: 'GET',
    headers: {
        'x-rapidapi-host': 'transloc-api-1-2.p.rapidapi.com',
        'x-rapidapi-key': '1b6e9ed24cmsh2d1311786670ae8p1eace0jsncef54644775d',
    },
};
