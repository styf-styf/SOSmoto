import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { CategoryPicker } from '../../../components/CategoryPicker';
import { GradientShade } from '../../../components/GradientShade';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import {
  createProduct,
  createProductVariant,
  createService,
  deleteProduct,
  deleteProductVariant,
  deleteService,
  getAllProducts,
  getAllServices,
  getPlanLimits,
  getProductVariants,
  syncProductStockFromVariants,
  updateProduct,
  updateProductVariant,
  updateService,
  type PlanLimits,
} from '../../../services/catalog';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getMyEmployeeRecord } from '../../../services/employees';
import { pickAndUploadBusinessImage } from '../../../services/storage';
import type { Business, Product, ProductPriceTier, ProductVariant, Service } from '../../../types/database';

const SIDE_PADDING = 20;
const GRID_GAP = 10;
const GRID_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
// Math.floor (no Math.round): evita que 2*CARD_WIDTH + GRID_GAP supere por
// 1px el ancho disponible y el grid colapse a 1 columna (ver AdGridCard.tsx).
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * (4 / 3));

interface CatalogDisplayItem {
  id: string;
  name: string;
  reference_price: number | null;
  photos: string[];
  is_active: boolean;
}

function formatItemPrice(referencePrice: number | null): string {
  return referencePrice !== null ? `$${Number(referencePrice).toFixed(2)}` : 'Consultar';
}

// Valida y ordena los escalones de precio por volumen de un producto o
// variante. El precio de arriba (basePrice) YA es el escalón 0, desde
// baseMinQuantity unidades -- los escalones que se agregan acá son SOLO
// para cantidades mayores a esa. Los mensajes de error citan los números
// reales que el usuario ingresó para que quede claro qué corregir.
function parsePriceTierRows(rows: PriceTierRow[], baseMinQuantity: number, basePrice: number | null): ProductPriceTier[] {
  const tiers: ProductPriceTier[] = [];
  for (const t of rows) {
    const q = Number(t.minQuantity);
    const p = Number(t.unitPrice);
    if (!t.minQuantity.trim() || !t.unitPrice.trim() || Number.isNaN(q) || Number.isNaN(p) || q < 1 || p <= 0) {
      throw new Error(
        'Cada escalón necesita una cantidad entera (mínimo 1) y un precio mayor a 0.\n\n' +
          'Ejemplo: "Desde 6" con precio "8.50" significa que desde 6 unidades, cada una cuesta $8.50.'
      );
    }
    tiers.push({ min_quantity: q, unit_price: p });
  }
  tiers.sort((a, b) => a.min_quantity - b.min_quantity);
  let prevQty = baseMinQuantity;
  let prevDescription =
    basePrice !== null
      ? `tu precio de arriba ($${basePrice}), que ya aplica desde ${baseMinQuantity} unidad${baseMinQuantity === 1 ? '' : 'es'}`
      : `la cantidad mínima de pedido (${baseMinQuantity})`;
  for (const t of tiers) {
    if (t.min_quantity <= prevQty) {
      throw new Error(
        `El escalón "Desde ${t.min_quantity}" repite o baja de ${prevDescription}.\n\n` +
          `Ejemplo: si ya tienes ${basePrice !== null ? `$${basePrice} desde ${prevQty}` : `un precio desde ${prevQty}`} unidad${prevQty === 1 ? '' : 'es'}, tu próximo escalón debe empezar en ${prevQty + 1} o más (ej. "Desde ${prevQty + 1}" con un precio menor), no repetir ${prevQty}.`
      );
    }
    prevQty = t.min_quantity;
    prevDescription = `el escalón anterior ("Desde ${t.min_quantity}", $${t.unit_price})`;
  }
  return tiers;
}

// Bloques reutilizables del modal de ayuda "Cómo agregar stock y variantes"
// (ver InventoryInfoModal más abajo) -- un paso numerado + su ejemplo.
function InfoStep({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <View style={styles.infoStep}>
      <View style={styles.infoStepHeader}>
        <View style={styles.infoStepBadge}>
          <Text style={styles.infoStepBadgeText}>{number}</Text>
        </View>
        <Text style={styles.infoStepTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoExample({ label, ok, children }: { label: string; ok?: boolean; children: ReactNode }) {
  return (
    <View style={[styles.infoExampleBox, ok === false && styles.infoExampleBoxError]}>
      <Text style={[styles.infoExampleLabel, ok === false && styles.infoExampleLabelError]}>{label}</Text>
      {children}
    </View>
  );
}

type FormState = { kind: 'service'; service: Service | null } | { kind: 'product'; product: Product | null };

interface VariantRow {
  id?: string;
  label: string;
  stock: string;
  price: string;
  priceTiers: PriceTierRow[];
}

interface PriceTierRow {
  minQuantity: string;
  unitPrice: string;
}

// Mismo grid de foto + lista sin foto que ve el cliente en
// negocio-catalogo/[id].tsx, pero acá cada tarjeta es pulsable para editar y
// trae su propio ícono de eliminar -- así el negocio ve su catálogo "tal
// cual" lo ve el cliente, con las acciones de gestión superpuestas.
export default function CatalogoScreen() {
  const { profile } = useAuth();
  const { highlightId, editId, editKind } = useLocalSearchParams<{
    highlightId?: string;
    editId?: string;
    editKind?: 'product' | 'service';
  }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManageCatalog, setCanManageCatalog] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInventoryInfo, setShowInventoryInfo] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    const myBusiness = work?.business ?? null;
    setBusiness(myBusiness);
    if (!myBusiness) return;

    const [serviceList, productList, planLimits, employeeRecord] = await Promise.all([
      getAllServices(myBusiness.id),
      getAllProducts(myBusiness.id),
      getPlanLimits(myBusiness.id),
      work?.isOwner ? Promise.resolve(null) : getMyEmployeeRecord(myBusiness.id, profile.id),
    ]);
    setServices(serviceList);
    setProducts(productList);
    setLimits(planLimits);
    setCanManageCatalog(work?.isOwner || (employeeRecord?.can_manage_catalog ?? false));
  }, [profile]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      setLoading(true);
      load()
        .catch((err) => console.error('load catalogo error', err))
        .finally(() => setLoading(false));
    } else {
      load().catch((err) => console.error('load catalogo background refresh error', err));
    }
  }, [load]);

  // Recarga productos al recuperar el foco (ej. al volver del inventario tras actualizar stock)
  useFocusEffect(
    useCallback(() => {
      if (!business) {
        load().catch((err) => console.error('reload catalogo on focus', err));
        return;
      }
      getAllProducts(business.id)
        .then((list) => setProducts(list))
        .catch((err) => console.error('reload products on focus', err));
    }, [business, load])
  );

  useEffect(() => {
    if (!highlightId || (!products.length && !services.length)) return;
    setHighlightedId(highlightId);
    const clearTimer = setTimeout(() => setHighlightedId(null), 3500);
    return () => clearTimeout(clearTimer);
  }, [highlightId, products.length, services.length]);

  // Llegada desde el botón "Editar" de la página de producto/servicio: abre
  // el modal de edición directamente apenas carga el catálogo.
  useEffect(() => {
    if (!editId || !editKind) return;
    if (editKind === 'product' && products.length) {
      const product = products.find((p) => p.id === editId);
      if (product) setForm({ kind: 'product', product });
    }
    if (editKind === 'service' && services.length) {
      const service = services.find((s) => s.id === editId);
      if (service) setForm({ kind: 'service', service });
    }
  }, [editId, editKind, products, services]);

  function handleHighlightLayout(y: number) {
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Primero crea tu negocio para gestionar el catálogo.</Text>
      </View>
    );
  }

  const canHaveServices = business.business_type === 'workshop';
  const activeServicesCount = services.filter((s) => s.is_active).length;
  const activeProductsCount = products.filter((p) => p.is_active).length;
  const atServiceLimit = limits?.maxServices !== null && activeServicesCount >= (limits?.maxServices ?? Infinity);
  const atProductLimit = limits?.maxProducts !== null && activeProductsCount >= (limits?.maxProducts ?? Infinity);

  function handleAddService() {
    if (atServiceLimit) {
      Alert.alert(
        'Límite de plan alcanzado',
        `Tu plan ${limits?.planName} permite hasta ${limits?.maxServices} servicios activos. Sube de plan para agregar más.`
      );
      return;
    }
    setForm({ kind: 'service', service: null });
  }

  function handleAddProduct() {
    if (atProductLimit) {
      Alert.alert(
        'Límite de plan alcanzado',
        `Tu plan ${limits?.planName} permite hasta ${limits?.maxProducts} productos activos. Sube de plan para agregar más.`
      );
      return;
    }
    setForm({ kind: 'product', product: null });
  }

  function applyService(service: Service) {
    setServices((prev) =>
      prev.some((s) => s.id === service.id) ? prev.map((s) => (s.id === service.id ? service : s)) : [service, ...prev]
    );
    setForm(null);
  }

  function applyProduct(product: Product) {
    setProducts((prev) =>
      prev.some((p) => p.id === product.id) ? prev.map((p) => (p.id === product.id ? product : p)) : [product, ...prev]
    );
    setForm(null);
  }

  function confirmDeleteService(service: Service) {
    Alert.alert('Eliminar servicio', `¿Eliminar "${service.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteService(service.id);
            setServices((prev) => prev.filter((s) => s.id !== service.id));
            setForm(null);
          } catch (err) {
            console.error('delete service error', err);
          }
        },
      },
    ]);
  }

  function confirmDeleteProduct(product: Product) {
    Alert.alert('Eliminar producto', `¿Eliminar "${product.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(product.id);
            setProducts((prev) => prev.filter((p) => p.id !== product.id));
            setForm(null);
          } catch (err) {
            console.error('delete product error', err);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
        {business.is_limited && (
          <Text style={styles.limitedNotice}>
            Tu negocio está limitado: no puedes crear, editar ni eliminar servicios o productos.
          </Text>
        )}
        {!business.is_limited && !canManageCatalog && (
          <Text style={styles.limitedNotice}>No tienes permiso para editar el catálogo de este negocio.</Text>
        )}

        {/* Acceso rápido al inventario de productos */}
        <View style={styles.inventarioRow}>
          <Pressable style={styles.inventarioBtn} onPress={() => router.push('/(business)/inventario')}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Text style={styles.inventarioBtnText}>Ver inventario de productos</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={styles.inventarioInfoBtn}
            onPress={() => setShowInventoryInfo(true)}
            hitSlop={8}
            accessibilityLabel="Cómo agregar stock y variantes"
          >
            <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
          </Pressable>
        </View>

        {canHaveServices && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Servicios ({activeServicesCount}
                {limits?.maxServices !== null ? `/${limits?.maxServices}` : ''})
              </Text>
              {!business.is_limited && canManageCatalog && (
                <Pressable onPress={handleAddService} style={styles.addButton}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.addButtonText}>Agregar</Text>
                </Pressable>
              )}
            </View>
            {services.length === 0 ? (
              <Text style={styles.placeholder}>Aún no agregas servicios.</Text>
            ) : (
              <CatalogGrid
                items={services}
                readOnly={business.is_limited || !canManageCatalog}
                onEdit={(service) => setForm({ kind: 'service', service })}
                onDelete={confirmDeleteService}
                highlightId={highlightId}
                highlightedId={highlightedId}
                onHighlightLayout={handleHighlightLayout}
              />
            )}
          </>
        )}

        <View style={[styles.sectionHeaderRow, canHaveServices && styles.sectionSpacing]}>
          <Text style={styles.sectionTitle}>
            Productos ({activeProductsCount}
            {limits?.maxProducts !== null ? `/${limits?.maxProducts}` : ''})
          </Text>
          {!business.is_limited && canManageCatalog && (
            <Pressable onPress={handleAddProduct} style={styles.addButton}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addButtonText}>Agregar</Text>
            </Pressable>
          )}
        </View>
        {products.length === 0 ? (
          <Text style={styles.placeholder}>Aún no agregas productos.</Text>
        ) : (
          <CatalogGrid
            items={products}
            readOnly={business.is_limited || !canManageCatalog}
            onEdit={(product) => setForm({ kind: 'product', product })}
            onDelete={confirmDeleteProduct}
            highlightId={highlightId}
            highlightedId={highlightedId}
            onHighlightLayout={handleHighlightLayout}
          />
        )}
      </ScrollView>

      <Modal visible={!!form} animationType="slide" onRequestClose={() => setForm(null)}>
        {form?.kind === 'service' && (
          <ServiceForm
            businessId={business.id}
            service={form.service}
            limits={limits}
            onCancel={() => setForm(null)}
            onSaved={applyService}
            onDelete={form.service ? () => confirmDeleteService(form.service!) : undefined}
          />
        )}
        {form?.kind === 'product' && (
          <ProductForm
            businessId={business.id}
            product={form.product}
            limits={limits}
            onCancel={() => setForm(null)}
            onSaved={applyProduct}
            onDelete={form.product ? () => confirmDeleteProduct(form.product!) : undefined}
          />
        )}
      </Modal>

      <Modal visible={showInventoryInfo} animationType="slide" onRequestClose={() => setShowInventoryInfo(false)}>
        <View style={styles.infoModalHeader}>
          <Text style={styles.infoModalTitle}>Cómo agregar stock y variantes</Text>
          <Pressable onPress={() => setShowInventoryInfo(false)} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.infoModalBody}>
          <InfoStep number={1} title="Stock sin variantes">
            <Text style={styles.infoText}>
              Si tu producto no tiene tallas, colores ni presentaciones distintas, usa el campo{' '}
              <Text style={styles.infoBold}>"Stock"</Text> directo en el formulario del producto.
            </Text>
            <InfoExample label="Ejemplo">
              <Text style={styles.infoExampleText}>"Aceite 20W50" → Stock: 50</Text>
              <Text style={styles.infoExampleTextMuted}>Tienes 50 unidades disponibles para vender/pedir.</Text>
            </InfoExample>
          </InfoStep>

          <InfoStep number={2} title="Variantes (tallas, colores, presentaciones)">
            <Text style={styles.infoText}>
              Usa <Text style={styles.infoBold}>"Agregar variante"</Text> cuando el mismo producto viene en varias
              versiones, cada una con su propio stock. El stock total del producto se calcula solo, sumando el de todas
              las variantes -- no lo edites arriba, ese campo desaparece en cuanto agregas una variante.
            </Text>
            <InfoExample label="Ejemplo">
              <Text style={styles.infoExampleText}>"Casco MT" con dos variantes:</Text>
              <Text style={styles.infoExampleText}>· Talla M → Stock: 10</Text>
              <Text style={styles.infoExampleText}>· Talla L → Stock: 8</Text>
              <Text style={styles.infoExampleTextMuted}>Stock total del producto: 18 uds (automático).</Text>
            </InfoExample>
            <Text style={styles.infoText}>
              El "Precio" de cada variante es opcional: si lo dejas vacío, esa variante hereda el precio general del
              producto. Solo llénalo si esa variante en particular cuesta distinto (ej. la Talla L más cara).
            </Text>
          </InfoStep>

          {business.business_type === 'brand_advertiser' && (
            <>
              <InfoStep number={3} title="Cantidad mínima de pedido">
                <Text style={styles.infoText}>
                  Define cuántas unidades como mínimo debe pedirte un taller o tienda. Si lo dejas vacío, se puede pedir
                  desde 1 unidad.
                </Text>
                <InfoExample label="Ejemplo">
                  <Text style={styles.infoExampleText}>Cantidad mínima de pedido: 12</Text>
                  <Text style={styles.infoExampleTextMuted}>
                    Un taller no puede pedirte menos de 12 unidades de este producto.
                  </Text>
                </InfoExample>
              </InfoStep>

              <InfoStep number={4} title="Precio por volumen (escalones del producto)">
                <Text style={styles.infoText}>
                  El precio que pones en el campo <Text style={styles.infoBold}>"Precio"</Text> ya es el precio desde tu
                  cantidad mínima de pedido -- es el "escalón 0". Los escalones que agregues abajo son{' '}
                  <Text style={styles.infoBold}>solo para cantidades mayores</Text>, cada uno con una cantidad más alta que
                  el anterior.
                </Text>
                <InfoExample label="✓ Ejemplo correcto" ok>
                  <Text style={styles.infoExampleText}>Precio: $40 · Cantidad mínima de pedido: 1</Text>
                  <Text style={styles.infoExampleText}>Escalón 1 → Desde 3, $38</Text>
                  <Text style={styles.infoExampleText}>Escalón 2 → Desde 6, $35</Text>
                  <Text style={styles.infoExampleTextMuted}>
                    Resultado: 1-2 unidades a $40 c/u · 3-5 unidades a $38 c/u · 6 o más a $35 c/u.
                  </Text>
                </InfoExample>
                <InfoExample label="✕ Error más común" ok={false}>
                  <Text style={styles.infoExampleText}>Precio: $40 · Cantidad mínima de pedido: 1</Text>
                  <Text style={styles.infoExampleText}>Escalón 1 → Desde 1, $38</Text>
                  <Text style={styles.infoExampleTextMuted}>
                    Inválido: el escalón repite la cantidad 1, que ya tiene precio ($40) por ser tu cantidad mínima.
                    Empieza el primer escalón en 2 o más.
                  </Text>
                </InfoExample>
              </InfoStep>

              <InfoStep number={5} title="Precio por volumen por variante">
                <Text style={styles.infoText}>
                  Cada variante puede tener sus propios escalones, totalmente independientes de los del producto y de las
                  demás variantes. La misma regla del paso 4 aplica: el "Precio" de esa variante ya es su escalón 0, no lo
                  repitas abajo.
                </Text>
                <InfoExample label="Ejemplo">
                  <Text style={styles.infoExampleText}>Talla M → Precio: $23 → Escalón: Desde 6, $20</Text>
                  <Text style={styles.infoExampleText}>Talla L → Precio: $28 → Escalón: Desde 6, $25</Text>
                  <Text style={styles.infoExampleTextMuted}>
                    Cada talla tiene su propio precio y su propio descuento por volumen -- no se mezclan entre sí.
                  </Text>
                </InfoExample>
              </InfoStep>
            </>
          )}

          <Button title="Entendido" onPress={() => setShowInventoryInfo(false)} style={styles.infoModalCloseButton} />
        </ScrollView>
      </Modal>
    </View>
  );
}

function CatalogGrid<T extends CatalogDisplayItem>({
  items,
  onEdit,
  onDelete,
  readOnly,
  highlightId,
  highlightedId,
  onHighlightLayout,
}: {
  items: T[];
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  readOnly?: boolean;
  highlightId?: string;
  highlightedId?: string | null;
  onHighlightLayout?: (y: number) => void;
}) {
  const containerY = useRef(0);
  const cardLocalY = useRef<number | null>(null);

  const withPhoto = items.filter((item) => item.photos.length > 0);
  const withoutPhoto = items.filter((item) => item.photos.length === 0);
  const targetInPhoto = !!highlightId && withPhoto.some((i) => i.id === highlightId);
  const targetInList = !!highlightId && withoutPhoto.some((i) => i.id === highlightId);

  return (
    <>
      {withPhoto.length > 0 && (
        <View
          style={styles.grid}
          onLayout={targetInPhoto ? (e) => {
            containerY.current = e.nativeEvent.layout.y;
            if (cardLocalY.current !== null && onHighlightLayout) {
              onHighlightLayout(containerY.current + cardLocalY.current);
            }
          } : undefined}
        >
          {withPhoto.map((item) => (
            <View
              key={item.id}
              style={[styles.gridCardWrapper, item.id === highlightedId && styles.gridCardHighlight]}
              onLayout={item.id === highlightId ? (e) => {
                cardLocalY.current = e.nativeEvent.layout.y;
              } : undefined}
            >
              <Pressable
                style={styles.gridCard}
                onPress={() => !readOnly && onEdit(item)}
              >
                <Image source={{ uri: item.photos[0] }} style={styles.gridImage} resizeMode="cover" />
                <GradientShade height={Math.round(CARD_HEIGHT * 0.55)} />
                <Text numberOfLines={1} style={styles.gridName}>
                  {item.name}
                </Text>
                <Text style={styles.gridPrice}>{formatItemPrice(item.reference_price)}</Text>
                {!item.is_active && (
                  <View style={styles.hiddenBadge}>
                    <Text style={styles.hiddenBadgeText}>Oculto</Text>
                  </View>
                )}
                {!readOnly && (
                  <Pressable style={styles.deleteIcon} onPress={() => onDelete(item)}>
                    <Ionicons name="trash-outline" size={15} color="#fff" />
                  </Pressable>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {withoutPhoto.length > 0 && (
        <View
          style={[withPhoto.length > 0 && styles.listWrapWithGrid]}
          onLayout={targetInList ? (e) => {
            containerY.current = e.nativeEvent.layout.y;
            if (cardLocalY.current !== null && onHighlightLayout) {
              onHighlightLayout(containerY.current + cardLocalY.current);
            }
          } : undefined}
        >
          {withoutPhoto.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.itemRow, item.id === highlightedId && styles.itemRowHighlight]}
              onPress={() => !readOnly && onEdit(item)}
              onLayout={item.id === highlightId ? (e) => {
                cardLocalY.current = e.nativeEvent.layout.y;
              } : undefined}
            >
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
                {!item.is_active ? ' · Oculto' : ''}
              </Text>
              <View style={styles.itemRowRight}>
                <Text style={styles.itemPrice}>{formatItemPrice(item.reference_price)}</Text>
                {!readOnly && (
                  <Pressable onPress={() => onDelete(item)}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

function ServiceForm({
  businessId,
  service,
  limits,
  onCancel,
  onSaved,
  onDelete,
}: {
  businessId: string;
  service: Service | null;
  limits: PlanLimits | null;
  onCancel: () => void;
  onSaved: (service: Service) => void;
  onDelete?: () => void;
}) {
  const isEdit = !!service;
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [categoryId, setCategoryId] = useState(service?.category_id ?? '');
  const [price, setPrice] = useState(service?.reference_price !== null && service?.reference_price !== undefined ? String(service.reference_price) : '');
  const [photos, setPhotos] = useState<string[]>(service?.photos ?? []);
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const maxPhotos = limits?.maxPhotosPerItem ?? 1;
  const atPhotoLimit = maxPhotos !== null && photos.length >= maxPhotos;

  async function handlePickPhoto() {
    if (atPhotoLimit) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadBusinessImage(businessId);
      if (url) setPhotos((prev) => [...prev, url]);
    } catch (err) {
      console.error('upload service photo error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del servicio.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Falta la categoría', 'Elige o sugiere una categoría para el servicio.');
      return;
    }
    if (!price.trim()) {
      Alert.alert('Falta el precio', 'Ingresa el precio del servicio.');
      return;
    }
    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice)) {
      Alert.alert('Precio inválido', 'Ingresa un número válido.');
      return;
    }
    setSaving(true);
    try {
      const result = isEdit
        ? await updateService(service!.id, {
            name: name.trim(),
            description: description.trim() || null,
            category_id: categoryId,
            reference_price: parsedPrice,
            photos,
            is_active: isActive,
          })
        : await createService({
            businessId,
            name: name.trim(),
            description: description.trim() || undefined,
            categoryId,
            referencePrice: parsedPrice,
            photos,
          });
      onSaved(result);
    } catch (err) {
      console.error('save service error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el servicio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.modalContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{isEdit ? 'Editar servicio' : 'Nuevo servicio'}</Text>
        <Pressable onPress={onCancel}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <TextField label="Nombre" placeholder="Cambio de aceite" value={name} onChangeText={setName} />
      <TextField
        label="Descripción (opcional)"
        placeholder="Incluye filtro y revisión básica"
        value={description}
        onChangeText={setDescription}
      />
      <CategoryPicker kind="service" value={categoryId} onChange={setCategoryId} />
      <TextField
        label="Precio"
        placeholder="15.00"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
      />
      <Text style={styles.fieldLabel}>
        Fotos ({photos.length}{maxPhotos !== null ? `/${maxPhotos}` : ''})
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
        {photos.map((url, index) => (
          <View key={`${url}-${index}`} style={styles.photoThumbWrap}>
            <Image source={{ uri: url }} style={styles.photoThumb} resizeMode="cover" />
            <Pressable style={styles.photoRemoveBtn} onPress={() => handleRemovePhoto(index)}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        {!atPhotoLimit && (
          <Pressable style={styles.photoAddTile} onPress={handlePickPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="add" size={22} color={colors.primary} />
                <Text style={styles.photoAddTileText}>Agregar</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
      {atPhotoLimit && (
        <Text style={styles.photoLimitHint}>
          Tu plan {limits?.planName ?? 'free'} permite hasta {maxPhotos} foto{maxPhotos === 1 ? '' : 's'}. Sube de plan para agregar más.
        </Text>
      )}

      {isEdit && (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Mostrar en catálogo</Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
      )}

      <Button title="Guardar" onPress={handleSave} loading={saving} style={styles.saveButton} />
      <Button title="Cancelar" variant="secondary" onPress={onCancel} style={styles.spacedButton} />
      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteLink}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteLinkText}>Eliminar servicio</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function ProductForm({
  businessId,
  product,
  limits,
  onCancel,
  onSaved,
  onDelete,
}: {
  businessId: string;
  product: Product | null;
  limits: PlanLimits | null;
  onCancel: () => void;
  onSaved: (product: Product) => void;
  onDelete?: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [price, setPrice] = useState(product?.reference_price !== null && product?.reference_price !== undefined ? String(product.reference_price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '0');
  const [minOrderQuantity, setMinOrderQuantity] = useState(
    product?.min_order_quantity != null ? String(product.min_order_quantity) : ''
  );
  const [priceTierRows, setPriceTierRows] = useState<PriceTierRow[]>(
    (product?.price_tiers ?? []).map((t) => ({ minQuantity: String(t.min_quantity), unitPrice: String(t.unit_price) }))
  );
  const isBrand = limits?.businessType === 'brand_advertiser';
  const [photos, setPhotos] = useState<string[]>(product?.photos ?? []);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const maxPhotos = limits?.maxPhotosPerItem ?? 1;
  const atPhotoLimit = maxPhotos !== null && photos.length >= maxPhotos;

  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [initialVariants, setInitialVariants] = useState<ProductVariant[]>([]);

  useEffect(() => {
    if (!product) return;
    getProductVariants(product.id)
      .then((list) => {
        setInitialVariants(list);
        setVariants(
          list.map((v) => ({
            id: v.id,
            label: v.label,
            stock: String(v.stock),
            price: v.reference_price !== null ? String(v.reference_price) : '',
            priceTiers: (v.price_tiers ?? []).map((t) => ({
              minQuantity: String(t.min_quantity),
              unitPrice: String(t.unit_price),
            })),
          }))
        );
      })
      .catch((err) => console.error('load product variants error', err));
  }, [product]);

  function addVariantRow() {
    setVariants((prev) => [...prev, { label: '', stock: '0', price: '', priceTiers: [] }]);
  }

  function addVariantTierRow(variantIndex: number) {
    setVariants((prev) =>
      prev.map((v, i) => (i === variantIndex ? { ...v, priceTiers: [...v.priceTiers, { minQuantity: '', unitPrice: '' }] } : v))
    );
  }

  function removeVariantTierRow(variantIndex: number, tierIndex: number) {
    setVariants((prev) =>
      prev.map((v, i) => (i === variantIndex ? { ...v, priceTiers: v.priceTiers.filter((_, ti) => ti !== tierIndex) } : v))
    );
  }

  function updateVariantTierRow(variantIndex: number, tierIndex: number, patch: Partial<PriceTierRow>) {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === variantIndex
          ? { ...v, priceTiers: v.priceTiers.map((t, ti) => (ti === tierIndex ? { ...t, ...patch } : t)) }
          : v
      )
    );
  }

  function addTierRow() {
    setPriceTierRows((prev) => [...prev, { minQuantity: '', unitPrice: '' }]);
  }

  function removeTierRow(index: number) {
    setPriceTierRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTierRow(index: number, patch: Partial<PriceTierRow>) {
    setPriceTierRows((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function removeVariantRow(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVariantRow(index: number, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  // Crea/actualiza/elimina las filas de variantes contra la BD y, si quedan
  // variantes activas, resincroniza products.stock como la suma de todas.
  async function syncVariants(productId: string) {
    // Ya validado en handleSave antes de llegar acá -- se reparsea solo para
    // tener el mismo escalón base (min_order_quantity) al armar cada arreglo.
    const baseMinQty = minOrderQuantity.trim() ? Number(minOrderQuantity) : 1;
    const currentIds = new Set(variants.filter((v) => v.id).map((v) => v.id));
    for (const iv of initialVariants) {
      if (!currentIds.has(iv.id)) await deleteProductVariant(iv.id);
    }
    const generalPrice = price.trim() ? Number(price) : null;
    for (const v of variants) {
      const vStock = Number(v.stock) || 0;
      const vPrice = v.price.trim() ? Number(v.price) : null;
      const vTiers = v.priceTiers.length > 0 ? parsePriceTierRows(v.priceTiers, baseMinQty, vPrice ?? generalPrice) : null;
      if (v.id) {
        await updateProductVariant(v.id, { label: v.label.trim(), stock: vStock, reference_price: vPrice, price_tiers: vTiers });
      } else {
        await createProductVariant({ productId, label: v.label.trim(), stock: vStock, referencePrice: vPrice, priceTiers: vTiers });
      }
    }
    if (variants.length > 0) {
      await syncProductStockFromVariants(productId);
    }
  }

  async function handlePickPhoto() {
    if (atPhotoLimit) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadBusinessImage(businessId);
      if (url) setPhotos((prev) => [...prev, url]);
    } catch (err) {
      console.error('upload product photo error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del producto.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Falta la categoría', 'Elige o sugiere una categoría para el producto.');
      return;
    }
    if (!price.trim()) {
      Alert.alert('Falta el precio', 'Ingresa el precio del producto.');
      return;
    }
    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice)) {
      Alert.alert('Precio inválido', 'Ingresa un número válido.');
      return;
    }
    const hasVariantRows = variants.length > 0;
    let parsedStock = 0;
    if (!hasVariantRows) {
      parsedStock = Number(stock);
      if (Number.isNaN(parsedStock) || parsedStock < 0) {
        Alert.alert('Stock inválido', 'Ingresa un número válido.');
        return;
      }
    }
    let parsedMinOrderQuantity: number | null = null;
    if (minOrderQuantity.trim()) {
      parsedMinOrderQuantity = Number(minOrderQuantity);
      if (Number.isNaN(parsedMinOrderQuantity) || parsedMinOrderQuantity < 1) {
        Alert.alert('Cantidad mínima inválida', 'Ingresa un número válido (mínimo 1) o déjalo vacío.');
        return;
      }
    }
    let parsedPriceTiers: ProductPriceTier[] | null = null;
    if (priceTierRows.length > 0) {
      try {
        parsedPriceTiers = parsePriceTierRows(priceTierRows, parsedMinOrderQuantity ?? 1, parsedPrice);
      } catch (err) {
        Alert.alert('Escalón de precio inválido', err instanceof Error ? err.message : 'Revisa los escalones.');
        return;
      }
    }
    for (const v of variants) {
      if (!v.label.trim()) {
        Alert.alert('Falta la etiqueta', 'Ingresa un nombre para cada variante (ej. Talla M).');
        return;
      }
      const vStock = Number(v.stock);
      if (Number.isNaN(vStock) || vStock < 0) {
        Alert.alert('Stock inválido', `Ingresa un stock válido para "${v.label}".`);
        return;
      }
      if (v.price.trim() && Number.isNaN(Number(v.price))) {
        Alert.alert('Precio inválido', `Ingresa un precio válido para "${v.label}" o déjalo vacío.`);
        return;
      }
      if (v.priceTiers.length > 0) {
        try {
          parsePriceTierRows(v.priceTiers, parsedMinOrderQuantity ?? 1, v.price.trim() ? Number(v.price) : parsedPrice);
        } catch (err) {
          Alert.alert('Escalón de precio inválido', `"${v.label}": ${err instanceof Error ? err.message : ''}`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const result = isEdit
        ? await updateProduct(product!.id, {
            name: name.trim(),
            description: description.trim() || null,
            category_id: categoryId,
            reference_price: parsedPrice,
            stock: parsedStock,
            photos,
            is_active: isActive,
            min_order_quantity: parsedMinOrderQuantity,
            price_tiers: parsedPriceTiers,
          })
        : await createProduct({
            businessId,
            name: name.trim(),
            description: description.trim() || undefined,
            categoryId,
            referencePrice: parsedPrice,
            stock: parsedStock,
            photos,
            minOrderQuantity: parsedMinOrderQuantity ?? undefined,
            priceTiers: parsedPriceTiers,
          });

      let finalProduct = result;
      if (hasVariantRows || initialVariants.length > 0) {
        await syncVariants(result.id);
        if (hasVariantRows) {
          finalProduct = { ...result, stock: variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0) };
        }
      }
      onSaved(finalProduct);
    } catch (err) {
      console.error('save product error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.modalContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{isEdit ? 'Editar producto' : 'Nuevo producto'}</Text>
        <Pressable onPress={onCancel}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <TextField label="Nombre" placeholder="Casco MT" value={name} onChangeText={setName} />
      <TextField
        label="Descripción (opcional)"
        placeholder="Casco abatible talla M"
        value={description}
        onChangeText={setDescription}
      />
      <CategoryPicker kind="product" value={categoryId} onChange={setCategoryId} />
      <TextField
        label="Precio"
        placeholder="45.00"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
      />
      {variants.length === 0 ? (
        <TextField label="Stock" placeholder="0" keyboardType="numeric" value={stock} onChangeText={setStock} />
      ) : (
        <View style={styles.stockComputedBox}>
          <Text style={styles.fieldLabel}>Stock total</Text>
          <Text style={styles.stockComputedValue}>
            {variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)} uds (suma de variantes)
          </Text>
        </View>
      )}

      {isBrand && (
        <TextField
          label="Cantidad mínima de pedido (opcional)"
          placeholder="Ej. 12 (por caja)"
          keyboardType="numeric"
          value={minOrderQuantity}
          onChangeText={setMinOrderQuantity}
        />
      )}

      {isBrand && (
        <>
          <Text style={styles.fieldLabel}>Precio por volumen (opcional)</Text>
          <Text style={styles.variantHint}>
            El precio de arriba ({price.trim() ? `$${price}` : 'sin definir'}) ya aplica desde{' '}
            {minOrderQuantity.trim() || '1'} unidad{minOrderQuantity.trim() === '1' ? '' : 'es'} -- NO agregues un escalón que
            repita esa cantidad. Agrega escalones solo para cantidades MAYORES, ej. si ya aplica desde{' '}
            {minOrderQuantity.trim() || '1'}, el primer escalón puede ser "Desde {Number(minOrderQuantity.trim() || '1') + 1}
            " (o más) a un precio menor.
          </Text>
          {priceTierRows.map((t, index) => (
            <View key={index} style={styles.variantCard}>
              <View style={styles.variantCardHeader}>
                <Text style={styles.fieldLabel}>Escalón {index + 1}</Text>
                <Pressable onPress={() => removeTierRow(index)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </Pressable>
              </View>
              <View style={styles.variantCardFieldsRow}>
                <View style={styles.variantFieldCol}>
                  <Text style={styles.variantFieldLabel}>Desde (unidades)</Text>
                  <TextInput
                    style={styles.variantSmallInput}
                    placeholder="Ej: 6"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={t.minQuantity}
                    onChangeText={(text) => updateTierRow(index, { minQuantity: text })}
                  />
                </View>
                <View style={styles.variantFieldCol}>
                  <Text style={styles.variantFieldLabel}>Precio por unidad</Text>
                  <TextInput
                    style={styles.variantSmallInput}
                    placeholder="Ej: 8.50"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={t.unitPrice}
                    onChangeText={(text) => updateTierRow(index, { unitPrice: text })}
                  />
                </View>
              </View>
            </View>
          ))}
          <Pressable style={styles.addVariantBtn} onPress={addTierRow}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addVariantBtnText}>Agregar escalón</Text>
          </Pressable>
        </>
      )}

      <Text style={styles.fieldLabel}>Variantes (opcional)</Text>
      <Text style={styles.variantHint}>
        Ej. tallas o colores, cada una con su propio stock. Deja el precio vacío para heredar el precio general.
      </Text>
      {variants.map((v, index) => (
        <View key={v.id ?? `new-${index}`} style={styles.variantCard}>
          <View style={styles.variantCardHeader}>
            <TextInput
              style={styles.variantLabelInput}
              placeholder="Ej: Talla M"
              placeholderTextColor={colors.textMuted}
              value={v.label}
              onChangeText={(text) => updateVariantRow(index, { label: text })}
            />
            <Pressable onPress={() => removeVariantRow(index)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </Pressable>
          </View>
          <View style={styles.variantCardFieldsRow}>
            <View style={styles.variantFieldCol}>
              <Text style={styles.variantFieldLabel}>Stock</Text>
              <TextInput
                style={styles.variantSmallInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={v.stock}
                onChangeText={(text) => updateVariantRow(index, { stock: text })}
              />
            </View>
            <View style={styles.variantFieldCol}>
              <Text style={styles.variantFieldLabel}>Precio (opcional)</Text>
              <TextInput
                style={styles.variantSmallInput}
                placeholder={price.trim() ? `$${price}` : 'General'}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={v.price}
                onChangeText={(text) => updateVariantRow(index, { price: text })}
              />
            </View>
          </View>

          {isBrand && (
            <View style={styles.variantTiersWrap}>
              <Text style={styles.variantFieldLabel}>Precio por volumen de esta variante (opcional)</Text>
              <Text style={styles.variantTierHint}>
                Su precio ({v.price.trim() ? `$${v.price}` : price.trim() ? `$${price} (general)` : 'sin definir'}) ya aplica
                desde {minOrderQuantity.trim() || '1'} unidad{minOrderQuantity.trim() === '1' ? '' : 'es'}. No repitas esa
                cantidad acá abajo -- agrega escalones solo para cantidades MAYORES, ej. si ya aplica desde{' '}
                {minOrderQuantity.trim() || '1'}, el primer escalón puede ser "Desde {Number(minOrderQuantity.trim() || '1') + 1}" (o más).
              </Text>
              {v.priceTiers.map((t, tierIndex) => (
                <View key={tierIndex} style={styles.variantCardFieldsRow}>
                  <View style={styles.variantFieldCol}>
                    <TextInput
                      style={styles.variantSmallInput}
                      placeholder="Desde uds"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={t.minQuantity}
                      onChangeText={(text) => updateVariantTierRow(index, tierIndex, { minQuantity: text })}
                    />
                  </View>
                  <View style={styles.variantFieldCol}>
                    <TextInput
                      style={styles.variantSmallInput}
                      placeholder="Precio c/u"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={t.unitPrice}
                      onChangeText={(text) => updateVariantTierRow(index, tierIndex, { unitPrice: text })}
                    />
                  </View>
                  <Pressable onPress={() => removeVariantTierRow(index, tierIndex)} hitSlop={8} style={styles.variantTierRemoveBtn}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addVariantTierBtn} onPress={() => addVariantTierRow(index)}>
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={styles.addVariantBtnText}>Agregar escalón</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
      <Pressable style={styles.addVariantBtn} onPress={addVariantRow}>
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={styles.addVariantBtnText}>Agregar variante</Text>
      </Pressable>

      <Text style={styles.fieldLabel}>
        Fotos ({photos.length}{maxPhotos !== null ? `/${maxPhotos}` : ''})
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
        {photos.map((url, index) => (
          <View key={`${url}-${index}`} style={styles.photoThumbWrap}>
            <Image source={{ uri: url }} style={styles.photoThumb} resizeMode="cover" />
            <Pressable style={styles.photoRemoveBtn} onPress={() => handleRemovePhoto(index)}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        {!atPhotoLimit && (
          <Pressable style={styles.photoAddTile} onPress={handlePickPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="add" size={22} color={colors.primary} />
                <Text style={styles.photoAddTileText}>Agregar</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
      {atPhotoLimit && (
        <Text style={styles.photoLimitHint}>
          Tu plan {limits?.planName ?? 'free'} permite hasta {maxPhotos} foto{maxPhotos === 1 ? '' : 's'}. Sube de plan para agregar más.
        </Text>
      )}

      {isEdit && (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Mostrar en catálogo</Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
      )}

      <Button title="Guardar" onPress={handleSave} loading={saving} style={styles.saveButton} />
      <Button title="Cancelar" variant="secondary" onPress={onCancel} style={styles.spacedButton} />
      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteLink}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteLinkText}>Eliminar producto</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 36,
    paddingBottom: 32,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  limitedNotice: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: '#FBE8E8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  inventarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  inventarioBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  inventarioBtnText: {
    flex: 1, fontSize: 14, fontWeight: '600', color: colors.primary,
  },
  inventarioInfoBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridCardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
  },
  gridCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'flex-end',
    padding: 8,
  },
  gridImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  gridPrice: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  hiddenBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hiddenBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listWrapWithGrid: {
    marginTop: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  itemRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  modalContainer: {
    padding: 20,
    paddingTop: 56,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  stockComputedBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  stockComputedValue: {
    fontSize: 14,
    color: colors.textMuted,
  },
  variantHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 10,
  },
  variantTierHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
    lineHeight: 15,
  },
  variantCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  variantCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variantLabelInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  variantCardFieldsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  variantFieldCol: {
    flex: 1,
  },
  variantFieldLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  variantSmallInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  variantTiersWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  variantTierRemoveBtn: {
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  addVariantTierBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  addVariantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingVertical: 10,
    marginBottom: 20,
  },
  addVariantBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  photosRow: {
    gap: 10,
    marginBottom: 6,
  },
  photoThumbWrap: {
    position: 'relative',
  },
  photoThumb: {
    width: 90,
    aspectRatio: 3 / 4,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  photoAddTile: {
    width: 90,
    aspectRatio: 3 / 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddTileText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  photoLimitHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    marginTop: 4,
  },
  spacedButton: {
    marginTop: 10,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 8,
  },
  deleteLinkText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  gridCardHighlight: {
    borderWidth: 2.5,
    borderColor: colors.primary,
    borderRadius: 12,
  },
  itemRowHighlight: {
    backgroundColor: `${colors.primary}18`,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  infoModalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  infoModalCloseButton: {
    marginTop: 8,
  },
  infoStep: {
    marginBottom: 26,
  },
  infoStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  infoStepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStepBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  infoStepTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    marginBottom: 10,
  },
  infoBold: {
    fontWeight: '700',
  },
  infoExampleBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  infoExampleBoxError: {
    borderLeftColor: colors.danger,
  },
  infoExampleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  infoExampleLabelError: {
    color: colors.danger,
  },
  infoExampleText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  infoExampleTextMuted: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },
});
