import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  Modal,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../constants/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import obsApi from "../../services/obsApi";
import { useToast } from "../../components/common/Toast";
import { useAppStore } from "../../store/useAppStore";
import { useObsStore } from "../../store/useObsStore";
import { useNinovaStore } from "../../store/useNinovaStore";
import TutorialModal from "../../components/common/TutorialModal";

const TUTORIAL_KEY = "has_seen_tutorial_v1";

const AVAILABLE_SHORTCUTS = [
  {
    id: "obs",
    title: "OBS",
    icon: "book-education-outline",
    screen: "Courses",
  },
  { id: "ninova", title: "Ninova", icon: "school-outline", screen: "Ninova" },
  { id: "ring", title: "Ring", icon: "bus-side", screen: "Ring" },
  {
    id: "notes",
    title: "Ders Notları",
    icon: "notebook-outline",
    screen: "Notes",
  },
  { id: "rooms", title: "Boş Sınıf", icon: "door-open", screen: "Rooms" },
  {
    id: "schedule",
    title: "Ders Programı",
    icon: "calendar-clock",
    screen: "Schedule",
  },
  {
    id: "mail",
    title: "İTÜ Mail",
    icon: "email-outline",
    screen: "Mail"
  },
  {
    id: "rehber",
    title: "İTÜ Rehber",
    icon: "card-account-details-outline",
    screen: "Rehber"
  },
  {
    id: "academic_calendar",
    title: "Akademik Takvim",
    icon: "calendar-month-outline",
    screen: "AcademicCalendar"
  }
];
const SHORTCUTS_KEY = "user_shortcuts_pref";
const WIDGET_ORDER_KEY = "widget_order_pref";
const WIDGET_HIDDEN_KEY = "widget_hidden_pref";
const DEFAULT_WIDGET_ORDER = [
  "gpa",
  "food",
  "classes",
  "final",
  "wallet_grad",
  "tahmini_gpa",
  "attendance",
  "announcements",
  "tracked_events"
];

import WalletWidget from "./components/WalletWidget";
import FoodMenuWidget from "./components/FoodMenuWidget";
import UpcomingClassesWidget from "./components/UpcomingClassesWidget";
import AnnouncementsWidget from "./components/AnnouncementsWidget";
import GraduationWidget from "./components/GraduationWidget";
import AcademicStatusWidget from "./components/AcademicStatusWidget";
import RealTimeGPAWidget from "./components/RealTimeGPAWidget";
import AttendanceWidget from "./components/AttendanceWidget";
import FinalScheduleWidget from "./components/FinalScheduleWidget";
import TrackedEventsWidget from "./components/TrackedEventsWidget";
import TopUpModal from "./components/TopUpModal";
import PaymentWebViewModal from "./components/PaymentWebViewModal";
import shuttleService from "../../services/shuttleService";

export default function DashboardScreen({ navigation, route }) {
  const [activeShortcuts, setActiveShortcuts] = useState(
    route.params?.savedShortcuts || ["obs", "ninova", "ring", "notes", "mail"],
  );
  const [isEditing, setIsEditing] = useState(false);
  const [swapSourceId, setSwapSourceId] = useState(null);
  const [shortcutModalVisible, setShortcutModalVisible] = useState(false);
  const [isTopUpModalVisible, setIsTopUpModalVisible] = useState(false);
  
  // Payment WebView States
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(null);
  const [paymentCard, setPaymentCard] = useState(null);
  const [widgetOrder, setWidgetOrder] = useState(() => {
    const cached = route.params?.savedWidgetOrder;
    if (!cached || cached.length === 0) return DEFAULT_WIDGET_ORDER;

    const missingWidgets = DEFAULT_WIDGET_ORDER.filter(
      (w) => !cached.includes(w),
    );
    return [...cached, ...missingWidgets];
  });
  const [hiddenWidgets, setHiddenWidgets] = useState(
    route.params?.savedHiddenWidgets || [],
  );
  const [swapWidgetId, setSwapWidgetId] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const {
    announcements,
    globalRefreshing,
    widgetRefreshing,
    fetchInitialData,
    loadCache,
    refreshWidget,
    refreshAll,
  } = useAppStore();

  const {
    userData,
    setUserData,
    foodMenuOgle,
    foodMenuAksam,
    classes,
    graduationData,
    realTimeGpa,
    attendanceData,
    finalSchedule,
  } = useObsStore();

  const { activeHomeworks } = useNinovaStore();

  const [activeMeal, setActiveMeal] = useState(
    new Date().getHours() < 15 ? "ogle" : "aksam",
  );
  const { showToast, ToastComponent } = useToast();

  const toggleShortcut = async (id) => {
    let newShortcuts = [...activeShortcuts];
    if (newShortcuts.includes(id)) {
      newShortcuts = newShortcuts.filter((s) => s !== id);
    } else {
      if (newShortcuts.length >= 5) return;
      newShortcuts.push(id);
    }
    setActiveShortcuts(newShortcuts);
    await AsyncStorage.setItem(SHORTCUTS_KEY, JSON.stringify(newShortcuts));

    if (!newShortcuts.includes(id)) return;
    setShortcutModalVisible(false);
  };

  const handleShortcutPress = async (id, item) => {
    if (!isEditing) {
      navigation.navigate(item.screen);
      return;
    }

    if (swapSourceId === null) {
      setSwapSourceId(id);
    } else if (swapSourceId === id) {
      setSwapSourceId(null);
    } else {
      let newShortcuts = [...activeShortcuts];
      const idx1 = newShortcuts.indexOf(swapSourceId);
      const idx2 = newShortcuts.indexOf(id);
      if (idx1 !== -1 && idx2 !== -1) {
        [newShortcuts[idx1], newShortcuts[idx2]] = [
          newShortcuts[idx2],
          newShortcuts[idx1],
        ];
        setActiveShortcuts(newShortcuts);
        AsyncStorage.setItem(SHORTCUTS_KEY, JSON.stringify(newShortcuts));
      }
      setSwapSourceId(null);
    }
  };

  const handleWidgetPress = (id) => {
    if (!isEditing) return;
    if (swapWidgetId === null) {
      setSwapWidgetId(id);
    } else if (swapWidgetId === id) {
      setSwapWidgetId(null);
    } else {
      let newOrder = [...widgetOrder];
      const idx1 = newOrder.indexOf(swapWidgetId);
      const idx2 = newOrder.indexOf(id);
      if (idx1 !== -1 && idx2 !== -1) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        [newOrder[idx1], newOrder[idx2]] = [newOrder[idx2], newOrder[idx1]];
        setWidgetOrder(newOrder);
        AsyncStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(newOrder));
      }
      setSwapWidgetId(null);
    }
  };

  const toggleWidgetVisibility = (id) => {
    let newHidden = [...hiddenWidgets];
    if (newHidden.includes(id)) {
      newHidden = newHidden.filter((i) => i !== id);
    } else {
      newHidden.push(id);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHiddenWidgets(newHidden);
    AsyncStorage.setItem(WIDGET_HIDDEN_KEY, JSON.stringify(newHidden));
  };

  useEffect(() => {
    const checkTutorial = async () => {
      const hasSeen = await AsyncStorage.getItem(TUTORIAL_KEY);
      if (!hasSeen) {
        setShowTutorial(true);
      }
    };
    checkTutorial();
  }, []);

  const closeTutorial = async () => {
    setShowTutorial(false);
    await AsyncStorage.setItem(TUTORIAL_KEY, "true");
  };

  const renderWidget = (widgetId) => {
    const isSelected = swapWidgetId === widgetId;
    const isHidden = hiddenWidgets.includes(widgetId);

    if (!isEditing && isHidden) return null;

    const wrapperStyle = isEditing
      ? [
        styles.widgetWrapper,
        isSelected && styles.widgetSelected,
        isHidden && { opacity: 0.5 },
      ]
      : null;

    const isWR = !!widgetRefreshing[widgetId];
    const onWR = () => refreshWidget(widgetId);

    const content = (() => {
      switch (widgetId) {
        case "tahmini_gpa":
          return (
            <RealTimeGPAWidget
              data={realTimeGpa}
              onPress={
                isEditing
                  ? undefined
                  : () =>
                    navigation.navigate("GPASimulator", {
                      initialData: realTimeGpa,
                    })
              }
            />
          );
        case "gpa":
          return (
            <AcademicStatusWidget
              gpa={graduationData?.gpa}
              credits={graduationData?.metKrediTotal}
              onRefresh={onWR}
              refreshing={isWR}
              onPress={
                isEditing
                  ? undefined
                  : () => navigation.navigate("AcademicStatus")
              }
            />
          );
        case "classes":
          return (
            <UpcomingClassesWidget
              classes={classes}
              onRefresh={onWR}
              refreshing={isWR}
            />
          );
        case "food":
          return (
            <FoodMenuWidget
              mealType={activeMeal}
              onToggleMeal={() =>
                setActiveMeal((prev) => (prev === "ogle" ? "aksam" : "ogle"))
              }
              onRefresh={onWR}
              refreshing={isWR}
            />
          );
        case "wallet_grad":
          return (
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 5 }}>
                <WalletWidget
                  balance={userData.balance}
                  compact={true}
                  onRefresh={() => refreshWidget("wallet")}
                  refreshing={!!widgetRefreshing["wallet"]}
                  onTopUpPress={() => setIsTopUpModalVisible(true)}
                />
              </View>
              <TouchableOpacity
                style={{ flex: 1, marginLeft: 5 }}
                onPress={() => !isEditing && navigation.navigate("Graduation")}
                activeOpacity={0.8}
              >
                <GraduationWidget
                  earnedCredits={graduationData?.metKrediTotal}
                  requiredCredits={graduationData?.gerekliMezuniyetKredisi}
                  compact={true}
                  onRefresh={() => refreshWidget("graduation")}
                  refreshing={!!widgetRefreshing["graduation"]}
                />
              </TouchableOpacity>
            </View>
          );
        case "announcements":
          return (
            <AnnouncementsWidget
              announcements={announcements}
              onRefresh={onWR}
              refreshing={isWR}
            />
          );
        case "attendance":
          return (
            <AttendanceWidget
              data={attendanceData}
              onRefresh={onWR}
              refreshing={isWR}
              onPress={
                isEditing
                  ? undefined
                  : () => navigation.navigate("AttendanceDetails")
              }
            />
          );
        case "final":
          return (
            <FinalScheduleWidget
              finalSchedule={finalSchedule}
              onRefresh={onWR}
              refreshing={isWR}
            />
          );
        case "tracked_events":
          return (
            <TrackedEventsWidget
              onPress={
                isEditing
                  ? undefined
                  : () => navigation.navigate("AcademicCalendar")
              }
            />
          );
        default:
          return null;
      }
    })();

    if (!isEditing) return <View key={widgetId}>{content}</View>;

    return (
      <TouchableOpacity
        key={widgetId}
        style={wrapperStyle}
        onPress={() => handleWidgetPress(widgetId)}
        activeOpacity={0.9}
      >
        <View pointerEvents="none">{content}</View>
        {isSelected && (
          <View style={styles.widgetOverlay}>
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={32}
              color="#FFF"
            />
          </View>
        )}

        {isEditing && (
          <TouchableOpacity
            style={styles.hideWidgetBtn}
            onPress={() => toggleWidgetVisibility(widgetId)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isHidden ? "eye-off" : "eye"}
              size={20}
              color={isHidden ? colors.muted : colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedShortcuts = await AsyncStorage.getItem(SHORTCUTS_KEY);
        if (savedShortcuts) setActiveShortcuts(JSON.parse(savedShortcuts));

        const savedWidgets = await AsyncStorage.getItem(WIDGET_ORDER_KEY);
        if (savedWidgets) {
          const parsedWidgets = JSON.parse(savedWidgets);
          const missingWidgets = DEFAULT_WIDGET_ORDER.filter(
            (w) => !parsedWidgets.includes(w),
          );
          setWidgetOrder([...parsedWidgets, ...missingWidgets]);
        }

        const savedHidden = await AsyncStorage.getItem(WIDGET_HIDDEN_KEY);
        if (savedHidden) setHiddenWidgets(JSON.parse(savedHidden));
      } catch (e) { }
    };
    loadPreferences();
  }, []);

  useEffect(() => {
    console.log('[Dashboard] Cache yükleniyor...');
    loadCache();
  }, []);

  useEffect(() => {
    if (route.params?.userInfo) {
      const fNameStr = (route.params.userInfo.firstName || "").trim();
      const nameParts = fNameStr.split(/\s+/).filter(Boolean);

      let displayName = "Öğrenci";
      if (nameParts.length > 1) {
        displayName = nameParts[1];
      } else if (nameParts.length === 1) {
        displayName = nameParts[0];
      }

      setUserData({
        name: displayName,
        photo: route.params.userInfo.photo || null,
      });
    }

    console.log('[Dashboard] API verileri çekiliyor...');
    fetchInitialData();

    obsApi.fetchPersonalInformation().then(data => {
      if (!data || data.StatusCode === -1) {
        showToast("İTÜ sunucusu şu anda yanıt vermiyor", "error");
      }
    }).catch(() => {
      showToast("Sunucuya bağlanılamadı", "error");
    });

  }, [route.params]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {ToastComponent}
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>İyi Günler,</Text>
          <Text style={styles.username}>{userData.name}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
          <TouchableOpacity
            disabled={isEditing}
            style={{ opacity: isEditing ? 0.5 : 1 }}
            onPress={() => navigation.navigate("Notifications")}
          >
            <MaterialCommunityIcons
              name="bell-outline"
              size={28}
              color={colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            disabled={isEditing}
            style={[styles.avatarBtn, { opacity: isEditing ? 0.5 : 1 }]}
            onPress={() => navigation.navigate("Menu")}
          >
            {userData?.photo ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${userData.photo}` }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={[styles.avatarImg, { backgroundColor: '#fff' }]} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.shortcuts, { marginTop: 0, marginBottom: 15 }]}>
          {activeShortcuts.map((id, index) => {
            const item = AVAILABLE_SHORTCUTS.find((s) => s.id === id);
            if (!item) return null;

            const isSelectedForSwap = swapSourceId === id;

            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.shortcutBtn,
                  isEditing && { opacity: 1 },
                  isSelectedForSwap && { transform: [{ scale: 1.1 }] },
                ]}
                onPress={() => handleShortcutPress(id, item)}
                onLongPress={() => setIsEditing(true)}
                delayLongPress={500}
                activeOpacity={isEditing ? 1 : 0.7}
              >
                <View
                  style={[
                    styles.shortcutIconBox,
                    isSelectedForSwap && {
                      borderColor: colors.accent,
                      borderWidth: 2,
                      backgroundColor: "rgba(41, 121, 255, 0.2)",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={22}
                    color={isSelectedForSwap ? "#FFF" : colors.accent}
                  />
                  {isEditing && (
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={() => toggleShortcut(id)}
                    >
                      <MaterialCommunityIcons
                        name="minus"
                        size={12}
                        color="#FFF"
                      />
                    </TouchableOpacity>
                  )}
                </View>
                <Text
                  style={[
                    styles.shortcutText,
                    isSelectedForSwap && {
                      color: colors.accent,
                      fontWeight: "bold",
                    },
                  ]}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}

          {isEditing && activeShortcuts.length < 5 && (
            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => setShortcutModalVisible(true)}
            >
              <View
                style={[
                  styles.shortcutIconBox,
                  { borderStyle: "dashed", borderColor: colors.textSecondary },
                ]}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={22}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={styles.shortcutText}>Ekle</Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditing && (
          <TouchableOpacity
            style={styles.doneBar}
            onPress={() => setIsEditing(false)}
          >
            <Text style={styles.doneText}>Düzenlemeyi Bitir</Text>
            <MaterialCommunityIcons name="check" size={18} color="#000" />
          </TouchableOpacity>
        )}

        {widgetOrder.map((wId) => renderWidget(wId))}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={shortcutModalVisible}
        onRequestClose={() => setShortcutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kısayolları Düzenle</Text>
              <TouchableOpacity onPress={() => setShortcutModalVisible(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Listeye eklemek için bir öğe seçin.
            </Text>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {AVAILABLE_SHORTCUTS.filter(
                (i) => !activeShortcuts.includes(i.id),
              ).map((item) => {
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.modalItem}
                    onPress={() => toggleShortcut(item.id)}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={24}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.modalItemText}>{item.title}</Text>
                    </View>
                    <MaterialCommunityIcons
                      name="plus-circle-outline"
                      size={20}
                      color={colors.success}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <TutorialModal
        visible={showTutorial}
        onClose={closeTutorial}
      />
      <TopUpModal 
        visible={isTopUpModalVisible}
        onClose={() => setIsTopUpModalVisible(false)}
        onSubmit={(amount, card) => {
            setIsTopUpModalVisible(false);
            setPaymentAmount(amount);
            setPaymentCard(card);
            setTimeout(() => {
                setIsPaymentModalVisible(true);
            }, 500); // Wait for modal close animation
        }}
      />
      <PaymentWebViewModal
        visible={isPaymentModalVisible}
        amount={paymentAmount}
        card={paymentCard}
        onClose={() => setIsPaymentModalVisible(false)}
        onSuccess={() => {
            setIsPaymentModalVisible(false);
            setTimeout(() => {
                showToast("Bakiye başarıyla yüklendi!", "success");
                refreshWidget("wallet");
            }, 400);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === "android" ? 30 : 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
  },
  greeting: { color: colors.textSecondary, fontSize: 14, marginBottom: 4 },
  username: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "bold",
    textShadowColor: colors.accentGlow,
    textShadowRadius: 10,
  },
  avatarBtn: { padding: 2 },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  shortcuts: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    backgroundColor: colors.card,
    paddingVertical: 15,
    paddingHorizontal: 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutBtn: {
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    flex: 1,
    minWidth: 60,
  },
  shortcutIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardHover,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  shortcutText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.danger,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  doneBar: {
    backgroundColor: colors.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 15,
  },
  doneText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  modalSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 20,
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  modalItemActive: {
    backgroundColor: colors.cardHover,
    borderRadius: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
    marginVertical: 4,
  },
  modalItemText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  widgetWrapper: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    marginBottom: 2,
  },
  widgetSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(41, 121, 255, 0.1)",
  },
  widgetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(41, 121, 255, 0.3)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  hideWidgetBtn: {
    position: "absolute",
    top: 11,
    right: 2,
    padding: 9,
    backgroundColor: colors.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10,
  },
});
