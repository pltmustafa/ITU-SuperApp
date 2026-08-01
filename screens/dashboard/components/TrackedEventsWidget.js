import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../../constants/colors';

const TRACKED_EVENTS_KEY = '@tracked_calendar_events';

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

const daysBetween = (dateStr) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

const getEventStatus = (event) => {
    const daysToStart = daysBetween(event.startDate);
    const daysToEnd = daysBetween(event.endDate);

    if (daysToStart === null && daysToEnd === null) {
        return { text: '—', type: 'unknown', sortKey: 9999 };
    }

    if (daysToEnd !== null && daysToEnd < 0) {
        return { text: `${Math.abs(daysToEnd)} gün geçti`, type: 'past', sortKey: 10000 };
    }

    if (daysToStart !== null && daysToStart <= 0 && daysToEnd !== null && daysToEnd >= 0) {
        return { text: 'Devam Ediyor', type: 'active', sortKey: -1 };
    }

    const days = daysToStart !== null ? daysToStart : daysToEnd;
    if (days === 0) return { text: 'Bugün', type: 'today', sortKey: 0 };
    if (days === 1) return { text: 'Yarın', type: 'soon', sortKey: 1 };
    return { text: `${days} gün kaldı`, type: days <= 7 ? 'soon' : 'normal', sortKey: days };
};

const getStatusColor = (type) => {
    switch (type) {
        case 'active':
            return { text: colors.success, bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
        case 'today':
        case 'soon':
            return { text: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.2)' };
        case 'past':
            return { text: colors.danger, bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.2)' };
        default:
            return { text: colors.accent, bg: 'rgba(41, 121, 255, 0.15)', border: 'rgba(41, 121, 255, 0.2)' };
    }
};

export default function TrackedEventsWidget({ onPress }) {
    const [trackedEvents, setTrackedEvents] = useState([]);

    useFocusEffect(
        useCallback(() => {
            const loadTrackedEvents = async () => {
                try {
                    const data = await AsyncStorage.getItem(TRACKED_EVENTS_KEY);
                    if (!data) return;

                    let parsed = JSON.parse(data);
                    let needsUpdate = false;

                    parsed = parsed.map(event => {
                        if (!event.startDate && event.date) {
                            const { startDate, endDate } = parseDateRange(event.date);
                            if (startDate || endDate) {
                                needsUpdate = true;
                                return {
                                    ...event,
                                    startDate: startDate ? startDate.toISOString() : null,
                                    endDate: endDate ? endDate.toISOString() : null
                                };
                            }
                        }
                        return event;
                    });

                    const activeEvents = parsed.filter(event => {
                        const daysToEnd = daysBetween(event.endDate);
                        return daysToEnd === null || daysToEnd >= 0;
                    });

                    if (activeEvents.length !== parsed.length || needsUpdate) {
                        await AsyncStorage.setItem(TRACKED_EVENTS_KEY, JSON.stringify(activeEvents));
                    }

                    activeEvents.sort((a, b) => {
                        const statusA = getEventStatus(a);
                        const statusB = getEventStatus(b);
                        return statusA.sortKey - statusB.sortKey;
                    });

                    setTrackedEvents(activeEvents);
                } catch (e) {
                }
            };
            loadTrackedEvents();
        }, [])
    );

    if (trackedEvents.length === 0) {
        return null;
    }

    return (
        <TouchableOpacity style={styles.container} activeOpacity={0.8} onPress={onPress}>
            <View style={styles.header}>
                <MaterialCommunityIcons name="calendar-star" size={20} color={colors.accent} />
                <Text style={styles.title}>Takip Edilen Etkinlikler</Text>
            </View>
            
            <View style={styles.content}>
                {trackedEvents.map((event, index) => {
                    const isLast = index === trackedEvents.length - 1;
                    const status = getEventStatus(event);
                    const colorScheme = getStatusColor(status.type);

                    return (
                        <View key={index} style={[styles.eventRow, !isLast && styles.borderBottom]}>
                            <View style={styles.eventInfo}>
                                <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                                <View style={styles.dateBadge}>
                                    <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={colors.textSecondary} />
                                    <Text style={styles.eventDate}>{event.date}</Text>
                                </View>
                            </View>
                            <View style={[styles.remainingBadge, { backgroundColor: colorScheme.bg, borderColor: colorScheme.border }]}>
                                <Text style={[styles.eventRemaining, { color: colorScheme.text }]}>{status.text}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text
    },
    content: {
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 12,
        padding: 12
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10
    },
    borderBottom: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    eventInfo: {
        flex: 1,
        paddingRight: 10
    },
    eventTitle: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 6
    },
    dateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    eventDate: {
        fontSize: 11,
        color: colors.textSecondary
    },
    remainingBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1
    },
    eventRemaining: {
        fontSize: 11,
        fontWeight: 'bold'
    }
});
