import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Pdf from 'react-native-pdf';
import { colors } from '../../constants/colors';
import portalApi from '../../services/portalApi';

const { width, height } = Dimensions.get('window');

export default function TranscriptScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [statusText, setStatusText] = useState('Başlatılıyor...');
    const [errorMsg, setErrorMsg] = useState(null);
    const [pdfPath, setPdfPath] = useState(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        loadTranscript();
    }, []);

    const loadTranscript = async () => {
        setLoading(true);
        setErrorMsg(null);
        setPdfPath(null);
        setProgress(0.1);
        setStatusText('OBS Oturumu kontrol ediliyor...');

        try {
            setProgress(0.3);
            setStatusText('Transkript sunucudan indiriliyor...');

            const response = await portalApi.obsRequest('https://obs.itu.edu.tr/api/ogrenci/Belgeler/TranskriptOnizleme', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'tr',
                    'Referer': 'https://obs.itu.edu.tr/ogrenci/Belgeler/TranskriptOnizleme',
                }
            });

            if (!response.ok) {
                throw new Error(`Sunucu hatası: ${response.status}`);
            }

            setProgress(0.7);
            const data = await response.json();

            if (!data || !data.belgeAsByteArray) {
                throw new Error('Geçersiz yanıt formatı. Transkript belgesi bulunamadı.');
            }

            const base64Data = data.belgeAsByteArray;

            setProgress(0.9);
            setStatusText('Belge işleniyor...');

            const filePath = `${FileSystem.documentDirectory}ITU_Transkript.pdf`;
            await FileSystem.writeAsStringAsync(filePath, base64Data, {
                encoding: 'base64'
            });

            setProgress(1.0);
            setStatusText('');
            setPdfPath(filePath);

        } catch (error) {
            console.error('[TranscriptScreen] Hata:', error);
            setErrorMsg(error.message || 'Transkript alınırken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const sharePdf = async () => {
        if (!pdfPath) return;
        try {
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(pdfPath);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Transkript</Text>

                {pdfPath ? (
                    <TouchableOpacity onPress={sharePdf} style={[styles.headerBtn, { backgroundColor: colors.accent + '20' }]}>
                        <MaterialCommunityIcons name="export-variant" size={24} color={colors.accent} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            {pdfPath ? (
                <View style={styles.pdfContainer}>
                    <Pdf
                        source={{ uri: pdfPath, cache: true }}
                        trustAllCerts={false}
                        style={styles.pdf}
                        onLoadComplete={(numberOfPages, filePath) => {
                            console.log(`[TranscriptScreen] PDF loaded: ${numberOfPages} pages`);
                        }}
                        onError={(error) => {
                            console.error('[TranscriptScreen] PDF Render Error:', error);
                        }}
                    />
                </View>
            ) : (
                <View style={styles.content}>
                    {loading ? (
                        <View style={styles.loadingPopup}>
                            <MaterialCommunityIcons name="cloud-sync" size={60} color={colors.accent} style={{ marginBottom: 20 }} />
                            <Text style={styles.loadingTitle}>Transkript İndiriliyor</Text>
                            <Text style={styles.loadingStatus}>{statusText}</Text>

                            <View style={styles.progressBarWrapper}>
                                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                            </View>
                        </View>
                    ) : (
                        errorMsg && (
                            <View style={styles.errorPopup}>
                                <MaterialCommunityIcons name="alert-circle" size={50} color={colors.danger} style={{ marginBottom: 15 }} />
                                <Text style={styles.errorTitle}>Bağlantı Hatası</Text>
                                <Text style={styles.errorText}>{errorMsg}</Text>
                                <TouchableOpacity style={styles.retryBtn} onPress={loadTranscript} activeOpacity={0.8}>
                                    <Text style={styles.retryBtnText}>Tekrar Dene</Text>
                                </TouchableOpacity>
                            </View>
                        )
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        backgroundColor: colors.bg,
        zIndex: 10
    },
    headerBtn: { padding: 8, borderRadius: 12, backgroundColor: colors.card },
    title: {
        fontSize: 20, fontWeight: 'bold', color: colors.text,
        textShadowColor: colors.accentGlow, textShadowRadius: 8
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingPopup: {
        backgroundColor: colors.card,
        width: '100%',
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8
    },
    loadingTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8
    },
    loadingStatus: {
        fontSize: 14,
        color: colors.muted,
        marginBottom: 24,
        textAlign: 'center'
    },
    progressBarWrapper: {
        width: '100%',
        height: 6,
        backgroundColor: colors.bg,
        borderRadius: 3,
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.accent,
        borderRadius: 3
    },
    errorPopup: {
        backgroundColor: colors.card,
        width: '100%',
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.danger + '40',
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 10
    },
    errorText: {
        color: colors.muted,
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22
    },
    retryBtn: {
        backgroundColor: colors.accent,
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center'
    },
    retryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    pdfContainer: {
        flex: 1,
        backgroundColor: '#e5e5e5'
    },
    pdf: {
        flex: 1,
        width: width,
        height: height
    }
});
