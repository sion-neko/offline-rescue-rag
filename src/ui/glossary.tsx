// 用語解説。文章の中の用語に点線の下線を引き、タップすると説明のシートを出す。
// 説明は data/glossary.md に人が書いた文章で、AI は使わない。
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { glossary } from '../rag/rag';
import type { Glossary } from '../rag/types';
import { useTheme } from '../state/app';
import { CloseIcon } from './icons';
import { font, minTouch } from './theme';

type Ctx = { open: (g: Glossary) => void };
const GlossaryCtx = createContext<Ctx | null>(null);

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Glossary | null>(null);
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const open = useCallback((g: Glossary) => setCurrent(g), []);
  const value = useMemo(() => ({ open }), [open]);
  const close = () => setCurrent(null);

  return (
    <GlossaryCtx.Provider value={value}>
      {children}
      <Modal visible={!!current} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={close} accessibilityLabel="閉じる" />
        <View
          style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: 24 + insets.bottom, borderColor: t.border }]}
          accessibilityViewIsModal
          testID="glossary-sheet"
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.label, { color: t.textMuted }]}>用語</Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="閉じる"
              style={({ pressed }) => [styles.close, { backgroundColor: t.surfaceAlt, opacity: pressed ? 0.6 : 1 }]}
            >
              <CloseIcon color={t.textSub} />
            </Pressable>
          </View>
          <Text style={[styles.term, { color: t.text }]} accessibilityRole="header">
            {current?.term}
          </Text>
          <Text style={[styles.body, { color: t.textSub }]}>{current?.text}</Text>
        </View>
      </Modal>
    </GlossaryCtx.Provider>
  );
}

export function useGlossary() {
  const v = useContext(GlossaryCtx);
  if (!v) throw new Error('GlossaryProvider の外です');
  return v;
}

type Part = { text: string; term?: Glossary };

/** 用語の出現位置で文章を分ける。同じ用語は文章ごとに最初の 1 回だけ下線を引く。 */
export function splitByGlossary(text: string, used = new Set<string>()): Part[] {
  const words = glossary()
    .flatMap((g) => [g.term, ...g.aliases].map((w) => ({ w, g })))
    .sort((a, b) => b.w.length - a.w.length);
  const parts: Part[] = [];
  let i = 0;
  let buf = '';
  while (i < text.length) {
    const hit = words.find(({ w, g }) => !used.has(g.term) && text.startsWith(w, i));
    if (hit) {
      if (buf) parts.push({ text: buf });
      buf = '';
      parts.push({ text: hit.w, term: hit.g });
      used.add(hit.g.term);
      i += hit.w.length;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  if (buf) parts.push({ text: buf });
  return parts;
}

/** 文章の中に出てくる用語（重複なし、出てきた順） */
export function termsIn(texts: string[]): Glossary[] {
  const used = new Set<string>();
  const out: Glossary[] = [];
  for (const text of texts) {
    for (const p of splitByGlossary(text, used)) if (p.term) out.push(p.term);
  }
  return out;
}

/** 用語のチップ。文中の用語は小さくて押しにくいので、押しやすい大きさでも並べる。 */
export function GlossaryChips({ texts }: { texts: string[] }) {
  const t = useTheme();
  const { open } = useGlossary();
  const terms = termsIn(texts);
  if (!terms.length) return null;
  return (
    <View style={styles.chips} testID="glossary-chips">
      <Text style={[styles.chipsLabel, { color: t.textSub }]}>用語</Text>
      {terms.map((g) => (
        <Pressable
          key={g.term}
          onPress={() => open(g)}
          accessibilityRole="button"
          accessibilityLabel={`用語「${g.term}」の説明`}
          style={({ pressed }) => [styles.chip, { borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.chipText, { color: t.accent }]}>{g.term}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** 用語に下線を引いた文章。used を渡すと、複数の段落で同じ用語に何度も下線を引かない。 */
export function GlossaryText({
  text,
  style,
  used,
  highlight,
}: {
  text: string;
  style?: TextStyle | TextStyle[];
  used?: Set<string>;
  highlight?: boolean;
}) {
  const t = useTheme();
  const { open } = useGlossary();
  const parts = splitByGlossary(text, used);
  return (
    <Text style={[style, highlight ? { backgroundColor: t.mark } : null]}>
      {parts.map((p, i) =>
        p.term ? (
          <Text
            key={i}
            onPress={() => open(p.term!)}
            accessibilityRole="button"
            accessibilityHint={`「${p.term.term}」の説明を表示`}
            style={{
              textDecorationLine: 'underline',
              textDecorationStyle: 'dotted',
              textDecorationColor: t.accent,
              color: t.accent,
            }}
          >
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  backdrop: StyleSheet.absoluteFill,
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: font.caption, fontWeight: '700' },
  close: { width: minTouch - 4, height: minTouch - 4, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  term: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: font.body, lineHeight: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chipsLabel: { fontSize: 15, fontWeight: '700', marginRight: 2 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontSize: 16, fontWeight: '700' },
});
