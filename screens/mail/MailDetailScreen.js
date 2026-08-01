import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet, Text, View, Platform, StatusBar,
    ActivityIndicator, Animated, Alert, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { TouchableOpacity } from 'react-native';
import { colors } from '../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import mailService from '../../services/mailService';
import ituApi from '../../services/ituApi';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import FileViewer from 'react-native-file-viewer';

export default function MailDetailScreen({ navigation, route }) {
    const { mail } = route.params;

    const [detailBody, setDetailBody] = useState('');
    const [detailLoading, setDetailLoading] = useState(true);
    const [webViewReady, setWebViewReady] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [downloadingId, setDownloadingId] = useState(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const userEmail = ituApi.userInfo?.email || '';

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
        }).start();
        loadMailBody();
    }, []);

    const loadMailBody = async () => {
        const savedPassword = await mailService.getSavedPassword();
        if (!savedPassword) {
            setDetailBody('<p style="color:#ff1744;">Oturum bulunamadı.</p>');
            setDetailLoading(false);
            return;
        }

        const result = await mailService.fetchMailBody(userEmail, savedPassword, mail.seqNum);
        if (result.success) {
            setDetailBody(result.body);
            if (result.attachments && result.attachments.length > 0) {
                setAttachments(result.attachments);
            }
        } else {
            setDetailBody('<p style="color:#ff1744;">Mail içeriği yüklenemedi.</p>');
        }
        setDetailLoading(false);
    };

    const handleDownloadAttachment = async (attachment) => {
        try {
            setDownloadingId(attachment.partId);
            const savedPassword = await mailService.getSavedPassword();
            if (!savedPassword) {
                Alert.alert('Hata', 'Oturum bulunamadı.');
                return;
            }

            const result = await mailService.fetchAttachment(
                userEmail, savedPassword, mail.seqNum, attachment
            );

            if (!result.success) {
                Alert.alert('Hata', result.error || 'Ek indirilemedi.');
                return;
            }

            const fileUri = FileSystem.cacheDirectory + attachment.filename;
            await FileSystem.writeAsStringAsync(fileUri, result.base64, {
                encoding: 'base64',
            });

            try {
                await FileViewer.open(fileUri, { showOpenWithDialog: false });
            } catch (err) {
                console.log("[FileViewer] Açılamadı, paylaşım menüsüne düşülüyor…", err);
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, {
                        mimeType: attachment.mimeType,
                        dialogTitle: attachment.filename,
                    });
                } else {
                    Alert.alert('Başarılı', `${attachment.filename} indirildi.`);
                }
            }
        } catch (error) {
            console.error('[MailDetail] Download error:', error);
            Alert.alert('Hata', 'Dosya indirilemedi.');
        } finally {
            setDownloadingId(null);
        }
    };

    const showLoading = detailLoading || (detailBody && !webViewReady);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>E-Posta</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.body}>
                {detailBody ? (
                    <WebView
                        originWhitelist={['*']}
                        source={{ html: getFullHtml(mail, detailBody, !isHtml(detailBody), attachments) }}
                        style={[styles.webView, !webViewReady && { opacity: 0 }]}
                        scrollEnabled={true}
                        showsVerticalScrollIndicator={true}
                        decelerationRate="normal"
                        onLoadEnd={() => setWebViewReady(true)}
                        onMessage={(event) => {

                            try {
                                const data = JSON.parse(event.nativeEvent.data);
                                if (data.action === 'download' && data.partId) {
                                    const att = attachments.find(a => a.partId === data.partId);
                                    if (att) handleDownloadAttachment(att);
                                }
                            } catch (e) { }
                        }}
                        onShouldStartLoadWithRequest={(request) => {
                            if (request.url !== 'about:blank' && !request.url.startsWith('data:')) {
                                return false;
                            }
                            return true;
                        }}
                    />
                ) : !detailLoading ? (
                    <View style={styles.bodyLoading}>
                        <Text style={styles.bodyText}>İçerik bulunamadı.</Text>
                    </View>
                ) : null}

                {showLoading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={colors.accent} />
                        <Text style={styles.loadingText}>İçerik yükleniyor...</Text>
                    </View>
                )}

                {downloadingId && (
                    <View style={styles.downloadOverlay}>
                        <View style={styles.downloadCard}>
                            <ActivityIndicator size="small" color={colors.accent} />
                            <Text style={styles.downloadText}>Ek indiriliyor...</Text>
                        </View>
                    </View>
                )}
            </View>
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

function isHtml(text) {
    return /<[a-z][\s\S]*>/i.test(text);
}

function getFullHtml(mail, body, isPureText, attachments = []) {
    let safeBody = body;
    if (isPureText) {
        safeBody = body
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>');
    } else {

        safeBody = safeBody
            .replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>')
            .replace(/<p[^>]*>\s*(&nbsp;\s*|\u00a0\s*)*<\/p>/gi, '')
            .replace(/<div[^>]*>\s*(&nbsp;\s*|\u00a0\s*)*<\/div>/gi, '')
            .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
            .replace(/mso-[^;"]+;?/gi, '');                                     // Remove all mso- inline styles
    }

    safeBody = safeBody.replace(
        /(?:_{10,}|<hr[^>]*>)?[\s\S]{0,150}mailing list --[\s\S]{0,150}To unsubscribe send an email to[\s\S]{0,150}listeci\.itu\.edu\.tr(?:<\/a>)?(?:<\/p>|<\/div>|<br\s*\/?>|\s)*/gi,
        ''
    );

    safeBody = safeBody.replace(/_{20,}/g, '<span class="underscore-divider">$&</span>');

    const avatarColor = getAvatarColor(mail.from);
    const avatarLetter = (mail.from || '?').charAt(0).toUpperCase();
    const subject = (mail.subject || 'Başlıksız').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const from = (mail.from || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fromEmail = (mail.fromEmail || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const date = (mail.date || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html>
<head>
    <meta id="viewport" name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { background-color: #000000; }
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px;
            line-height: 1.6;
            background-color: #ffffff;
            color: #000000;
            word-wrap: break-word;
            overflow-wrap: break-word;
            filter: invert(1) hue-rotate(180deg);
            -webkit-overflow-scrolling: touch;
        }
        img, picture, video, iframe, svg, canvas {
            filter: invert(1) hue-rotate(180deg);
        }
        a { color: #0056b3; }
        p, .MsoNormal { margin: 0 0 0.8em 0; padding: 0; }
        div, table, td, span, center { max-width: 100% !important; height: auto !important; }
        o\:p { display: none !important; }
        img { max-width: 100% !important; height: auto !important; display: block; margin: 0 auto; }
        pre, code { white-space: pre-wrap; word-wrap: break-word; max-width: 100%; overflow-x: hidden; }
        blockquote { border-left: 3px solid #252A36; padding-left: 12px; margin: 8px 0; color: #A0AEC0; }
        .underscore-divider {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: clip;
            max-width: 100%;
        }

        .mail-header {
            padding: 16px;
            border-bottom: 1px solid #1E2330;
        }
        .mail-subject {
            font-size: 20px;
            font-weight: bold;
            color: #000;
            margin-bottom: 16px;
            line-height: 1.4;
        }
        .mail-meta {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 12px;
        }
        .mail-avatar {
            width: 44px;
            height: 44px;
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            filter: invert(1) hue-rotate(180deg);
        }
        .mail-avatar span {
            color: #fff;
            font-size: 20px;
            font-weight: bold;
        }
        .mail-from {
            font-size: 16px;
            font-weight: 600;
            color: #000;
        }
        .mail-email {
            font-size: 13px;
            color: #666;
            margin-top: 2px;
        }
        .mail-date {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        }
        .mail-body {
            padding: 16px;
        }

        .attachments-section {
            padding: 16px;
            border-top: 1px solid #1E2330;
        }
        .attachments-title {
            font-size: 13px;
            font-weight: 700;
            color: #555;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }
        .attachment-card {
            display: flex;
            flex-direction: row;
            align-items: center;
            background: #f8f8f8;
            border: 1px solid #e0e0e0;
            border-radius: 14px;
            padding: 12px 14px;
            margin-bottom: 8px;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.1s, background 0.15s;
        }
        .attachment-card:active {
            background: #efefef;
            transform: scale(0.98);
        }
        .attachment-info {
            flex: 1;
            min-width: 0;
        }
        .attachment-name {
            font-size: 14px;
            font-weight: 600;
            color: #000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .attachment-detail {
            font-size: 12px;
            color: #888;
            margin-top: 3px;
        }
        .attachment-btn {
            width: 38px;
            height: 38px;
            border-radius: 19px;
            background: #1a73e8;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-left: 8px;
            filter: invert(1) hue-rotate(180deg);
        }
        .attachment-btn svg {
            width: 18px;
            height: 18px;
            fill: white;
        }
    </style>
</head>
<body>
    <div class="mail-header">
        <div class="mail-subject">${subject}</div>
        <div class="mail-meta">
            <div class="mail-avatar" style="background-color: ${avatarColor};">
                <span>${avatarLetter}</span>
            </div>
            <div>
                <div class="mail-from">${from}</div>
                <div class="mail-email">${fromEmail}</div>
                <div class="mail-date">${date}</div>
            </div>
        </div>
    </div>
    <div class="mail-body">
        ${safeBody}
    </div>
    ${attachments.length > 0 ? `
    <div class="attachments-section">
        <div class="attachments-title">Ekler (${attachments.length})</div>
        ${attachments.map(att => {
        const ext = (att.filename || '').split('.').pop().toLowerCase();
        const iconInfo = getFileIcon(ext, att.mimeType);
        const sizeStr = formatFileSize(att.size);
        return `
            <div class="attachment-card" onclick="downloadAttachment('${att.partId}')">
                <div class="attachment-info">
                    <div class="attachment-name">${(att.filename || 'Ek').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                    <div class="attachment-detail">${sizeStr}</div>
                </div>
                <div class="attachment-btn"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></div>
            </div>`;
    }).join('')}
    </div>
    ` : ''}
    <script>
        function adjustViewport() {
            var scrollW = document.documentElement.scrollWidth || document.body.scrollWidth;
            var winW = window.innerWidth;
            if (scrollW > winW) {
                document.getElementById('viewport').setAttribute('content', 'width=' + scrollW + ', initial-scale=' + (winW / scrollW));
            }
        }
        function downloadAttachment(partId) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'download', partId: partId }));
        }
        adjustViewport();
        window.onload = adjustViewport;
    </script>
</body>
</html>`;
}

function getFileIcon(ext, mimeType) {
    const icons = {
        pdf: { emoji: '📄', bg: '#ffebee' },
        doc: { emoji: '📝', bg: '#e3f2fd' },
        docx: { emoji: '📝', bg: '#e3f2fd' },
        xls: { emoji: '📊', bg: '#e8f5e9' },
        xlsx: { emoji: '📊', bg: '#e8f5e9' },
        ppt: { emoji: '📑', bg: '#fff3e0' },
        pptx: { emoji: '📑', bg: '#fff3e0' },
        zip: { emoji: '📦', bg: '#f3e5f5' },
        rar: { emoji: '📦', bg: '#f3e5f5' },
        jpg: { emoji: '🖼️', bg: '#e8eaf6' },
        jpeg: { emoji: '🖼️', bg: '#e8eaf6' },
        png: { emoji: '🖼️', bg: '#e8eaf6' },
        gif: { emoji: '🖼️', bg: '#e8eaf6' },
        mp3: { emoji: '🎵', bg: '#fce4ec' },
        mp4: { emoji: '🎬', bg: '#e0f2f1' },
        txt: { emoji: '📃', bg: '#f5f5f5' },
    };
    return icons[ext] || { emoji: '📎', bg: '#f5f5f5' };
}

function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        flex: 1,
        textAlign: 'center',
    },
    body: {
        flex: 1,
    },
    bodyLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        color: colors.textSecondary,
        fontSize: 14,
        marginTop: 16,
    },
    webView: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.bg,
    },
    downloadOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    downloadCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.card,
        borderRadius: 16,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    downloadText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
    },
    bodyText: {
        color: colors.textSecondary,
        fontSize: 15,
        lineHeight: 24,
        padding: 16,
    },
});
