import { useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { GradientShade } from './GradientShade';
import { registerAdImpression } from '../services/ads';
import type { AdWithBusiness } from '../services/ads';

export function AdBanner({ ad, detailHref }: { ad: AdWithBusiness; detailHref: string }) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const collapsed = !expanded;

  useEffect(() => {
    registerAdImpression(ad.id).catch((err) => console.error('register ad impression error', err));
  }, [ad.id]);

  function handleMeasure(e: NativeSyntheticEvent<TextLayoutEventData>) {
    if (e.nativeEvent.lines.length > 1) setIsTruncated(true);
  }

  function handleExpand(e: GestureResponderEvent) {
    e.stopPropagation();
    setExpanded(true);
  }

  function handleCollapse(e: GestureResponderEvent) {
    e.stopPropagation();
    setExpanded(false);
  }

  function handleShare() {
    const url = `https://so-smoto.vercel.app/ad/${ad.id}`;
    const businessName = ad.business?.name ?? 'Anuncio';
    const text = ad.title ? `${businessName}: ${ad.title}` : `Anuncio de ${businessName} en SOSmoto`;
    Share.share({ message: `${text}\n${url}`, url }).catch(() => {});
  }

  const businessName = ad.business?.name ?? 'Anuncio';
  const title = ad.title ?? '';

  return (
    <Pressable style={styles.card} onPress={() => router.push(detailHref)}>
      <View style={[styles.authorRow, expanded && styles.authorRowExpanded]}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {ad.business?.logo_url ? (
              <Image source={{ uri: ad.business.logo_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="storefront" size={18} color={colors.primary} />
            )}
          </View>
          {ad.business?.is_verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
            </View>
          )}
        </View>
        <View style={styles.authorTextRow}>
          {collapsed && (
            <Text style={[styles.authorLine, styles.measure]} onTextLayout={handleMeasure}>
              <Text style={styles.authorName}>{businessName}</Text>
              {title && <Text style={styles.inlineCaption}>  {title}</Text>}
            </Text>
          )}
          <Text
            style={styles.authorLine}
            numberOfLines={collapsed ? 1 : undefined}
            ellipsizeMode={collapsed && isTruncated ? 'clip' : 'tail'}
          >
            <Text style={styles.authorName}>{businessName}</Text>
            {title && <Text style={styles.inlineCaption}>  {title}</Text>}
            {expanded && isTruncated && (
              <Text style={styles.moreLink} onPress={handleCollapse}>
                {'  menos'}
              </Text>
            )}
          </Text>
          {collapsed && isTruncated && (
            <Pressable onPress={handleExpand}>
              <Text style={styles.moreLink}>... más</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.imageWrap}>
        <Image source={{ uri: ad.image_url }} style={styles.image} resizeMode="cover" />
        <GradientShade height={100} />
        <View style={styles.adChip}>
          <Ionicons name="megaphone" size={12} color="#fff" />
          <Text style={styles.adChipText}>Anuncio</Text>
        </View>
        <View style={styles.imageEngagementRow}>
          <Pressable style={styles.engagementButtonOverlay} onPress={() => router.push(detailHref)}>
            <Ionicons name="chatbubble-outline" size={22} color="#fff" />
            <Text style={styles.engagementCountOverlay}>{ad.comments_count}</Text>
          </Pressable>
          <Pressable style={styles.engagementButtonOverlay} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  authorRowExpanded: {
    alignItems: 'flex-start',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  authorTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorLine: {
    flexShrink: 1,
  },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  inlineCaption: {
    fontSize: 14,
    color: colors.text,
  },
  moreLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginLeft: 4,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },
  adChip: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  adChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  imageEngagementRow: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  engagementButtonOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engagementCountOverlay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
