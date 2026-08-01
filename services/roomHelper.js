import AsyncStorage from '@react-native-async-storage/async-storage';

const ROOMS_DATA_URL = 'https://raw.githubusercontent.com/pltmustafa/ITU-SuperApp-data/main/rooms.json';
const CACHE_KEY = 'static_rooms_data';
const CACHE_EXPIRY = 60 * 60 * 1000;

class RoomHelper {

    async getEmptyRooms(buildingCode) {
        try {
            const allCourses = await this._loadData();
            if (!allCourses) return { full_day: [], limited: {} };

            const targetBuilding = buildingCode.toUpperCase();
            const buildingCourses = allCourses.filter(c => c.building === targetBuilding && c.room !== '--');

            if (buildingCourses.length === 0) return { full_day: [], limited: {} };

            const allRooms = [...new Set(buildingCourses.map(c => c.room))];

            const now = new Date();
            const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
            const todayName = dayNames[now.getDay()];

            const currentHour = now.getHours();
            const currentMin = now.getMinutes();
            const currentTimeVal = (currentHour * 60) + currentMin;

            const roomData = {};
            allRooms.forEach(r => roomData[r] = []);

            buildingCourses.forEach(c => {
                if (c.day !== todayName) return;
                const [startStr, endStr] = c.time.split('/');
                const [sH, sM] = startStr.split(':').map(Number);
                const [eH, eM] = endStr.split(':').map(Number);
                roomData[c.room].push([(sH * 60) + sM, (eH * 60) + eM]);
            });

            const full_day = [];
            const limited = {};
            const will_be_empty = {};

            const TWO_HOURS_MIN = 120;

            allRooms.forEach(room => {
                const lessons = roomData[room].sort((a, b) => a[0] - b[0]);

                let currentLessonIndex = lessons.findIndex(l => currentTimeVal >= l[0] && currentTimeVal <= l[1]);

                if (currentLessonIndex !== -1) {

                    let freeAt = lessons[currentLessonIndex][1];
                    let nextIdx = currentLessonIndex + 1;
                    for (; nextIdx < lessons.length; nextIdx++) {
                        if (lessons[nextIdx][0] <= freeAt + 10) {
                            freeAt = lessons[nextIdx][1];
                        } else {
                            break;
                        }
                    }

                    if (freeAt > currentTimeVal && freeAt - currentTimeVal <= TWO_HOURS_MIN) {
                        const timeStr = this._formatTime(freeAt);

                        let durationStr = "Günün geri kalanı";
                        if (nextIdx < lessons.length) {
                             const roundedFreeAt = this._roundMinutes(freeAt);
                             const nextLessonStart = this._roundMinutes(lessons[nextIdx][0]);
                             const durationMin = nextLessonStart - roundedFreeAt;
                             const dH = Math.floor(durationMin / 60);
                             const dM = durationMin % 60;
                             durationStr = dH > 0 ? (dM > 0 ? `${dH}sa ${dM}dk` : `${dH}sa`) : `${dM}dk`;
                        }

                        if (!will_be_empty[timeStr]) will_be_empty[timeStr] = [];
                        will_be_empty[timeStr].push({ room, duration: durationStr });
                    }
                } else {

                    let nextLesson = lessons.find(l => l[0] > currentTimeVal);
                    if (nextLesson) {

                        const timeStr = this._formatTime(nextLesson[0]);

                        if (!limited[timeStr]) limited[timeStr] = [];
                        limited[timeStr].push(room);
                    } else {

                        full_day.push(room);
                    }
                }
            });

            return {
                full_day: full_day.sort(),
                limited: limited,
                will_be_empty: will_be_empty
            };

        } catch (error) {
            console.error('[RoomHelper] Error:', error);
            throw error;
        }
    }

    _formatTime(minutes) {
        const rounded = this._roundMinutes(minutes);
        const h = Math.floor(rounded / 60);
        const m = rounded % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    _roundMinutes(minutes) {
        const m = minutes % 60;
        if (m === 29 || m === 59) return minutes + 1;
        return minutes;
    }

    async _loadData() {
        try {

            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    return data;
                }
            }

            const response = await fetch(ROOMS_DATA_URL);
            if (!response.ok) throw new Error('Data fetch failed');

            const data = await response.json();

            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }));

            return data;
        } catch (e) {
            console.warn('[RoomHelper] Load failed, falling back to cache if available:', e);
            const fallback = await AsyncStorage.getItem(CACHE_KEY);
            return fallback ? JSON.parse(fallback).data : null;
        }
    }
}

export default new RoomHelper();
