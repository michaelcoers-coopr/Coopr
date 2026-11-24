import { Image, Text, View } from 'react-native';
import { useDisplayFace } from '../design/display-font';
import { contestLine, formatToPar } from './scoring';
import { SPONSOR_MENU } from './sponsor-menu';
import type { PublicEvent } from './types';

/** Public web board. The accent is the event's color. The phone app does not use this view. */
export function WebBoard({ event }: { event: PublicEvent }) {
  const display = useDisplayFace();
  const accent = event.accent ?? '#8AC926';
  const title = event.logos.find((logo) => logo.slot === 'title') ?? null;
  const cup = event.logos.find((logo) => logo.slot === 'winning-prize') ?? null;
  const partner = event.logos.find((logo) => logo.slot === 'prize-partner') ?? null;
  const closest = contestLine('Closest to the pin', event.contests.closestToPin);
  const drive = contestLine('Longest drive', event.contests.longestDrive);
  const clock = event.startTime ? formatClock(event.startTime) : '';
  return (
    <View style={{ backgroundColor: '#0B1F3A', borderRadius: 16, padding: 16, gap: 10 }}>
      <Text style={{ color: accent, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 }}>{event.charityName}</Text>
      {event.charityDetail ? <Text style={{ color: '#FFFFFF', fontSize: 15 }}>{event.charityDetail}</Text> : null}
      <Text style={{ color: '#FFFFFF', fontFamily: display, fontSize: 42, lineHeight: 46 }}>{event.name}</Text>
      {title ? <Text style={{ color: accent, fontSize: 18, fontWeight: '800' }}>{`Presented by ${title.name}`}</Text> : null}
      <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{[event.courseName, event.courseAddress, event.date, clock, startLabel(event.startStyle), event.includesCart ? 'Golf and cart' : '', 'No handicaps'].filter(Boolean).join(' · ')}</Text>
      {event.mulliganMax > 0 ? <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{`Mulligans ${event.mulliganMax} per ${event.mulliganScope}. Prepaid with a coin or ticket. This board only counts them.`}</Text> : null}
      {closest ? <Text style={{ color: accent, fontSize: 16, fontWeight: '700' }}>{closest}</Text> : null}
      {drive ? <Text style={{ color: accent, fontSize: 16, fontWeight: '700' }}>{drive}</Text> : null}
      {cup ? <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{`Panther Cup presented by ${cup.name}`}</Text> : null}
      {partner ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: accent, fontSize: 13, fontWeight: '800' }}>Prize partner</Text>
          <Image accessibilityLabel={partner.name} source={{ uri: partner.dataUrl }} resizeMode="contain" style={{ height: 48, width: 180 }} />
        </View>
      ) : null}
      {event.rows.map((row) => (
        <View key={row.key} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', paddingTop: 8 }}>
          <Text style={{ width: 36, color: accent, fontFamily: display, fontSize: 28 }}>{row.rank ?? '–'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>{row.name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>{`${row.startingHole ? `Starts ${row.startingHole} · ` : ''}${row.waitlist ? 'Waitlist' : row.thru === 0 ? 'Not started' : `Thru ${row.thru}`}${row.mulliganCap > 0 ? ` · Mulligans ${row.mulligansUsed}/${row.mulliganCap}` : ''}`}</Text>
          </View>
          <Text style={{ color: row.toPar != null && row.toPar > 0 ? '#C8102E' : accent, fontFamily: display, fontSize: 28 }}>{formatToPar(row.toPar)}</Text>
        </View>
      ))}
      {event.friends.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: accent, fontSize: 13, fontWeight: '800' }}>Friend of the Panthers</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{event.friends.join(' · ')}</Text>
        </View>
      ) : null}
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{`Sponsor menu, for reference only. ${SPONSOR_MENU.map((item) => `${item.label} ${item.price}`).join(' · ')}`}</Text>
    </View>
  );
}

function startLabel(style: PublicEvent['startStyle']): string {
  if (style === 'modified-shotgun') return 'Modified shotgun';
  if (style === 'shotgun') return 'Shotgun';
  return 'Tee times';
}

function formatClock(value: string): string {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !minute) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${shown}:${minute} ${suffix}`;
}
