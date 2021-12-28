function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// For controls to fly to NB/NWK/CMDN. Depends on some Mapbox stuff (internals? maybe, oops)
class FlyToCampusControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.classList.add('mapboxgl-ctrl', 'mapboxgl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        this._createFlyToButton('NB', {center: [-74.45, 40.5], zoom: 13})
        this._createFlyToButton('NWK', {center: [-74.18, 40.74], zoom: 14})
        this._createFlyToButton('CMDN', {center: [-75.125, 39.948], zoom: 15})

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    // https://github.com/mapbox/mapbox-gl-js/blob/7afee477ba26ccf539a1d35e3ca781691c548536/src/ui/control/navigation_control.js#L143-L148
    _createFlyToButton(buttonText, flyToOptions) {
        const button = this._domCreate('button', undefined, this._container);
        button.classList.add('flyToCampusButton');
        button.type = 'button';
        button.textContent = buttonText;
        button.addEventListener('click', () => this._map.flyTo(flyToOptions));
        return button;
    }

    // https://github.com/mapbox/mapbox-gl-js/blob/7afee477ba26ccf539a1d35e3ca781691c548536/src/util/dom.js#L11-L16
    _domCreate(tagName, className, container) {
        const el = window.document.createElement(tagName);
        if (className !== undefined) el.className = className;
        if (container) container.appendChild(el);
        return el;
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
