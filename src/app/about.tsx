// このアプリについて：しくみ、注意、ライセンス、開発者向けの情報（モデルの状態とログ）。
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { getLogText, subscribeLog } from '../log';
import { useApp } from '../state/app';
import { PressableCard, SectionLabel, TopBar } from '../ui/parts';
import { font } from '../ui/theme';

export default function About() {
  const { theme: t, engine, store, status, setThemeMode } = useApp();
  const [logs, setLogs] = useState<string[]>([]);
  useEffect(() => subscribeLog(setLogs), []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <TopBar title="このアプリについて" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.block}>
          <SectionLabel>しくみ</SectionLabel>
          <Text style={[styles.body, { color: t.textSub }]}>
            スマホの中に入れた山の安全マニュアルを、圏外でも検索できます。検索結果はマニュアルの原文です。「AIで短くまとめる」を押すと、スマホの中の小さなAIが要約します。
          </Text>
          <Text style={[styles.body, { color: t.textSub }]}>
            AIは資料にないことを書くことがあります。行動するときは原文を確かめてください。命に関わるときは、迷わず110番か119番へ。
          </Text>
          <Text style={[styles.body, { color: t.danger }]}>いまのマニュアルと用語集は、検証用の仮データ（専門家の監修なし）です。</Text>
        </View>

        <View style={styles.block}>
          <SectionLabel>表示</SectionLabel>
          <PressableCard
            onPress={() => setThemeMode(t.dark ? 'light' : 'dark')}
            accessibilityLabel={t.dark ? '通常表示にする' : '夜・節電の表示にする'}
            style={[styles.toggle, { borderColor: t.border }]}
          >
            <Text style={[styles.body, { color: t.text }]}>{t.dark ? '通常表示にする' : '夜・節電の表示にする（黒い背景で電池を節約）'}</Text>
          </PressableCard>
        </View>

        <View style={styles.block}>
          <SectionLabel>使っているAI</SectionLabel>
          <Text style={[styles.body, { color: t.textSub }]}>
            要約：LFM2.5-1.2B-JP（Liquid AI、LFM Open License v1.0）{'\n'}検索：EmbeddingGemma-300m（Google、Gemma 利用規約）
          </Text>
        </View>

        <View style={styles.block}>
          <SectionLabel>開発者向け</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.surfaceAlt }]} testID="debug">
            <Text style={[styles.mono, { color: t.textSub }]}>
              engine={engine.name} store={store.name}{'\n'}
              検索の準備 {status.searchReadyMs != null ? `${status.searchReadyMs}ms` : '準備中'}／AIの準備 {status.llmReadyMs != null ? `${status.llmReadyMs}ms` : '準備中'}
              {status.searchError ? `\n検索エラー=${status.searchError}` : ''}
              {status.llmError ? `\nAIエラー=${status.llmError}` : ''}
            </Text>
            <PressableCard
              onPress={() => Clipboard.setStringAsync(getLogText())}
              accessibilityLabel="ログをコピー"
              style={[styles.button, { backgroundColor: t.surface }]}
            >
              <Text style={[styles.buttonText, { color: t.accent }]}>ログをコピー</Text>
            </PressableCard>
            <Text style={[styles.mono, { color: t.textMuted }]} selectable>
              {logs.join('\n')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 24, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  block: { gap: 8 },
  body: { fontSize: 16, lineHeight: 25 },
  card: { borderRadius: 14, padding: 14, gap: 8 },
  mono: { fontSize: font.caption, lineHeight: 17, fontFamily: 'Courier' },
  toggle: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, justifyContent: 'center' },
  button: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '700' },
});
