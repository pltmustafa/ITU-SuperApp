import AsyncStorage from '@react-native-async-storage/async-storage';
import mailService from './mailService';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0',
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'tr',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://portal.itu.edu.tr/apps/default/'
};

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};

class PortalApi {
    constructor() {
        this.authStates = {
            portal: false,
            obs: false,
            ninova: false
        };
        this.obsToken = null;
        this.obsTokenExpires = null;
        this.identityId = '3565f794-ce45-46b2-acb1-395ceec09968';
    }

    clearCache() {
        this.authStates = { portal: false, obs: false, ninova: false };
        this.obsToken = null;
        this.obsTokenExpires = null;
        console.log('[PortalApi] Bellekteki JWT ve oturum onbellekleri temizlendi.');
    }

    async getCredentials() {
        try {
            const userInfoStr = await AsyncStorage.getItem('itu_user_info');
            const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;
            const username = userInfo?.email ? userInfo.email.split('@')[0] : null;
            const password = await mailService.getSavedPassword();
            return { username, password };
        } catch (e) {
            console.error('[Portal API] Kimlik bilgileri alinamadi:', e);
            return { username: null, password: null };
        }
    }

    async baseGirisv3Login(currentURL) {
        console.log(`[PortalApi] baseGirisv3Login cagriliyor. Hedef: ${currentURL}`);
        const { username, password } = await this.getCredentials();

        if (!username || !password) {
            console.log('[PortalApi] Kimlik bilgileri bulunamadi.');
            return { success: false, error: 'Kullanıcı adı veya şifre bulunamadı.' };
        }

        const URL_GIRIS = `https://girisv3.itu.edu.tr/Login.aspx?currentURL=${encodeURIComponent(currentURL)}`;
        console.log(`[PortalApi] 1. Giris yapilacak URL: ${URL_GIRIS}`);
        const req1 = await fetch(URL_GIRIS, { headers: DEFAULT_HEADERS });

        console.log(`[PortalApi] 1. İstek tamamlandı. Durum Kodu: ${req1.status}, Ulaştığı URL: ${req1.url}`);

        if (!req1.url.includes('girisv3.itu.edu.tr/Login.aspx')) {
            console.log(`[PortalApi] Zaten giriş yapılmış (SSO aktif). Gidilen adres: ${req1.url}`);
            return { success: true, initialResponse: req1 };
        }

        const html = await req1.text();
        const actionMatch = html.match(/action="([^"]+)"/);
        if (!actionMatch) {
            console.log('[PortalApi] HATA: action attribute bulunamadi HTML icinde.');
            return { success: false, error: 'Giriş formu bulunamadı.' };
        }

        let rawAction = actionMatch[1].replace(/&amp;/g, '&');
        let postUrl = (rawAction === './' || rawAction === '') ? req1.url : `https://girisv3.itu.edu.tr/${rawAction.replace('./', '')}`;
        console.log(`[PortalApi] 2. Form POST edilecek URL: ${postUrl}`);

        const inputMatches = [...html.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/g)];
        const inputMatches2 = [...html.matchAll(/<input[^>]+value="([^"]*)"[^>]+name="([^"]+)"/g)];

        const data = {};
        inputMatches.forEach(m => { if (m[1].startsWith('__') || m[1].includes('ctl00')) data[m[1]] = m[2]; });
        inputMatches2.forEach(m => { if (m[2].startsWith('__') || m[2].includes('ctl00')) data[m[2]] = m[1]; });

        data["ctl00$ContentPlaceHolder1$tbUserName"] = username;
        data["ctl00$ContentPlaceHolder1$tbPassword"] = password;
        data["ctl00$ContentPlaceHolder1$btnLogin"] = "Giriş / Login";

        const formData = new URLSearchParams();
        Object.keys(data).forEach(k => formData.append(k, data[k]));

        console.log('[PortalApi] 3. POST isteği gönderiliyor...');
        const req2 = await fetch(postUrl, {
            method: 'POST',
            headers: {
                ...DEFAULT_HEADERS,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': 'cookieAdded=true'
            },
            body: formData.toString()
        });

        console.log(`[PortalApi] 3. POST tamamlandı. Durum Kodu: ${req2.status}, Yönlendirilen URL: ${req2.url}`);

        if (req2.url.includes('girisv3')) {
            console.log('[PortalApi] HATA: Login başarısız oldu (girisv3 de kaldi).');
            return { success: false, error: 'Giriş başarısız. Kullanıcı adı veya şifre hatalı olabilir.' };
        }

        return { success: true, initialResponse: req2 };
    }

    async login(target = 'portal') {
        try {
            if (this.authStates[target]) {
                return { success: true, message: 'Zaten giriş yapılmış.' };
            }

            if (target === 'portal') {
                const res = await this.baseGirisv3Login('https://portal.itu.edu.tr/apps/default/');
                if (!res.success) return res;
                this.authStates.portal = true;
                return { success: true, message: 'Portal girişi başarılı.' };
            }
            else if (target === 'obs') {
                console.log('[PortalApi] OBS Login baslatiliyor...');

                const res = await this.baseGirisv3Login('https://obs.itu.edu.tr/login/auth');
                if (!res.success) return res;

                let finalIdentityId = this.identityId || "3565f794-ce45-46b2-acb1-395ceec09968";

                let authUrl = `https://obs.itu.edu.tr/login/SetIdentity?id=${finalIdentityId}&returnURL=/&yetkiAnahtari=ogrenci`;
                console.log(`[PortalApi] SetIdentity atiliyor: ${authUrl}`);
                let authRes = await fetch(authUrl, { headers: DEFAULT_HEADERS });
                console.log(`[PortalApi] SetIdentity tamamlandi, durum: ${authRes.status}, URL: ${authRes.url}`);

                if (authRes.url.includes('SelectIdentity')) {
                    console.log("[PortalApi] ⚠️ Kimlik ID geçersiz, auth rotasından yeni ID yakalanıyor...");
                    const r_auth = await fetch('https://obs.itu.edu.tr/login/auth', { headers: DEFAULT_HEADERS });
                    const match = r_auth.url.match(/id=([a-f0-9-]{36})/i);
                    if (match) {
                        finalIdentityId = match[1];
                        this.identityId = finalIdentityId;
                        console.log(`[PortalApi] Yeni Identity bulundu: ${finalIdentityId}`);
                        authUrl = `https://obs.itu.edu.tr/login/SetIdentity?id=${finalIdentityId}&returnURL=/&yetkiAnahtari=ogrenci`;
                        authRes = await fetch(authUrl, { headers: DEFAULT_HEADERS });
                        console.log(`[PortalApi] Yeni ID ile SetIdentity tamamlandi, URL: ${authRes.url}`);
                    }
                }

                console.log('[PortalApi] JWT Token isteniyor...');
                const tokenRes = await fetch('https://obs.itu.edu.tr/ogrenci/auth/jwt', { headers: DEFAULT_HEADERS });
                const tokenText = await tokenRes.text();

                console.log(`[PortalApi] Token API durumu: ${tokenRes.status}, yanit (ilk 50 karakter): ${tokenText.substring(0, 50)}`);

                if (tokenRes.ok && tokenText.includes('eyJ')) {
                    this.obsToken = tokenText.replace(/"/g, '').trim();
                    this.authStates.obs = true;
                    console.log('[PortalApi] OBS Token basariyla alindi. Dinamik sureli.');
                    return { success: true, message: 'OBS Token alındı.' };
                } else {
                    console.log('[PortalApi] OBS Token alinamadi.');
                    return { success: false, error: 'OBS Token alınamadı.' };
                }
            }
            else if (target === 'ninova') {
                const res = await this.baseGirisv3Login('https://ninova.itu.edu.tr/Kampus/Giris');
                if (!res.success) return res;
                this.authStates.ninova = true;
                return { success: true, message: 'Ninova oturumu kuruldu.' };
            }

            return { success: false, error: 'Bilinmeyen target: ' + target };

        } catch (error) {
            console.error(`[Portal API] Login (${target}) hatasi:`, error);
            return { success: false, error: error.message };
        }
    }

    async ensureObsToken(force = false) {
        if (force) {
            console.log('[PortalApi] OBS Token yenilemeye zorlandi (force=true).');
            this.authStates.obs = false;
            this.obsToken = null;
        }

        if (!this.authStates.obs || !this.obsToken) {
            const res = await this.login('obs');
            if (!res.success) throw new Error(res.error);
        }
        return this.obsToken;
    }

    async obsRequest(url, options = {}) {
        let token = await this.ensureObsToken();

        const makeRequest = (t) => fetch(url, {
            ...options,
            headers: {
                ...DEFAULT_HEADERS,
                'Authorization': `Bearer ${t}`,
                ...(options.headers || {})
            }
        });

        let response = await makeRequest(token);

        if (response.status === 401 || response.status === 403) {
            console.log(`[PortalApi] OBS Request ${response.status} aldi, token yenileniyor...`);
            token = await this.ensureObsToken(true); // FORCE
            response = await makeRequest(token);
        }

        return response;
    }

    async ensureNinovaSession(force = false) {
        if (force) this.authStates.ninova = false;
        if (!this.authStates.ninova) {
            const res = await this.login('ninova');
            if (!res.success) throw new Error(res.error);
        }
    }

    async request(endpoint, options = {}) {
        if (!this.authStates.portal) {
            const loginRes = await this.login('portal');
            if (!loginRes.success) {
                throw new Error(loginRes.error);
            }
        }

        const url = `https://portal.itu.edu.tr/apps/default/service/service.aspx/${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                ...HEADERS,
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return response.json();
    }

    async getYardimBiletleri() {
        const data = await this.request('GetYardim', { method: 'GET' });
        return data;
    }
}

const portalApi = new PortalApi();
export default portalApi;
