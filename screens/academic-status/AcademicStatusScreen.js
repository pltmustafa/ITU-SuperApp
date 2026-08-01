import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useObsStore } from '../../store/useObsStore';

export default function AcademicStatusScreen({ navigation }) {
    const { academicStats, graduationDataTimestamp, terms } = useObsStore();
    const [isLoading, setIsLoading] = useState(!academicStats || academicStats.length === 0);
    const [selectedTermForGrades, setSelectedTermForGrades] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeChartType, setActiveChartType] = useState('cgpa');

    useEffect(() => {
        if (academicStats && academicStats.length > 0) {
            setIsLoading(false);
        } else {
            fetchFailsafe();
        }
    }, [academicStats]);

    const fetchFailsafe = async () => {
        setIsLoading(true);
        const { fetchGraduationData } = useObsStore.getState();
        await fetchGraduationData();
        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.loadingText}>Akademik Veriler Yükleniyor...</Text>
            </SafeAreaView>
        );
    }

    if (!academicStats || academicStats.length === 0) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.muted} />
                <Text style={styles.emptyText}>Dönem verileriniz bulunamadı.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchFailsafe}>
                    <Text style={styles.retryText}>Tekrar Dene</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const sortedStats = [...academicStats]
        .filter(term => term.genelNotOrtalamasi > 0 || term.donemlikNotOrtalamasi > 0 || term.verilenKredi > 0)
        .sort((a, b) => {
            return parseInt(b.akademikDonemKodu) - parseInt(a.akademikDonemKodu);
        });

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dönemsel İstatistik</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* GPA Chart Section */}
                <View style={styles.chartSection}>
                    <View style={styles.chartHeader}>
                        <Text style={styles.sectionTitle}>Akademik Gelişim</Text>
                        <View style={styles.legendRow}>
                            <TouchableOpacity
                                style={[
                                    styles.legendItem,
                                    activeChartType === 'term' ? { borderColor: colors.warning, backgroundColor: colors.warning + '15' } : { opacity: 1 }
                                ]}
                                onPress={() => setActiveChartType('term')}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                                <Text style={[styles.legendText, activeChartType === 'term' && { color: colors.warning, fontWeight: 'bold' }]}>Dönem</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.legendItem,
                                    activeChartType === 'cgpa' ? { borderColor: colors.accent, backgroundColor: colors.accent + '15' } : { opacity: 0.8 }
                                ]}
                                onPress={() => setActiveChartType('cgpa')}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                                <Text style={[styles.legendText, activeChartType === 'cgpa' && { color: colors.accent, fontWeight: 'bold' }]}>Genel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
                        {(() => {
                            const chartData = [...sortedStats].reverse();
                            const stepX = 75;
                            const chartHeight = 120;
                            const paddingTop = 25;

                            const points = chartData.map((term, i) => {
                                return {
                                    x: i * stepX + (stepX / 2),
                                    cgpaY: chartHeight - (term.genelNotOrtalamasi / 4.0) * chartHeight + paddingTop,
                                    termY: chartHeight - (term.donemlikNotOrtalamasi / 4.0) * chartHeight + paddingTop,
                                    term,
                                };
                            });

                            return (
                                <View style={{ width: points.length * stepX, height: chartHeight + paddingTop + 50 }}>

                                    {[0, 1, 2, 3, 4].map(val => (
                                        <View key={'grid_' + val} style={{
                                            position: 'absolute',
                                            top: chartHeight - (val / 4.0) * chartHeight + paddingTop,
                                            left: 0,
                                            right: 0,
                                            height: 1,
                                            backgroundColor: 'rgba(255,255,255,0.05)'
                                        }} />
                                    ))}

                                    {/* Lines Layer */}
                                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, elevation: 1 }}>
                                        {points.map((pt, i) => {
                                            if (i === points.length - 1) return null;
                                            const nextPt = points[i + 1];

                                            const dxCGPA = nextPt.x - pt.x;
                                            const dyCGPA = nextPt.cgpaY - pt.cgpaY;
                                            const widthCGPA = Math.sqrt(dxCGPA * dxCGPA + dyCGPA * dyCGPA);
                                            const angleCGPA = Math.atan2(dyCGPA, dxCGPA) * (180 / Math.PI);
                                            const cxCGPA = (pt.x + nextPt.x) / 2;
                                            const cyCGPA = (pt.cgpaY + nextPt.cgpaY) / 2;

                                            const dxTerm = nextPt.x - pt.x;
                                            const dyTerm = nextPt.termY - pt.termY;
                                            const widthTerm = Math.sqrt(dxTerm * dxTerm + dyTerm * dyTerm);
                                            const angleTerm = Math.atan2(dyTerm, dxTerm) * (180 / Math.PI);
                                            const cxTerm = (pt.x + nextPt.x) / 2;
                                            const cyTerm = (pt.termY + nextPt.termY) / 2;

                                            return (
                                                <React.Fragment key={pt.term.akademikDonemKodu + '_lines'}>
                                                    {activeChartType === 'term' && (
                                                        <View style={{
                                                            position: 'absolute',
                                                            left: cxTerm - widthTerm / 2,
                                                            top: cyTerm - 1,
                                                            width: widthTerm,
                                                            height: 2,
                                                            backgroundColor: colors.warning,
                                                            opacity: 0.5,
                                                            borderStyle: 'dashed',
                                                            borderRadius: 1,
                                                            transform: [{ rotate: `${angleTerm}deg` }]
                                                        }} />
                                                    )}

                                                    {activeChartType === 'cgpa' && (
                                                        <View style={{
                                                            position: 'absolute',
                                                            left: cxCGPA - widthCGPA / 2,
                                                            top: cyCGPA - 1.5,
                                                            width: widthCGPA,
                                                            height: 3,
                                                            backgroundColor: colors.accent,
                                                            borderRadius: 2,
                                                            transform: [{ rotate: `${angleCGPA}deg` }]
                                                        }} />
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </View>

                                    {/* Dots and Text Layer */}
                                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2, elevation: 2 }}>
                                        {points.map((pt, i) => {
                                            let shortName = pt.term.akademikDonemAdi;
                                            if (shortName?.toLowerCase().includes('güz')) shortName = 'Güz';
                                            else if (shortName?.toLowerCase().includes('bahar')) shortName = 'Bahar';
                                            else if (shortName?.toLowerCase().includes('yaz')) shortName = 'Yaz';

                                            const yearMatch = pt.term.akademikDonemAdi?.match(/20(\d{2})-20(\d{2})/);
                                            const label = yearMatch ? `${yearMatch[1]}/${yearMatch[2]}\n${shortName}` : shortName;

                                            return (
                                                <React.Fragment key={pt.term.akademikDonemKodu + '_dots'}>
                                                    {activeChartType === 'term' && (
                                                        <>
                                                            <View style={{
                                                                position: 'absolute',
                                                                left: pt.x - 5,
                                                                top: pt.termY - 5,
                                                                width: 10, height: 10,
                                                                borderRadius: 5,
                                                                backgroundColor: colors.warning,
                                                                borderWidth: 2,
                                                                borderColor: colors.card,
                                                            }} />
                                                            <Text style={{
                                                                position: 'absolute',
                                                                left: pt.x - 20,
                                                                top: pt.termY - 22,
                                                                width: 40,
                                                                textAlign: 'center',
                                                                fontSize: 10,
                                                                color: colors.text,
                                                                fontWeight: 'bold',
                                                                backgroundColor: colors.background,
                                                                borderRadius: 6,
                                                                overflow: 'hidden',
                                                                paddingVertical: 1,
                                                            }}>{pt.term.donemlikNotOrtalamasi.toFixed(2)}</Text>
                                                        </>
                                                    )}

                                                    {activeChartType === 'cgpa' && (
                                                        <>
                                                            <View style={{
                                                                position: 'absolute',
                                                                left: pt.x - 5,
                                                                top: pt.cgpaY - 5,
                                                                width: 10, height: 10,
                                                                borderRadius: 5,
                                                                backgroundColor: colors.accent,
                                                                borderWidth: 2,
                                                                borderColor: colors.card,
                                                            }} />
                                                            <Text style={{
                                                                position: 'absolute',
                                                                left: pt.x - 20,
                                                                top: pt.cgpaY - 22,
                                                                width: 40,
                                                                textAlign: 'center',
                                                                fontSize: 10,
                                                                color: colors.text,
                                                                fontWeight: 'bold',
                                                                backgroundColor: colors.background,
                                                                borderRadius: 6,
                                                                overflow: 'hidden',
                                                                paddingVertical: 1,
                                                            }}>{pt.term.genelNotOrtalamasi.toFixed(2)}</Text>
                                                        </>
                                                    )}

                                                    <Text style={{
                                                        position: 'absolute',
                                                        left: pt.x - 25,
                                                        top: chartHeight + paddingTop + 10,
                                                        width: 50,
                                                        textAlign: 'center',
                                                        fontSize: 10,
                                                        color: colors.muted,
                                                        fontWeight: '600',
                                                        lineHeight: 14,
                                                    }}>{label}</Text>
                                                </React.Fragment>
                                            );
                                        })}
                                    </View>
                                </View>
                            );
                        })()}
                    </ScrollView>
                </View>

                {sortedStats.map((term, index) => {
                    const isNewest = index === 0;
                    const prevTerm = sortedStats[index + 1];
                    let trendIcon = null;
                    let trendColor = colors.textSecondary;

                    if (prevTerm) {
                        if (term.genelNotOrtalamasi > prevTerm.genelNotOrtalamasi) {
                            trendIcon = 'trending-up';
                            trendColor = colors.success;
                        } else if (term.genelNotOrtalamasi < prevTerm.genelNotOrtalamasi) {
                            trendIcon = 'trending-down';
                            trendColor = colors.danger;
                        } else {
                            trendIcon = 'trending-neutral';
                            trendColor = colors.textSecondary;
                        }
                    }

                    return (
                        <TouchableOpacity
                            key={term.akademikDonemKodu}
                            style={styles.termCard}
                            activeOpacity={0.8}
                            onPress={() => {
                                setSelectedTermForGrades(term);
                                setModalVisible(true);
                            }}
                        >
                            <View style={styles.termHeader}>
                                <View style={styles.termTitleContainer}>
                                    <Text style={styles.termTitle}>{term.akademikDonemAdi}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                            </View>

                            <View style={styles.termStats}>
                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>Dönem Ort.</Text>
                                    <Text style={styles.statValue}>{term.donemlikNotOrtalamasi.toFixed(2)}</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>Genel Ort.</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Text style={styles.statValue}>{term.genelNotOrtalamasi.toFixed(2)}</Text>
                                        {trendIcon && <MaterialCommunityIcons name={trendIcon} size={16} color={trendColor} />}
                                    </View>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>Kredi</Text>
                                    <Text style={styles.statValue}>{term.verilenKredi.toFixed(1)}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}

                <View style={{ height: 40 }} />
            </ScrollView>

            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setModalVisible(false)} />
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedTermForGrades?.akademikDonemAdi} Notları</Text>
                        </View>
                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            {(() => {
                                if (!selectedTermForGrades) return null;
                                const termData = terms?.find(t => t.donemKodu === selectedTermForGrades.akademikDonemKodu || t.akademikDonemKodu === selectedTermForGrades.akademikDonemKodu);
                                const courses = termData?.courses || [];

                                const gradeValues = {
                                    'AA': 4.0, 'BA+': 3.75, 'BA': 3.5, 'BB+': 3.25, 'BB': 3.0,
                                    'CB+': 2.75, 'CB': 2.5, 'CC+': 2.25, 'CC': 2.0,
                                    'DC+': 1.75, 'DC': 1.5, 'DD+': 1.25, 'DD': 1.0,
                                    'FF': 0.0, 'VF': 0.0
                                };
                                const cgpa = selectedTermForGrades.genelNotOrtalamasi;

                                if (courses.length === 0) {
                                    return (
                                        <View style={styles.emptyCoursesContainer}>
                                            <MaterialCommunityIcons name="information-outline" size={32} color={colors.muted} />
                                            <Text style={styles.emptyCoursesText}>Bu döneme ait ders kaydı bulunamadı.</Text>
                                        </View>
                                    );
                                }

                                return courses.map((c, idx) => {
                                    let gradeColor = colors.muted;
                                    const cleanGrade = c.harfNotu?.replace('+', '');
                                    if (['AA', 'BA', 'BB', 'BL'].includes(cleanGrade)) gradeColor = colors.success;
                                    else if (['CB', 'CC'].includes(cleanGrade)) gradeColor = colors.warning;
                                    else if (['DD', 'DC'].includes(cleanGrade)) gradeColor = '#FF9800';
                                    else if (['FF', 'VF'].includes(cleanGrade)) gradeColor = colors.danger;
                                    else if (c.harfNotu) gradeColor = colors.text;

                                    const gradeVal = gradeValues[c.harfNotu?.trim()];
                                    let showWarning = false;
                                    if (gradeVal !== undefined && gradeVal < cgpa && gradeVal <= 2.75) {
                                        showWarning = true;
                                    }

                                    return (
                                        <View key={idx} style={[styles.courseRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={styles.courseMain}>
                                                    <Text style={styles.courseName}>{c.name}</Text>
                                                </View>
                                                <View style={[styles.gradeBadge, c.harfNotu && { borderColor: gradeColor }]}>
                                                    <Text style={[styles.gradeText, { color: c.harfNotu ? gradeColor : colors.muted }]}>{c.harfNotu || '-'}</Text>
                                                </View>
                                            </View>
                                            {showWarning && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: colors.danger + '10', padding: 8, borderRadius: 8 }}>
                                                    <MaterialCommunityIcons name="trending-down" size={16} color={colors.danger} />
                                                    <Text style={{ flex: 1, fontSize: 11.5, color: colors.danger, fontWeight: '500' }}>Ortalamanızı düşürüyor, tekrar almanız önerilir.</Text>
                                                </View>
                                            )}
                                        </View>
                                    );
                                });
                            })()}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: Platform.OS === 'android' ? 30 : 0
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 15,
        color: colors.textSecondary,
        fontSize: 16,
    },
    emptyText: {
        marginTop: 15,
        color: colors.textSecondary,
        fontSize: 16,
    },
    retryBtn: {
        marginTop: 20,
        backgroundColor: colors.card,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    retryText: {
        color: colors.text,
        fontWeight: 'bold',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
    },
    headerBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: colors.card,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 15,
        marginBottom: 15,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    chartSection: {
        marginBottom: 24,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 8,
    },
    legendRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 15,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '500',
    },
    chartScroll: {
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    termCard: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    termCardActive: {
        borderColor: 'rgba(41, 121, 255, 0.5)',
        backgroundColor: colors.cardHover,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    termHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    termTitleContainer: {
        flex: 1,
    },
    termTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(41, 121, 255, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(41, 121, 255, 0.2)',
        gap: 4,
    },
    activeBadgeText: {
        color: colors.accent,
        fontSize: 12,
        fontWeight: 'bold',
    },
    termStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderRadius: 16,
        padding: 15,
    },
    statBox: {
        flex: 1,
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginHorizontal: 10,
    },
    statValue: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    statLabel: {
        color: colors.muted,
        fontSize: 11,
        marginBottom: 4,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalBox: {
        backgroundColor: colors.card,
        borderRadius: 20,
        width: '100%',
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'center',
    },
    modalScroll: {
        padding: 20,
    },
    courseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    courseMain: {
        flex: 1,
        paddingRight: 16,
    },
    courseName: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    gradeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: 40,
        alignItems: 'center',
    },
    gradeText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    emptyCoursesContainer: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCoursesText: {
        color: colors.muted,
        textAlign: 'center',
        fontSize: 14,
        marginTop: 12,
        lineHeight: 20,
    }
});
