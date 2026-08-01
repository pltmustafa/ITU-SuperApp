import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet, Text, View, FlatList, TouchableOpacity,
    Platform, StatusBar, ActivityIndicator, TextInput,
    RefreshControl, KeyboardAvoidingView,
    Keyboard, TouchableWithoutFeedback, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import mailService from '../../services/mailService';
import ituApi from '../../services/ituApi';

export default function MailScreen({ navigation }) {

    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const [needsPassword, setNeedsPassword] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    const userEmail = ituApi.userInfo?.email || '';
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
        loadEmails();
    }, []);

    const loadEmails = async () => {
        const savedPassword = await mailService.getSavedPassword();
        if (!savedPassword) {
            setNeedsPassword(true);
            setLoading(false);
            return;
        }
        await fetchEmails(savedPassword);
    };

    const fetchEmails = async (password) => {
        setError('');
        const result = await mailService.fetchInbox(userEmail, password);
        if (result.success) {
            setEmails(result.emails);
            setNeedsPassword(false);
        } else {
            if (result.error?.includes('Şifre') || result.error?.includes('Giriş')) {
                await mailService.clearPassword();
                setNeedsPassword(true);
                setLoginError(result.error);
            } else {
                setError(result.error);
            }
        }
        setLoading(false);
        setRefreshing(false);
    };

    const handlePasswordSubmit = async () => {
        if (!passwordInput.trim()) return;
        Keyboard.dismiss();
        setLoginLoading(true);
        setLoginError('');

        await mailService.savePassword(passwordInput);
        const result = await mailService.fetchInbox(userEmail, passwordInput);

        if (result.success) {
            setEmails(result.emails);
            setNeedsPassword(false);
            setPasswordInput('');
        } else {
            await mailService.clearPassword();
            setLoginError(result.error || 'Giriş başarısız.');
        }
        setLoginLoading(false);
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        const savedPassword = await mailService.getSavedPassword();
        if (savedPassword) {
            await fetchEmails(savedPassword);
        } else {
            setRefreshing(false);
            setNeedsPassword(true);
        }
    }, []);

    const openMailDetail = (mail) => {
        navigation.navigate('MailDetail', { mail });
    };

    const renderMailItem = ({ item, index }) => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
                style={styles.mailCard}
                onPress={() => openMailDetail(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.from) }]}>
                    <Text style={styles.avatarText}>
                        {(item.from || '?').charAt(0).toUpperCase()}
                    </Text>
                </View>

                <View style={styles.mailContent}>
                    <View style={styles.mailHeader}>
                        <Text style={styles.mailFrom} numberOfLines={1}>{item.from}</Text>
                        <Text style={styles.mailDate}>{item.date}</Text>
                    </View>
                    <Text style={styles.mailSubject} numberOfLines={1}>{item.subject}</Text>
                    {item.preview ? (
                        <Text style={styles.mailPreview} numberOfLines={2}>{item.preview}</Text>
                    ) : null}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );

    if (needsPassword) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>E-Posta</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.passwordContainer}>
                            <View style={styles.lockCircle}>
                                <MaterialCommunityIcons name="email-lock-outline" size={48} color={colors.accent} />
                            </View>

                            <Text style={styles.passwordTitle}>E-Posta Erişimi</Text>
                            <Text style={styles.passwordSubtitle}>
                                İTÜ e-postalarınızı görüntülemek için şifrenizi girin.
                                {'\n'}
                                <Text style={{ color: colors.muted, fontSize: 12 }}>
                                    {userEmail}
                                </Text>
                            </Text>

                            <View style={styles.inputRow}>
                                <MaterialCommunityIcons name="lock-outline" size={20} color={colors.muted} style={{ marginRight: 10 }} />
                                <TextInput
                                    style={styles.input}
                                    value={passwordInput}
                                    onChangeText={(text) => {
                                        setPasswordInput(text);
                                        if (loginError) setLoginError('');
                                    }}
                                    placeholder="Şifre"
                                    placeholderTextColor={colors.muted}
                                    secureTextEntry={!showPassword}
                                    returnKeyType="go"
                                    onSubmitEditing={handlePasswordSubmit}
                                    editable={!loginLoading}
                                    autoFocus
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={{ padding: 8 }}
                                >
                                    <MaterialCommunityIcons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color={colors.muted}
                                    />
                                </TouchableOpacity>
                            </View>

                            {loginError ? (
                                <View style={styles.errorBox}>
                                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.danger} />
                                    <Text style={styles.errorText}>{loginError}</Text>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.loginBtn, loginLoading && { opacity: 0.7 }]}
                                onPress={handlePasswordSubmit}
                                disabled={loginLoading}
                                activeOpacity={0.8}
                            >
                                {loginLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.loginBtnText}>Bağlan</Text>
                                )}
                            </TouchableOpacity>

                            <Text style={styles.privacyNote}>
                                <MaterialCommunityIcons name="shield-check-outline" size={12} color={colors.muted} />
                                {' '}Şifreniz yalnızca bu cihazda saklanır.
                            </Text>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Gelen Kutusu</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>E-postalar yükleniyor...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerContainer}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.danger} />
                    <Text style={styles.errorTitle}>Bağlantı Hatası</Text>
                    <Text style={styles.errorDescription}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); loadEmails(); }}>
                        <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
                        <Text style={styles.retryBtnText}>Tekrar Dene</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList showsVerticalScrollIndicator={false}
                    data={emails}
                    renderItem={renderMailItem}
                    keyExtractor={(item) => `mail-${item.id}`}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.accent}
                            colors={[colors.accent]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.centerContainer}>
                            <MaterialCommunityIcons name="email-open-outline" size={48} color={colors.muted} />
                            <Text style={styles.emptyText}>
                                Gelen kutunuz boş
                            </Text>
                        </View>
                    }
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            )}

        </SafeAreaView>
    );
}

function getAvatarColor(name) {
    const avatarColors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
        '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: Platform.OS === 'android' ? 30 : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: colors.card,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        textShadowColor: colors.accentGlow,
        textShadowRadius: 8,
    },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 10,
        fontSize: 15,
        color: colors.text,
    },

    passwordContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    lockCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.card,
        borderWidth: 2,
        borderColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
        marginBottom: 24,
    },
    passwordTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    passwordSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 14,
        width: '100%',
        maxWidth: 400,
        marginBottom: 16,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: colors.text,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 23, 68, 0.1)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 23, 68, 0.3)',
        width: '100%',
        maxWidth: 400,
    },
    errorText: {
        color: colors.danger,
        fontSize: 14,
        flex: 1,
    },
    loginBtn: {
        backgroundColor: colors.accent,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    loginBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 1,
    },
    privacyNote: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 16,
        textAlign: 'center',
    },

    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        color: colors.textSecondary,
        fontSize: 14,
        marginTop: 16,
    },
    errorTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
    },
    errorDescription: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 22,
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.accent,
        borderRadius: 12,
        paddingHorizontal: 24,
        paddingVertical: 12,
        marginTop: 24,
    },
    retryBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    emptyText: {
        color: colors.muted,
        fontSize: 16,
        marginTop: 16,
    },

    listContent: {
        paddingBottom: 20,
    },
    mailCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    avatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    mailContent: {
        flex: 1,
    },
    mailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    mailFrom: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    mailDate: {
        color: colors.muted,
        fontSize: 12,
    },
    mailSubject: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 3,
    },
    mailPreview: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 18,
    },
    separator: {
        height: 1,
        backgroundColor: colors.border,
        marginLeft: 74,
        opacity: 0.5,
    },

});
