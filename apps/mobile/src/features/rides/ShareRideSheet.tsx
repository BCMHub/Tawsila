import { useRef, useState } from 'react';
import { Linking, Modal, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner } from '../../components/Banner';
import { strings } from '../../strings';
import { dark, radius, spacing, useTheme } from '../../theme';
import { RideButton } from './RidePresentation';
import { RideText, rideStyles } from './RideScreen';

const copy = strings.rides;

export function ShareRideSheet({ message, developmentLink, link, onClose }: {
  message: string;
  developmentLink: boolean;
  link?: string;
  onClose?: () => void;
}) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const sharing = useRef(false);

  async function openWhatsApp() {
    if (sharing.current) return;
    sharing.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
    } catch {
      try {
        await Share.share({ message });
      } catch {
        setFailed(true);
      }
    } finally {
      sharing.current = false;
      setBusy(false);
    }
  }

  const firstBreak = message.indexOf('\n');
  const firstLine = firstBreak === -1 ? message : message.slice(0, firstBreak);
  const body = firstBreak === -1 ? '' : message.slice(firstBreak);
  const previewLink = link && body.endsWith(`\n${link}`) ? link : undefined;

  const content = <SafeAreaView edges={['bottom']} accessibilityViewIsModal={!!onClose}
    style={[styles.sheet, { backgroundColor: t['bg/base'] }]}>
    {onClose && <View style={[styles.grabber, { backgroundColor: t['label/quaternary'] }]} />}
    <ScrollView bounces={false} style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={rideStyles.between}>
        <View style={rideStyles.grow}><RideText kind="title2" header>{copy.shareTitle}</RideText></View>
        {onClose && <RideButton label={copy.close} variant="text" compact onPress={onClose} />}
      </View>
      <View style={[styles.preview, { backgroundColor: t['brand/tint'] }]}>
        <RideText kind="caption1" muted>{copy.sharePreview}</RideText>
        <RideText kind="subheadline">
          <RideText kind="subheadlineSemibold">{firstLine}</RideText>
          {previewLink ? body.slice(0, -previewLink.length) : body}
          {previewLink && <RideText kind="subheadlineSemibold" color="brand/primary">{previewLink}</RideText>}
        </RideText>
        {developmentLink && <RideText kind="footnoteSemibold">{copy.developmentLink}</RideText>}
      </View>
      <RideText kind="footnote" muted>{copy.sharePrivacy}</RideText>
      {failed && <Banner text={copy.shareError} tone="warning" />}
      <RideButton label={copy.openWhatsApp} busy={busy} disabled={busy} onPress={() => void openWhatsApp()} />
    </ScrollView>
  </SafeAreaView>;

  if (!onClose) return content;
  return <Modal transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t['overlay/scrim'], opacity: t === dark ? 0.85 : 0.4 }]} />
      {content}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%', overflow: 'hidden',
    borderTopLeftRadius: radius['radius/28'], borderTopRightRadius: radius['radius/28'],
  },
  scroll: { flexGrow: 0 },
  grabber: {
    width: spacing['space/32'], height: spacing['space/4'], borderRadius: radius['radius/full'],
    alignSelf: 'center', marginTop: spacing['space/12'],
  },
  content: { padding: spacing['space/16'], gap: spacing['space/12'] },
  preview: { padding: spacing['space/16'], gap: spacing['space/8'], borderRadius: radius['radius/16'] },
});
