import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Animated, PanResponder } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../../../constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AddCardModal from './AddCardModal';

const QUICK_AMOUNTS = [50, 100, 200, 500];

const SwipeableCard = ({ card, isSelected, onPress, onDelete }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const [isSwiped, setIsSwiped] = useState(false);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return Math.abs(gestureState.dx) > 10;
            },
            onPanResponderMove: (evt, gestureState) => {
                if (gestureState.dx < 0) {
                    pan.setValue({ x: gestureState.dx, y: 0 });
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (gestureState.dx < -50) {
                    Animated.spring(pan, { toValue: { x: -68, y: 0 }, useNativeDriver: true }).start();
                    setIsSwiped(true);
                } else {
                    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
                    setIsSwiped(false);
                }
            }
        })
    ).current;

    const deleteTranslateX = pan.x.interpolate({
        inputRange: [-68, 0],
        outputRange: [0, 68],
        extrapolate: 'clamp'
    });

    return (
        <View style={styles.swipeContainer}>
            <Animated.View style={[styles.deleteAction, { transform: [{ translateX: deleteTranslateX }] }]}>
                <TouchableOpacity onPress={() => onDelete(card.id)} style={styles.deleteBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={24} color="#FFF" />
                </TouchableOpacity>
            </Animated.View>
            <Animated.View
                {...panResponder.panHandlers}
                style={[styles.cardItem, isSelected && styles.cardItemActive, { transform: [{ translateX: pan.x }] }]}
            >
                <TouchableOpacity activeOpacity={1} onPress={() => {
                    if (isSwiped) {
                        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
                        setIsSwiped(false);
                    } else {
                        onPress();
                    }
                }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons 
                        name={card.brand === 'mastercard' ? 'credit-card-outline' : 'credit-card'} 
                        size={28} 
                        color={isSelected ? colors.accent : colors.muted} 
                    />
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>{card.tag || card.name}</Text>
                        <Text style={styles.cardNumber}>**** **** **** {card.last4}</Text>
                    </View>
                    {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={24} color={colors.accent} />
                    )}
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

export default function TopUpModal({ visible, onClose, onSubmit }) {
    const [amount, setAmount] = useState('');
    const [cards, setCards] = useState([]);
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [isAddCardVisible, setIsAddCardVisible] = useState(false);

    useEffect(() => {
        if (visible) {
            loadCards();
        }
    }, [visible]);

    const loadCards = async () => {
        try {
            const saved = await SecureStore.getItemAsync('saved_payment_cards');
            if (saved) {
                const parsed = JSON.parse(saved);
                setCards(parsed);
                if (parsed.length > 0 && !selectedCardId) {
                    setSelectedCardId(parsed[0].id);
                }
            }
        } catch (e) {
            console.log("Kartlar yüklenemedi:", e);
        }
    };

    const handleSaveCard = async (newCard) => {
        try {
            const updatedCards = [...cards, newCard];
            await SecureStore.setItemAsync('saved_payment_cards', JSON.stringify(updatedCards));
            setCards(updatedCards);
            setSelectedCardId(newCard.id);
            setIsAddCardVisible(false);
        } catch (e) {
            console.log("Kart kaydedilemedi:", e);
        }
    };

    const handleDeleteCard = async (id) => {
        try {
            const updated = cards.filter(c => c.id !== id);
            await SecureStore.setItemAsync('saved_payment_cards', JSON.stringify(updated));
            setCards(updated);
            if (selectedCardId === id) setSelectedCardId(null);
        } catch (e) {
            console.log("Kart silinemedi:", e);
        }
    };

    const handleAmountSelect = (val) => {
        setAmount(val.toString());
    };

    const handleSubmit = () => {
        if (!amount || isNaN(amount) || Number(amount) <= 0 || !selectedCardId) return;
        const card = cards.find(c => c.id === selectedCardId);
        onSubmit(amount, card);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <KeyboardAvoidingView 
                        behavior="padding"
                        style={styles.keyboardView}
                    >
                        <View style={styles.modalContainer}>
                            <View style={styles.header}>
                                <Text style={styles.title}>Bakiye Yükle</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                                
                                {/* Tutar Seçimi */}
                                <Text style={styles.sectionTitle}>Yüklenecek Tutar (₺)</Text>
                                <View style={styles.amountInputContainer}>
                                    <Text style={styles.currencySymbol}>₺</Text>
                                    <TextInput 
                                        style={styles.amountInput}
                                        keyboardType="numeric"
                                        placeholder="0"
                                        placeholderTextColor={colors.muted}
                                        value={amount}
                                        onChangeText={setAmount}
                                    />
                                </View>
                                
                                <View style={styles.quickAmountsRow}>
                                    {QUICK_AMOUNTS.map((val) => (
                                        <TouchableOpacity 
                                            key={val} 
                                            style={[styles.quickAmountBtn, amount === val.toString() && styles.quickAmountBtnActive]}
                                            onPress={() => handleAmountSelect(val)}
                                        >
                                            <Text style={[styles.quickAmountText, amount === val.toString() && styles.quickAmountTextActive]}>
                                                {val}₺
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Kart Seçimi */}
                                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Kayıtlı Kartlar</Text>
                                
                                {cards.length === 0 ? (
                                    <View style={[styles.cardItem, { borderStyle: 'dashed', backgroundColor: 'transparent' }]}>
                                        <MaterialCommunityIcons name="credit-card-off-outline" size={28} color={colors.muted} />
                                        <View style={styles.cardInfo}>
                                            <Text style={[styles.cardName, { color: colors.muted }]}>Kayıtlı kart bulunamadı.</Text>
                                            <Text style={styles.cardNumber}>Lütfen yükleme yapmak için bir kart ekleyin.</Text>
                                        </View>
                                    </View>
                                ) : (
                                    cards.map((card) => (
                                        <SwipeableCard
                                            key={card.id}
                                            card={card}
                                            isSelected={selectedCardId === card.id}
                                            onPress={() => setSelectedCardId(card.id)}
                                            onDelete={handleDeleteCard}
                                        />
                                    ))
                                )}

                                <TouchableOpacity style={styles.addCardBtn} onPress={() => setIsAddCardVisible(true)}>
                                    <MaterialCommunityIcons name="plus" size={20} color={colors.textSecondary} />
                                    <Text style={styles.addCardText}>Yeni Kart Ekle</Text>
                                </TouchableOpacity>

                            </ScrollView>

                            {/* İşlem Butonu */}
                            <View style={styles.footer}>
                                <TouchableOpacity 
                                    style={[styles.submitBtn, (!amount || Number(amount) <= 0 || !selectedCardId) && styles.submitBtnDisabled]}
                                    onPress={handleSubmit}
                                    disabled={!amount || Number(amount) <= 0 || !selectedCardId}
                                >
                                    <Text style={styles.submitBtnText}>Yüklemeyi Başlat</Text>
                                    <MaterialCommunityIcons name="arrow-right" size={20} color={colors.bg} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>

            <AddCardModal 
                visible={isAddCardVisible} 
                onClose={() => setIsAddCardVisible(false)} 
                onSave={handleSaveCard} 
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    keyboardView: {
        width: '100%',
        maxHeight: '90%',
    },
    modalContainer: {
        backgroundColor: colors.bg,
        borderRadius: 24,
        padding: 20,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    closeBtn: {
        padding: 4,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 12,
    },
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 16,
    },
    currencySymbol: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.accent,
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
        padding: 0,
    },
    quickAmountsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    quickAmountBtn: {
        flex: 1,
        minWidth: '22%',
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickAmountBtnActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accent + '20',
    },
    quickAmountText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    quickAmountTextActive: {
        color: colors.accent,
    },
    cardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardItemActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accent + '10',
    },
    cardInfo: {
        flex: 1,
        marginLeft: 12,
    },
    cardName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    cardNumber: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    addCardBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.border,
        marginTop: 4,
        marginBottom: 20,
    },
    addCardText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
        marginLeft: 8,
    },
    footer: {
        marginTop: 10,
    },
    submitBtn: {
        backgroundColor: colors.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    submitBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.bg,
    },
    swipeContainer: {
        position: 'relative',
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
    },
    deleteAction: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 60,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
    },
    deleteBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    }
});
