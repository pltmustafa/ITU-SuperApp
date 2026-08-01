import AsyncStorage from '@react-native-async-storage/async-storage';

const GRADES_BASE_URL = 'https://raw.githubusercontent.com/pltmustafa/ITU-SuperApp-data/main/grades';
const CACHE_PREFIX = 'static_grades_';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const CATALOG_URL = `${GRADES_BASE_URL}/catalog.json`;
const CATALOG_CACHE_KEY = 'static_grades_catalog';

class GradeHelper {

    async searchCourses(query) {
        try {
            const term = query.trim().toUpperCase();
            if (term.length < 2) return [];

            const catalog = await this._loadCatalog();
            if (catalog && catalog.courses) {

                const cleanQuery = term.replace(/\s+/g, '');
                const matches = catalog.courses.filter(item =>
                    item.c.replace(/\s+/g, '').toUpperCase().includes(cleanQuery)
                ).slice(0, 50);

                return matches.map(m => ({
                    tamKod: m.c,
                    bransKodu: m.b,
                    dersNo: m.n
                }));
            }

            let branchCode = '';
            const normalized = term.replace(/\s+/g, '');
            if (normalized.match(/^[A-Z]{2,4}/)) {
                branchCode = normalized.match(/^[A-Z]{2,4}/)[0];
            } else {
                return [];
            }

            const branchData = await this._loadBranchData(branchCode);
            if (!branchData) return [];

            return branchData.filter(course => {
                const fullCode = (course.tamKod || '').replace(/\s+/g, '').toUpperCase();
                return fullCode.includes(normalized);
            }).map(c => ({
                tamKod: c.tamKod,
                bransKodu: c.bransKodu,
                dersNo: c.dersNo
            }));

        } catch (error) {
            console.error('[GradeHelper] Search error:', error);
            return [];
        }
    }

    async getCourseDetail(branchCode, courseNo) {
        console.log(`[GradeHelper] Getting detail for: ${branchCode} - ${courseNo}`);
        try {
            const branchData = await this._loadBranchData(branchCode.toUpperCase());
            if (!branchData) {
                console.warn(`[GradeHelper] No branch data found for ${branchCode}`);
                return null;
            }

            const found = branchData.find(c => String(c.dersNo) === String(courseNo));
            console.log(`[GradeHelper] Match result: ${found ? 'FOUND' : 'NOT FOUND'}`);

            return found || null;
        } catch (error) {
            console.error('[GradeHelper] Detail error:', error);
            return null;
        }
    }

    async _loadCatalog() {
        try {
            const cached = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    console.log('[GradeHelper] Catalog loaded from CACHE');
                    return data;
                }
            }

            console.log(`[GradeHelper] Fetching catalog from: ${CATALOG_URL}`);
            const response = await fetch(CATALOG_URL);
            if (!response.ok) {
                console.warn(`[GradeHelper] Catalog fetch failed: ${response.status}`);
                return null;
            }

            const data = await response.json();
            console.log(`[GradeHelper] Catalog fetched: ${data.courses?.length} courses`);

            await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
            return data;
        } catch (e) {
            console.error('[GradeHelper] Catalog fetch crash:', e);
            return null;
        }
    }

    async _loadBranchData(branchCode) {
        const cacheKey = `${CACHE_PREFIX}${branchCode}`;
        const url = `${GRADES_BASE_URL}/${branchCode}.json`;

        try {

            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    console.log(`[GradeHelper] ${branchCode} data loaded from CACHE`);
                    return data;
                }
            }

            console.log(`[GradeHelper] Fetching branch data from: ${url}`);
            const response = await fetch(url);

            if (!response.ok) {
                console.warn(`[GradeHelper] Branch fetch failed for ${branchCode}: ${response.status}`);
                return null;
            }

            const data = await response.json();
            console.log(`[GradeHelper] Branch fetched: ${data.length} entries for ${branchCode}`);

            await AsyncStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));

            return data;
        } catch (e) {
            console.error(`[GradeHelper] Branch load error for ${branchCode}:`, e);
            const fallback = await AsyncStorage.getItem(cacheKey);
            return fallback ? JSON.parse(fallback).data : null;
        }
    }

}

export default new GradeHelper();
