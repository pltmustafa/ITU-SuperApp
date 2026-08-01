import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

class PushService {
    fcmToken = null;
    _unsubscribeMessage = null;


    async getFCMToken() {
        try {
            const messaging = (await import('@react-native-firebase/messaging')).default;

            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (!enabled) {
                console.log('[PushService] Bildirim izni reddedildi');
                return null;
            }

            const token = await messaging().getToken();

            this.fcmToken = token;
            console.log('[PushService] ✅ Firebase Token alındı:', token.substring(0, 30) + '...');
            return token;
        } catch (error) {
            console.error('[PushService] ❌ FCM Token hatası:', error);
            return null;
        }
    }


    setupForegroundListener() {
        if (this._unsubscribeMessage) return;

        import('@react-native-firebase/messaging').then(({ default: messaging }) => {
            this._unsubscribeMessage = messaging().onMessage(async remoteMessage => {
                console.log('[PushService] 📬 Foreground push alındı:', remoteMessage);

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: remoteMessage.notification?.title || 'Bildirim',
                        body: remoteMessage.notification?.body || 'Detaylar için uygulamayı açın.',
                        sound: true,
                        data: remoteMessage.data || {},
                    },
                    trigger: null,
                });
            });
        });
    }


    async initialize() {
        if (Platform.OS !== 'android') {
            console.log('[PushService] iOS\'ta FCM push desteklenmiyor, atlanıyor.');
            return;
        }

        console.log('[PushService] 🚀 Push notification servisi başlatılıyor...');

        const token = await this.getFCMToken();
        if (token) {
            this.setupForegroundListener();
            console.log('[PushService] ✅ Push notification servisi hazır.');
        } else {
            console.warn('[PushService] ⚠️ FCM token alınamadı, push notification çalışmayacak.');
        }
    }


    cleanup() {
        if (this._unsubscribeMessage) {
            this._unsubscribeMessage();
            this._unsubscribeMessage = null;
        }
        this.fcmToken = null;
    }
}

export default new PushService();
