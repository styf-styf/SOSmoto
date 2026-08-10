import { useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { useImageAspectRatio } from '../hooks/useImageAspectRatio';
import { ExpandableText } from './ExpandableText';
import { GradientShade } from './GradientShade';
import { getPostAuthorAvatar, getPostAuthorName, getPostTag, incrementPostShares, type PostWithAuthor } from '../services/posts';
import { markHomeFeedPreserveScroll } from '../utils/homeFeedScrollPreserve';

const SCREEN_WIDTH = Dimensions.get('window').width;
// Unificado con el espacio izquierdo/derecho del resto del feed (historias,
// carrusel de catálogo, anuncios) -- ver CLAUDE.md/pedido de diseño del feed.
export const CARD_MARGIN = 6;
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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();
  const authorName = getPostAuthorName(post);
  const avatarUrl = getPostAuthorAvatar(post);
  const tag = getPostTag(post, userRole);
  const isBusiness = !!post.author_business;
  const hasImage = post.photos.length > 0;
  // Proporción natural de la publicación (a diferencia del resto de la app,
  // que fuerza 3:4 al subir) -- acotada a un MÁXIMO de alto relativo de 3:4
  // (nunca más angosta/alta que eso), sin tope de ancho. Con varias fotos,
  // todas comparten el alto de la primera (mismo criterio que Instagram),
  // ver el mini-carrusel más abajo.
  const imageRatio = useImageAspectRatio(post.photos[0], { clampMin: 3 / 4 });
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

  // El detalle de publicación vive fuera de (tabs) (hermano, no hijo), así
  // que volver con "atrás" re-enfoca todo el navegador de tabs y dispara el
  // useFocusEffect de Inicio -- se avisa acá para que ese efecto sepa que no
  // debe forzar scrollToTop esta vez (ver utils/homeFeedScrollPreserve.ts).
  function goToDetail() {
    markHomeFeedPreserveScroll();
    router.push(detailHref);
  }

  function handlePhotoPress(e: GestureResponderEvent) {
    const startX = photoTouchStartXRef.current;
    if (startX !== null && Math.abs(e.nativeEvent.pageX - startX) > PHOTO_SWIPE_THRESHOLD) return;
    goToDetail();
  }

  const caption = post.caption ?? '';

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

  async function handleShare() {
    const url = `https://sosmoto.net/post/${post.id}`;
    const text = post.caption ? `${authorName}: ${post.caption}` : `Publicación de ${authorName} en SOSmoto`;
    try {
      const result = await Share.share({ message: `${text}\n${url}`, url });
      // En iOS Share.share() distingue "canceló" de "sí compartió"; en
      // Android el share sheet nativo no avisa si de verdad se completó
      // (limitación de la API, no de la app), así que ahí se cuenta apenas
      // se abre el selector -- mismo criterio que usan la mayoría de apps.
      if (result.action !== Share.dismissedAction) {
        incrementPostShares(post.id).catch(() => {});
      }
    } catch {
      // Cerrar el share sheet sin elegir nada también puede rechazar la
      // promesa en vez de resolver con dismissedAction -- no cuenta.
    }
  }

  function handleAuthorPress(e: GestureResponderEvent) {
    e.stopPropagation();
    const prefix = userRole === 'business' ? '/(business)' : '/(client)';
    if (isBusiness && post.author_business) {
      if (post.author_business.id === viewerBusinessId) {
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

  // Toda la tarjeta lleva al detalle EXCEPTO avatar/nombre (→ perfil) y los
  // botones de comentar/compartir -- por eso el fondo de cada fila (author
  // row, bloque de descripción, fila de engagement plana) es su propio
  // Pressable→detalle, con esas excepciones como Pressables anidados
  // encima (el más interno gana el toque, no se propaga al de afuera).
  // A propósito NO es un solo Pressable envolviendo TODA la tarjeta -- el
  // carrusel de fotos (imageWrap) es un ScrollView horizontal, y si
  // quedara anidado dentro de un Pressable ancestro, la negociación de
  // gestos entre "tap para abrir el detalle" y "swipe para cambiar de
  // foto" queda inconsistente (funciona para un lado sí y para el otro no,
  // o requiere remount para destrabarse) -- ya se probó antes y por eso
  // sigue siendo un hermano suelto dentro de `card`, con su propio
  // tap-vs-swipe resuelto en handlePhotoPress/handlePhotoPressIn.
  return (
    <View style={styles.card}>
      <Pressable style={styles.authorRow} onPress={() => goToDetail()}>
        <Pressable onPress={handleAuthorPress} style={styles.avatarWrap}>
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
        </Pressable>
        <Pressable onPress={handleAuthorPress} style={styles.authorNameWrap}>
          <Text style={styles.authorName} numberOfLines={1}>
            {authorName}
          </Text>
        </Pressable>
      </Pressable>

      {/* Descripción arriba de la imagen, hasta 3 líneas -- exclusivo de
          publicaciones CON foto (ver PhotoCarousel/PostDetail para el caso
          sin imagen, que muestra el texto completo sin límite). */}
      {hasImage && caption && (
        <Pressable style={styles.captionBlock} onPress={() => goToDetail()}>
          <ExpandableText text={caption} style={styles.captionCollapsedText} />
        </Pressable>
      )}

      {hasImage && (
        <View style={[styles.imageWrap, { aspectRatio: imageRatio ?? 3 / 4 }]}>
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
            <Pressable onPress={() => goToDetail()}>
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
            <Pressable style={styles.engagementButtonOverlay} onPress={() => goToDetail()}>
              <Ionicons name="chatbubble-outline" size={22} color="#fff" />
              <Text style={styles.engagementCountOverlay}>{post.comments_count}</Text>
            </Pressable>
            <Pressable style={styles.engagementButtonOverlay} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={22} color="#fff" />
              <Text style={styles.engagementCountOverlay}>{post.shares_count}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!hasImage && caption && (
        <Pressable onPress={() => goToDetail()}>
          <Text style={styles.caption}>{caption}</Text>
        </Pressable>
      )}

      {!hasImage && (
        <Pressable style={styles.engagementRow} onPress={() => goToDetail()}>
          {tag ? (
            <Pressable style={styles.tagChipFlat} onPress={handleTagPress}>
              <Ionicons name="pricetag" size={12} color={colors.primary} />
              <Text style={styles.tagChipFlatText}>{tag.label}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={styles.engagementButtonsGroup}>
            <Pressable style={styles.engagementButton} onPress={() => goToDetail()}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
              <Text style={styles.engagementCount}>{post.comments_count}</Text>
            </Pressable>
            <Pressable style={styles.engagementButton} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color={colors.textMuted} />
              <Text style={styles.engagementCount}>{post.shares_count}</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
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
    authorNameWrap: {
      flex: 1,
    },
    authorName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    captionBlock: {
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    captionCollapsedText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 19,
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
      backgroundColor: colors.warningLight,
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
}
