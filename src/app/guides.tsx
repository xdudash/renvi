import { Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Screen, Tiny, Title } from '@/components/ui';
import { Tappable } from '@/components/Kit';
import { useSession } from '@/lib/session';
import { usePlaybook } from '@/lib/playbook';
import { useLang } from '@/lib/lang';
import { useMyTier } from '@/lib/tier';
import { colors } from '@/theme/tokens';
import type { TranslationKey } from '@/i18n';

type Guide = { letter: string; color: string; title: TranslationKey; sub: TranslationKey; n?: TranslationKey; href?: string };
const GUIDES: Guide[] = [
  { letter: 'P', color: '#DA302B', title: 'guides.playbook', sub: 'guides.playbookSub', n: 'guides.playbookN', href: '/playbook' },
  { letter: 'S', color: '#8C2457', title: 'guides.safe', sub: 'guides.safeSub' },
  { letter: 'N', color: '#2F4A7A', title: 'guides.city', sub: 'guides.citySub' },
  { letter: '2', color: '#7A5A12', title: 'guides.couple', sub: 'guides.coupleSub' },
];

// guides · the Playbook is the one guide that exists today; the others are announced, not sold.
export default function Guides() {
  const { t } = useLang();
  const { session } = useSession();
  const pb = usePlaybook(session?.user.id);
  const { tier } = useMyTier();
  return (
    <Screen>
      <BackLink onPress={() => router.replace('/me')} />
      <Title kicker={t('guides.kicker')} heading={t('guides.h')} sub={t('guides.sub')} />
      {GUIDES.map((g) => {
        const open = !!g.href;
        const chip = !open ? t('guides.soon') : tier?.plus ? t('guides.inPlus') : pb.purchased ? t('guides.owned') : null;
        return (
          <Tappable key={g.title} label={t(g.title)} onPress={() => { if (g.href) router.push(g.href as never); }} style={[s.card, !open && { opacity: 0.6 }]}>
            <View style={[s.cover, { backgroundColor: g.color }]}><Text style={s.coverText}>{g.letter}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{t(g.title)}</Text>
              <Text style={s.sub}>{t(g.sub)}</Text>
              {g.n ? <Tiny>{t(g.n)}</Tiny> : null}
            </View>
            {chip ? <Text style={[s.chip, open && s.chipOn]}>{chip}</Text> : null}
          </Tappable>
        );
      })}
      {!tier?.plus ? (
        <Tappable onPress={() => router.push('/plans')} label={t('guides.plusBlock')} style={s.soft}>
          <Text style={s.softH}>{t('guides.plusBlock')}</Text>
          <Tiny>{t('guides.plusBlockCopy')}</Tiny>
        </Tappable>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  cover: { width: 46, height: 62, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  coverText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  title: { fontSize: 13, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 10.5, color: colors.sub, marginTop: 2 },
  chip: { fontSize: 10, fontWeight: '700', color: colors.sub, borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden' },
  chipOn: { color: colors.green, borderColor: colors.green },
  soft: { padding: 14, borderRadius: 17, backgroundColor: colors.redWash, gap: 4 },
  softH: { fontSize: 12.5, fontWeight: '800', color: colors.ink },
});
