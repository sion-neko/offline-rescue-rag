// 救助を呼ぶ：110／119 への発信、現在地（緯度経度）、電池残量、通報で伝えることのチェックリスト。
// 伝える内容は、県警の山岳遭難の案内（電池残量・場所と座標・何があったか・氏名や持病）をもとにしている。
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import * as Battery from 'expo-battery';
import { router } from 'expo-router';
import { useApp } from '../state/app';
import { profileFields, useProfile } from '../state/profile';
import { BatteryIcon, CheckIcon, CopyIcon, PhoneIcon, PinIcon } from '../ui/icons';
import { PressableCard, SectionLabel, TopBar } from '../ui/parts';
import { font, minTouch } from '../ui/theme';
import { formatFix, toDms, type Fix } from '../util/geo';

type LocState =
  | { kind: 'idle' }
  | { kind: 'locating'; last?: Fix }
  | { kind: 'ok'; fix: Fix }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

const CHECKS = [
  '名前と年齢、持病',
  'いる場所（上の緯度経度、山の名前、登山口、最後に通った場所）',
  '何があったか、けがの有無',
  '人数',
  '持っているもの（水・食べ物・ライト・防寒着）',
  '電話の電池残量',
];

/** 電池残量（0〜1、分からなければ -1）。web など取れない環境でも落ちないようにする。 */
function useBattery() {
  const [level, setLevel] = useState(-1);
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    Battery.getBatteryLevelAsync()
      .then(setLevel)
      .catch(() => setLevel(-1));
    if (Platform.OS !== 'web') {
      try {
        sub = Battery.addBatteryLevelListener(({ batteryLevel }) => setLevel(batteryLevel));
      } catch {
        sub = null;
      }
    }
    return () => sub?.remove();
  }, []);
  return level;
}

export default function Emergency() {
  const { theme: t } = useApp();
  const { profile, filled } = useProfile();
  const battery = useBattery();
  const [loc, setLoc] = useState<LocState>({ kind: 'idle' });
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false));
  const [copied, setCopied] = useState(false);

  const locate = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLoc({ kind: 'denied' });
        return;
      }
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const toFix = (p: Location.LocationObject): Fix => ({
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        accuracy: p.coords.accuracy ?? null,
        time: p.timestamp,
      });
      setLoc({ kind: 'locating', last: last ? toFix(last) : undefined });
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLoc({ kind: 'ok', fix: toFix(cur) });
    } catch (e) {
      setLoc({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  // 画面を開いたらすぐに測り始める（locate の中の setState は await のあとなので、同期的な連鎖は起きない）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    locate();
  }, [locate]);

  const call = (n: string) => Linking.openURL(`tel:${n}`);
  const fix = loc.kind === 'ok' ? loc.fix : loc.kind === 'locating' ? loc.last : undefined;
  const batteryPct = battery >= 0 ? Math.round(battery * 100) : null;

  const copy = async () => {
    if (!fix) return;
    const lines = [
      `現在地 ${formatFix(fix)}`,
      `（${toDms(fix.lat)} ${toDms(fix.lon)}${fix.accuracy ? `、誤差 約${Math.round(fix.accuracy)}m` : ''}）`,
      batteryPct != null ? `電話の電池 ${batteryPct}%` : '',
    ].filter(Boolean);
    await Clipboard.setStringAsync(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <TopBar title="救助を呼ぶ" hideEmergency />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.calls}>
          <PressableCard
            onPress={() => call('110')}
            accessibilityLabel="110番に電話する（警察・山岳遭難）"
            testID="call-110"
            style={[styles.call, { backgroundColor: t.danger }]}
          >
            <PhoneIcon size={24} color={t.dangerText} />
            <View>
              <Text style={[styles.callNumber, { color: t.dangerText }]}>110</Text>
              <Text style={[styles.callLabel, { color: t.dangerText }]}>警察・山岳遭難</Text>
            </View>
          </PressableCard>
          <PressableCard
            onPress={() => call('119')}
            accessibilityLabel="119番に電話する（消防・救急）"
            testID="call-119"
            style={[styles.call, { backgroundColor: t.surface, borderColor: t.danger, borderWidth: 2 }]}
          >
            <PhoneIcon size={24} color={t.danger} />
            <View>
              <Text style={[styles.callNumber, { color: t.danger }]}>119</Text>
              <Text style={[styles.callLabel, { color: t.danger }]}>消防・救急</Text>
            </View>
          </PressableCard>
        </View>
        <Text style={[styles.note, { color: t.textSub }]}>
          山で動けないときは110番が基本。つながったら、その場を動かず、電話を切らない。
        </Text>

        <View style={styles.block}>
          <SectionLabel>現在地</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.surfaceAlt }]} testID="location-card">
            {fix ? (
              <>
                <View style={styles.row}>
                  <PinIcon color={t.accent} />
                  <Text style={[styles.coord, { color: t.text }]} selectable>
                    {formatFix(fix)}
                  </Text>
                </View>
                <Text style={[styles.sub, { color: t.textSub }]} selectable>
                  {toDms(fix.lat)}　{toDms(fix.lon)}
                </Text>
                <Text style={[styles.sub, { color: t.textMuted }]}>
                  {fix.accuracy ? `誤差 約${Math.round(fix.accuracy)}m・` : ''}
                  {new Date(fix.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に測定
                  {loc.kind === 'locating' ? '（更新中…）' : ''}
                </Text>
                <View style={styles.row}>
                  <PressableCard
                    onPress={copy}
                    accessibilityLabel="現在地をコピー"
                    style={[styles.smallButton, { backgroundColor: t.surface }]}
                  >
                    {copied ? <CheckIcon color={t.accent} /> : <CopyIcon color={t.text} />}
                    <Text style={[styles.smallButtonText, { color: t.text }]}>{copied ? 'コピーした' : 'コピー'}</Text>
                  </PressableCard>
                  <PressableCard
                    onPress={locate}
                    accessibilityLabel="もう一度測る"
                    style={[styles.smallButton, { backgroundColor: t.surface }]}
                  >
                    <Text style={[styles.smallButtonText, { color: t.text }]}>もう一度測る</Text>
                  </PressableCard>
                </View>
              </>
            ) : loc.kind === 'denied' ? (
              <Text style={[styles.sub, { color: t.textSub }]}>
                位置情報が許可されていません。設定アプリで許可するか、iPhoneの「コンパス」アプリで北緯・東経を確認できます。
              </Text>
            ) : loc.kind === 'error' ? (
              <Text style={[styles.sub, { color: t.textSub }]}>
                現在地を測れませんでした。空が開けた場所で「もう一度測る」を押すか、「コンパス」アプリで確認できます。
              </Text>
            ) : (
              <Text style={[styles.sub, { color: t.textSub }]}>GPSで測っています。圏外でも測れます…</Text>
            )}
            {!fix && loc.kind !== 'locating' && loc.kind !== 'idle' && (
              <PressableCard onPress={locate} accessibilityLabel="もう一度測る" style={[styles.smallButton, { backgroundColor: t.surface }]}>
                <Text style={[styles.smallButtonText, { color: t.text }]}>もう一度測る</Text>
              </PressableCard>
            )}
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.rowBetween}>
            <SectionLabel>わたしの情報（読み上げる）</SectionLabel>
            <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" hitSlop={10}>
              <Text style={[styles.link, { color: t.accent }]}>{filled ? '編集' : '入力'}</Text>
            </Pressable>
          </View>
          <View style={[styles.card, { backgroundColor: t.surfaceAlt }]} testID="profile-card">
            {filled ? (
              profileFields
                .filter((f) => profile[f.key].trim())
                .map((f) => (
                  <View key={f.key} style={styles.profileRow}>
                    <Text style={[styles.profileLabel, { color: t.textMuted }]}>{f.label}</Text>
                    <Text style={[styles.profileValue, { color: t.text }]} selectable>
                      {profile[f.key]}
                    </Text>
                  </View>
                ))
            ) : (
              <Text style={[styles.sub, { color: t.textSub }]}>
                名前・持病・緊急連絡先・今日のルートを入れておくと、ここに出ます。登山の前に入れておくのがおすすめです。
              </Text>
            )}
          </View>
        </View>

        <View style={styles.block}>
          <SectionLabel>電話で伝えること</SectionLabel>
          <View style={[styles.list, { backgroundColor: t.surfaceAlt }]}>
            {CHECKS.map((c, i) => (
              <Pressable
                key={c}
                onPress={() => setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: checked[i] }}
                style={({ pressed }) => [
                  styles.check,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.box,
                    { borderColor: checked[i] ? t.accent : t.textMuted, backgroundColor: checked[i] ? t.accent : 'transparent' },
                  ]}
                >
                  {checked[i] && <CheckIcon size={14} color={t.accentText} strokeWidth={3} />}
                </View>
                <Text
                  style={[
                    styles.checkText,
                    { color: checked[i] ? t.textMuted : t.text, textDecorationLine: checked[i] ? 'line-through' : 'none' },
                  ]}
                >
                  {c}
                  {i === CHECKS.length - 1 && batteryPct != null ? `（いま ${batteryPct}%）` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <SectionLabel>圏外のとき</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.surfaceAlt }]}>
            <Text style={[styles.sub, { color: t.textSub }]}>
              ・iPhone 14以降は、圏外で110番に発信すると「衛星経由の緊急SOS」に切り替えられることがある。空が開けた場所で、画面の指示に従う。
            </Text>
            <Text style={[styles.sub, { color: t.textSub }]}>・通話がつながらなくても、SMSは送れることがある。</Text>
            <Text style={[styles.sub, { color: t.textSub }]}>・道が分からないまま、電波を探して歩き回らない。</Text>
          </View>
        </View>

        {batteryPct != null && (
          <View style={[styles.row, { opacity: 0.9 }]}>
            <BatteryIcon color={batteryPct <= 20 ? t.danger : t.textMuted} />
            <Text style={[styles.sub, { color: batteryPct <= 20 ? t.danger : t.textMuted }]}>
              電池 {batteryPct}%{batteryPct <= 20 ? '。画面を暗くして、必要なときだけ使う' : ''}
            </Text>
          </View>
        )}
        {Platform.OS === 'web' && (
          <Text style={[styles.caption, { color: t.textMuted }]}>（web版の確認用表示です。発信はスマホで行ってください）</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 18, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  calls: { flexDirection: 'row', gap: 12 },
  call: { flex: 1, minHeight: 88, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  callNumber: { fontSize: 30, fontWeight: '800', lineHeight: 34 },
  callLabel: { fontSize: 13, fontWeight: '700' },
  note: { fontSize: 15, lineHeight: 23 },
  block: { gap: 8 },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  coord: { fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 15, lineHeight: 23 },
  caption: { fontSize: font.caption },
  smallButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallButtonText: { fontSize: 15, fontWeight: '600' },
  list: { borderRadius: 14, overflow: 'hidden' },
  check: { minHeight: minTouch + 4, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontSize: 16, lineHeight: 23, flexShrink: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 15, fontWeight: '700' },
  profileRow: { gap: 2 },
  profileLabel: { fontSize: 12, fontWeight: '700' },
  profileValue: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
});
