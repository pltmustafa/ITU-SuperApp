const SHUTTLE_URL = 'https://harita.itu.edu.tr/Home/GetSuttlePosition';
const ACTIVE_INTERVAL = 2000;

let shuttles = [];
let lastUpdated = null;
let intervalId = null;
let listeners = new Set();
let isActive = false;

const parseShuttles = (data) => {
    if (!data?.isSuccess || !Array.isArray(data.data)) return [];
    return data.data.filter(s => {
        if (s.TypeKey === 'staff') return false;
        try {
            const lat = parseFloat(String(s.Latitude).replace(',', '.'));
            const lon = parseFloat(String(s.Longitude).replace(',', '.'));
            return !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0);
        } catch (e) { return false; }
    });
};

const fetchShuttles = async () => {
    try {
        const response = await fetch(SHUTTLE_URL, {
            method: 'POST',
            body: '',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (response.ok) {
            const data = await response.json();
            const valid = parseShuttles(data);
            if (valid.length > 0 || data?.isSuccess) {
                shuttles = valid;
                lastUpdated = new Date();

                listeners.forEach(fn => fn(shuttles, lastUpdated));
            }
        }
    } catch (error) {

    }
};

const startPolling = (interval) => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(fetchShuttles, interval);
};

const setActiveMode = () => {
    isActive = true;
    fetchShuttles();
    startPolling(ACTIVE_INTERVAL);
};

const stopPolling = () => {
    isActive = false;
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
};

const subscribe = (fn) => {
    listeners.add(fn);

    if (shuttles.length > 0) {
        fn(shuttles, lastUpdated);
    }
    return () => listeners.delete(fn);
};

const getShuttles = () => shuttles;
const getLastUpdated = () => lastUpdated;
const preload = () => fetchShuttles();

export default {
    setActiveMode,
    stopPolling,
    subscribe,
    getShuttles,
    getLastUpdated,
    preload,
};
