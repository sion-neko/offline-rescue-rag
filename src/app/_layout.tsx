import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useTheme } from '../state/app';
import { ProfileProvider } from '../state/profile';
import { GlossaryProvider } from '../ui/glossary';

function ThemedStack() {
  const t = useTheme();
  return (
    <GlossaryProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: 'fade' }} />
    </GlossaryProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ProfileProvider>
          <ThemedStack />
        </ProfileProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
