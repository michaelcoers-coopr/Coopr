import { useMemo, useRef, useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SUGGESTED_QUESTIONS } from '@coopr/engine';
import type { CoachAnswer } from '@coopr/core';
import { useTheme } from '../src/theme';
import { Body, Label, DoneAccessory, DONE_ACCESSORY_ID } from '../src/ui';
import { getFirstUserId, getCaddiePersona } from '../src/db/repo';
import { ask } from '../src/features/coach';
import { registry } from '../src/providers/registry';

interface Msg {
  id: number;
  role: 'user' | 'coach';
  text?: string;
  answer?: CoachAnswer;
  narration?: string; // conversational rewrite (LLM), when available
  pending?: boolean;
}

function flatten(a: CoachAnswer): string {
  const bullets = a.bullets.map((b) => `- ${b.label}${b.detail ? `: ${b.detail}` : ''}`);
  return [...a.paragraphs.filter(Boolean), ...bullets].join('\n');
}

export default function Ask() {
  const t = useTheme();
  const userId = getFirstUserId();
  const scroller = useRef<ScrollView>(null);
  const idRef = useRef(1);
  const persona = useMemo(
    () => (userId ? getCaddiePersona(userId) : { name: 'Coop', humorLevel: 0.3, detailLevel: 0.6, coachingStyle: 'direct' }),
    [userId],
  );
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: 'coach',
      answer: {
        topic: 'help',
        title: `Ask ${persona.name}`,
        paragraphs: ['I answer from your own numbers — what to practice, your club distances, bag gaps, and equipment direction. Ask me anything, or tap a starter below.'],
        bullets: [],
        followUps: SUGGESTED_QUESTIONS,
        grounded: true,
      },
    },
  ]);

  const send = (q: string) => {
    const question = q.trim();
    if (!question) return;
    const a = userId ? ask(userId, question, Date.now()) : null;
    const hasLLM = !!registry.language && !!a;
    const userMsg: Msg = { id: idRef.current++, role: 'user', text: question };
    const coachMsg: Msg = a
      ? { id: idRef.current++, role: 'coach', answer: a, pending: hasLLM }
      : { id: idRef.current++, role: 'coach', text: 'Log a session first and I can answer from your real numbers.' };
    setMessages((m) => [...m, userMsg, coachMsg]);
    setInput('');
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);

    // Optional conversational rewrite in the caddie's voice — grounded facts unchanged.
    if (hasLLM && a) {
      registry
        .language!.narrateCoach({ question, groundedTitle: a.title, groundedText: flatten(a), persona })
        .then((text) =>
          setMessages((m) => m.map((x) => (x.id === coachMsg.id ? { ...x, narration: text, pending: false } : x))),
        )
        .catch(() =>
          setMessages((m) => m.map((x) => (x.id === coachMsg.id ? { ...x, pending: false } : x))),
        );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: t.spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <UserBubble key={i} text={m.text ?? ''} />
          ) : (
            <CoachBubble key={i} msg={m} onFollowUp={send} />
          ),
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md,
          borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth, backgroundColor: t.surface,
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your game…"
          placeholderTextColor={t.textMuted}
          inputAccessoryViewID={DONE_ACCESSORY_ID}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          style={{
            flex: 1, color: t.textPrimary, backgroundColor: t.ink, borderColor: t.border, borderWidth: 1,
            borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm, fontSize: t.fontSize.md,
          }}
        />
        <Pressable
          onPress={() => send(input)}
          style={{ backgroundColor: t.accent, borderRadius: t.radius.pill, paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.lg }}
        >
          <Body style={{ color: t.accentOn, fontWeight: '700' }}>Ask</Body>
        </Pressable>
      </View>
      <DoneAccessory />
    </SafeAreaView>
  );
}

function UserBubble({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: '85%', marginVertical: t.spacing.xs }}>
      <View style={{ backgroundColor: t.accent, borderRadius: t.radius.md, paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md }}>
        <Body style={{ color: t.accentOn }}>{text}</Body>
      </View>
    </View>
  );
}

function CoachBubble({ msg, onFollowUp }: { msg: Msg; onFollowUp: (q: string) => void }) {
  const t = useTheme();
  const a = msg.answer;
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '92%', marginVertical: t.spacing.xs }}>
      <View style={{ backgroundColor: t.surfaceRaised, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: t.radius.md, padding: t.spacing.md }}>
        {a ? (
          <>
            <Label>{a.title}</Label>
            {msg.narration ? (
              <Body style={{ marginTop: t.spacing.sm }}>{msg.narration}</Body>
            ) : (
              a.paragraphs.filter(Boolean).map((p, i) => (
                <Body key={i} style={{ marginTop: t.spacing.sm }}>{p}</Body>
              ))
            )}
            {msg.pending ? <Body muted style={{ marginTop: t.spacing.xs, fontSize: t.fontSize.xs }}>…</Body> : null}
            {a.bullets.map((b, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.sm }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.accent, marginTop: 7 }} />
                <Body style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>{b.label}</Body>
                  {b.detail ? <Body muted> — {b.detail}</Body> : null}
                </Body>
              </View>
            ))}
          </>
        ) : (
          <Body>{msg.text}</Body>
        )}
      </View>
      {a && a.followUps.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs, marginTop: t.spacing.sm }}>
          {a.followUps.map((q) => (
            <Pressable
              key={q}
              onPress={() => onFollowUp(q)}
              style={{
                borderColor: t.accent, borderWidth: StyleSheet.hairlineWidth, borderRadius: t.radius.pill,
                paddingVertical: 6, paddingHorizontal: t.spacing.md,
              }}
            >
              <Body style={{ color: t.accent, fontSize: t.fontSize.sm }}>{q}</Body>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
