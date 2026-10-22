/** One pulse for a club call. Two for a lay-up. No alarm. Quiet when the device has no haptics. */
export async function pulse(times: 1 | 2): Promise<void> {
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (times === 2) {
      await new Promise((resolve) => setTimeout(resolve, 140));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch {
    // Expo web and a missing module stay silent.
  }
}
