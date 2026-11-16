// ホーム：検索欄と「いまの状況」ボタン。下に目次と通報。
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { situations } from '../data/situations';
import { ragIndex } from '../rag/rag';
import { useApp } from '../state/app';
import { useProfile } from '../state/profile';
import { BookIcon, ChevronIcon, ClockIcon, PhoneIcon } from '../ui/icons';
import { PressableCard, SearchField, SectionLabel } from '../ui/parts';
import { font } from '../ui/theme';

export default function Home() {
  const { theme: t, recent, clearRecent, status, themeMode, setThemeMode } = useApp();
  const [q, setQ] = useState('');
  const { filled, loaded } = useProfile();

  const go = (query: string) => {
    const text = query.trim();
    if (!text) return;
    router.push({ pathname: '/result', params: { q: text } });
  };

  const nextMode = t.dark ? 'light' : 'dark';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
              山の手引き
            </Text>
            <Text style={[styles.subtitle, { color: t.textSub }]}>
              圏外でも使える・マニュアル{ragIndex.chunks.length}項目
            </Text>
          </View>
          <Pressable
            onPress={() => setThemeMode(themeMode === 'system' ? nextMode : nextMode)}
            accessibilityRole="button"
            accessibilityLabel={t.dark ? '明るい表示にする' : '夜・節電の表示にする'}
            testID="theme-toggle"
            style={({ pressed }) => [styles.themeButton, { borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.themeText, { color: t.text }]}>{t.dark ? '通常表示' : '夜・節電'}</Text>
          </Pressable>
        </View>

        <SearchField value={q} onChangeText={setQ} onSubmit={() => go(q)} />

        {!status.searchReady && !status.searchError && (
          <Text style={[styles.loading, { color: t.textMuted }]} testID="home-loading">
            検索の準備中… 目次と通報はすぐ使えます
          </Text>
        )}
        {status.searchError && (
          <Text style={[styles.loading, { color: t.danger }]}>
            検索を準備できませんでした。目次から資料を読めます。
          </Text>
        )}

        <View style={styles.block}>
          <SectionLabel>いまの状況</SectionLabel>
          <View style={styles.grid}>
            {situations.map((s) => (
              <PressableCard
                key={s.label}
                onPress={() => go(s.query)}
                accessibilityLabel={s.label}
                testID={`situation-${s.label}`}
                style={[styles.situation, { backgroundColor: t.accentSoft }]}
              >
                <s.Icon size={22} color={t.accent} />
                <Text style={[styles.situationText, { color: t.text }]}>{s.label}</Text>
              </PressableCard>
            ))}
          </View>
        </View>

        {loaded && (
          <PressableCard
            onPress={() => router.push('/profile')}
            accessibilityLabel={filled ? 'わたしの情報（入力済み）' : '登山の前に、わたしの情報を入れておく'}
            testID="profile-prompt"
            style={[styles.prepare, { borderColor: t.border }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.prepareTitle, { color: t.text }]}>
                {filled ? 'わたしの情報（入力済み）' : '登山の前に、わたしの情報を入力'}
              </Text>
              <Text style={[styles.prepareText, { color: t.textSub }]}>
                {filled ? '通報のときに読み上げる内容。今日のルートも更新できます' : '名前・持病・緊急連絡先・ルート。通報のときに読み上げられます'}
              </Text>
            </View>
            <ChevronIcon color={t.textMuted} />
          </PressableCard>
        )}

        {recent.length > 0 && (
          <View style={styles.block}>
            <View style={styles.rowBetween}>
              <SectionLabel>最近の検索</SectionLabel>
              <Pressable onPress={clearRecent} accessibilityRole="button" accessibilityLabel="最近の検索を消去" style={styles.clear}>
                <Text style={[styles.link, { color: t.textMuted }]}>消去</Text>
              </Pressable>
            </View>
            {recent.map((r) => (
              <Pressable
                key={r}
                onPress={() => go(r)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.recent, { opacity: pressed ? 0.5 : 1 }]}
              >
                <ClockIcon color={t.textMuted} />
                <Text style={[styles.recentText, { color: t.textSub }]} numberOfLines={1}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.bg }]}>
        <PressableCard
          onPress={() => router.push('/contents')}
          accessibilityLabel="マニュアルの目次"
          testID="contents-button"
          style={[styles.footerButton, { backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border }]}
        >
          <BookIcon color={t.text} />
          <Text style={[styles.footerText, { color: t.text }]}>目次</Text>
        </PressableCard>
        <PressableCard
          onPress={() => router.push('/emergency')}
          accessibilityLabel="救助を呼ぶ"
          testID="emergency-button"
          style={[styles.footerButton, styles.footerMain, { backgroundColor: t.danger }]}
        >
          <PhoneIcon color={t.dangerText} />
          <Text style={[styles.footerText, { color: t.dangerText, fontWeight: '700' }]}>救助を呼ぶ</Text>
        </PressableCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingTop: 24, gap: 22, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: font.title, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: 4 },
  themeButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  themeText: { fontSize: 14, fontWeight: '600' },
  loading: { fontSize: font.small, marginTop: -10 },
  block: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  situation: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  situationText: { fontSize: font.body, fontWeight: '700', flexShrink: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: font.small },
  clear: { minHeight: 44, minWidth: 56, alignItems: 'flex-end', justifyContent: 'center' },
  recent: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentText: { fontSize: 16, flex: 1 },
  prepare: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  prepareTitle: { fontSize: 16, fontWeight: '700' },
  prepareText: { fontSize: 15, lineHeight: 22 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerMain: { flex: 1.6 },
  footerText: { fontSize: 16 },
});
