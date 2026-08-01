import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_TIMEOUT = 10000;

class ApiService {

    constructor() {
        this.memoryCache = new Map();
    }

    getCached(path) {
        return this.memoryCache.get(path) || null;
    }

    async get(path, options = {}) {
        const { skipCache = false, ...reqOptions } = options;
        const cacheKey = `api_cache_${path}`;
        let cached = null;

        if (!skipCache) {
            try {

                if (this.memoryCache.has(path)) {
                    cached = { data: this.memoryCache.get(path) };
                }

                const raw = await AsyncStorage.getItem(cacheKey);
                if (raw) {
                    const diskCached = JSON.parse(raw);
                    cached = diskCached;

                    if (!this.memoryCache.has(path)) {
                        this.memoryCache.set(path, diskCached.data);
                    }
                }
            } catch (e) {
                console.warn('Cache read error:', e);
            }
        }

        const headers = reqOptions.headers || {};
        if (cached?.etag) {
            headers['If-None-Match'] = cached.etag;
        }

        try {
            const res = await this._request(path, {
                method: 'GET',
                ...reqOptions,
                headers,
                _returnFullResponse: true
            });

            if (res.status === 304) {
                console.log(`[API] ✅ Veri zaten güncel (304): ${path}`);
                if (!this.memoryCache.has(path) && cached?.data) {
                    this.memoryCache.set(path, cached.data);
                }
                return cached.data;
            }

            const { data, headers: resHeaders } = res;

            const newEtag = resHeaders.get('x-etag') || resHeaders.get('etag');

            if (newEtag && !skipCache) {
                console.log(`[API] 🔄 Veri güncellendi (200): ${path}`);

                this.memoryCache.set(path, data);

                AsyncStorage.setItem(cacheKey, JSON.stringify({
                    etag: newEtag,
                    data: data,
                    updatedAt: Date.now()
                })).catch(e => console.warn('Cache write error:', e));
            } else if (!skipCache) {
                console.log(`[API] Veri alındı (No ETag): ${path}`);
            }

            if (!newEtag && !skipCache) {
                this.memoryCache.set(path, data);
            }

            return data;
        } catch (error) {
            throw error;
        }
    }

    async post(path, body = null, options = {}) {
        const fetchOptions = { method: 'POST' };
        if (body) {
            fetchOptions.headers = { 'Content-Type': 'application/json' };
            fetchOptions.body = JSON.stringify(body);
        }
        return this._request(path, { ...fetchOptions, ...options });
    }

    async swr(path, callback, options = {}) {
        const cacheKey = `api_cache_${path}`;

        const memData = this.memoryCache.get(path);
        if (memData) {

            callback(memData, true);
        }

        if (!memData) {
            try {

                const raw = await AsyncStorage.getItem(cacheKey);
                if (raw) {
                    const cached = JSON.parse(raw);
                    if (cached.data) {

                        this.memoryCache.set(path, cached.data);
                        callback(cached.data, true);
                    }
                }
            } catch (e) {
                console.warn('[SWR] Cache read error:', e);
            }
        }

        try {

            const data = await this.get(path, options);

            callback(data, false);

        } catch (error) {
            console.warn(`[Background Sync] Update FAILED for ${path}:`, error);
        }
    }

    async checkUpdate(version) {
        try {
            const response = await fetch('https://raw.githubusercontent.com/pltmustafa/ITU-SuperApp/refs/heads/main/package.json');
            const remotePackage = await response.json();
            const latestVersion = remotePackage.version;
            const changelog = remotePackage.changelog || "Yeni bir güncelleme mevcut! GitHub üzerinden en son sürümü indirebilirsiniz.";
            const critical = remotePackage.critical || false;

            const isUpdateAvailable = latestVersion.localeCompare(version, undefined, { numeric: true, sensitivity: 'base' }) > 0;

            return {
                hasUpdate: isUpdateAvailable,
                latestVersion: latestVersion,
                changelog: changelog,
                critical: critical
            };
        } catch (error) {
            console.warn('[API] Versiyon kontrolü başarısız:', error.message);
            return { hasUpdate: false };
        }
    }

    async _request(path, options = {}) {
        const { timeout = DEFAULT_TIMEOUT, _returnFullResponse = false, ...fetchOptions } = options;
        const url = path;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
            });

            if (response.status === 304) {
                if (_returnFullResponse) {
                    return { status: 304 };
                }

                return null;
            }

            if (!response.ok) {
                throw new ApiError(
                    `HTTP ${response.status}`,
                    response.status,
                    path
                );
            }

            const data = await response.json();

            if (_returnFullResponse) {
                return {
                    data,
                    headers: response.headers,
                    status: response.status
                };
            }

            return data;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            if (error.name === 'AbortError') {
                throw new ApiError('İstek zaman aşımına uğradı', 0, path);
            }
            throw new ApiError(
                'Sunucuya bağlanılamadı',
                0,
                path,
                error
            );
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export class ApiError extends Error {
    constructor(message, statusCode = 0, path = '', originalError = null) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.path = path;
        this.originalError = originalError;
    }

    get isTimeout() {
        return this.message === 'İstek zaman aşımına uğradı';
    }

    get isNetworkError() {
        return this.statusCode === 0 && !this.isTimeout;
    }
}

const api = new ApiService();
export default api;
