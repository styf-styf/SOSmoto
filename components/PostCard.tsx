import { useRef, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, NativeSyntheticEvent, NativeScrollEvent, TextLayoutEventData } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { GradientShade } from './GradientShade';
import { getPostAuthorAvatar, getPostAuthorName, getPostTag, type PostWithAuthor } from '../services/posts';

const SCREEN_WIDTH = Dimensions.get('window').width;
// Unificado con el espacio izquierdo/derecho del resto del feed (historias,
// carrusel de catálogo, anuncios) -- ver CLAUDE.md/pedido de diseño del feed.
const CARD_MARGIN = 6;
// Redondeado a un entero: si el ancho de cada foto (usado en `image` y en el
// ScrollView) queda con decimales, `pagingEnabled` snapea a un múltiplo del
// ancho del propio ScrollView (calculado por Yoga con su propio redondeo) que
// puede diferir por una fracción de píxel del ancho declarado aquí -- ese
// desfase se acumula foto a foto y se ve como una franja de la imagen vecina
// al volver atrás en el carrusel.
const CARD_WIDTH = Math.round(SCREEN_WIDTH - CARD_MARGIN * 2);
const PHOTO_SWIPE_THRESHOLD = 10;

export function PostCard({
  post,
  detailHref,
  userRole = 'client',
  viewerBusinessId,
}: {
  post: PostWithAuthor;
  detailHref: string;
  userRole?: 'client' | 'business';
  // Negocio del propio usuario (dueño o empleado, ver getMyWorkBusiness) --
  // sin esto, un mecánico que ve una publicación de su propio taller se
  // trataba como un visitante cualquiera (solo se comparaba owner_id).
  viewerBusinessId?: string;
}) {
  const { profile } = useAuth();
  const authorName = getPostAuthorName(post);
  const avatarUrl = getPostAuthorAvatar(post);
  const tag = getPostTag(post, userRole);
  const isBusiness = !!post.author_business;
  const hasImage = post.photos.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Un swipe corto y rápido para cambiar de foto puede terminar dentro del
  // mismo Pressable sin que el ScrollView llegue a "reclamar" el gesto --
  // Pressable no distingue eso de un tap real. Se guarda dónde empezó el
  // toque y, si al soltar el dedo se movió más que PHOTO_SWIPE_THRESHOLD,
  // se cancela la navegación (fue un swipe, no un tap).
  const photoTouchStartXRef = useRef<number | null>(null);

  function handlePhotoScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH));
  }

  function handlePhotoPressIn(e: GestureResponderEvent) {
    photoTouchStartXRef.current = e.nativeEvent.pageX;
  }

  function handlePhotoPress(e: GestureResponderEvent) {
    const startX = photoTouchStartXRef.current;
    if (startX !== null && Math.abs(e.nativeEvent.pageX - startX) > PHOTO_SWIPE_THRESHOLD) return;
    router.push(detailHref);
  }

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
    if (!tag) return;
    // Si el negocio etiquetado es el propio (dueño o empleado, ver
    // viewerBusinessId más arriba), llevarlo a su perfil real en vez de la
    // vista pública -- mismo criterio que handleAuthorPress.
    if (post.tag_business && post.tag_business.id === viewerBusinessId) {
      const prefix = userRole === 'business' ? '/(business)' : '/(client)';
      router.push(`${prefix}/(tabs)/perfil`);
      return;
    }
    router.push(tag.href);
  }

  function handleShare() {
    const url = `https://so-smoto.vercel.app/post/${post.id}`;
    const text = post.caption ? `${authorName}: ${post.caption}` : `Publicación de ${authorName} en SOSmoto`;
    Share.share({ message: `${text}\n${url}`, url }).catch(() => {});
  }

  function handleAuthorPress(e: GestureResponderEvent) {
    e.stopPropagation();
    const prefix = userRole === 'business' ? '/(business)' : '/(client)';
    if (isBusiness && post.author_business) {
      if (post.author_business.owner_id === profile?.id || post.author_business.id === viewerBusinessId) {
        router.push(`${prefix}/(tabs)/perfil`);
      } else {
        router.push(`${prefix}/business/${post.author_business.id}`);
      }
    } else if (post.author_client) {
      if (post.author_client.id === profile?.id) {
        router.push(`${prefix}/(tabs)/perfil`);
      } else {
        router.push(`${prefix}/usuario/${post.author_client.id}`);
      }
    }
  }

  // El carrusel de fotos es un ScrollView horizontal -- si todo el card fuera
  // un solo Pressable envolviéndolo (como antes), la negociación de gestos
  // entre "tap para abrir el detalle" y "swipe para cambiar de foto" queda
  // inconsistente (funciona para un lado sí y para el otro no, o requiere
  // remount para destrabarse), y además hace más fácil que un scroll
  // vertical leve dentro del feed se interprete como tap. En vez de un
  // Pressable envolviendo todo, cada zona pulsable (foto, caption, etc.)
  // tiene su propio Pressable puntual.
  return (
    <View style={styles.card}>
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
          {post.photos.length > 1 ? (
            <ScrollView
              style={styles.imageScroll}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handlePhotoScroll}
              scrollEventThrottle={16}
            >
              {post.photos.map((url, index) => (
                <Pressable
                  key={`${url}-${index}`}
                  style={{ width: CARD_WIDTH }}
                  onPressIn={handlePhotoPressIn}
                  onPress={handlePhotoPress}
                >
                  <Image
                    source={{ uri: url }}
                    style={[styles.image, { width: CARD_WIDTH }]}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Pressable onPress={() => router.push(detailHref)}>
              <Image source={{ uri: post.photos[0] }} style={styles.image} resizeMode="cover" />
            </Pressable>
          )}
          <GradientShade height={100} />
          {post.photos.length > 1 && (
            <>
              <View style={styles.multiPhotoBadge}>
                <Ionicons name="copy-outline" size={14} color="#fff" />
              </View>
              <View style={styles.dotsRowOverlay}>
                {post.photos.map((_, i) => (
                  <View key={i} style={[styles.dotOverlay, i === photoIndex && styles.dotOverlayActive]} />
                ))}
              </View>
            </>
          )}
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

      {!hasImage && caption && (
        <Pressable onPress={() => router.push(detailHref)}>
          <Text style={styles.caption}>{caption}</Text>
        </Pressable>
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: CARD_MARGIN,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
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
    aspectRatio: 3 / 4,
  },
  imageScroll: {
    // Ancho explícito en vez de '100%': tiene que ser el mismo entero que
    // `CARD_WIDTH` (usado por cada página) para que `pagingEnabled` snapee
    // exactamente al ancho de cada foto -- ver nota junto a CARD_WIDTH.
    width: CARD_WIDTH,
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
  },
  multiPhotoBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 5,
  },
  dotsRowOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dotOverlay: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotOverlayActive: {
    backgroundColor: '#fff',
    width: 16,
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
