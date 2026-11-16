// 資料のページ：原文をそのまま表示する。hl があればその行にマーカーを引く（AI のまとめの出典から来たとき）。
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getChunk } from '../../rag/rag';
import { useApp } from '../../state/app';
import { GlossaryText } from '../../ui/glossary';
import { ChevronIcon } from '../../ui/icons';
import { SectionLabel, TopBar } from '../../ui/parts';
import { font, minTouch } from '../../ui/theme';

export default function Section() {
  const { id, hl } = useLocalSearchParams<{ id: string; hl?: string }>();
  const { theme: t } = useApp();
  const chunk = getChunk(id);
  const highlight = hl != null ? Number(hl) : -1;
  const used = new Set<string>();

  if (!chunk) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
        <TopBar title="資料" />
        <Text style={[styles.body, { color: t.text, padding: 20 }]}>資料が見つかりませんでした。</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <TopBar title={chunk.category} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: t.text }]} accessibilityRole="header" testID="section-title">
          {chunk.title}
        </Text>
        {highlight >= 0 && (
          <Text style={[styles.caption, { color: t.textMuted }]}>マーカーの行が、AIのまとめの出典です</Text>
        )}
        <View style={styles.points}>
          {chunk.sentences.map((s, i) => (
            <View key={i} style={styles.point}>
              <Text style={[styles.bullet, { color: t.accent }]}>・</Text>
              <GlossaryText text={s} used={used} highlight={i === highlight} style={[styles.body, { color: t.text }]} />
            </View>
          ))}
        </View>
        <Text style={[styles.caption, { color: t.textMuted }]}>出典：山の安全マニュアル（検証用の仮データ）</Text>

        {chunk.related.length > 0 && (
          <View style={styles.block}>
            <SectionLabel>関連する資料</SectionLabel>
            <View style={[styles.list, { backgroundColor: t.surfaceAlt }]}>
              {chunk.related.map((rid, i) => {
                const c = getChunk(rid);
                if (!c) return null;
                return (
                  <Pressable
                    key={rid}
                    onPress={() => router.push({ pathname: '/section/[id]', params: { id: rid } })}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.listRow,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
                      { opacity: pressed ? 0.5 : 1 },
                    ]}
                  >
                    <Text style={[styles.listText, { color: t.text }]}>{c.title}</Text>
                    <ChevronIcon color={t.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 33 },
  points: { gap: 10 },
  point: { flexDirection: 'row', gap: 2 },
  bullet: { fontSize: font.body, lineHeight: 30, fontWeight: '700' },
  body: { fontSize: 18, lineHeight: 30, flexShrink: 1 },
  caption: { fontSize: font.caption },
  block: { gap: 10, marginTop: 12 },
  list: { borderRadius: 14, overflow: 'hidden' },
  listRow: { minHeight: minTouch, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  listText: { fontSize: 16, flexShrink: 1 },
});
