import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { InlineNotice } from './InlineNotice';
import { radius, spacing, typography, useTheme } from '../theme';
type Props = TextInputProps & { label: string; error?: string; readOnly?: boolean };
export function TextField({ label, error, readOnly = false, ...props }: Props) {
 const t = useTheme();
 return <View style={{ gap: spacing['space/8'] }}>
  <Text style={{ ...typography.footnoteSemibold, color: t['label/secondary'], textAlign: 'auto' }}>{label}</Text>
  <TextInput {...props} accessibilityRole={readOnly ? undefined : 'textbox'} accessibilityLabel={label} accessibilityHint={error} editable={!readOnly && props.editable !== false} selectTextOnFocus={false} autoCorrect={false} style={{ ...typography.body, textAlign: 'auto', minHeight: 52, paddingHorizontal: spacing['space/16'], paddingVertical: spacing['space/12'], borderRadius: radius['radius/16'], borderWidth: 1, borderColor: error ? t['system/red'] : t.separator, backgroundColor: t[readOnly ? 'bg/grouped' : 'bg/elevated'], color: t[readOnly ? 'label/secondary' : 'label/primary'] }} placeholderTextColor={t['label/tertiary']} />
  {error && <InlineNotice text={error} />}
 </View>;
}
