import { CarEntryPoints } from '../../features/verification/CarEntryPoints';
import { TabScreen } from '../../components/TabScreen';
import { strings } from '../../strings';
export default function Screen() { return <TabScreen title={strings.tabs[0]}><CarEntryPoints /></TabScreen>; }
