import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import obsApi from '../services/obsApi';

import notificationApi from '../services/notificationApi';

const CACHE_KEY = '@obsStoreCache_v2';
const CACHE_KEY_TERMS = 'obs_terms_cache_v3';
const GRADE_CACHE_PREFIX = 'obs_grades_';

const CACHEABLE_KEYS = [
    'userData', 'classes', 'foodMenuOgle', 'foodMenuAksam',
    'foodMenuCache', 'graduationData', 'graduationDataTimestamp', 'academicStats', 'academicStatsTimestamp', 'attendanceData', 'notifications', 'terms', 'finalSchedule', 'ignoredCourses'
];

const saveToCache = async (state) => {
    try {
        const toCache = {};
        CACHEABLE_KEYS.forEach(key => {
            if (state[key] !== undefined) {
                if (key === 'foodMenuCache') {

                    const filtered = {};
                    const today = new Date();
                    for (let i = 0; i <= 0; i++) {
                        const d = new Date(today);
                        d.setDate(today.getDate() + i);
                        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                        ['ogle', 'aksam'].forEach(m => {
                            const k = `${dateStr}_${m}`;
                            if (state.foodMenuCache[k]) filtered[k] = state.foodMenuCache[k];
                        });
                    }
                    toCache[key] = filtered;
                } else {
                    toCache[key] = state[key];
                }
            }
        });
        if (toCache.classes) {
            toCache.classes = toCache.classes.map(({ _raw, ...rest }) => rest);
        }
        toCache._cachedAt = Date.now();
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
        console.log('[OBS Cache] ✅ Kaydedildi');
    } catch (e) {
        console.error('[OBS Cache] ❌ Kaydetme hatası:', e);
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

const DAY_MAP = {
    'pazartesi': 'Monday', 'salı': 'Tuesday', 'çarşamba': 'Wednesday',
    'perşembe': 'Thursday', 'cuma': 'Friday', 'cumartesi': 'Saturday', 'pazar': 'Sunday'
};

const getCurrentDonemKodu = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    if (month >= 9) return `${year + 1}10`;
    if (month <= 1) return `${year}10`;
    if (month >= 2 && month <= 6) return `${year}20`;
    return `${year}30`;
};

const findCurrentTerm = (donemList) => {
    const code = getCurrentDonemKodu();
    const match = donemList.find(d => d.donemKodu === code);
    if (match) return match;
    const sorted = [...donemList].sort((a, b) => parseInt(b.donemKodu) - parseInt(a.donemKodu));
    return sorted[0];
};

const parseClassesFromKepler = (kayitSinifResultList) => {
    const parsed = [];
    kayitSinifResultList.forEach(c => {
        const sid = c.sinifId || c.dersSinifId || c.SinifId || c.DersSinifId;
        if (!c.yerZamanBilgiTR) {
            parsed.push({
                code: `${c.bransKodu} ${c.dersKodu}`, name: c.dersAdiTR, title: c.dersAdiTR,
                crn: c.crn, day: '-', day_en: '-', time: '-', loc: '-', building: '-', room: '-', sinifId: sid
            });
            return;
        }
        c.yerZamanBilgiTR.split(' - ').forEach(block => {
            let day = '-', time = '-', building = '-', room = '-', loc = '-';
            const parts = block.trim().split(' / ');
            if (parts.length >= 1) {
                const dt = parts[0].trim().split(' ');
                day = dt[0];
                time = dt.slice(1).join(' ');
            }
            if (parts.length >= 2) {
                loc = parts[1].trim();
                const locParts = loc.split(', ');
                if (locParts.length >= 2) {
                    building = locParts[1].trim();
                    const bParts = building.split(' Binası ');
                    if (bParts.length === 2) { building = bParts[0]; room = bParts[1]; }
                } else { building = loc; }
            }
            parsed.push({
                code: `${c.bransKodu} ${c.dersKodu}`, name: c.dersAdiTR, title: c.dersAdiTR,
                crn: c.crn, day, day_en: DAY_MAP[day.toLowerCase()] || day, time, loc, building, room, sinifId: sid
            });
        });
    });
    return parsed;
};

export const useObsStore = create((set, get) => ({
    userData: { name: 'Mustafa', gpa: '-', credits: '-', balance: '0.00' },
    foodMenuOgle: null,
    foodMenuAksam: null,
    foodMenuCache: {},
    classes: [],
    graduationData: null,
    graduationDataTimestamp: null,
    realTimeGpa: null,
    academicStats: [],
    academicStatsTimestamp: null,
    attendanceData: null,
    notifications: [],
    notificationDetails: {},
    terms: [],
    finalSchedule: null,
    ignoredCourses: [],
    cacheLoaded: false,

    setUserData: (data) => set((state) => ({ userData: { ...state.userData, ...data } })),
    setFoodMenuCache: (key, data) => set((state) => ({
        foodMenuCache: { ...state.foodMenuCache, [key]: data }
    })),
    setGraduationData: (data) => {
        set({ graduationData: data, graduationDataTimestamp: Date.now() });
        saveToCache(get());
    },
    
    toggleIgnoredCourse: (courseCode) => {
        const { ignoredCourses } = get();
        if (ignoredCourses.includes(courseCode)) {
            set({ ignoredCourses: ignoredCourses.filter(c => c !== courseCode) });
        } else {
            set({ ignoredCourses: [...ignoredCourses, courseCode] });
        }
        saveToCache(get());
    },

    loadCache: async () => {
        const cached = await loadFromCache();
        if (cached) {
            const updates = {};
            CACHEABLE_KEYS.forEach(key => {
                if (cached[key] !== undefined) updates[key] = cached[key];
            });

            if (cached._cachedAt) {
                const cacheDate = new Date(cached._cachedAt).toDateString();
                const todayDate = new Date().toDateString();
                if (cacheDate !== todayDate) {
                    console.log('[OBS Store] 🔄 Yeni gün algılandı, eski yemek menüsü temizleniyor');
                    updates.foodMenuCache = {};
                }
            }

            set({ ...updates, cacheLoaded: true });
        } else {
            set({ cacheLoaded: true });
        }
    },

    fetchInitialData: async (termList = null) => {
        try {
            let donemler = termList;
            if (!donemler) {
                const donemlerRes = await obsApi.fetchKepler('DonemListesi');
                donemler = donemlerRes?.ogrenciDonemListesi;
            }
            
            if (donemler?.length > 0) {
                const activeTerm = findCurrentTerm(donemler);
                const classesRes = await obsApi.fetchKepler(`sinif/KayitliSinifListesi/${activeTerm.akademikDonemId}`);
                if (classesRes?.kayitSinifResultList) {
                    const parsedClasses = parseClassesFromKepler(classesRes.kayitSinifResultList);
                    set({ classes: parsedClasses });
                    get().fetchAttendance(parsedClasses);
                } else {
                    set({ classes: [] });
                    get().fetchAttendance([]);
                }
                get().fetchFinalSchedule(activeTerm);
            }
            
            const { graduationData, graduationDataTimestamp } = get();
            const cacheAge = Date.now() - (graduationDataTimestamp || 0);
            if (!graduationData || cacheAge > 7 * 24 * 60 * 60 * 1000) {
                await get().fetchGraduationData();
            }
        } catch (e) {
            console.error('[OBS Store] Kepler API hatası:', e);
        }

        get().ensureFoodMenuCache();

        obsApi.fetchPersonalInformation().then(data => {
            if (data && data.StatusCode === 0 && data.Bakiye) {
                get().setUserData({ balance: data.Bakiye, quota: data.Kota });
                saveToCache(get());
            }
        }).catch(() => {});

        notificationApi.getNotifications(0).then(list => {
            if (list && list.length > 0) {
                set({ notifications: list });
                get().prefetchNotificationDetails(list);
                saveToCache(get());
            }
        }).catch(() => {});

        saveToCache(get());
    },

    fetchFinalSchedule: async (existingTerm) => {
        try {
            let activeTerm = existingTerm;
            if (!activeTerm) {
                const donemlerRes = await obsApi.fetchKepler('DonemListesi');
                if (donemlerRes?.ogrenciDonemListesi?.length > 0) {
                    activeTerm = findCurrentTerm(donemlerRes.ogrenciDonemListesi);
                }
            }
            if (activeTerm) {
                const finalRes = await obsApi.fetchKepler(`takvim/FinalTakvimi?donemId=${activeTerm.akademikDonemId}`);
                set({ finalSchedule: finalRes?.finalBilgiList || null });
                saveToCache(get());
            }
        } catch (e) {
            console.error('[OBS Store] Final takvimi hatası:', e);
        }
    },

    fetchAttendance: async (currentClasses) => {
        if (!currentClasses || currentClasses.length === 0) {
            set({ attendanceData: null });
            saveToCache(get());
            return;
        }
        const uniqueClasses = [];
        const seenCrns = new Set();
        currentClasses.forEach(c => {
            if (c.crn && c.sinifId && !seenCrns.has(c.crn)) {
                seenCrns.add(c.crn);
                uniqueClasses.push(c);
            }
        });

        const results = await Promise.all(uniqueClasses.map(async (c) => {
            try {
                const res = await obsApi.fetchKepler(`sinif/SinifOgrenciYoklama/${c.sinifId}`);
                if (res?.sinifOgrenciYoklama) return { crn: c.crn, dersAdi: c.name || c.code, yoklama: res.sinifOgrenciYoklama };
            } catch (e) {}
            return null;
        }));

        const attData = {};
        results.forEach(r => { if (r) attData[r.crn] = { dersAdi: r.dersAdi, yoklama: r.yoklama }; });
        set({ attendanceData: Object.keys(attData).length > 0 ? attData : null });
        saveToCache(get());
    },

    fetchTermsAndCourses: async (termList = null) => {
        set({ globalRefreshing: true });

        try {
            const cachedTermsRaw = await AsyncStorage.getItem(CACHE_KEY_TERMS);
            let cachedTerms = cachedTermsRaw ? JSON.parse(cachedTermsRaw) : [];

            if (cachedTerms.length > 0) {
                set({ terms: cachedTerms });
            }

            let fetchedTerms = termList;
            if (!fetchedTerms) {
                const res = await obsApi.fetchKepler('DonemListesi');
                fetchedTerms = res?.ogrenciDonemListesi;
            }

            if (fetchedTerms?.length > 0) {
                const freshTermList = [...fetchedTerms].reverse();

                const populatedTerms = await Promise.all(freshTermList.map(async (term) => {
                    const fromCache = cachedTerms.find(ct => ct.akademikDonemId === term.akademikDonemId);

                    if (fromCache && Array.isArray(fromCache.courses)) {
                        return fromCache;
                    }

                    try {
                        const [classRes, harfRes] = await Promise.allSettled([
                            obsApi.fetchKepler(`sinif/KayitliSinifListesi/${term.akademikDonemId}`),
                            obsApi.fetchKepler(`sinif/SinifHarfNotuListesi/${term.akademikDonemId}`)
                        ]);

                        const harfMap = {};
                        if (harfRes.status === 'fulfilled' && harfRes.value?.sinifHarfNotuResultList) {
                            harfRes.value.sinifHarfNotuResultList.forEach(h => { harfMap[h.crn] = h.harfNotu; });
                        }

                        let courses = [];
                        if (classRes.status === 'fulfilled' && classRes.value?.kayitSinifResultList) {
                            courses = classRes.value.kayitSinifResultList.map(c => ({
                                sinifId: c.sinifId,
                                crn: c.crn,
                                name: `${c.bransKodu} ${c.dersKodu} - ${c.dersAdiTR}`,
                                harfNotu: harfMap[c.crn] || null
                            }));
                        }
                        return { ...term, courses };
                    } catch (e) {
                        return { ...term, courses: [] };
                    }
                }));

                set({ terms: populatedTerms });
                const stripRaw = (arr) => arr.map(t => ({ ...t, courses: t.courses?.map(({ _raw, ...rest }) => ({ ...rest })) }));
                await AsyncStorage.setItem(CACHE_KEY_TERMS, JSON.stringify(stripRaw(populatedTerms)));

                if (populatedTerms[0]?.courses) {
                    populatedTerms[0].courses.forEach(async (c) => {
                        try {
                            const data = await obsApi.fetchKepler(`sinif/SinifDonemIciNotListesi/${c.sinifId}`);
                            if (data) await AsyncStorage.setItem(GRADE_CACHE_PREFIX + c.sinifId, JSON.stringify(data));
                        } catch (e) {}
                    });
                }
            }
        } catch (e) {
            console.error('[OBS Store] fetchTermsAndCourses hatası:', e);
        }
    },

    ensureFoodMenuCache: async () => {
        const { foodMenuCache } = get();
        const today = new Date();
        const requests = [];

        for (let dayOffset = 0; dayOffset <= 0; dayOffset++) {
            for (const meal of ['ogle', 'aksam']) {
                const date = new Date(today);
                date.setDate(today.getDate() + dayOffset);
                const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

                const key = `${dateStr}_${meal}`;
                if (foodMenuCache[key]) continue;

                const menuType = meal === 'ogle' ? 0 : 1;
                requests.push(
                    obsApi.fetchFoodMenu(dateStr, menuType)
                        .then(data => (data && data.StatusCode === 0) ? { key, data } : { key, data: { empty: true } })
                        .catch(() => ({ key, data: { empty: true } }))
                );
            }
        }

        if (requests.length === 0) return;

        try {
            const results = await Promise.all(requests);
            const newCache = {};
            results.forEach(r => { if (r) newCache[r.key] = r.data; });

            const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

            set((state) => ({
                foodMenuCache: { ...state.foodMenuCache, ...newCache },
                foodMenuOgle: newCache[`${todayStr}_ogle`] || state.foodMenuCache[`${todayStr}_ogle`] || state.foodMenuOgle,
                foodMenuAksam: newCache[`${todayStr}_aksam`] || state.foodMenuCache[`${todayStr}_aksam`] || state.foodMenuAksam,
            }));
            saveToCache(get());
        } catch (e) {
            console.error('[OBS Store] ensureFoodMenuCache hatası:', e);
        }
    },

    ensureFoodMenuCacheForOffset: async (dayOffset) => {
        const { foodMenuCache } = get();
        const today = new Date();
        const requests = [];

        for (const meal of ['ogle', 'aksam']) {
            const date = new Date(today);
            date.setDate(today.getDate() + dayOffset);
            const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

            const key = `${dateStr}_${meal}`;
            if (foodMenuCache[key]) continue;

            const menuType = meal === 'ogle' ? 0 : 1;
            requests.push(
                obsApi.fetchFoodMenu(dateStr, menuType)
                    .then(data => (data && data.StatusCode === 0) ? { key, data } : { key, data: { empty: true } })
                    .catch(() => ({ key, data: { empty: true } }))
            );
        }

        if (requests.length === 0) return;

        try {
            const results = await Promise.all(requests);
            const newCache = {};
            results.forEach(r => { if (r) newCache[r.key] = r.data; });

            set((state) => ({
                foodMenuCache: { ...state.foodMenuCache, ...newCache }
            }));

        } catch (e) {
            console.error('[OBS Store] ensureFoodMenuCacheForOffset hatası:', e);
        }
    },

    fetchGraduationData: async () => {
        try {
            const portalApi = (await import('../services/portalApi')).default;
            const programRes = await portalApi.obsRequest('https://obs.itu.edu.tr/api/ogrenci/OgrenciProgamListesi/', {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Referer': 'https://obs.itu.edu.tr/ogrenci/MezuniyetIslemleri/MezuniyetimeNeKaldi' }
            });
            const programData = await programRes.json();
            
            if (!programData.ogrenciProgramBilgiListesi || programData.ogrenciProgramBilgiListesi.length === 0) return;
            const programId = programData.ogrenciProgramBilgiListesi[0].ogrenciProgramId;

            const mezuniyetRes = await portalApi.obsRequest(`https://obs.itu.edu.tr/api/ogrenci/MezuniyetimeNeKaldi/${programId}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Referer': 'https://obs.itu.edu.tr/ogrenci/MezuniyetIslemleri/MezuniyetimeNeKaldi' }
            });
            const mezuniyetData = await mezuniyetRes.json();
            const info = mezuniyetData.mezuniyetimeNeKaldiBilgi;
            if (!info) return;

                let rawCourses = (info.checkMetMezuniyetList || []).map(c => ({
                    donemNo: c.donemNo || 99,
                    bransKodu: c.bransKodu,
                    dersAdi: c.dersAdi,
                    kredisi: c.kredisiDec,
                    isMet: c.isMet,
                    harfNotu: c.harfNotu
                }));

                let mergedCourses = [];
                let skipIndices = new Set();
                
                for (let i = 0; i < rawCourses.length; i++) {
                    if (skipIndices.has(i)) continue;
                    let c1 = rawCourses[i];
                    
                    if (!c1.bransKodu) {
                        mergedCourses.push(c1);
                        continue;
                    }

                    let pairIndex = -1;
                    let isEVariant = c1.bransKodu.endsWith('E');
                    let baseCode = isEVariant ? c1.bransKodu.slice(0, -1).trim() : c1.bransKodu.trim();
                    let targetCode = isEVariant ? baseCode : baseCode + 'E';
                    
                    for (let j = i + 1; j < rawCourses.length; j++) {
                        if (skipIndices.has(j)) continue;
                        let c2 = rawCourses[j];
                        if (c2.bransKodu && c2.bransKodu.trim() === targetCode && c2.donemNo === c1.donemNo) {
                            pairIndex = j;
                            break;
                        }
                    }
                    
                    if (pairIndex !== -1) {
                        let c2 = rawCourses[pairIndex];
                        skipIndices.add(pairIndex);
                        if (c2.isMet && !c1.isMet) {
                            mergedCourses.push(c2);
                        } else if (c1.isMet && !c2.isMet) {
                            mergedCourses.push(c1);
                        } else {
                            let combined = { ...c1 };
                            if (!c1.isMet && !c2.isMet) {
                                combined.bransKodu = `${baseCode} / ${baseCode}E`;
                            }
                            mergedCourses.push(combined);
                        }
                    } else {
                        mergedCourses.push(c1);
                    }
                }

                const finalData = {
                    metKrediTotal: info.metKrediTotal,
                    gerekliMezuniyetKredisi: info.dersPlaniVM?.gerekliMezuniyetKredisi || 132,
                    gerekliIngilizceKredi: info.dersPlaniVM?.gerekliIngilizceKredi || 39.6,
                    metIngKrediTotal: info.metIngKrediTotal || 0,
                    gpa: info.gpa || 0,
                    courses: mergedCourses
                };

            // Fetch KayitDurumu (Term Stats)
            let termStats = [];
            try {
                const kayitRes = await portalApi.obsRequest('https://obs.itu.edu.tr/api/ogrenci/KayitDurumu', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json', 'Referer': 'https://obs.itu.edu.tr/ogrenci/DersKayitIslemleri/AkademikDurum' }
                });
                const kayitData = await kayitRes.json();
                if (kayitData && kayitData.kayitDurumuList && kayitData.kayitDurumuList.length > 0) {
                    termStats = kayitData.kayitDurumuList[0].kayitDurumuDonemList || [];
                }
            } catch (kayitError) {
                console.error('[OBS Store] KayitDurumu fetch hatası:', kayitError);
            }

            set({ 
                graduationData: finalData, 
                graduationDataTimestamp: Date.now(),
                academicStats: termStats,
                academicStatsTimestamp: Date.now()
            });
            saveToCache(get());
        } catch (e) {
            console.error('[OBS Store] fetchGraduationData hatası:', e);
        }
    },

    prefetchNotificationDetails: async (list) => {
        if (!list || list.length === 0) return;
        const toPrefetch = list.slice(0, 5);
        const { notificationDetails } = get();
        const ninovaApi = (await import('../services/ninovaApi')).default;

        const fetchPromises = toPrefetch.map(async (item) => {
            const isNinova = !!item.KeyValues && !item.KeyValues.includes('<') && (
                item.ApplicationName === 'Ninova' ||
                item.KeyValues.includes('DuyuruId=') ||
                item.KeyValues.includes('OdevId=') ||
                item.KeyValues.includes('DersId=')
            );
            if (isNinova && !notificationDetails[item.KeyValues]) {
                try {
                    const detail = await ninovaApi.getNinovaDetail(item.KeyValues);
                    if (detail) {
                        set(state => ({
                            notificationDetails: { ...state.notificationDetails, [item.KeyValues]: detail }
                        }));
                    }
                } catch (e) {}
            }
        });

        await Promise.all(fetchPromises);
    },

    markNotificationAsRead: (id) => {
        set((state) => {
            const updated = state.notifications.map(n => 
                n.NotificationObjectId === id ? { ...n, IsRead: true } : n
            );
            return { notifications: updated };
        });
        saveToCache(get());
    },

    refreshWidget: async (widgetId) => {
        try {
            switch (widgetId) {
                case 'classes': {
                    const donemRes = await obsApi.fetchKepler('DonemListesi');
                    if (donemRes?.ogrenciDonemListesi?.length > 0) {
                        const dList = donemRes.ogrenciDonemListesi;
                        const activeTerm = findCurrentTerm(dList);
                        const classesRes = await obsApi.fetchKepler(`sinif/KayitliSinifListesi/${activeTerm.akademikDonemId}`);
                        if (classesRes?.kayitSinifResultList) {
                            set({ classes: parseClassesFromKepler(classesRes.kayitSinifResultList) });
                        } else {
                            set({ classes: [] });
                        }
                    }
                    break;
                }
                case 'food': {
                    set({ foodMenuCache: {} });
                    await get().ensureFoodMenuCache();
                    break;
                }
                case 'wallet': {
                    const data = await obsApi.fetchPersonalInformation();
                    if (data && data.StatusCode === 0 && data.Bakiye) {
                        get().setUserData({ balance: data.Bakiye });
                    }
                    break;
                }
                case 'gpa':
                case 'graduation': {
                    await get().fetchGraduationData();
                    break;
                }
                case 'attendance': {
                    await get().fetchAttendance(get().classes);
                    break;
                }
                case 'final': {
                    await get().fetchFinalSchedule();
                    break;
                }
            }
        } catch (e) {
            console.error(`[OBS Store] Widget yenileme hatası: ${widgetId}`, e);
        }
        saveToCache(get());
    },

    clearStore: () => {
        set({
            userData: null, classes: null, foodMenuOgle: null, foodMenuAksam: null,
            foodMenuCache: {}, graduationData: null, graduationDataTimestamp: null,
            academicStats: null, academicStatsTimestamp: null, attendanceData: null,
            notifications: null, terms: null, finalSchedule: null, ignoredCourses: []
        });
    }
}));
