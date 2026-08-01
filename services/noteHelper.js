import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTES_DATA_URL = 'https://raw.githubusercontent.com/pltmustafa/ITU-SuperApp-data/main/notes.json';
const CACHE_KEY = 'static_notes_data';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

class NoteHelper {

    async searchNotes(query) {
        try {
            const allNotes = await this._loadData();
            if (!allNotes || !Array.isArray(allNotes)) return [];

            if (!query || query.length < 2) return [];

            const normalizedQuery = query
                .replace(/İ/g, 'I')
                .replace(/ı/g, 'I')
                .replace(/i/g, 'I')
                .toUpperCase();

            return allNotes.filter(note => {
                const code = (note.courseCode || '').toUpperCase();
                const title = (note.title || '').toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/ı/g, 'I')
                    .replace(/i/g, 'I');

                return code.includes(normalizedQuery) || title.includes(normalizedQuery);
            });

        } catch (error) {
            console.error('[NoteHelper] Search error:', error);
            return [];
        }
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

            const response = await fetch(NOTES_DATA_URL);
            if (!response.ok) throw new Error('Notes data fetch failed');

            const data = await response.json();

            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }));

            return data;
        } catch (e) {
            console.warn('[NoteHelper] Load failed:', e);
            const fallback = await AsyncStorage.getItem(CACHE_KEY);
            return fallback ? JSON.parse(fallback).data : null;
        }
    }
}

export default new NoteHelper();
