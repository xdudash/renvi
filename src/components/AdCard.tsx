import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { Btn } from '@/components/ui';
import { api, type AdCard as Ad } from '@/lib/api';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

/** A partner card (.x-ad): label, picture, title, partner line, "learn more". Clicks are counted on the server. */
export function AdCard({ ad, label, aside }: { ad: Ad; label: string; aside?: React.ReactNode }) {
  const { t } = useLang();
  const open = () => {
    api.adClick(ad.id).catch(() => {});
    Linking.openURL(ad.link_url).catch(() => {});
  };
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.label}>{label}</Text>
        {aside}
      </View>
      {ad.image_url ? <Image source={{ uri: ad.image_url }} style={s.img} resizeMode="cover" accessibilityLabel={ad.title} /> : <View style={[s.img, s.imgEmpty]} />}
      <Text style={s.title}>{ad.title}</Text>
      {ad.body ? <Text style={s.body}>{ad.body}</Text> : null}
      <Text style={s.partner}>{t('ad.partnerLine', { name: ad.partner })}</Text>
      <Btn kind="secondary" label={t('ad.more')} onPress={open} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 10, padding: 14, gap: 8, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: colors.eyebrow },
  img: { height: 260, borderRadius: 13, backgroundColor: colors.surfaceMuted },
  imgEmpty: { opacity: 0.6 },
  title: { fontSize: 14, fontWeight: '800', color: colors.ink },
  body: { fontSize: 12, color: colors.sub, lineHeight: 17 },
  partner: { fontSize: 10, color: colors.sub },
});
