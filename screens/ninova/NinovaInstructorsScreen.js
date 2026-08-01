import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import ituRehberService from '../../services/ituRehberService';

export default function NinovaInstructorsScreen({ route, navigation }) {
    const { courses } = route.params || { courses: [] };
    const [expandedCourse, setExpandedCourse] = useState(null);
    const [instructorsData, setInstructorsData] = useState({});
    const prefetchedData = useRef({});

    useEffect(() => {
        courses.forEach(async (course) => {
            const courseId = course.SinifId;
            try {
                const names = new Set();
                if (course.YetkiliAdi) {
                    course.YetkiliAdi.split('-').map(n => n.trim()).forEach(n => {
                        if (n && n.length > 3 && !n.toLowerCase().includes('havuz') && !n.toLowerCase().includes('bölümü')) {
                            names.add(n);
                        }
                    });
                }

                const uniqueNames = Array.from(names);
                const results = await Promise.all(
                    uniqueNames.map(async (name) => {
                        try {
                            const persons = await ituRehberService.searchPerson(name);
                            if (persons && persons.length > 0) {
                                const sortedPersons = [...persons].sort((a, b) => {
                                    const aIsStudent = a.PrimaryIdentityTypeName?.toLowerCase().includes('öğrenci');
                                    const bIsStudent = b.PrimaryIdentityTypeName?.toLowerCase().includes('öğrenci');
                                    if (aIsStudent && !bIsStudent) return 1;
                                    if (!aIsStudent && bIsStudent) return -1;
                                    return 0;
                                });
                                const p = sortedPersons[0];
                                const details = await ituRehberService.getPersonDetails(p.PublicObjectId);
                                const emailObj = details?.find(d => d.ContactTypeName === 'E-posta Adresi');
                                return {
                                    id: p.PublicObjectId,
                                    fullName: p.AcademicTitle ? `${p.AcademicTitle} ${p.Name} ${p.Surname}` : `${p.Name} ${p.Surname}`,
                                    unit: p.UnitName,
                                    email: emailObj ? emailObj.ContactValue : 'E-posta bulunamadı'
                                };
                            }
                        } catch (e) { }
                        return null;
                    })
                );

                const validResults = results.filter(r => r !== null);
                prefetchedData.current[courseId] = { data: validResults, error: false, done: true };

                setInstructorsData(prev => {
                    if (prev[courseId]?.waitingForData) {
                        return {
                            ...prev,
                            [courseId]: { loading: false, data: validResults, error: false }
                        };
                    }
                    return prev;
                });
            } catch (e) {
                prefetchedData.current[courseId] = { data: [], error: true, done: true };
                setInstructorsData(prev => {
                    if (prev[courseId]?.waitingForData) {
                        return {
                            ...prev,
                            [courseId]: { loading: false, data: [], error: true }
                        };
                    }
                    return prev;
                });
            }
        });
    }, [courses]);

    const toggleCourse = (course) => {
        const courseId = course.SinifId;

        if (expandedCourse === courseId) {
            setExpandedCourse(null);
            return;
        }

        setExpandedCourse(courseId);

        if (instructorsData[courseId]?.data) return;

        setInstructorsData(prev => ({ ...prev, [courseId]: { loading: true } }));

        setTimeout(() => {
            const cached = prefetchedData.current[courseId];
            if (cached && cached.done) {
                setInstructorsData(prev => ({
                    ...prev,
                    [courseId]: { loading: false, data: cached.data, error: cached.error }
                }));
            } else {
                setInstructorsData(prev => ({
                    ...prev,
                    [courseId]: { loading: true, waitingForData: true }
                }));
            }
        }, 500);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="account-multiple" size={24} color={colors.accent} />
                    <Text style={styles.title}>Öğretim Üyeleri</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {courses.map((course, idx) => {
                    const courseId = course.SinifId;
                    const isExpanded = expandedCourse === courseId;
                    const isFetching = instructorsData[courseId]?.loading;
                    const instList = instructorsData[courseId]?.data || [];
                    const error = instructorsData[courseId]?.error;

                    const isOtherExpanded = expandedCourse !== null && expandedCourse !== courseId;

                    return (
                        <View key={`${courseId}-${idx}`} style={[styles.courseContainer, isOtherExpanded && { opacity: 0.4 }]}>
                            <TouchableOpacity
                                style={[styles.courseCard, isExpanded && styles.activeCard]}
                                onPress={() => toggleCourse(course)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.courseIcon, isExpanded && styles.activeCourseIcon]}>
                                    <MaterialCommunityIcons
                                        name={isExpanded ? "school" : "school-outline"}
                                        size={26}
                                        color={isExpanded ? '#fff' : colors.accent}
                                    />
                                </View>
                                <View style={styles.courseHeaderMain}>
                                    <Text style={[styles.courseName, isExpanded && { color: colors.accent }]} numberOfLines={2}>
                                        {course.SinifAdi}
                                    </Text>
                                    <Text style={styles.courseSubtitle}>{course.DersKodu}</Text>
                                </View>
                                <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color={colors.muted} />
                            </TouchableOpacity>

                            {isExpanded && (
                                <View style={styles.expandedArea}>
                                    {isFetching ? (
                                        <View style={styles.centerView}>
                                            <ActivityIndicator size="small" color={colors.accent} />
                                            <Text style={styles.loadingText}>sorgulanıyor...</Text>
                                        </View>
                                    ) : error ? (
                                        <Text style={styles.errorText}>Eğitmenler yüklenirken hata oluştu.</Text>
                                    ) : instList.length > 0 ? (
                                        instList.map((inst, i) => (
                                            <View key={inst.id || i} style={styles.instructorCard}>
                                                <View style={styles.instructorAvatar}>
                                                    <MaterialCommunityIcons name="account-tie" size={26} color={colors.accent} />
                                                </View>
                                                <View style={styles.instructorInfo}>
                                                    <Text style={styles.instructorName}>{inst.fullName}</Text>
                                                    {inst.unit && <Text style={styles.instructorUnit} numberOfLines={1}>{inst.unit}</Text>}
                                                    <Text style={styles.instructorEmail} selectable>{inst.email}</Text>
                                                </View>
                                                {inst.email && inst.email !== 'E-posta bulunamadı' && (
                                                    <TouchableOpacity
                                                        style={styles.mailButton}
                                                        onPress={() => Linking.openURL(`mailto:${inst.email}`)}
                                                    >
                                                        <MaterialCommunityIcons name="send" size={20} color="#fff" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.emptyText}>Bu derse kayıtlı eğitmen bulunamadı.</Text>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border
    },
    headerBtn: { padding: 8, borderRadius: 12, backgroundColor: colors.card },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 20, fontWeight: 'bold', color: colors.text, textShadowColor: colors.accentGlow, textShadowRadius: 8 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    courseContainer: { marginBottom: 12 },
    courseCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
        padding: 16, borderRadius: 20,
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1, shadowRadius: 8, elevation: 2,
        zIndex: 2
    },
    activeCard: {
        borderColor: colors.border,
        backgroundColor: colors.card,
        shadowColor: colors.accent,
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    courseIcon: {
        width: 48, height: 48, borderRadius: 14,
        backgroundColor: `${colors.accent}15`,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 16
    },
    activeCourseIcon: {
        backgroundColor: colors.accent,
    },
    courseHeaderMain: { flex: 1, justifyContent: 'center' },
    courseName: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    courseSubtitle: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    expandedArea: {
        backgroundColor: colors.bg,
        marginTop: -20,
        paddingTop: 36,
        paddingHorizontal: 12,
        paddingBottom: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        borderWidth: 1, borderTopWidth: 0,
        borderColor: colors.border,
        zIndex: 1
    },
    centerView: { alignItems: 'center', marginVertical: 10 },
    loadingText: { color: colors.muted, marginTop: 8, fontSize: 13 },
    errorText: { color: colors.error, fontSize: 14, textAlign: 'center', marginVertical: 10 },
    emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 10 },
    instructorCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.card,
        padding: 14, borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1, borderColor: colors.border,
    },
    instructorAvatar: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: `${colors.accent}15`,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 14,
        borderWidth: 1, borderColor: `${colors.accent}30`
    },
    instructorInfo: { flex: 1, justifyContent: 'center' },
    instructorName: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
    instructorUnit: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
    instructorEmail: { color: colors.accent, fontSize: 13, fontWeight: '500' },
    mailButton: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: colors.accent,
        alignItems: 'center', justifyContent: 'center',
        marginLeft: 10,
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4
    }
});
