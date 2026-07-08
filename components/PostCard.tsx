import { useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { GradientShade } from './GradientShade';
import { getPostAuthorAvatar, getPostAuthorName, getPostTag, type PostWithAuthor } from '../services/posts';

export function PostCard({
  post,
  detailHref,
  userRole = 'client',
  showTopShadow = true,
  showBottomShadow = true,
  topFadeFromHeader = false,
}: {
  post: PostWithAuthor;
  detailHref: string;
  userRole?: 'client' | 'business';
  // Cuando este post (sin imagen) queda pegado a otro bloque "de fondo"
  // (catálogo u otro post sin imagen), HomeFeed apaga la sombra del lado
  // compartido para que ambos se vean como un solo fondo gris continuo en
  // vez de dos tarjetas hundidas por separado.
  showTopShadow?: boolean;
  showBottomShadow?: boolean;
  // Cuando este post es el primero del feed (nada arriba salvo el header
  // blanco), se funde de blanco a gris en vez de mostrar la sombra normal.
  topFadeFromHeader?: boolean;
}) {
  const authorName = getPostAuthorName(post);
  const avatarUrl = getPostAuthorAvatar(post);
  const tag = getPostTag(post, userRole);
  const isBusiness = !!post.author_business;
  const hasImage = !!post.image_url;
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const caption = post.caption ?? '';
  const collapsed = hasImage && !expanded;

  // Mide el texto completo (nombre + caption + etiqueta) sin límite de líneas,
  // de forma invisible y superpuesta, para saber si realmente no entra en una
  // sola línea -- así "más" solo aparece cuando hace falta, sin importar el
  // largo del nombre o el ancho de pantalla (en vez de un umbral fijo de
  // caracteres, que no reflejaba el overflow real).
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

  function handleTagPress(e: GestureResponderEvent) {
    e.stopPropagation();
    if (tag) router.push(tag.href);
  }

  function handleShare() {
    const message = post.caption ? `${authorName}: ${post.caption}` : `Publicación de ${authorName} en SOSmoto`;
    Share.share({ message }).catch(() => {});
  }

  function handleAuthorPress(e: GestureResponderEvent) {
    e.stopPropagation();
    const prefix = userRole === 'business' ? '/(business)' : '/(client)';
    if (isBusiness && post.author_business) {
      router.push(`${prefix}/business/${post.author_business.id}`);
    } else if (post.author_client) {
      router.push(`${prefix}/usuario/${post.author_client.id}`);
    }
  }

  return (
    <Pressable
      style={[styles.card, !hasImage && styles.cardNoImage, !hasImage && !showBottomShadow && styles.cardNoBorder]}
      onPress={() => router.push(detailHref)}
    >
      {!hasImage && topFadeFromHeader && (
        <GradientShade position="top" height={24} maxOpacity={1} color={colors.background} />
      )}
      {!hasImage && !topFadeFromHeader && showTopShadow && (
        <GradientShade position="top" height={8} maxOpacity={0.12} />
      )}
      <Pressable
        style={[styles.authorRow, hasImage && expanded && styles.authorRowExpanded]}
        onPress={handleAuthorPress}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name={isBusiness ? 'storefront' : 'person'} size={18} color={colors.primary} />
            )}
          </View>
          {isBusiness && post.author_business?.is_verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
            </View>
          )}
        </View>
        <View style={styles.authorTextRow}>
          {collapsed && (
            <Text style={[styles.authorLine, styles.measure]} onTextLayout={handleMeasure}>
              <Text style={styles.authorName}>{authorName}</Text>
              {hasImage && caption && <Text style={styles.inlineCaption}>  {caption}</Text>}
            </Text>
          )}
          <Text
            style={styles.authorLine}
            numberOfLines={collapsed ? 1 : undefined}
            ellipsizeMode={collapsed && isTruncated ? 'clip' : 'tail'}
          >
            <Text style={styles.authorName}>{authorName}</Text>
            {hasImage && caption && <Text style={styles.inlineCaption}>  {caption}</Text>}
            {hasImage && expanded && isTruncated && (
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
      </Pressable>

      {hasImage && (
        <View style={styles.imageWrap}>
          <Image source={{ uri: post.image_url! }} style={styles.image} resizeMode="cover" />
          <GradientShade height={100} />
          {tag && (
            <Pressable style={styles.tagChip} onPress={handleTagPress}>
              <Ionicons name="pricetag" size={12} color="#fff" />
              <Text style={styles.tagChipText}>{tag.label}</Text>
            </Pressable>
          )}
          <View style={styles.imageEngagementRow}>
            <Pressable style={styles.engagementButtonOverlay} onPress={() => router.push(detailHref)}>
              <Ionicons name="chatbubble-outline" size={22} color="#fff" />
              <Text style={styles.engagementCountOverlay}>{post.comments_count}</Text>
            </Pressable>
            <Pressable style={styles.engagementButtonOverlay} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      {!hasImage && caption && <Text style={styles.caption}>{caption}</Text>}

      {!hasImage && (
        <View style={styles.engagementRow}>
          {tag ? (
            <Pressable style={styles.tagChipFlat} onPress={handleTagPress}>
              <Ionicons name="pricetag" size={12} color={colors.primary} />
              <Text style={styles.tagChipFlatText}>{tag.label}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={styles.engagementButtonsGroup}>
            <Pressable style={styles.engagementButton} onPress={() => router.push(detailHref)}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
              <Text style={styles.engagementCount}>{post.comments_count}</Text>
            </Pressable>
            <Pressable style={styles.engagementButton} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      )}

      {!hasImage && showBottomShadow && <GradientShade position="bottom" height={8} maxOpacity={0.12} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardNoImage: {
    backgroundColor: colors.surface,
  },
  cardNoBorder: {
    borderBottomWidth: 0,
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
    backgroundColor: colors.background,
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
    height: 280,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
  },
  tagChip: {
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
  tagChipText: {
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
  caption: {
    fontSize: 14,
    color: colors.text,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  tagChipFlat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1E6',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagChipFlatText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  engagementButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engagementCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
