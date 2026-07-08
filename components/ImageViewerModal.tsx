import { Modal, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  uri: string | null;
  onClose: () => void;
}

export function ImageViewerModal({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />
      <Pressable style={styles.backdrop} onPress={onClose}>
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : null}
      </Pressable>
      <Pressable
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={onClose}
        hitSlop={16}
      >
        <View style={styles.closeBtnInner}>
          <Ionicons name="close" size={22} color="#fff" />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
  },
  closeBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
