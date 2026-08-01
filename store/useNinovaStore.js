import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ituApi from '../services/ituApi';

const CACHE_KEY = '@ninovaStoreCache_v2';
const CACHE_KEY_COURSES = 'ninova_courses_cache_v1';
const CACHEABLE_KEYS = ['activeHomeworks', 'courses'];

const saveToCache = async (state) => {
    try {
        const toCache = {};
        CACHEABLE_KEYS.forEach(key => {
            if (state[key] !== undefined) {
                toCache[key] = state[key];
            }
        });
        toCache._cachedAt = Date.now();
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
        console.log('[Ninova Cache] ✅ Kaydedildi');
    } catch (e) {
        console.error('[Ninova Cache] ❌ Kaydetme hatası:', e);
    }
};

const loadFromCache = async () => {
    try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
};

export const useNinovaStore = create((set, get) => ({
    activeHomeworks: [],
    courses: [],
    cacheLoaded: false,

    loadCache: async () => {
        const cached = await loadFromCache();
        if (cached) {
            const updates = {};
            CACHEABLE_KEYS.forEach(key => {
                if (cached[key] !== undefined) updates[key] = cached[key];
            });
            set({ ...updates, cacheLoaded: true });
        } else {
            set({ cacheLoaded: true });
        }
    },

    fetchInitialData: async () => {
        try {

            const url = `https://mobil.itu.edu.tr/v2/service/service.aspx?method=NinovaGetKisiSinifList&Token=${ituApi.token}&test=aka&SecurityId=8ade2db68433b532`;
            const response = await fetch(url);
            const data = await response.json();
            const list = data.SinifList || [];

            if (list.length > 0) {
                set({ courses: list });
                await AsyncStorage.setItem(CACHE_KEY_COURSES, JSON.stringify(list));
            } else {
                set({ courses: [] });
                await AsyncStorage.removeItem(CACHE_KEY_COURSES);
            }
        } catch (e) {
            console.error('[Ninova Store] Initial fetch hatası:', e);
        }
        saveToCache(get());
    },

    refreshWidget: async (widgetId) => {
        if (widgetId === 'active_homeworks') {
            await get().fetchInitialData();
        }
        saveToCache(get());
    }
}));
