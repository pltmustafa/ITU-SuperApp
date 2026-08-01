import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AcademicStatusWidget({ gpa, credits, onPress, onRefresh, refreshing }) {
    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TouchableOpacity style={styles.iconContainer} onPress={onRefresh} disabled={refreshing} activeOpacity={0.6}>
                        {refreshing ? (
                            <ActivityIndicator size={16} color={colors.accent} />
                        ) : (
                            <MaterialCommunityIcons name="school" size={20} color={colors.accent} />
                        )}
                    </TouchableOpacity>
                    <Text style={styles.title}>AKADEMİK DURUM</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.gpaContainer}>
                    <Text style={styles.gpaLabel}>Ortalama</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                        <Text style={styles.gpaValue}>{gpa || '---'}</Text>
                        <Text style={styles.gpaMax}>/ 4.00</Text>
                    </View>
                </View>

                {/* Simulated Graph Line */}
                <View style={styles.graphContainer}>
                    <View style={[styles.graphBar, { height: '40%' }]} />
                    <View style={[styles.graphBar, { height: '60%' }]} />
                    <View style={[styles.graphBar, { height: '55%' }]} />
                    <View style={[styles.graphBar, { height: '85%', backgroundColor: colors.accent }]} />
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.credits}>{credits || 0} Kredi Tamamlandı</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    iconContainer: {
        backgroundColor: colors.cardHover,
        padding: 4,
        borderRadius: 8,
        marginRight: 8,
    },
    title: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 10,
    },
    gpaContainer: {
        flex: 1,
    },
    gpaLabel: {
        color: colors.muted,
        fontSize: 11,
        marginBottom: 2,
    },
    gpaValue: {
        color: colors.text,
        fontSize: 34,
        fontWeight: 'bold',
        lineHeight: 36,
    },
    gpaMax: {
        color: colors.muted,
        fontSize: 12,
        marginBottom: 2,
        marginLeft: 4,
    },
    graphContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 28,
        gap: 4,
    },
    graphBar: {
        width: 4,
        backgroundColor: colors.cardHover,
        borderRadius: 2,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    credits: {
        color: colors.textSecondary,
        fontSize: 12,
    },
});
