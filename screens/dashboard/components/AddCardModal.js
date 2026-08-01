import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const isValidLuhn = (value) => {
    let nCheck = 0;
    let bEven = false;
    value = value.replace(/\D/g, "");

    for (let n = value.length - 1; n >= 0; n--) {
        let cDigit = value.charAt(n);
        let nDigit = parseInt(cDigit, 10);

        if (bEven && (nDigit *= 2) > 9) {
            nDigit -= 9;
        }

        nCheck += nDigit;
        bEven = !bEven;
    }

    return (nCheck % 10) === 0;
};

export default function AddCardModal({ visible, onClose, onSave }) {
    const [cardTag, setCardTag] = useState('');
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expMonth, setExpMonth] = useState('');
    const [expYear, setExpYear] = useState('');
    const [cvv, setCvv] = useState('');

    const monthRef = useRef(null);
    const yearRef = useRef(null);
    const cvvRef = useRef(null);

    const handleCardNumberChange = (text) => {
        const cleaned = text.replace(/\D/g, '');
        let formattedText = cleaned.replace(/(\d{4})/g, '$1 ').trim();
        if (formattedText.length <= 19) {
            setCardNumber(formattedText);
            if (formattedText.length === 19) {
                if (isValidLuhn(cleaned)) {
                    monthRef.current?.focus();
                }
            }
        }
    };

    const num = cardNumber.replace(/\s/g, '');
    const isCardInvalid = num.length === 16 && !isValidLuhn(num);

    const handleSave = () => {
        if (isCardInvalid) return;

        if (!cardName || !cardTag || num.length !== 16 || expMonth.length !== 2 || expYear.length !== 2 || cvv.length !== 3) {
            alert('Lütfen tüm bilgileri eksiksiz ve doğru formatta giriniz.');
            return;
        }



        const newCard = {
            id: Date.now().toString(),
            tag: cardTag,
            name: cardName,
            number: num,
            last4: num.slice(-4),
            expMonth,
            expYear,
            cvv,
            brand: num.startsWith('4') ? 'visa' : 'mastercard'
        };

        onSave(newCard);

        setCardTag('');
        setCardName('');
        setCardNumber('');
        setExpMonth('');
        setExpYear('');
        setCvv('');
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <KeyboardAvoidingView
                        behavior="padding"
                        style={styles.keyboardView}
                    >
                        <View style={styles.modalContainer}>
                            <View style={styles.header}>
                                <Text style={styles.title}>Yeni Kart Ekle</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.form}>
                                <Text style={styles.label}>Kart İsmi (Örn: Ziraat, Garanti)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Kart Etiketi"
                                    placeholderTextColor={colors.muted}
                                    value={cardTag}
                                    onChangeText={setCardTag}
                                />

                                <Text style={styles.label}>Kart Üzerindeki İsim</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ad Soyad"
                                    placeholderTextColor={colors.muted}
                                    value={cardName}
                                    onChangeText={setCardName}
                                    autoCapitalize="words"
                                />

                                <Text style={styles.label}>Kart Numarası</Text>
                                <TextInput
                                    style={[styles.input, isCardInvalid && { borderColor: '#EF4444', color: '#EF4444' }]}
                                    placeholder="0000 0000 0000 0000"
                                    placeholderTextColor={colors.muted}
                                    value={cardNumber}
                                    onChangeText={handleCardNumberChange}
                                    keyboardType="number-pad"
                                    maxLength={19}
                                />
                                {isCardInvalid && <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4 }}>Geçersiz kart numarası</Text>}

                                <View style={styles.row}>
                                    <View style={styles.halfCol}>
                                        <Text style={styles.label}>Son Kullanma Tarihi</Text>
                                        <View style={styles.dateRow}>
                                            <TextInput
                                                ref={monthRef}
                                                style={[styles.input, { flex: 1, textAlign: 'center' }]}
                                                placeholder="Ay"
                                                placeholderTextColor={colors.muted}
                                                value={expMonth}
                                                onChangeText={(text) => {
                                                    const val = text.replace(/\D/g, '');
                                                    setExpMonth(val);
                                                    if (val.length === 2) {
                                                        yearRef.current?.focus();
                                                    }
                                                }}
                                                keyboardType="number-pad"
                                                maxLength={2}
                                            />
                                            <Text style={styles.slash}>/</Text>
                                            <TextInput
                                                ref={yearRef}
                                                style={[styles.input, { flex: 1, textAlign: 'center' }]}
                                                placeholder="Yıl"
                                                placeholderTextColor={colors.muted}
                                                value={expYear}
                                                onChangeText={(text) => {
                                                    const val = text.replace(/\D/g, '');
                                                    setExpYear(val);
                                                    if (val.length === 2) {
                                                        cvvRef.current?.focus();
                                                    }
                                                }}
                                                keyboardType="number-pad"
                                                maxLength={2}
                                            />
                                        </View>
                                    </View>
                                    <View style={styles.halfCol}>
                                        <Text style={styles.label}>CVV</Text>
                                        <TextInput
                                            ref={cvvRef}
                                            style={styles.input}
                                            placeholder="123"
                                            placeholderTextColor={colors.muted}
                                            value={cvv}
                                            onChangeText={(text) => setCvv(text.replace(/\D/g, ''))}
                                            keyboardType="number-pad"
                                            maxLength={3}
                                            secureTextEntry
                                        />
                                    </View>
                                </View>
                            </View>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <MaterialCommunityIcons name="content-save-outline" size={20} color={colors.bg} />
                                <Text style={styles.saveBtnText}>Kartı Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    keyboardView: {
        width: '100%',
    },
    modalContainer: {
        backgroundColor: colors.bg,
        borderRadius: 24,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    closeBtn: {
        padding: 4,
    },
    form: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: colors.text,
        fontSize: 15,
    },
    row: {
        flexDirection: 'row',
        gap: 16,
    },
    halfCol: {
        flex: 1,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    slash: {
        fontSize: 20,
        color: colors.textSecondary,
        marginHorizontal: 8,
    },
    saveBtn: {
        backgroundColor: colors.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
    },
    saveBtnText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: colors.bg,
    }
});
