import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import portalApi from '../../../services/portalApi';

const DOWNLOAD_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.csv', '.txt', '.rtf',
    '.apk', '.exe', '.dmg', '.msi',
    '.mp3', '.mp4', '.avi', '.mov', '.mkv',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
];

const isDownloadUrl = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.includes('blob:')) return true;
    if (lower.includes('data:application')) return true;
    if (lower.includes('content-disposition')) return true;
    if (lower.includes('download=')) return true;
    if (lower.includes('/download/')) return true;
    if (lower.includes('/Download/')) return true;
    for (const ext of DOWNLOAD_EXTENSIONS) {
        if (lower.includes(ext + '?') || lower.endsWith(ext)) return true;
    }
    return false;
};

export default function PaymentWebViewModal({ visible, amount, card, onClose, onSuccess }) {
    const [logs, setLogs] = useState([]);
    const [credentials, setCredentials] = useState(null);
    const [txId, setTxId] = useState('');
    const [isInteractive, setIsInteractive] = useState(false);
    const webviewRef = useRef(null);

    useEffect(() => {
        if (visible) {
            setLogs(['Yükleme işlemi başlatılıyor...']);
            setTxId(Date.now().toString());
            setIsInteractive(false);
            portalApi.getCredentials().then(creds => {
                if (creds && creds.username && creds.password) {
                    setCredentials(creds);
                    addLog('Kimlik bilgileri hafızadan alındı.');
                } else {
                    addLog('Hata: Kullanıcı adı veya şifre bulunamadı!');
                }
            });
        } else {
            setLogs([]);
            setCredentials(null);
        }
    }, [visible]);

    const addLog = (msg) => {
        console.log(`[TopUp] ${msg}`);
        setLogs(prev => [...prev, msg]);
    };

    const handleMessage = (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'log') {
                addLog(data.message);
            } else if (data.type === 'debug') {
                console.log('[TopUp DEBUG]', data.message);
            } else if (data.type === 'error') {
                addLog('Hata: ' + data.message);
            } else if (data.type === 'interactive') {
                setIsInteractive(true);
            } else if (data.type === 'success') {
                addLog('3D onay başarılı, bakiye yüklendi!');
                setTimeout(() => {
                    onSuccess();
                }, 100);
            }
        } catch (e) {
            addLog(`Bilinmeyen mesaj: ${event.nativeEvent.data}`);
        }
    };

    const handleShouldStartLoadWithRequest = (request) => {
        const { url, navigationType, isTopFrame, mainDocumentURL, loading } = request;
        console.log('[TopUp NAV_REQUEST]', JSON.stringify({
            url: url,
            navigationType: navigationType,
            isTopFrame: isTopFrame,
            mainDocumentURL: mainDocumentURL,
            loading: loading,
        }));

        if (isDownloadUrl(url)) {
            console.log('[TopUp NAV_BLOCKED] İndirme URL engellendi:', url);
            return false;
        }

        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('gizlilik') || lowerUrl.includes('taahhut') || lowerUrl.includes('taahh')) {
            console.log('[TopUp NAV_BLOCKED] Gizlilik/taahhüt URL engellendi:', url);
            return false;
        }

        if (url.startsWith('blob:') || url.startsWith('data:')) {
            console.log('[TopUp NAV_BLOCKED] Blob/Data URL engellendi:', url.substring(0, 100));
            return false;
        }

        return true;
    };

    const handleNavigationStateChange = (navState) => {
        console.log('[TopUp NAV_STATE]', JSON.stringify({
            url: navState.url,
            title: navState.title,
            loading: navState.loading,
            canGoBack: navState.canGoBack,
            canGoForward: navState.canGoForward,
        }));
    };

    const handleLoadStart = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.log('[TopUp LOAD_START]', JSON.stringify({
            url: nativeEvent.url,
            title: nativeEvent.title,
            loading: nativeEvent.loading,
        }));
    };

    const handleLoadEnd = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.log('[TopUp LOAD_END]', JSON.stringify({
            url: nativeEvent.url,
            title: nativeEvent.title,
            loading: nativeEvent.loading,
        }));
    };

    const handleLoadProgress = ({ nativeEvent }) => {
        if (nativeEvent.progress === 1) {
            console.log('[TopUp LOAD_PROGRESS] %100 tamamlandı, URL:', nativeEvent.url);
        }
    };

    const handleError = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.log('[TopUp ERROR]', JSON.stringify({
            code: nativeEvent.code,
            description: nativeEvent.description,
            url: nativeEvent.url,
        }));
        addLog('WebView hata: ' + nativeEvent.description);
    };

    const handleHttpError = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.log('[TopUp HTTP_ERROR]', JSON.stringify({
            statusCode: nativeEvent.statusCode,
            url: nativeEvent.url,
            description: nativeEvent.description,
        }));
    };

    const handleFileDownload = ({ nativeEvent }) => {
        console.log('[TopUp FILE_DOWNLOAD]', JSON.stringify({
            downloadUrl: nativeEvent.downloadUrl,
        }));
    };

    const handleOpenWindow = (syntheticEvent) => {
        console.log('[TopUp OPEN_WINDOW]', JSON.stringify({
            targetUrl: syntheticEvent.nativeEvent.targetUrl,
        }));
    };


    const getInjectedScript = () => {
        if (!credentials || !card) return '';

        return `
            (function() {
                const log = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify({type: 'log', message: msg}));
                const debug = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify({type: 'debug', message: msg}));
                const err = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify({type: 'error', message: msg}));
                const success = () => window.ReactNativeWebView.postMessage(JSON.stringify({type: 'success'}));
                
                let ticks = 0;
                setInterval(() => {
                    ticks++;
                    const url = window.location.href;
                    const storedStage = sessionStorage.getItem('payment_stage_${txId}');
                    
                    if (url.includes('/User/LoginITU') || url.includes('/Login.aspx')) {
                        const userInp = document.querySelector('#ContentPlaceHolder1_tbUserName');
                        const passInp = document.querySelector('#ContentPlaceHolder1_tbPassword');
                        const loginBtn = document.querySelector('#ContentPlaceHolder1_btnLogin');
                        
                        if (userInp && passInp && loginBtn && !window._loginClicked) {
                            window._loginClicked = true;
                            log('Kullanıcı adı ve şifre dolduruluyor...');
                            userInp.value = '${credentials.username}';
                            passInp.value = '${credentials.password}';
                            loginBtn.click();
                        }
                    }

                    if (window._lastUrl !== url) {
                        window._lastUrl = url;
                        const bodyText = document.body ? document.body.innerText.replace(/\\\\s+/g, ' ').substring(0, 500) : 'Body yok';
                        debug('URL Degisti: ' + url);
                        debug('Icerik Ozeti: ' + bodyText);
                        
                        const forms = Array.from(document.querySelectorAll('form'));
                        if (forms.length > 0) {
                            debug('Sayfadaki Formlar: ' + forms.map(f => f.action || 'action_yok').join(', '));
                        }
                    }

                    
                    if (url.includes('Default.aspx') || document.querySelector('#TUTAR')) {
                        let currentBalance = null;
                        const tds = Array.from(document.querySelectorAll('td'));
                        for (let i = 0; i < tds.length; i++) {
                            if (tds[i].innerText.includes('BAKİYE:')) {
                                if (tds[i+1]) {
                                    currentBalance = tds[i+1].innerText.trim();
                                }
                                break;
                            }
                        }

                        if (sessionStorage.getItem('payment_stage_${txId}')) {
                            const initBal = sessionStorage.getItem('initial_balance_${txId}');
                            
                            if (initBal && currentBalance && initBal !== currentBalance) {
                                if (!window._completed) {
                                    window._completed = true;
                                    debug('Bakiye değişti (' + initBal + ' -> ' + currentBalance + '), işlem başarılı!');
                                    setTimeout(success, 200);
                                }
                            } else {
                                if (!window._checking_balance) {
                                    window._checking_balance = true;
                                    debug('Bakiye kontrol ediliyor...');
                                }
                            }
                            return;
                        } else {
                            if (currentBalance && !sessionStorage.getItem('initial_balance_${txId}')) {
                                sessionStorage.setItem('initial_balance_${txId}', currentBalance);
                                debug('İlk bakiye hafızaya alındı: ' + currentBalance);
                            }
                        }
                        
                        const cookieBtn = document.querySelector('#btn_cookie_ok');
                        if (cookieBtn && cookieBtn.style.display !== 'none') {
                            cookieBtn.click();
                        }
                        
                        const tutarInp = document.querySelector('#TUTAR');
                        const yukleBtn = document.querySelector('button[onclick*="OnParaYukle"]');
                        
                        if (tutarInp && yukleBtn && !window._amountSubmitted) {
                            window._amountSubmitted = true;
                            log('Tutar giriliyor: ${amount}...');
                            tutarInp.value = '${amount}';
                            
                            tutarInp.dispatchEvent(new Event('input', { bubbles: true }));
                            tutarInp.dispatchEvent(new Event('change', { bubbles: true }));
                            
                            yukleBtn.click();
                        }
                        
                        const swalBtn = document.querySelector('button.swal2-confirm');
                        if (swalBtn && swalBtn.innerText.includes('Evet') && !window._redirecting) {
                            window._redirecting = true;
                            log('Tutar onaylanıyor...');
                            sessionStorage.setItem('payment_stage_${txId}', Date.now().toString());
                            swalBtn.click();
                        }
                    }
                    
                    const panInp = document.querySelector('#cc-num');
                    if (panInp && !window._cardFilled) {
                        window._cardFilled = true;
                        log('Kart bilgileri dolduruluyor...');
                        document.querySelector('#cc-chn').value = '${card.name}';
                        document.querySelector('#cc-num').value = '${card.number}';
                        document.querySelector('#cc-exp-mm').value = '${card.expMonth}';
                        document.querySelector('#cc-exp-yy').value = '${card.expYear}';
                        document.querySelector('#cc-cvc').value = '${card.cvv}';
                        document.querySelector('#submit-btn').click();
                        log('Ödeme isteği gönderildi, 3D onay bekleniyor...');
                    }
                    
                    const isOtpScreen = !url.includes('kampuskart.itu.edu.tr') && !url.includes('virtualpospaymentgateway.akbank.com');
                    if (isOtpScreen && !window._madeInteractive) {
                        window._madeInteractive = true;
                        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'interactive'}));
                        log('Lütfen banka doğrulamasını tamamlayınız.');
                    }
                    
                    const btnGonder = document.querySelector('#SubmitButton');
                    if (btnGonder && !window._submitBtnClicked) {
                        btnGonder.addEventListener('click', () => log('Onay gönderiliyor...'));
                        window._submitBtnClicked = true;
                    }
                    
                }, 200);
            })();
            true;
        `;
    };



    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Ödeme Adımları</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.statusContainer}>
                    <View style={styles.statusCard}>
                        {logs.length > 0 && !logs[logs.length - 1].includes('başarılı') && !logs[logs.length - 1].includes('HATA') ? (
                            <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 12 }} />
                        ) : (
                            <MaterialCommunityIcons
                                name={logs.length > 0 && logs[logs.length - 1].includes('başarılı') ? "check-circle" : "information"}
                                size={24}
                                color={logs.length > 0 && logs[logs.length - 1].includes('başarılı') ? '#10b981' : colors.accent}
                                style={{ marginRight: 12 }}
                            />
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.statusTitle}>İşlem Durumu</Text>
                            <Text style={styles.statusText} numberOfLines={2}>
                                {logs.length > 0 ? logs[logs.length - 1] : "Hazırlanıyor..."}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.webviewWrapper} pointerEvents={isInteractive ? "auto" : "none"}>
                    {credentials && txId ? (
                        <WebView
                            key={txId}
                            ref={webviewRef}
                            source={{ uri: 'https://kampuskart.itu.edu.tr/User/LoginITU' }}
                            style={[styles.webview, { backgroundColor: 'transparent' }]}
                            injectedJavaScript={getInjectedScript()}
                            onMessage={handleMessage}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            startInLoadingState={true}
                            incognito={true}
                            cacheEnabled={false}
                            opaque={false}
                            mixedContentMode="always"
                            thirdPartyCookiesEnabled={true}
                            sharedCookiesEnabled={false}
                            androidLayerType="hardware"
                            allowFileAccess={false}
                            allowFileAccessFromFileURLs={false}
                            allowUniversalAccessFromFileURLs={false}
                            setSupportMultipleWindows={false}
                            allowsBackForwardNavigationGestures={false}
                            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
                            onNavigationStateChange={handleNavigationStateChange}
                            onLoadStart={handleLoadStart}
                            onLoadEnd={handleLoadEnd}
                            onLoadProgress={handleLoadProgress}
                            onError={handleError}
                            onHttpError={handleHttpError}
                            onFileDownload={handleFileDownload}
                            onOpenWindow={handleOpenWindow}
                            renderLoading={() => (
                                <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
                            )}
                        />
                    ) : (
                        <View style={styles.loader}>
                            <ActivityIndicator size="large" color={colors.accent} />
                            <Text style={{ color: colors.muted, marginTop: 10 }}>Kimlik bilgileri bekleniyor...</Text>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
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
    closeBtn: {
        padding: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    statusContainer: {
        padding: 16,
        backgroundColor: colors.bg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    statusTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text,
    },
    webviewWrapper: {
        flex: 1,
    },
    webview: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    loader: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -20 }, { translateY: -20 }],
        alignItems: 'center',
        justifyContent: 'center'
    }
});
