import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, ScrollView, TouchableOpacity,
    TextInput, Modal, Alert, KeyboardAvoidingView, Platform, StatusBar,
    LayoutAnimation, UIManager
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useToast } from '../../components/common/Toast';

const GRADE_POINTS = {
    "-": null,
    "AA": 4.0, "BA+": 3.75, "BA": 3.5, "BB+": 3.25, "BB": 3.0,
    "CB+": 2.75, "CB": 2.5, "CC+": 2.25, "CC": 2.0,
    "DC+": 1.75, "DC": 1.5, "DD+": 1.25, "DD": 1.0,
    "FD+": 0.5, "FD": 0.5,
    "FF": 0.0, "VF": 0.0
};
const GRADE_OPTIONS = Object.keys(GRADE_POINTS).filter(g => g !== '-');

export default function GPASimulatorScreen({ navigation, route }) {
    const [curriculumGroups, setCurriculumGroups] = useState([]);
    const [simulatedGrades, setSimulatedGrades] = useState({});
    const [simulatedTerms, setSimulatedTerms] = useState([]);
    const [expandedTerms, setExpandedTerms] = useState({});

    const [simulatedCumGPA, setSimulatedCumGPA] = useState({ gpa: '0.00', total_credits: 0, total_points: 0 });
    const [originalCumGPA, setOriginalCumGPA] = useState({ gpa: '0.00', total_credits: 0, total_points: 0 });
    const [simulatedTermGPA, setSimulatedTermGPA] = useState({ gpa: '0.00', total_credits: 0, total_points: 0 });

    const [addModalVisible, setAddModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedCourseInfo, setSelectedCourseInfo] = useState(null);

    const [newCourseName, setNewCourseName] = useState('');
    const [newCourseCredit, setNewCourseCredit] = useState('');
    const [newCourseGrade, setNewCourseGrade] = useState('AA');

    const [isLoading, setIsLoading] = useState(false);
    const { showToast, ToastComponent } = useToast();

    useEffect(() => {
        loadServerData();
    }, []);

    const loadServerData = async () => {
        setIsLoading(true);
        try {
            const { useObsStore } = require('../../store/useObsStore');
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const storeState = useObsStore.getState();

            let currentCourses = [];
            try {
                const termCache = await AsyncStorage.getItem('obs_terms_cache_v3');
                if (termCache) {
                    const terms = JSON.parse(termCache);
                    if (terms && terms.length > 0 && terms[0].courses) {
                        currentCourses = terms[0].courses;
                    }
                }
            } catch (e) {
                console.warn('Terms cache read error', e);
            }

            if (currentCourses.length === 0 && storeState.classes) {
                const uniqueMap = {};
                storeState.classes.forEach(c => {
                    if (c.sinifId && !uniqueMap[c.sinifId]) {
                        uniqueMap[c.sinifId] = {
                            sinifId: c.sinifId,
                            name: c.code + ' - ' + c.name,
                            code: c.code
                        };
                    }
                });
                currentCourses = Object.values(uniqueMap);
            }

            for (let i = 0; i < currentCourses.length; i++) {
                const c = currentCourses[i];
                if (c.sinifId && (!c.harfNotu || c.harfNotu === '-')) {
                    try {
                        const gradeStr = await AsyncStorage.getItem('obs_grades_' + c.sinifId);
                        if (gradeStr) {
                            const gradeData = JSON.parse(gradeStr);
                            if (gradeData?.harfNotu) c.harfNotu = gradeData.harfNotu;
                        }
                    } catch (e) { }
                }
            }

            const gradCourses = storeState.graduationData?.courses || [];
            let hasGradCache = gradCourses.length > 0;

            const groups = {};
            let origCumPoints = 0;
            let origCumCredits = 0;

            const retakenBaseCodes = new Set();
            gradCourses.forEach(gc => {
                const codeMatch = (gc.bransKodu ? gc.bransKodu.trim() : '') + (gc.dersKodu ? ' ' + gc.dersKodu.trim() : '');
                const baseCode = codeMatch.replace(/\s/g, '').replace('E', '');
                const hasPastGrade = (gc.harfNotu && gc.harfNotu.trim() !== '' && gc.harfNotu.trim() !== '-');

                const isCurrent = currentCourses.some(mc => {
                    const mcCode = mc.name ? mc.name.split(' - ')[0] : mc.code;
                    return mcCode.replace(/\s/g, '').replace('E', '') === baseCode;
                });

                if (hasPastGrade && isCurrent) {
                    retakenBaseCodes.add(baseCode);
                }
            });

            gradCourses.forEach((gc, index) => {
                const credit = parseFloat(gc.kredisi);
                if (isNaN(credit) || credit <= 0) return;

                const codeMatch = (gc.bransKodu ? gc.bransKodu.trim() : '') + (gc.dersKodu ? ' ' + gc.dersKodu.trim() : '');
                const baseCode = codeMatch.replace(/\s/g, '').replace('E', '');
                const hasPastGrade = (gc.harfNotu && gc.harfNotu.trim() !== '' && gc.harfNotu.trim() !== '-');

                let originalGrade = '-';
                if (hasPastGrade) {
                    originalGrade = gc.harfNotu.trim();
                }

                const currentMatch = currentCourses.find(mc => {
                    const mcCode = mc.name ? mc.name.split(' - ')[0] : mc.code;
                    return mcCode.replace(/\s/g, '').replace('E', '') === baseCode;
                });

                if (currentMatch && !hasPastGrade && retakenBaseCodes.has(baseCode)) {
                    return;
                }

                if (currentMatch && originalGrade === '-' && currentMatch.harfNotu && currentMatch.harfNotu !== '-') {
                    originalGrade = currentMatch.harfNotu;
                }

                if (GRADE_POINTS[originalGrade] !== undefined && GRADE_POINTS[originalGrade] !== null) {
                    origCumPoints += credit * GRADE_POINTS[originalGrade];
                    origCumCredits += credit;
                }

                const term = gc.donemNo || 99;
                const targetTerm = currentMatch ? 0 : term;
                if (!groups[targetTerm]) groups[targetTerm] = [];

                groups[targetTerm].push({
                    id: codeMatch + '_' + index,
                    code: codeMatch,
                    name: gc.dersAdi,
                    credit: credit,
                    originalGrade: originalGrade,
                    baseCode: baseCode,
                    isRetake: !!currentMatch && hasPastGrade
                });
            });

            currentCourses.forEach((c, index) => {
                const codeMatch = c.name ? c.name.split(' - ')[0] : c.code;
                const baseMcCode = codeMatch.replace(/\s/g, '').replace('E', '');

                let found = false;
                Object.values(groups).forEach(grp => {
                    if (grp.some(gc => gc.baseCode === baseMcCode)) found = true;
                });

                if (!found) {
                    if (!groups[0]) groups[0] = [];
                    let grade = (c.harfNotu && c.harfNotu !== '') ? c.harfNotu : '-';
                    const credit = 3;

                    if (GRADE_POINTS[grade] !== undefined && GRADE_POINTS[grade] !== null) {
                        origCumPoints += credit * GRADE_POINTS[grade];
                        origCumCredits += credit;
                    }

                    groups[0].push({
                        id: codeMatch + '_curr_' + index,
                        code: codeMatch,
                        name: c.name ? (c.name.split(' - ')[1] || c.name) : 'Ders',
                        credit: credit,
                        originalGrade: grade,
                        baseCode: baseMcCode,
                        isRetake: false
                    });
                }
            });

            const groupedArray = Object.keys(groups)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(term => ({
                    termNo: parseInt(term),
                    termName: parseInt(term) == 0 ? 'Güncel Dönem' : (parseInt(term) == 99 ? 'Diğer / Seçmeli' : `${term}. Yarıyıl`),
                    courses: groups[term]
                }));

            let trueBaseGPA = storeState.graduationData?.gpa || storeState.userData?.gpa || 0;

            let pastCumCredits = 0;
            Object.keys(groups).forEach(t => {
                if (parseInt(t) !== 0) {
                    groups[t].forEach(c => {
                        if (GRADE_POINTS[c.originalGrade] !== undefined && GRADE_POINTS[c.originalGrade] !== null) {
                            pastCumCredits += c.credit;
                        }
                    });
                }
            });

            let baseCredits = storeState.graduationData?.toplamKredi ? parseFloat(storeState.graduationData.toplamKredi) : pastCumCredits;

            if (trueBaseGPA === 0 && pastCumCredits > 0) {
                let pastCumPoints = 0;
                Object.keys(groups).forEach(t => {
                    if (parseInt(t) !== 0) {
                        groups[t].forEach(c => {
                            if (GRADE_POINTS[c.originalGrade] !== undefined && GRADE_POINTS[c.originalGrade] !== null) {
                                pastCumPoints += c.credit * GRADE_POINTS[c.originalGrade];
                            }
                        });
                    }
                });
                trueBaseGPA = (pastCumPoints / pastCumCredits).toFixed(2);
            }

            setOriginalCumGPA({
                gpa: parseFloat(trueBaseGPA).toFixed(2),
                total_credits: baseCredits,
                total_points: (parseFloat(trueBaseGPA) * baseCredits).toFixed(2)
            });

            setCurriculumGroups(groupedArray);

            if (groupedArray.length > 0) {
                const exp = {};
                groupedArray.forEach(g => { exp[g.termNo] = false; });
                setExpandedTerms(exp);
            }

            if (!hasGradCache) {
                showToast(`Mezuniyet verileri eksik. Lütfen Mezuniyet sayfasına girip verilerinizi güncelleyin.`, 'warning', 6000);
            }

        } catch (error) {
            console.error('GPA Data Load Error:', error);
            Alert.alert('Hata', 'Veriler yüklenirken bir sorun oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        calculateGPA();
    }, [curriculumGroups, simulatedGrades, simulatedTerms, originalCumGPA]);

    const calculateGPA = () => {
        let baseGPA = parseFloat(originalCumGPA.gpa) || 0;
        let baseCredits = parseFloat(originalCumGPA.total_credits) || 0;
        let basePoints = baseGPA * baseCredits;

        let pointsDiff = 0;
        let creditsDiff = 0;

        let simPoints = 0;
        let simCredits = 0;

        let hasAnyExplicitSimulation = false;

        curriculumGroups.forEach(group => {
            const termNo = parseInt(group.termNo);
            const isCurrentTerm = termNo === 0;

            group.courses.forEach(c => {
                const simGrade = simulatedGrades[c.id];
                const finalGrade = simGrade !== undefined ? simGrade : c.originalGrade;

                if (simGrade !== undefined && simGrade !== c.originalGrade) {
                    hasAnyExplicitSimulation = true;
                }

                const originalHasGrade = GRADE_POINTS[c.originalGrade] !== undefined && GRADE_POINTS[c.originalGrade] !== null;
                const finalHasGrade = GRADE_POINTS[finalGrade] !== undefined && GRADE_POINTS[finalGrade] !== null;

                if (!isCurrentTerm) {
                    if (originalHasGrade && finalHasGrade && c.originalGrade !== finalGrade) {
                        pointsDiff += (GRADE_POINTS[finalGrade] - GRADE_POINTS[c.originalGrade]) * c.credit;
                    } else if (!originalHasGrade && finalHasGrade) {
                        pointsDiff += GRADE_POINTS[finalGrade] * c.credit;
                        creditsDiff += c.credit;
                    }
                } else {
                    if (finalHasGrade) {
                        pointsDiff += GRADE_POINTS[finalGrade] * c.credit;
                        creditsDiff += c.credit;
                    }
                }

                if (isCurrentTerm && finalHasGrade) {
                    simPoints += GRADE_POINTS[finalGrade] * c.credit;
                    simCredits += c.credit;
                }
            });
        });

        const newTotalCredits = baseCredits + creditsDiff;
        const newTotalPoints = basePoints + pointsDiff;

        let calculatedCumGPA = newTotalCredits > 0 ? (newTotalPoints / newTotalCredits).toFixed(2) : baseGPA.toFixed(2);

        if (creditsDiff === 0 && pointsDiff === 0 && !hasAnyExplicitSimulation && simulatedTerms.length === 0) {
            calculatedCumGPA = baseGPA.toFixed(2);
        }

        setSimulatedCumGPA({
            gpa: calculatedCumGPA,
            total_credits: newTotalCredits,
            total_points: newTotalPoints.toFixed(2)
        });

        setSimulatedTermGPA({
            gpa: simCredits > 0 ? (simPoints / simCredits).toFixed(2) : '0.00',
            total_credits: simCredits,
            total_points: simPoints.toFixed(2)
        });
    };

    const toggleTermExpand = (termNo) => {
        LayoutAnimation.configureNext({
            duration: 250,
            create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
            update: { type: LayoutAnimation.Types.easeInEaseOut }
        });
        setExpandedTerms(prev => ({ ...prev, [termNo]: !prev[termNo] }));
    };

    const openEditModal = (course, isCustom = false) => {
        let currentGrade = isCustom ? course.simulatedGrade : (simulatedGrades[course.id] !== undefined ? simulatedGrades[course.id] : course.originalGrade);
        if (currentGrade === '-') currentGrade = 'AA';

        setSelectedCourseInfo({ ...course, currentGrade, isCustom });
        setNewCourseGrade(currentGrade);
        setEditModalVisible(true);
    };

    const handleUpdateGrade = () => {
        if (selectedCourseInfo) {
            setSimulatedGrades(prev => {
                const newGrades = { ...prev };
                if (newCourseGrade === selectedCourseInfo.originalGrade) {
                    delete newGrades[selectedCourseInfo.id];
                } else {
                    newGrades[selectedCourseInfo.id] = newCourseGrade;
                }
                return newGrades;
            });
            setEditModalVisible(false);
        }
    };

    const clearSimulations = () => {
        setSimulatedGrades({});
        setSimulatedTerms([]);
        showToast('Tüm simülasyonlar sıfırlandı.', 'success');
    };

    const getDiffInfo = () => {
        const original = parseFloat(originalCumGPA.gpa);
        const simulated = parseFloat(simulatedCumGPA.gpa);
        const diff = (simulated - original).toFixed(2);
        if (simulated > original) return { color: colors.success, icon: 'trending-up', diff: `+ ${diff} ` };
        if (simulated < original) return { color: colors.danger, icon: 'trending-down', diff };
        return { color: colors.muted, icon: 'minus', diff: '0.00' };
    };

    const getGradeColor = (grade) => {
        if (grade === '-') return colors.muted;
        const point = GRADE_POINTS[grade];
        if (point >= 3.0) return colors.success;
        if (point >= 2.0) return colors.warning;
        return colors.danger;
    };

    const visibleGroups = curriculumGroups.filter(g => {
        if (g.termNo === 0 || g.termNo === 99) return true;
        return g.courses.some(c => c.originalGrade !== '-') || simulatedTerms.includes(g.termNo);
    });

    const hiddenGroups = curriculumGroups.filter(g => {
        if (g.termNo === 0 || g.termNo === 99) return false;
        return !g.courses.some(c => c.originalGrade !== '-') && !simulatedTerms.includes(g.termNo);
    }).sort((a, b) => parseInt(a.termNo) - parseInt(b.termNo));

    const currentGroup = visibleGroups.find(g => parseInt(g.termNo) === 0);
    const pastGroups = visibleGroups
        .filter(g => parseInt(g.termNo) !== 0)
        .sort((a, b) => {
            if (parseInt(a.termNo) === 99) return 1;
            if (parseInt(b.termNo) === 99) return -1;
            return parseInt(b.termNo) - parseInt(a.termNo);
        });

    const diffInfo = getDiffInfo();
    const hasSimulations = Object.keys(simulatedGrades).length > 0 || simulatedTerms.length > 0;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <MaterialCommunityIcons name="calculator-variant" size={24} color={colors.accent} />
                    <Text style={styles.title}>GPA Simülatörü</Text>
                </View>
                {hasSimulations ? (
                    <TouchableOpacity onPress={clearSimulations} style={styles.headerBtn}>
                        <MaterialCommunityIcons name="refresh" size={24} color={colors.danger} />
                    </TouchableOpacity>
                ) : <View style={{ width: 40 }} />}
            </View>

            <View style={styles.cardsContainer}>
                <View style={styles.summaryCard}>
                    <Text style={styles.cardTitle}>Genel Ortalama</Text>
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Mevcut</Text>
                            <Text style={styles.summaryValue}>{originalCumGPA.gpa}</Text>
                        </View>
                        <View style={styles.arrowContainer}>
                            <MaterialCommunityIcons name="arrow-right" size={24} color={colors.muted} />
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Simüle</Text>
                            <Text style={[styles.summaryValue, { color: diffInfo.color }]}>{simulatedCumGPA.gpa}</Text>
                        </View>
                    </View>
                    <View style={styles.diffRow}>
                        <View style={[styles.diffBadge, { backgroundColor: `${diffInfo.color} 20` }]}>
                            <MaterialCommunityIcons name={diffInfo.icon} size={14} color={diffInfo.color} />
                            <Text style={[styles.diffText, { color: diffInfo.color }]}>{diffInfo.diff}</Text>
                        </View>
                        <Text style={styles.summarySub}>{simulatedCumGPA.total_credits} Kr</Text>
                    </View>
                </View>

                <View style={[styles.summaryCard, styles.termCard]}>
                    <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit>Dönem Ortalaması</Text>
                    <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <Text style={[styles.summaryValue, { color: colors.accent, fontSize: 32 }]}>{simulatedTermGPA.gpa}</Text>
                    </View>
                    <View style={styles.diffRow}>
                        <Text style={styles.summarySub}>{simulatedTermGPA.total_credits} Kr</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {currentGroup && currentGroup.courses.length > 0 && (
                    <View style={styles.currentTermSection}>
                        <Text style={styles.sectionHeader}>Güncel Dönem Dersleri ({currentGroup.courses.length})</Text>
                        {currentGroup.courses.map(course => {
                            const simGrade = simulatedGrades[course.id];
                            const isSimulated = simGrade !== undefined && simGrade !== course.originalGrade;
                            const displayGrade = isSimulated ? simGrade : course.originalGrade;

                            return (
                                <TouchableOpacity
                                    key={course.id}
                                    style={[styles.courseCard, isSimulated && styles.simulatedCourseCard]}
                                    onPress={() => openEditModal(course)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.gradeCircle, { backgroundColor: `${getGradeColor(displayGrade)} 20` }]}>
                                        <Text style={[styles.gradeText, { color: getGradeColor(displayGrade) }]}>{displayGrade}</Text>
                                    </View>
                                    <View style={styles.courseInfo}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.courseCode}>{course.code}</Text>
                                            {isSimulated && <MaterialCommunityIcons name="pencil-circle" size={14} color={colors.warning} />}
                                            {course.isRetake && (
                                                <View style={{ backgroundColor: `${colors.danger}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                                    <Text style={{ color: colors.danger, fontSize: 10, fontWeight: 'bold' }}>Tekrar</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                                        {isSimulated && (
                                            <Text style={styles.originalGradeText}>Asıl Not: {course.originalGrade}</Text>
                                        )}
                                    </View>
                                    <View style={styles.courseRight}>
                                        <Text style={styles.creditText}>{course.credit} Kr</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {pastGroups.map((group) => {
                    const isExpanded = expandedTerms[group.termNo];
                    let simCount = 0;
                    group.courses.forEach(c => { if (simulatedGrades[c.id]) simCount++; });

                    return (
                        <View key={group.termNo} style={styles.accordionContainer}>
                            <TouchableOpacity
                                style={styles.accordionHeader}
                                onPress={() => toggleTermExpand(group.termNo)}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <MaterialCommunityIcons name="bookshelf" size={20} color={colors.accent} />
                                    <Text style={styles.accordionTitle}>{group.termName}</Text>
                                    {simCount > 0 && (
                                        <View style={styles.badgeSimCount}>
                                            <Text style={styles.badgeSimCountText}>{simCount}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <Text style={styles.accordionSubTitle}>{group.courses.length} Ders</Text>
                                    <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color={colors.muted} />
                                </View>
                            </TouchableOpacity>

                            {isExpanded && (
                                <View style={styles.accordionBody}>
                                    {group.courses.map(course => {
                                        const sGrade = simulatedGrades[course.id];
                                        const isSimulated = sGrade !== undefined && sGrade !== course.originalGrade;
                                        const displayGrade = sGrade !== undefined ? sGrade : course.originalGrade;

                                        return (
                                            <TouchableOpacity
                                                key={course.id}
                                                style={[styles.courseCard, isSimulated && styles.simulatedCourseCard]}
                                                onPress={() => openEditModal(course, false)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={[styles.gradeCircle, { backgroundColor: `${getGradeColor(displayGrade)} 20` }]}>
                                                    <Text style={[styles.gradeText, { color: getGradeColor(displayGrade) }]}>{displayGrade}</Text>
                                                </View>
                                                <View style={styles.courseInfo}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={styles.courseCode}>{course.code}</Text>
                                                        {isSimulated && <MaterialCommunityIcons name="pencil-circle" size={14} color={colors.warning} />}
                                                    </View>
                                                    <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                                                    {isSimulated && (
                                                        <Text style={styles.originalGradeText}>Asıl Not: {course.originalGrade}</Text>
                                                    )}
                                                </View>
                                                <View style={styles.courseRight}>
                                                    <Text style={styles.creditText}>{course.credit} Kr</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    );
                })}



                {hiddenGroups.length > 0 && (
                    <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
                        <MaterialCommunityIcons name="plus-circle-outline" size={24} color={colors.accent} />
                        <Text style={styles.addBtnText}>Dönem Ekle</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAddModalVisible(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={() => { }}>
                        <View style={styles.modalHeader}>
                            <MaterialCommunityIcons name="book-plus-outline" size={28} color={colors.accent} />
                            <Text style={styles.modalTitle}>Dönem Ekle</Text>
                        </View>
                        <Text style={styles.modalSub}>Simüle etmek istediğiniz dönemi seçin.</Text>

                        <ScrollView style={{ maxHeight: 300, marginBottom: 20 }}>
                            {hiddenGroups.map(group => (
                                <TouchableOpacity
                                    key={group.termNo}
                                    style={styles.termSelectBtn}
                                    onPress={() => {
                                        setSimulatedTerms(prev => [...prev, group.termNo]);
                                        setAddModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.termSelectText}>{group.termName}</Text>
                                    <MaterialCommunityIcons name="plus" size={20} color={colors.accent} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditModalVisible(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={() => { }}>
                        <View style={styles.modalHeader}>
                            <MaterialCommunityIcons name="pencil" size={28} color={colors.accent} />
                            <Text style={styles.modalTitle}>Notu Değiştir</Text>
                        </View>
                        <Text style={styles.modalSub}>
                            {selectedCourseInfo?.name}
                        </Text>

                        <View style={styles.gradeGrid}>
                            {GRADE_OPTIONS.map(g => (
                                <TouchableOpacity
                                    key={g}
                                    style={[styles.gradeGridItem, newCourseGrade === g && { backgroundColor: getGradeColor(g), borderColor: getGradeColor(g) }]}
                                    onPress={() => setNewCourseGrade(g)}
                                >
                                    <Text style={[styles.gradeGridText, newCourseGrade === g && { color: '#fff' }]}>{g}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleUpdateGrade}>
                                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                                <Text style={styles.confirmBtnText}>Güncelle</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
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

    cardsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        gap: 12
    },
    summaryCard: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 16, backgroundColor: colors.card, borderRadius: 16,
        borderWidth: 1, borderColor: colors.border,
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
    },
    termCard: {
        flex: 1
    },
    cardTitle: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0,
        marginBottom: 12,
        textAlign: 'center'
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    summaryItem: { alignItems: 'center' },
    summaryLabel: { color: colors.muted, fontSize: 11, marginBottom: 4 },
    summaryValue: { fontSize: 26, fontWeight: 'bold', color: colors.text },
    arrowContainer: { paddingHorizontal: 4 },
    diffRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    diffBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    diffText: { fontWeight: 'bold', fontSize: 12 },
    summarySub: { color: colors.muted, fontSize: 12, fontWeight: '500' },

    termRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    termItem: { alignItems: 'center' },
    termDivider: { width: 1, height: 30, backgroundColor: colors.border },
    termValue: { fontSize: 22, fontWeight: 'bold', color: colors.text },

    clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.1)', paddingVertical: 10, borderRadius: 12 },
    clearBtnText: { color: colors.danger, fontWeight: 'bold', fontSize: 13 },

    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },

    accordionContainer: {
        marginBottom: 16, backgroundColor: colors.card, borderRadius: 20,
        borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
        shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05, shadowRadius: 12, elevation: 3
    },
    accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: colors.card },
    accordionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    accordionSubTitle: { fontSize: 14, color: colors.muted },
    accordionBody: { paddingHorizontal: 16, paddingBottom: 16 },

    badgeSimCount: { backgroundColor: colors.warning, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 6 },
    badgeSimCountText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },

    courseCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg,
        borderRadius: 16, padding: 16, marginBottom: 10,
        borderWidth: 1, borderColor: colors.border
    },
    simulatedCourseCard: { borderColor: colors.warning, borderWidth: 1.5, backgroundColor: 'rgba(245,158,11,0.06)' },
    gradeCircle: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    gradeText: { fontSize: 16, fontWeight: 'bold' },
    courseInfo: { flex: 1, marginLeft: 16 },
    courseCode: { color: colors.accent, fontWeight: 'bold', fontSize: 14 },
    courseName: { color: colors.text, fontSize: 15, marginTop: 4 },
    originalGradeText: { color: colors.muted, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
    courseRight: { alignItems: 'flex-end', gap: 8 },
    creditText: { color: colors.muted, fontSize: 13, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, fontWeight: '600' },
    deleteBtn: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 10 },

    addBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: colors.card, padding: 20, borderRadius: 18,
        borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginTop: 10
    },
    addBtnText: { color: colors.text, fontSize: 15, fontWeight: '600' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: colors.bg, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
    modalSub: { fontSize: 14, color: colors.muted, marginBottom: 16, textAlign: 'center' },

    inputContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14,
        borderWidth: 1, borderColor: colors.border, marginBottom: 14
    },
    input: { flex: 1, paddingVertical: 14, color: colors.text, fontSize: 16 },

    gradeLabel: { color: colors.muted, fontSize: 13, marginBottom: 10, textTransform: 'uppercase' },
    gradeScroll: { maxHeight: 50, marginBottom: 20 },
    gradeOption: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.card, marginRight: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    gradeOptionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    gradeOptionText: { color: colors.text, fontWeight: 'bold', fontSize: 15 },

    gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
    gradeGridItem: { width: 52, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    gradeGridText: { color: colors.text, fontWeight: 'bold', fontSize: 15 },

    modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    cancelBtn: { flex: 1, padding: 14, alignItems: 'center', backgroundColor: colors.card, borderRadius: 12 },
    cancelBtnText: { color: colors.text, fontWeight: '600' },
    confirmBtn: { flex: 1, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.success, borderRadius: 12 },
    confirmBtnText: { color: '#fff', fontWeight: 'bold' },

    currentTermSection: { marginBottom: 16 },
    sectionHeader: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 12, marginLeft: 4 },

    termSelectBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, backgroundColor: colors.card, borderRadius: 12,
        borderWidth: 1, borderColor: colors.border, marginBottom: 10
    },
    termSelectText: { color: colors.text, fontSize: 16, fontWeight: 'bold' }
});
