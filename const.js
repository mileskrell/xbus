function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
