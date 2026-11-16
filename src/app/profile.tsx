// わたしの情報の入力。通報のときに読み上げる内容を、登山の前に入れておく。
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/app';
import { profileFields, useProfile, type Profile } from '../state/profile';
import { PressableCard, TopBar } from '../ui/parts';
import { font } from '../ui/theme';

export default function ProfileScreen() {
  const { theme: t } = useApp();
  const { profile, save, loaded } = useProfile();
  const [draft, setDraft] = useState<Profile>(profile);
  const [synced, setSynced] = useState(false);

  // 保存済みの内容を読み込めたら、入力欄に反映する（1 回だけ）
  if (loaded && !synced) {
    setSynced(true);
    setDraft(profile);
  }

  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(id);
  }, [saved]);

  const onSave = async () => {
    await save(draft);
    setSaved(true);
    setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 1200);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar title="わたしの情報" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.lead, { color: t.textSub }]}>
            登山の前に入れておくと、通報のときに画面を読み上げるだけで済みます。この情報はスマホの中だけに保存し、外には送りません。
          </Text>
          {profileFields.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={[styles.label, { color: t.textSub }]} nativeID={`label-${f.key}`}>
                {f.label}
              </Text>
              <TextInput
                value={draft[f.key]}
                onChangeText={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                placeholder={f.placeholder}
                placeholderTextColor={t.textMuted}
                keyboardType={f.keyboard ?? 'default'}
                multiline={f.multiline}
                accessibilityLabel={f.label}
                accessibilityLabelledBy={`label-${f.key}`}
                testID={`profile-${f.key}`}
                style={[styles.input, f.multiline && styles.multiline, { color: t.text, backgroundColor: t.surfaceAlt }]}
              />
            </View>
          ))}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: t.border }]}>
          <PressableCard
            onPress={onSave}
            accessibilityLabel="保存"
            testID="profile-save"
            style={[styles.save, { backgroundColor: t.accent }]}
          >
            <Text style={[styles.saveText, { color: t.accentText }]}>{saved ? '保存しました' : '保存'}</Text>
          </PressableCard>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  lead: { fontSize: 15, lineHeight: 23 },
  field: { gap: 6 },
  label: { fontSize: font.small, fontWeight: '700' },
  input: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 17 },
  multiline: { minHeight: 88, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  save: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 17, fontWeight: '700' },
});
