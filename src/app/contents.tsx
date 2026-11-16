// 目次：AI を通さず、マニュアルを分類ごとに読める。
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contents, glossary } from '../rag/rag';
import { useGlossary } from '../ui/glossary';
import { useApp } from '../state/app';
import { ChevronIcon } from '../ui/icons';
import { SectionLabel, TopBar } from '../ui/parts';
import { minTouch } from '../ui/theme';

export default function Contents() {
  const { theme: t } = useApp();
  const { open } = useGlossary();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <TopBar title="目次" />
      <ScrollView contentContainerStyle={styles.content}>
        {contents().map((g) => (
          <View key={g.category} style={styles.block}>
            <SectionLabel>{g.category}</SectionLabel>
            <View style={[styles.list, { backgroundColor: t.surfaceAlt }]}>
              {g.chunks.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push({ pathname: '/section/[id]', params: { id: c.id } })}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                >
                  <Text style={[styles.rowText, { color: t.text }]}>{c.title}</Text>
                  <ChevronIcon color={t.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <View style={styles.block}>
          <SectionLabel>用語</SectionLabel>
          <View style={styles.terms}>
            {glossary().map((g) => (
              <Pressable
                key={g.term}
                onPress={() => open(g)}
                accessibilityRole="button"
                accessibilityLabel={`用語「${g.term}」の説明`}
                style={({ pressed }) => [styles.term, { borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.termText, { color: t.accent }]}>{g.term}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable onPress={() => router.push('/about')} accessibilityRole="button" style={styles.about}>
          <Text style={[styles.aboutText, { color: t.textMuted }]}>このアプリについて</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 22, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  block: { gap: 8 },
  list: { borderRadius: 14, overflow: 'hidden' },
  row: { minHeight: minTouch + 4, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowText: { fontSize: 17, flexShrink: 1 },
  terms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  term: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  termText: { fontSize: 16, fontWeight: '700' },
  about: { alignSelf: 'center', minHeight: minTouch, justifyContent: 'center', paddingHorizontal: 12 },
  aboutText: { fontSize: 15, textDecorationLine: 'underline' },
});
