import React from 'react'; // needed for JSX
import { Modal, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../core/hook';
import SubscriptionScreen from './SubscriptionScreen';

interface Props {
  visible:  boolean;
  onClose:  () => void;
}

export function SubscriptionModal({ visible, onClose }: Props) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SubscriptionScreen onClose={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
