import { useRef, useState } from 'react';
import { Linking, Modal, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner } from '../../components/Banner';
import { strings } from '../../strings';
import { spacing, useTheme } from '../../theme';
import { CarButton } from '../verification/CarScreens';
import { RideCard, RideScreen, RideText, rideStyles } from './RideScreen';

const copy = strings.rides;

export function ShareRideSheet({ message, developmentLink, onClose }: {
  message: string;
  developmentLink: boolean;
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

  const content = <RideScreen title={copy.shareTitle}>
    <View style={rideStyles.between}>
      <RideText kind="headline" header>{copy.sharePreview}</RideText>
      {onClose && <CarButton label={copy.close} secondary onPress={onClose} />}
    </View>
    <RideCard>
      <RideText>{message}</RideText>
      {developmentLink && <RideText kind="footnoteSemibold">{copy.developmentLink}</RideText>}
    </RideCard>
    <RideText kind="footnote" muted>{copy.sharePrivacy}</RideText>
    {failed && <Banner text={copy.shareError} tone="warning" />}
    <CarButton label={copy.openWhatsApp} busy={busy} disabled={busy} onPress={() => void openWhatsApp()} />
  </RideScreen>;

  if (!onClose) return content;
  return <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView edges={[]} accessibilityViewIsModal
      style={{ flex: 1, paddingTop: spacing['space/8'], backgroundColor: t['bg/base'] }}>
      {content}
    </SafeAreaView>
  </Modal>;
}
