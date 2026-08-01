import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ituApi from './ituApi';
import obsApi from './obsApi';
import notificationApi from './notificationApi';

const BACKGROUND_FETCH_TASK = 'background-obs-grades-fetch';
const BG_GRADE_CACHE_PREFIX = 'bg_obs_grades_';
const LETTER_CACHE_PREFIX = 'obs_letters_';
const NOTIFICATION_CACHE_KEY = 'general_notifications_cache';

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

export async function executeGradeCheckTask() {
    try {
        console.log('[BackgroundTask] Arkaplan not kontrolü başlatıldı.');


        await ituApi.loadStoredToken();
        if (!ituApi.token || !ituApi.userInfo?.studentId || !ituApi.userInfo?.keplerToken) {
            console.log('[BackgroundTask] Kullanıcı girişi yapılamadı, durduruluyor.');
            return BackgroundTask.BackgroundTaskResult.Success;
        }

        let hasNewUpdates = false;

        try {
            const freshNotifications = await notificationApi.getNotifications(0);
            if (freshNotifications && freshNotifications.length > 0) {
                const cachedNotifsRaw = await AsyncStorage.getItem(NOTIFICATION_CACHE_KEY);
                const cachedNotifs = cachedNotifsRaw ? JSON.parse(cachedNotifsRaw) : [];

                const getNotifId = (n) => n.NotificationId || n.Id || n.Url || (n.Title + n.CreateDate);
                const cachedIdentifiers = cachedNotifs.map(getNotifId);

                const newlyAnnouncedNotifs = freshNotifications.filter(n => {
                    return !cachedIdentifiers.includes(getNotifId(n));
                });

                if (newlyAnnouncedNotifs.length > 0) {
                    hasNewUpdates = true;

                    if (cachedNotifs.length > 0) {
                        const notifPromises = newlyAnnouncedNotifs.map(ann => 
                            Notifications.scheduleNotificationAsync({
                                content: {
                                    title: ann.Title || 'Yeni İTÜ Bildirimi',
                                    body: ann.SummaryText || 'Detaylar için uygulamayı açın.',
                                    sound: true,
                                },
                                trigger: null,
                            })
                        );
                        await Promise.allSettled(notifPromises);
                    }
                    await AsyncStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(freshNotifications));
                }
            }
        } catch (e) {
            console.error(`[BackgroundTask] Genel bildirimler okunurken hata:`, e);
        }

        const donemlerRes = await obsApi.fetchKepler('DonemListesi');

        if (!donemlerRes?.ogrenciDonemListesi?.length) {
            return BackgroundTask.BackgroundTaskResult.Success;
        }

        const activeTerm = findCurrentTerm(donemlerRes.ogrenciDonemListesi);
        if (!activeTerm) {
            return BackgroundTask.BackgroundTaskResult.Success;
        }

        const classesRes = await obsApi.fetchKepler(`sinif/KayitliSinifListesi/${activeTerm.akademikDonemId}`);
        if (!classesRes?.kayitSinifResultList) {
            return BackgroundTask.BackgroundTaskResult.Success;
        }

        const classMap = {};
        classesRes.kayitSinifResultList.forEach(c => {
            classMap[c.crn] = `${c.bransKodu} ${c.dersKodu}`;
        });

        try {
            const lettersRes = await obsApi.fetchKepler(`sinif/SinifHarfNotuListesi/${activeTerm.akademikDonemId}`);
            if (lettersRes?.sinifHarfNotuResultList) {
                const freshLetters = lettersRes.sinifHarfNotuResultList;
                const cachedLettersRaw = await AsyncStorage.getItem(LETTER_CACHE_PREFIX + activeTerm.akademikDonemId);
                const cachedLetters = cachedLettersRaw ? JSON.parse(cachedLettersRaw) : [];

                const newlyAnnouncedLetters = freshLetters.filter(f => {

                    if (!f.harfNotu || f.harfNotu.trim() === '') return false;

                    const cItem = cachedLetters.find(old => old.crn === f.crn);

                    if (!cItem) return true;
                    if ((!cItem.harfNotu || cItem.harfNotu.trim() === '') && f.harfNotu.trim() !== '') return true;

                    return false;
                });

                if (newlyAnnouncedLetters.length > 0) {
                    hasNewUpdates = true;
                    const notifPromises = newlyAnnouncedLetters.map(ann => {
                        const cName = classMap[ann.crn] || `Ders (CRN: ${ann.crn})`;
                        return Notifications.scheduleNotificationAsync({
                            content: {
                                title: 'Harf Notu Açıklandı',
                                body: `${cName}: ${ann.harfNotu}`,
                                sound: true,
                            },
                            trigger: null,
                        });
                    });
                    await Promise.allSettled(notifPromises);
                }

                await AsyncStorage.setItem(LETTER_CACHE_PREFIX + activeTerm.akademikDonemId, JSON.stringify(freshLetters));
            }
        } catch (e) {
            console.error(`[BackgroundTask] Harf notu listesi okunurken hata:`, e);
        }

        const gradePromises = classesRes.kayitSinifResultList.map(async (c) => {
            const sid = c.sinifId || c.dersSinifId || c.SinifId || c.DersSinifId;
            const courseCode = `${c.bransKodu} ${c.dersKodu}`;

            try {
                const freshData = await obsApi.fetchKepler(`sinif/SinifDonemIciNotListesi/${sid}`);
                if (!freshData || !freshData.sinifDonemIciNotListesi) return;

                const cachedRaw = await AsyncStorage.getItem(BG_GRADE_CACHE_PREFIX + sid);

                if (cachedRaw) {
                    const cachedData = JSON.parse(cachedRaw);

                    const flatFresh = freshData.sinifDonemIciNotListesi || [];
                    const flatCached = cachedData.sinifDonemIciNotListesi || [];

                    const newlyAnnounced = flatFresh.filter(f => {
                        const fScore = f.not ?? f.puan;
                        if (!f.ilanEdilmeDurumu || fScore === null || fScore === undefined) return false;
                        
                        const cItem = flatCached.find(oldItem => 
                            (oldItem.degerlendirmeOlcutuAdi === f.degerlendirmeOlcutuAdi) || 
                            (oldItem.kisaAciklama && oldItem.kisaAciklama === f.kisaAciklama)
                        );
                        if (!cItem) return true;

                        const cScore = cItem.not ?? cItem.puan;
                        if ((cScore === null || cScore === undefined) && (fScore !== null && fScore !== undefined)) return true;
                        if (!cItem.ilanEdilmeDurumu && f.ilanEdilmeDurumu) return true;
                        return false;
                    });

                    if (newlyAnnounced.length > 0) {
                        hasNewUpdates = true;
                        const notifPromises = newlyAnnounced.map(ann => {
                            const score = ann.not ?? ann.puan;
                            const name = ann.degerlendirmeOlcutuAdi || ann.kisaAciklama || 'Değerlendirme';
                            return Notifications.scheduleNotificationAsync({
                                content: {
                                    title: 'Yeni Not Açıklandı',
                                    body: `${courseCode} ${name}: ${score}`,
                                    sound: true,
                                },
                                trigger: null,
                            });
                        });
                        await Promise.allSettled(notifPromises);
                    }
                }

                await AsyncStorage.setItem(BG_GRADE_CACHE_PREFIX + sid, JSON.stringify(freshData));
            } catch (e) {
                console.error(`[BackgroundTask] ${sid} dersi okunurken hata:`, e);
            }
        });

        await Promise.allSettled(gradePromises);

        if (hasNewUpdates) {
            console.log('[BackgroundTask] Yeni not bulundu ve bildirim atıldı.');
            return BackgroundTask.BackgroundTaskResult.Success;
        } else {
            return BackgroundTask.BackgroundTaskResult.Success;
        }

    } catch (error) {
        console.error('[BackgroundTask] Görev hatası:', error);
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
}

TaskManager.defineTask(BACKGROUND_FETCH_TASK, executeGradeCheckTask);

export async function registerBackgroundFetchAsync() {
    return BackgroundTask.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15,
    });
}

export async function unregisterBackgroundFetchAsync() {
    return BackgroundTask.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}
