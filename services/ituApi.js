import AsyncStorage from '@react-native-async-storage/async-storage';
import { btoa } from './base64';
import mailService from './mailService';

const BASE_URL = 'https://mobil.itu.edu.tr/v2/service/service.aspx';

const HEADERS = {
    'User-Agent': 'okhttp/4.12.0',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip',
};

const STORAGE_KEYS = {
    TOKEN: 'itu_token',
    USER_INFO: 'itu_user_info',
};

class ItuApi {
    constructor() {
        this.token = null;
        this.userInfo = null;
    }

    async loadStoredToken() {
        try {
            const [token, userInfoStr] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
                AsyncStorage.getItem(STORAGE_KEYS.USER_INFO),
            ]);
            if (token) {
                this.token = token;
                this.userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;
                this.securityId = '8ade2db68433b532';

                if (!this.userInfo || !this.userInfo.studentId || !this.userInfo.keplerToken) {
                    await this.logout();
                    return null;
                }

                return { token, userInfo: this.userInfo };
            }
        } catch (e) {
            console.warn('[ITU API] Token yükleme hatası:', e);
        }
        return null;
    }

    async login(username, password) {
        try {
            const encodedUsername = btoa(username);
            const encodedPassword = btoa(password);

            const params = new URLSearchParams({
                method: 'LoginSessionEncoded',
                OSType: '0',
                DeviceName: 'iPhone',
                Locale: 'tr',
                UserName: encodedUsername,
                DeviceModel: '4.2.0.101',
                Password: encodedPassword,
                SecurityId: '8ade2db68433b532',
            });

            const url = `${BASE_URL}?${params.toString()}`;
            const response = await fetch(url, { method: 'GET', headers: HEADERS });
            const data = await response.json();

            if (!data?.Session?.IsAuthenticated) {
                return {
                    success: false,
                    error: data?.Session?.Message || 'Giriş başarısız. Kullanıcı adı veya şifre hatalı.',
                };
            }

            const session = data.Session;

            this.token = session.Token || data.SessionId;

            this.securityId = '8ade2db68433b532';

            this.userInfo = {
                firstName: session.FirstName,
                lastName: session.LastName,
                email: session.ITUMail,
                studentId: session.ITUNumber,
                keplerToken: session.Token,
                photo: null
            };

            try {
                const photoRes = await this.request({ method: 'GetPersonPhotoV2' });
                if (photoRes && photoRes.Base64) {
                    this.userInfo.photo = photoRes.Base64;
                }
            } catch (e) {
                console.warn('[ITU API] Fotoğraf alınamadı:', e);
            }

            await Promise.all([
                AsyncStorage.setItem(STORAGE_KEYS.TOKEN, this.token),
                AsyncStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(this.userInfo)),
            ]);

            return { success: true, session: this.userInfo, token: this.token };
        } catch (error) {
            console.error('[ITU API] Login hatası:', error);
            return {
                success: false,
                error: 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.',
            };
        }
    }

    async request(params) {
        if (!this.token) {
            throw new Error('Token bulunamadı. Lütfen giriş yapın.');
        }

        const queryParams = new URLSearchParams({
            test: 'aka',
            SecurityId: this.securityId || '8ade2db68433b532',
            ...params,
            Token: this.token,
        });

        const url = `${BASE_URL}?${queryParams.toString()}`;
        const response = await fetch(url, { method: 'GET', headers: HEADERS });
        return response.json();
    }

    async logout() {
        this.token = null;
        this.userInfo = null;
        await Promise.all([
            AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
            AsyncStorage.removeItem(STORAGE_KEYS.USER_INFO),
        ]);
        try {
            await mailService.clearPassword();
        } catch (e) {
            console.warn('[ITU API] Mail şifresi temizlenirken hata oluştu:', e);
        }
    }

    get isLoggedIn() {
        return !!this.token;
    }
}

const ituApi = new ItuApi();
export default ituApi;
