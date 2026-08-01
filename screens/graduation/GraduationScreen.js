import { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity,
    ActivityIndicator, Platform, StatusBar, ScrollView,
    LayoutAnimation, UIManager, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useObsStore } from '../../store/useObsStore';
import { useToast } from '../../components/common/Toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function GraduationScreen({ navigation }) {
    const { graduationData: data, fetchGraduationData, ignoredCourses, toggleIgnoredCourse } = useObsStore();
    const [loading, setLoading] = useState(!data);
    const [expandedTerms, setExpandedTerms] = useState({});
    const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '', type: 'info', onConfirm: null, confirmText: 'Tamam', cancelText: 'İptal' });

    const showAlert = (title, message, type = 'info', onConfirm = null, confirmText = 'Tamam', cancelText = 'İptal') => {
        setCustomAlert({ visible: true, title, message, type, onConfirm, confirmText, cancelText });
    };

    const hideAlert = () => setCustomAlert(prev => ({ ...prev, visible: false }));

    const { showToast, ToastComponent } = useToast();

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (data?.courses) {
            const grouped = {};
            data.courses.forEach(c => {
                const term = c.donemNo || 99;
                if (!grouped[term]) grouped[term] = [];
                grouped[term].push(c);
            });
            const sortedTerms = Object.keys(grouped).sort((a, b) => parseInt(a) - parseInt(b));

            for (const term of sortedTerms) {
                const isComplete = grouped[term].every(c => c.isMet || (c.bransKodu && ignoredCourses.includes(c.bransKodu)));
                if (!isComplete) {
                    setExpandedTerms({ [term]: true });
                    break;
                }
            }
        }
    }, [data, ignoredCourses]);

    const loadData = async (forceRefresh = false) => {
        if (!forceRefresh && data) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            await fetchGraduationData();
        } catch (err) {
            console.error(err);
            showToast('Veriler yüklenemedi: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleTerm = (term) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedTerms(prev => ({ ...prev, [term]: !prev[term] }));
    };

    const earned = data?.metKrediTotal || 0;
    const required = data?.gerekliMezuniyetKredisi || 132;
    const remaining = Math.max(0, required - earned);
    const percentage = Math.min(100, required > 0 ? (earned / required) * 100 : 0);

    const engEarned = data?.metIngKrediTotal || 0;
    const engRequired = data?.gerekliIngilizceKredi || 39.6;
    const engPercentage = Math.min(100, engRequired > 0 ? (engEarned / engRequired) * 100 : 0);

    const groupedCourses = {};
    if (data?.courses) {
        data.courses.forEach(c => {
            const term = c.donemNo || 99;
            if (!groupedCourses[term]) groupedCourses[term] = [];
            groupedCourses[term].push(c);
        });
    }
    const terms = Object.keys(groupedCourses).sort((a, b) => parseInt(a) - parseInt(b));

    const getGradeColor = (grade) => {
        if (!grade) return colors.muted;
        const cleanGrade = grade.replace('+', '');
        if (['AA', 'BA', 'BB', 'BL'].includes(cleanGrade)) return colors.success;
        if (['CB', 'CC'].includes(cleanGrade)) return colors.warning;
        if (['DD', 'DC'].includes(cleanGrade)) return '#FF9800';
        if (['FF', 'VF'].includes(cleanGrade)) return colors.danger;
        return colors.text;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {ToastComponent}
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={hideAlert}>
                <View style={styles.alertOverlay}>
                    <View style={styles.alertBox}>
                        <MaterialCommunityIcons
                            name={customAlert.type === 'danger' ? 'alert-circle-outline' : customAlert.type === 'success' ? 'check-circle-outline' : 'information-outline'}
                            size={48}
                            color={customAlert.type === 'danger' ? colors.danger : customAlert.type === 'success' ? colors.success : colors.accent}
                            style={{ alignSelf: 'center', marginBottom: 16 }}
                        />
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

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="school-outline" size={24} color={colors.accent} />
                    <Text style={styles.title}>Mezuniyet</Text>
                </View>
                <TouchableOpacity onPress={() => loadData(true)} style={styles.headerBtn} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                        <MaterialCommunityIcons name="refresh" size={24} color={colors.text} />
                    )}
                </TouchableOpacity>
            </View>

            {loading && !data ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Mezuniyet verileriniz hesaplanıyor...</Text>
                </View>
            ) : data ? (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressRing}>
                            <View style={styles.progressInner}>
                                <Text style={styles.progressPercent}>{Math.round(percentage)}%</Text>
                                <Text style={styles.progressLabel}>Tamamlandı</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <View style={[styles.statIconWrap, { backgroundColor: `${colors.success}20` }]}>
                                <MaterialCommunityIcons name="check-circle-outline" size={24} color={colors.success} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.success }]}>{earned}</Text>
                            <Text style={styles.statLabel}>Tamamlanan</Text>
                        </View>

                        <View style={styles.statCard}>
                            <View style={[styles.statIconWrap, { backgroundColor: `${colors.accent}20` }]}>
                                <MaterialCommunityIcons name="target" size={24} color={colors.accent} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.accent }]}>{required}</Text>
                            <Text style={styles.statLabel}>Toplam</Text>
                        </View>

                        <View style={styles.statCard}>
                            <View style={[styles.statIconWrap, { backgroundColor: `${colors.warning}20` }]}>
                                <MaterialCommunityIcons name="clock-outline" size={24} color={colors.warning} />
                            </View>
                            <Text style={[styles.statValue, { color: colors.warning }]}>{remaining}</Text>
                            <Text style={styles.statLabel}>Kalan</Text>
                        </View>
                    </View>

                    <View style={[styles.progressBarContainer, { marginBottom: 15 }]}>
                        <View style={styles.progressBarHeader}>
                            <Text style={styles.progressBarLabel}>Genel İlerleme</Text>
                            <Text style={styles.progressBarValue}>{earned} / {required} Kredi</Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${percentage}%` }]} />
                        </View>
                    </View>

                    <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarHeader}>
                            <Text style={styles.progressBarLabel}>İngilizce Kredi</Text>
                            <Text style={styles.progressBarValue}>{engEarned} / {engRequired} Kredi</Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${engPercentage}%`, backgroundColor: colors.warning }]} />
                        </View>
                    </View>

                    <View style={styles.roadmapContainer}>
                        {terms.map(term => {
                            const termCourses = groupedCourses[term];
                            const completedCount = termCourses.filter(c => c.isMet || (c.bransKodu && ignoredCourses.includes(c.bransKodu))).length;
                            const isComplete = completedCount === termCourses.length;
                            const isExpanded = expandedTerms[term];
                            const termLabel = term == 99 ? "Seçmeli / Diğer" : `${term}. Yarıyıl`;

                            return (
                                <View key={term} style={styles.termContainer}>
                                    <TouchableOpacity
                                        style={styles.termHeader}
                                        onPress={() => toggleTerm(term)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.termHeaderLeft}>
                                            <View>
                                                <Text style={styles.termTitle}>{termLabel}</Text>
                                                <Text style={styles.termSubtitle}>
                                                    {completedCount}/{termCourses.length} Ders Tamamlandı
                                                </Text>
                                            </View>
                                        </View>
                                        <MaterialCommunityIcons
                                            name={isExpanded ? "chevron-up" : "chevron-down"}
                                            size={24}
                                            color={colors.muted}
                                        />
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={styles.termBody}>
                                            {termCourses.map((course, idx) => {
                                                const isIgnored = course.bransKodu && ignoredCourses.includes(course.bransKodu);
                                                const effectivelyMet = course.isMet || isIgnored;
                                                return (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={[styles.courseRow, isIgnored && { opacity: 0.5 }]}
                                                        disabled={course.isMet}
                                                        onPress={() => {
                                                            if (!course.bransKodu) return;
                                                            showAlert(
                                                                isIgnored ? "Yoksaymayı Kaldır" : "Dersi Yoksay",
                                                                isIgnored ? "Bu dersi yoksaymayı bırakmak istiyor musunuz?" : "Bu dersi yoksaymak istiyor musunuz?",
                                                                "info",
                                                                () => toggleIgnoredCourse(course.bransKodu),
                                                                "Evet",
                                                                "İptal"
                                                            );
                                                        }}
                                                        activeOpacity={0.8}
                                                    >
                                                        <View style={[styles.statusIndicator, { backgroundColor: effectivelyMet ? colors.success : colors.danger }]} />
                                                        <View style={styles.courseMain}>
                                                            {course.bransKodu ? (
                                                                <>
                                                                    <Text style={[styles.courseCode, isIgnored && { textDecorationLine: 'line-through' }]}>{course.bransKodu}</Text>
                                                                    <Text style={styles.courseName}>{course.dersAdi}</Text>
                                                                </>
                                                            ) : (
                                                                <Text style={styles.courseCode}>{course.dersAdi}</Text>
                                                            )}
                                                        </View>
                                                        <View style={styles.courseRight}>
                                                            <Text style={styles.creditBadge}>{course.kredisi} Kr</Text>
                                                            {course.harfNotu ? (
                                                                <View style={[styles.gradeBadge, { borderColor: getGradeColor(course.harfNotu) }]}>
                                                                    <Text style={[styles.gradeText, { color: getGradeColor(course.harfNotu) }]}>
                                                                        {course.harfNotu}
                                                                    </Text>
                                                                </View>
                                                            ) : (
                                                                !effectivelyMet && (
                                                                    <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
                                                                )
                                                            )}
                                                            {isIgnored && !course.harfNotu && (
                                                                <MaterialCommunityIcons name="eye-off-outline" size={20} color={colors.muted} style={{ marginLeft: 4 }} />
                                                            )}
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            ) : null}
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

    centerView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.muted, marginTop: 16, fontSize: 15 },

    scrollView: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },

    progressContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
    progressRing: {
        width: 180, height: 180, borderRadius: 90,
        borderWidth: 12, borderColor: `${colors.accent}30`,
        alignItems: 'center', justifyContent: 'center'
    },
    progressInner: {
        width: 140, height: 140, borderRadius: 70,
        backgroundColor: colors.card, borderWidth: 6, borderColor: colors.accent,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 12, elevation: 4
    },
    progressPercent: { fontSize: 40, fontWeight: 'bold', color: colors.accent },
    progressLabel: { color: colors.muted, fontSize: 14, marginTop: 4 },

    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: {
        flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border
    },
    statIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 24, fontWeight: 'bold' },
    statLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },

    progressBarContainer: {
        backgroundColor: colors.card, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: colors.border, marginBottom: 30
    },
    progressBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    progressBarLabel: { color: colors.text, fontWeight: '600', fontSize: 15 },
    progressBarValue: { color: colors.muted, fontSize: 14 },
    progressBar: { height: 14, backgroundColor: colors.bg, borderRadius: 7, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 7, backgroundColor: colors.accent },

    roadmapContainer: { marginTop: 10 },

    termContainer: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border
    },
    termHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, backgroundColor: colors.cardHover,
    },
    termHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    termTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    termSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    termBody: { padding: 16, paddingTop: 8 },
    courseRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    statusIndicator: { width: 3, height: 32, borderRadius: 2, marginRight: 12 },
    courseMain: { flex: 1 },
    courseCode: { color: colors.text, fontWeight: '600', fontSize: 14 },
    courseName: { fontSize: 13, color: colors.muted, marginTop: 4 },
    courseRight: { alignItems: 'flex-end', minWidth: 50, flexDirection: 'row' },
    creditBadge: { fontSize: 13, color: colors.muted, fontWeight: '500', marginRight: 8 },
    gradeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    gradeText: { fontSize: 13, fontWeight: 'bold' },
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
