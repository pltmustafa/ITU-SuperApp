import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Platform, StatusBar, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';

const CACHE_KEY = '@academic_calendar_data';
const TRACKED_EVENTS_KEY = '@tracked_calendar_events';

export default function AcademicCalendarScreen({ navigation }) {
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [showPast, setShowPast] = useState(false);
    const [trackedEvents, setTrackedEvents] = useState([]);
    const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '', type: 'info', onConfirm: null, confirmText: 'Tamam', cancelText: 'İptal' });

    const showAlert = (title, message, type = 'info', onConfirm = null, confirmText = 'Tamam', cancelText = 'İptal') => {
        setCustomAlert({ visible: true, title, message, type, onConfirm, confirmText, cancelText });
    };

    const hideAlert = () => setCustomAlert(prev => ({ ...prev, visible: false }));

    const hasPastEvents = useMemo(() => {
        return sections.some(sec => sec.data.some(item => item.remaining.toLowerCase().includes('geçti')));
    }, [sections]);

    const visibleSections = useMemo(() => {
        if (showPast) return sections;
        return sections.map(sec => ({
            ...sec,
            data: sec.data.filter(item => !item.remaining.toLowerCase().includes('geçti'))
        })).filter(sec => sec.data.length > 0);
    }, [sections, showPast]);

    useEffect(() => {
        loadCachedData();
    }, []);

    const loadCachedData = async () => {
        let hasCache = false;
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                setSections(JSON.parse(cached));
                setLoading(false);
                hasCache = true;
            }
            const tracked = await AsyncStorage.getItem(TRACKED_EVENTS_KEY);
            if (tracked) {
                setTrackedEvents(JSON.parse(tracked));
            }
        } catch (e) {
        }

        fetchCalendarData(false, hasCache);
    };

    const fetchCalendarData = async (isManualRefresh = false, hasCache = false) => {
        if (isManualRefresh) {
            setRefreshing(true);
        } else if (!hasCache) {
            setLoading(true);
        }

        try {
            setError(null);
            const response = await fetch('https://www.takvim.sis.itu.edu.tr/AkademikTakvim/TR/akademik-takvim/AkademikTakvimTablo.php', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                }
            });
            const html = await response.text();

            const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
            if (!tableMatch) {
                if (sections.length === 0) setError("Takvim verisi bulunamadı.");
                return;
            }

            const tbodyMatch = tableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
            const rowsStr = tbodyMatch ? tbodyMatch[1] : tableMatch[1];

            const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
            let match;
            let currentTerm = "Genel";
            const eventsByTerm = {};

            while ((match = rowRegex.exec(rowsStr)) !== null) {
                const rowHtml = match[1];

                if (rowHtml.includes('tablo-baslik')) {
                    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
                    const tdMatches = [];
                    let tdMatch;
                    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
                        tdMatches.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
                    }
                    if (tdMatches.length > 0) {
                        currentTerm = tdMatches[0];
                        if (!eventsByTerm[currentTerm]) {
                            eventsByTerm[currentTerm] = [];
                        }
                    }
                } else {
                    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
                    const tdMatches = [];
                    let tdMatch;
                    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
                        let cleanStr = tdMatch[1].replace(/<[^>]+>/g, '').trim();
                        cleanStr = cleanStr.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
                        tdMatches.push(cleanStr);
                    }

                    if (tdMatches.length >= 3) {
                        if (!eventsByTerm[currentTerm]) {
                            eventsByTerm[currentTerm] = [];
                        }
                        eventsByTerm[currentTerm].push({
                            title: tdMatches[0],
                            date: tdMatches[1],
                            remaining: tdMatches[2]
                        });
                    }
                }
            }

            const parsedSections = Object.keys(eventsByTerm).map(key => ({
                title: key,
                data: eventsByTerm[key]
            }));

            setSections(parsedSections);
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsedSections));
        } catch (err) {
            if (sections.length === 0) setError("Takvim yüklenirken bir hata oluştu.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getRemainingStyle = (text) => {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('geçti')) {
            return { color: colors.danger, icon: 'history', bg: 'rgba(239, 68, 68, 0.1)' };
        }
        if (lowerText.includes('kaldı')) {
            const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num <= 7) {
                return { color: '#fb923c', icon: 'timer-sand', bg: 'rgba(251, 146, 60, 0.1)' };
            }
            return { color: colors.success, icon: 'check-circle-outline', bg: 'rgba(16, 185, 129, 0.1)' };
        }
        return { color: colors.accent, icon: 'calendar-clock-outline', bg: 'rgba(41, 121, 255, 0.1)' };
    };

    const TURKISH_MONTHS = {
        'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
        'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
    };

    const parseDateRange = (dateStr) => {
        const regex = /(\d{1,2})\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+(\d{4})/gi;
        const allMatches = [];
        let m;
        while ((m = regex.exec(dateStr)) !== null) {
            allMatches.push({
                day: parseInt(m[1], 10),
                month: TURKISH_MONTHS[m[2].toLowerCase()],
                year: parseInt(m[3], 10)
            });
        }

        if (allMatches.length === 0) return { startDate: null, endDate: null };

        const lastMatch = allMatches[allMatches.length - 1];
        const endDate = new Date(lastMatch.year, lastMatch.month, lastMatch.day);

        let startDate;

        if (allMatches.length >= 2) {
            const firstMatch = allMatches[0];
            startDate = new Date(firstMatch.year, firstMatch.month, firstMatch.day);
        } else if (dateStr.includes('-')) {
            const parts = dateStr.split(/\s*-\s*/);
            const firstPart = parts[0].trim();
            const dayMatch = firstPart.match(/(\d{1,2})/);
            if (dayMatch) {
                const day = parseInt(dayMatch[1], 10);
                const monthRegex = /(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)/gi;
                const monthMatch = monthRegex.exec(firstPart);
                const month = monthMatch ? TURKISH_MONTHS[monthMatch[1].toLowerCase()] : lastMatch.month;
                startDate = new Date(lastMatch.year, month, day);
            } else {
                startDate = endDate;
            }
        } else {
            startDate = endDate;
        }

        return { startDate, endDate };
    };

    const handleEventPress = (item) => {
        if (item.remaining.toLowerCase().includes('geçti')) return;

        const isTracked = trackedEvents.some(e => e.title === item.title && e.date === item.date);

        if (isTracked) {
            showAlert(
                "Takibi Bırak",
                "Bu etkinliği takip listesinden çıkarmak istiyor musunuz?",
                "danger",
                async () => {
                    const newTracked = trackedEvents.filter(e => !(e.title === item.title && e.date === item.date));
                    setTrackedEvents(newTracked);
                    await AsyncStorage.setItem(TRACKED_EVENTS_KEY, JSON.stringify(newTracked));
                },
                "Çıkar",
                "İptal"
            );
        } else {
            const { startDate, endDate } = parseDateRange(item.date);
            showAlert(
                "Etkinliği Takip Et",
                "Bu etkinliği ana ekranda widget olarak görmek istiyor musunuz?",
                "success",
                async () => {
                    const newEvent = {
                        title: item.title,
                        date: item.date,
                        startDate: startDate ? startDate.toISOString() : null,
                        endDate: endDate ? endDate.toISOString() : null
                    };
                    const newTracked = [...trackedEvents, newEvent];
                    setTrackedEvents(newTracked);
                    await AsyncStorage.setItem(TRACKED_EVENTS_KEY, JSON.stringify(newTracked));
                },
                "Takip Et",
                "İptal"
            );
        }
    };

    const renderItem = ({ item }) => {
        const remainingStyle = getRemainingStyle(item.remaining);
        const isTracked = trackedEvents.some(e => e.title === item.title && e.date === item.date);

        return (
            <TouchableOpacity
                style={[styles.eventCard, isTracked && { borderColor: colors.success, borderWidth: 1.5 }]}
                activeOpacity={0.7}
                onPress={() => handleEventPress(item)}
            >
                <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                    <View style={styles.dateRow}>
                        <View style={styles.dateBadge}>
                            <MaterialCommunityIcons name="calendar-blank-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.eventDate}>{item.date}</Text>
                        </View>
                        <View style={[styles.remainingBadge, { backgroundColor: remainingStyle.bg }]}>
                            <MaterialCommunityIcons name={remainingStyle.icon} size={14} color={remainingStyle.color} />
                            <Text style={[styles.eventRemaining, { color: remainingStyle.color }]}>{item.remaining}</Text>
                        </View>
                    </View>
                </View>
                {isTracked && (
                    <MaterialCommunityIcons name="bookmark-check" size={24} color={colors.success} style={{ position: 'absolute', top: 10, right: 10 }} />
                )}
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = ({ section: { title } }) => (
        <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Akademik Takvim</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading && sections.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Takvim Yükleniyor...</Text>
                </View>
            ) : error && sections.length === 0 ? (
                <View style={styles.centerContainer}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={56} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchCalendarData(false)}>
                        <Text style={styles.retryBtnText}>Tekrar Dene</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <SectionList
                        sections={visibleSections}
                        keyExtractor={(item, index) => item.title + index}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        contentContainerStyle={styles.listContent}
                        stickySectionHeadersEnabled={false}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={15}
                        maxToRenderPerBatch={10}
                        windowSize={10}
                        removeClippedSubviews={true}
                        ListHeaderComponent={
                            !showPast && hasPastEvents ? (
                                <TouchableOpacity
                                    style={styles.pastEventsBtn}
                                    onPress={() => setShowPast(true)}
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons name="history" size={20} color={colors.textSecondary} />
                                    <Text style={styles.pastEventsText}>Geçmiş Etkinlikleri Göster</Text>
                                </TouchableOpacity>
                            ) : null
                        }
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => fetchCalendarData(true)}
                                tintColor={colors.accent}
                                colors={[colors.accent]}
                            />
                        }
                    />
                </View>
            )}

            <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={hideAlert}>
                <View style={styles.alertOverlay}>
                    <View style={styles.alertBox}>
                        <Text style={styles.alertTitle}>{customAlert.title}</Text>
                        <Text style={styles.alertMessage}>{customAlert.message}</Text>

                        <View style={styles.alertButtons}>
                            {customAlert.onConfirm ? (
                                <>
                                    <TouchableOpacity style={[styles.alertBtn, styles.alertBtnCancel]} onPress={hideAlert}>
                                        <Text style={styles.alertBtnCancelText}>{customAlert.cancelText}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.alertBtn, { backgroundColor: customAlert.type === 'danger' ? colors.danger : colors.accent }]} onPress={() => { hideAlert(); customAlert.onConfirm(); }}>
                                        <Text style={styles.alertBtnConfirmText}>{customAlert.confirmText}</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: colors.cardHover, flex: 1 }]} onPress={hideAlert}>
                                    <Text style={[styles.alertBtnConfirmText, { color: colors.text }]}>{customAlert.confirmText}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: Platform.OS === 'android' ? 30 : 0
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    headerBtn: {
        padding: 10,
        borderRadius: 14,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        textShadowColor: colors.accentGlow,
        textShadowRadius: 8
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    loadingText: {
        marginTop: 16,
        color: colors.textSecondary,
        fontSize: 16,
        fontWeight: '600'
    },
    errorText: {
        marginTop: 16,
        color: colors.danger,
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '500'
    },
    retryBtn: {
        marginTop: 24,
        paddingHorizontal: 28,
        paddingVertical: 14,
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border
    },
    retryBtnText: {
        color: colors.text,
        fontWeight: 'bold',
        fontSize: 16
    },
    listContent: {
        padding: 16,
        paddingBottom: 40
    },
    sectionHeaderContainer: {
        marginTop: 16,
        marginBottom: 10,
        paddingLeft: 4
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    eventCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center'
    },
    eventInfo: {
        flex: 1
    },
    eventTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 10,
        lineHeight: 20
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap'
    },
    dateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    eventDate: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500'
    },
    remainingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    eventRemaining: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    pastEventsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.cardHover,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 10,
        borderStyle: 'dashed'
    },
    pastEventsText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.textSecondary
    },
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    alertBox: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    alertTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    alertMessage: {
        fontSize: 14,
        color: colors.muted,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    alertButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    alertBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertBtnCancel: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border,
    },
    alertBtnCancelText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
    },
    alertBtnConfirmText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    }
});
