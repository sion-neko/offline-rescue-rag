// 画面で共通に使う部品。
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../state/app';
import { BackIcon, PhoneIcon, SearchIcon } from './icons';
import { font, minTouch } from './theme';

/** 上部のバー：戻る＋検索欄＋通報ボタン。どの画面からも通報まで 2 タップで行ける。 */
export function TopBar({
  value,
  onChangeText,
  onSubmit,
  title,
  hideEmergency,
}: {
  value?: string;
  onChangeText?: (v: string) => void;
  onSubmit?: () => void;
  /** 検索欄の代わりに見出しを出すとき */
  title?: string;
  /** 通報ボタンを出さない（救助を呼ぶ画面そのもの） */
  hideEmergency?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.topBar, { borderBottomColor: t.border, backgroundColor: t.bg }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="戻る"
        testID="back-button"
        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}
      >
        <BackIcon color={t.accent} />
      </Pressable>
      {title != null ? (
        <Text style={[styles.barTitle, { color: t.text }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <SearchField value={value ?? ''} onChangeText={onChangeText} onSubmit={onSubmit} compact />
      )}
      {hideEmergency ? <View style={styles.iconButton} /> : <EmergencyIconButton />}
    </View>
  );
}

export function EmergencyIconButton() {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/emergency')}
      accessibilityRole="button"
      accessibilityLabel="救助を呼ぶ"
      testID="emergency-icon"
      style={({ pressed }) => [
        styles.emergencyIcon,
        { backgroundColor: t.danger, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <PhoneIcon size={20} color={t.dangerText} />
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  onSubmit,
  compact,
  autoFocus,
}: {
  value: string;
  onChangeText?: (v: string) => void;
  onSubmit?: () => void;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.search,
        compact ? styles.searchCompact : styles.searchLarge,
        { backgroundColor: compact ? t.surfaceAlt : t.surface, borderColor: compact ? 'transparent' : t.border },
      ]}
    >
      <SearchIcon color={t.textMuted} size={compact ? 18 : 20} />
      <TextInput
        testID="search-input"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder="マニュアルを検索"
        placeholderTextColor={t.textMuted}
        returnKeyType="search"
        accessibilityLabel="マニュアルを検索"
        autoFocus={autoFocus}
        style={[styles.searchInput, { color: t.text, fontSize: compact ? 16 : 17 }]}
      />
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text style={[styles.sectionLabel, { color: t.textMuted }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** 押した手応えが見えるボタン。押すと少し沈む。 */
export function PressableCard({
  onPress,
  children,
  style,
  accessibilityLabel,
  testID,
}: {
  onPress: () => void;
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emergencyIcon: {
    width: 44,
    height: 44,
    marginLeft: 4,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1 },
  searchCompact: { flex: 1, height: 44, paddingHorizontal: 14, borderRadius: 22 },
  searchLarge: { height: 54, paddingHorizontal: 18, borderRadius: 27 },
  searchInput: { flex: 1, minWidth: 0, height: '100%' },
  sectionLabel: { fontSize: font.small, fontWeight: '700' },
});
