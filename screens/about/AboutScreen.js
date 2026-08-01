import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Modal, DevSettings, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import packageJson from '../../package.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ituApi from '../../services/ituApi';
import portalApi from '../../services/portalApi';
import { useObsStore } from '../../store/useObsStore';

export default function AboutScreen({ navigation }) {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [customAlert, setCustomAlert] = useState({ visible: false, title: '', message: '', type: 'info', onConfirm: null, confirmText: 'Tamam', cancelText: 'İptal' });

    const showAlert = (title, message, type = 'info', onConfirm = null, confirmText = 'Tamam', cancelText = 'İptal') => {
        setCustomAlert({ visible: true, title, message, type, onConfirm, confirmText, cancelText });
    };

    const hideAlert = () => setCustomAlert(prev => ({ ...prev, visible: false }));

    const handleClearCache = () => {
        showAlert(
            "Önbelleği Temizle ve Yeniden Başlat", 
            "Önbellekteki veriler silinecektir. Değişikliklerin etkili olması için uygulamanın hemen yeniden başlatılması gerekmektedir. Onaylıyor musunuz?", 
            "warning", 
            async () => {
                try {
                    const keys = await AsyncStorage.getAllKeys();
                    const preservedKeys = [
                        'itu_token',
                        'itu_user_info',
                        'itu_mail_password',
                        'menu_hidden_pref',
                        'menu_order_pref',
                        'has_seen_tutorial_v1',
                        'user_shortcuts_pref',
                        'widget_order_pref',
                        'widget_hidden_pref'
                    ];
                    const cacheKeys = keys.filter(k => !preservedKeys.includes(k));
                    await AsyncStorage.multiRemove(cacheKeys);
                    
                    portalApi.clearCache();
                    
                    DevSettings.reload();
                } catch (e) {
                    console.error("[AboutScreen] Temizleme hatası:", e);
                }
            },
            "Yeniden Başlat"
        );
    };

    const handleLogout = () => {
        showAlert(
            "Çıkış Yap ve Yeniden Başlat", 
            "Hesabınızdan çıkış yapılacak ve tüm yerel verileriniz silinecektir. Uygulama hemen yeniden başlatılacak. Onaylıyor musunuz?", 
            "danger", 
            async () => {
                try {
                    await ituApi.logout();
                    await AsyncStorage.clear();
                    
                    DevSettings.reload();
                } catch (e) {
                    console.error("[AboutScreen] Çıkış hatası:", e);
                }
            },
            "Yeniden Başlat"
        );
    };

    const handleSend = async () => {
        if (!message.trim()) {
            showAlert("Hata", "Lütfen bir mesaj yazın.", "danger");
            return;
        }

        setSending(true);
        try {

            const _k = "itu-super-app";
            const _un = (d) => d.map((c, i) => String.fromCharCode(c ^ _k.charCodeAt(i % _k.length))).join('');

            const _u = _un([28, 14, 76, 74, 11, 66, 25, 28, 65, 67, 10, 24, 73, 12, 4, 13, 27, 30, 16, 22, 20, 17, 88, 83, 5, 67, 91, 26, 5, 28]);
            const _t = _un([8, 66, 18, 68, 20, 28, 4, 17, 28, 64, 2, 8, 17, 3, 65, 31, 72, 64, 13, 69, 11, 28, 92, 23, 67, 72, 3, 76, 6, 26]);
            const _api = _un([1, 0, 1, 93, 0, 79, 95, 74, 19, 93, 8, 94, 0, 28, 7, 29, 66, 5, 16, 2, 75, 28, 72, 21, 95, 65, 70, 25, 16, 94, 0, 20, 23, 0, 1, 3, 11, 3, 31, 7]);
            const _ttl = _un([345, 32, 169, 13, 62, 26, 18, 12, 30, 13, 38, 21, 2, 0, 84, 55, 68, 31, 17, 25, 23, 27, 64]);

            const response = await fetch(_api, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: _t,
                    user: _u,
                    message: message,
                    title: _ttl
                }),
            });

            const data = await response.json();

            if (data.status === 1) {
                showAlert("Başarılı", "Mesajınız iletildi.", "success");
                setMessage('');
            } else {
                showAlert("Hata", "Mesaj gönderilemedi, lütfen daha sonra tekrar deneyin.", "danger");
            }
        } catch (error) {
            showAlert("Hata", "Bağlantı hatası oluştu.", "danger");
        } finally {
            setSending(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.title}>Hakkında</Text>
                </View>
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(false)} activeOpacity={1}>
                    <View style={styles.dropdownMenu}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleClearCache(); }}>
                            <MaterialCommunityIcons name="delete-sweep-outline" size={20} color={colors.text} />
                            <Text style={styles.menuItemText}>Önbelleği Temizle</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleLogout(); }}>
                            <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
                            <Text style={[styles.menuItemText, { color: colors.danger }]}>Çıkış Yap</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

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

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.content}>
                    <MaterialCommunityIcons name="information-outline" size={64} color={colors.accent} style={{ alignSelf: 'center', marginBottom: 20 }} />
                    <Text style={styles.appName}>İTÜ Mobil</Text>
                    <Text style={styles.version}>Versiyon {packageJson.version}</Text>
                    <Text style={styles.description}>
                        Bu uygulama, ITÜ Mobil’in performans sorunları ve sınırlı özellikleri nedeniyle kişisel kullanım amacıyla geliştirilmiş, açık kaynaklı bir İTÜ Mobil projesidir.
                    </Text>
                    <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>Mustafa Polat</Text>
                    </View>

                    <View style={styles.feedbackContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            <MaterialCommunityIcons name="bug-outline" size={22} color={colors.warning} />
                            <Text style={styles.feedbackTitle}>Hata Bildir / İletişim</Text>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Karşılaştığınız bir hatayı veya önerinizi yazın..."
                            placeholderTextColor={colors.muted}
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />

                        <TouchableOpacity
                            style={[styles.sendBtn, (!message.trim() || sending) && { opacity: 0.5 }]}
                            onPress={handleSend}
                            disabled={!message.trim() || sending}
                        >
                            {sending ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Text style={styles.sendBtnText}>Gönder</Text>
                                    <MaterialCommunityIcons name="send" size={18} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={styles.githubLink}
                        onPress={() => Linking.openURL('https://github.com/pltmustafa/ITU-SuperApp')}
                    >
                        <MaterialCommunityIcons name="github" size={20} color={colors.text} />
                        <Text style={styles.githubText}>pltmustafa/ITU-SuperApp</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
    headerCenter: { flex: 1, marginHorizontal: 12, justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    appName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    version: {
        fontSize: 16,
        color: colors.muted,
        marginBottom: 24,
    },
    description: {
        fontSize: 16,
        color: colors.muted,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 16,
    },
    badgeContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 32,
    },
    badgeText: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
    feedbackContainer: {
        width: '100%',
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    feedbackTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginLeft: 8,
    },
    input: {
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 16,
        color: colors.text,
        fontSize: 15,
        minHeight: 120,
        marginBottom: 16,
    },
    sendBtn: {
        backgroundColor: colors.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        gap: 8,
    },
    sendBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: Platform.OS === 'android' ? 80 : 100,
        paddingRight: 20,
    },
    dropdownMenu: {
        backgroundColor: colors.card,
        borderRadius: 16,
        paddingVertical: 8,
        minWidth: 180,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    menuItemText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '500',
    },
    menuDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginHorizontal: 12,
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
    },
    githubLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
        marginBottom: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 24,
        gap: 8,
    },
    githubText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '600',
    }
});
