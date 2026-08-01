import React, { useState, useCallback } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    FlatList, ActivityIndicator, Linking, Keyboard, Platform, StatusBar, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import ituRehberService from '../../services/ituRehberService';

const BAR_BG = 'rgba(41, 121, 255, 0.08)';

const PersonCard = ({ person }) => {
    const [expanded, setExpanded] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [details, setDetails] = useState(null);

    const toggleExpand = async () => {
        if (expanded) {
            setExpanded(false);
            return;
        }

        Keyboard.dismiss();
        setExpanded(true);

        if (!details && person.PublicObjectId) {
            setLoadingDetails(true);
            try {
                const contactList = await ituRehberService.getPersonDetails(person.PublicObjectId);
                setDetails(contactList);
            } catch (e) {
                console.error("Detay cekilemedi:", e);
                setDetails([]);
            } finally {
                setLoadingDetails(false);
            }
        }
    };

    const handleEmail = (email) => {
        Linking.openURL(`mailto:${email}`).catch(err => {
            console.log('Mail acilamadi', err);
            Alert.alert("Hata", "Telefonda kurulu bir mail uygulaması bulunamadı.");
        });
    };

    const handleCall = (phone) => {
        let cleanPhone = phone.replace(/[^0-9+]/g, '');
        if (cleanPhone.startsWith('90') && !cleanPhone.startsWith('+')) {
            cleanPhone = '+' + cleanPhone;
        }
        Linking.openURL(`tel:${cleanPhone}`).catch(err => {
            console.log('Arama yapilamadi', err);
            Alert.alert("Hata", "Arama yapılamadı. (Eğer simülatördeyseniz arama desteklenmez)");
        });
    };

    const handleLink = (url) => {
        Linking.openURL(url).catch(err => {
            console.log('Link acilamadi', err);
            Alert.alert("Hata", "Link açılamadı.");
        });
    }

    const isAcademic = person.PrimaryIdentityTypeName === 'Akademik' || person.PrimaryIdentityTypeName === 'Emekli Ak.' || !!person.AcademicTitle;
    const isStudent = person.PrimaryIdentityTypeName === 'Öğrenci';

    const displayUnit = person.UnitName || person.ParentUnitName || 'Birim bilgisi bulunmuyor';
    const displayType = person.PrimaryIdentityTypeName || (person.AcademicTitle ? 'Akademik' : 'Bilinmiyor');

    return (
        <TouchableOpacity style={styles.card} onPress={toggleExpand} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconWrapper, { backgroundColor: isAcademic ? 'rgba(230, 168, 34, 0.15)' : BAR_BG }]}>
                    <MaterialCommunityIcons
                        name={isAcademic ? "school" : isStudent ? "account-school" : "account"}
                        size={24}
                        color={isAcademic ? colors.warning : colors.accent}
                    />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.nameText}>
                        {person.AcademicTitle ? `${person.AcademicTitle} ` : ''}{person.Name} {person.Surname}
                    </Text>
                    <Text style={styles.unitText}>{displayUnit}</Text>
                    <Text style={styles.typeText}>{displayType}</Text>
                </View>
                <MaterialCommunityIcons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={24}
                    color={colors.muted}
                />
            </View>

            {expanded && (
                <View style={styles.detailsContainer}>
                    <View style={styles.divider} />

                    {loadingDetails ? (
                        <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 10 }} />
                    ) : (
                        details && details.length > 0 ? (
                            details.map((contact, idx) => {
                                const isEmail = contact.ContactTypeName.includes('E-posta');
                                const isPhone = contact.ContactTypeName.includes('Telefon');
                                const isLink = contact.ContactValue.startsWith('http');

                                return (
                                    <View key={idx} style={styles.contactRow}>
                                        <View style={styles.contactLabel}>
                                            <MaterialCommunityIcons
                                                name={isEmail ? "email-outline" : isPhone ? "phone-outline" : "web"}
                                                size={18}
                                                color={colors.muted}
                                            />
                                            <Text style={styles.contactTypeText}>{contact.ContactTypeName}</Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => {
                                                if (isEmail) handleEmail(contact.ContactValue);
                                                else if (isPhone) handleCall(contact.ContactValue);
                                                else if (isLink) handleLink(contact.ContactValue);
                                            }}
                                            style={[styles.actionBtn, isEmail ? styles.actionBtnMail : isPhone ? styles.actionBtnPhone : {}]}
                                        >
                                            <Text style={[styles.contactValueText, isEmail || isPhone || isLink ? { color: isEmail ? colors.accent : colors.success } : {}]}>
                                                {contact.ContactValue}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })
                        ) : (
                            <Text style={styles.noContactText}>İletişim bilgisi bulunamadı.</Text>
                        )
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
};

export default function RehberScreen({ navigation }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleSearch = async () => {
        if (query.trim().length < 3) return;

        Keyboard.dismiss();
        setLoading(true);
        setSearched(true);

        try {
            const data = await ituRehberService.searchPerson(query.trim());
            setResults(data);
        } catch (error) {
            console.error("Rehber search err:", error);
            setResults([]);
        } finally {
            setLoading(false);
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
                    <MaterialCommunityIcons name="card-account-details-outline" size={22} color={colors.accent} />
                    <Text style={styles.title}>İTÜ Rehber</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={22} color={colors.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="İsim veya Soyisim yazın..."
                        placeholderTextColor={colors.muted}
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        autoCapitalize="words"
                        autoCorrect={false}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
                            <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={[styles.searchButton, query.length < 3 && styles.searchButtonDisabled]}
                    onPress={handleSearch}
                    disabled={query.length < 3 || loading}
                >
                    <Text style={styles.searchButtonText}>Ara</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.centerStateText}>Aranıyor...</Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item, index) => item.PublicObjectId || index.toString()}
                    renderItem={({ item }) => <PersonCard person={item} />}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={() => (
                        searched ? (
                            <View style={styles.centerState}>
                                <MaterialCommunityIcons name="account-search-outline" size={48} color={colors.muted} />
                                <Text style={styles.centerStateText}>Sonuç bulunamadı.</Text>
                            </View>
                        ) : (
                            <View style={styles.centerState}>
                                <MaterialCommunityIcons name="book-search-outline" size={48} color={colors.accent} />
                                <Text style={styles.centerStateText}>Akademisyen veya öğrenci aramak için bir isim yazın.</Text>
                            </View>
                        )
                    )}
                />
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
    },
    headerBtn: { padding: 8, borderRadius: 12, backgroundColor: colors.card },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: {
        fontSize: 20, fontWeight: 'bold', color: colors.text,
        textShadowColor: colors.accentGlow, textShadowRadius: 8,
    },

    searchContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        zIndex: 10
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: colors.card, borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        borderWidth: 1, borderColor: colors.border,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 16 },
    searchButton: {
        backgroundColor: colors.accent,
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderRadius: 14,
    },
    searchButtonDisabled: {
        backgroundColor: colors.cardHover,
    },
    searchButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16,
    },

    listContent: { paddingHorizontal: 16, paddingBottom: 40 },

    card: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardInfo: {
        flex: 1,
    },
    nameText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    unitText: {
        color: colors.textSecondary,
        fontSize: 13,
        marginBottom: 2,
    },
    typeText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
    },

    detailsContainer: {
        marginTop: 12,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginBottom: 12,
    },
    contactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    contactLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    contactTypeText: {
        color: colors.muted,
        fontSize: 13,
    },
    contactValueText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionBtnMail: {
        backgroundColor: 'rgba(41, 121, 255, 0.1)',
        borderColor: 'rgba(41, 121, 255, 0.3)',
    },
    actionBtnPhone: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    noContactText: {
        color: colors.muted,
        fontStyle: 'italic',
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 8,
    },

    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    centerStateText: {
        color: colors.muted,
        marginTop: 16,
        fontSize: 15,
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 22,
    }
});
