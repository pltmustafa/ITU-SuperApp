import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useObsStore } from '../../../store/useObsStore';

export default function GraduationWidget({ earnedCredits, requiredCredits = 132, compact = false, onRefresh, refreshing }) {
    const percent = Math.min(100, Math.round((earnedCredits / requiredCredits) * 100)) || 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconContainer} onPress={onRefresh} disabled={refreshing} activeOpacity={0.6}>
                    {refreshing ? (
                        <ActivityIndicator size={16} color={colors.accent} />
                    ) : (
                        <MaterialCommunityIcons name="school-outline" size={20} color={colors.accent} />
                    )}
                </TouchableOpacity>
                <Text style={styles.title}>{compact ? 'MEZUNİYET' : 'MEZUNİYET DURUMU'}</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${percent}%` }]} />
                </View>

                <View style={[styles.meta, compact && { flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
                    <Text style={styles.percentText}>%{percent} Tamamlandı</Text>
                    <Text style={styles.creditText}>{earnedCredits || 0} / {requiredCredits || 132} Kr</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 20,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: colors.border,
        flex: 1
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    iconContainer: {
        backgroundColor: colors.cardHover,
        padding: 6,
        borderRadius: 8,
        marginRight: 10,
    },
    title: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    content: {
        gap: 10,
    },
    progressBg: {
        height: 12,
        backgroundColor: colors.cardHover,
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.success,
        borderRadius: 6,
    },
    meta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    percentText: {
        color: colors.text,
        fontWeight: 'bold',
        fontSize: 14,
    },
    creditText: {
        color: colors.muted,
        fontSize: 12,
    }
});
