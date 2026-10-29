import 'react-native-reanimated';
import { useEffect } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@coopr/tokens';
import { DisplayFontProvider } from '../src/design/display-font';
import { FloatingAsk } from '../src/design/floating-ask';
import { BagScanProvider } from '../src/bag-scan/session';
import { LocalStoreProvider } from '../src/local-store';
import { rememberScreen } from '../src/screen-name';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Web has no native splash. The launch view below covers that gap.
});

function LaunchScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A1020' }}>
      <Image
        accessibilityLabel="COOPR"
        source={require('../assets/brand/splash.png')}
        resizeMode="contain"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

function RememberScreen() {
  const segments = useSegments();
  const name = segments.join('/') || 'Home';
  useEffect(() => {
    rememberScreen(name);
  }, [name]);
  return null;
}

function HideSplash() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DisplayFontProvider>
        <LocalStoreProvider fallback={<LaunchScreen />}>
          <BagScanProvider>
          <HideSplash />
          <RememberScreen />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.navy,
              headerTitleStyle: { fontWeight: '800', fontSize: 20 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
              title: 'COOPR',
              headerLeft: ({ canGoBack }) =>
                canGoBack ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', paddingRight: 8 }}>
                    <Text style={{ color: colors.navy, fontSize: 17, fontWeight: '800' }}>‹ Back</Text>
                  </Pressable>
                ) : null,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboard" options={{ headerShown: false }} />
            <Stack.Screen name="play" options={{ headerShown: false }} />
            <Stack.Screen name="recap" options={{ headerShown: false }} />
            <Stack.Screen name="rounds" options={{ headerShown: false }} />
            <Stack.Screen name="round/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="more" options={{ headerShown: false }} />
            <Stack.Screen name="bag" options={{ headerShown: false, contentStyle: { backgroundColor: '#0B1F3A' } }} />
            <Stack.Screen name="analysis" options={{ headerShown: false, contentStyle: { backgroundColor: '#0B1F3A' } }} />
            <Stack.Screen name="games" options={{ headerShown: false, contentStyle: { backgroundColor: '#0B1F3A' } }} />
          </Stack>
          <FloatingAsk />
          </BagScanProvider>
        </LocalStoreProvider>
      </DisplayFontProvider>
    </SafeAreaProvider>
  );
}
