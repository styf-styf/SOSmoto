import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { GradientShade } from '../../../components/GradientShade';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import {
  createProduct,
  createService,
  deleteProduct,
  deleteService,
  getAllProducts,
  getAllServices,
  getPlanLimits,
  updateProduct,
  updateService,
  type PlanLimits,
} from '../../../services/catalog';
import { getMyWorkBusiness } from '../../../services/businesses';
import { pickAndUploadBusinessImage } from '../../../services/storage';
import type { Business, Product, Service } from '../../../types/database';

const SIDE_PADDING = 20;
const GRID_GAP = 10;
const GRID_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.round((SCREEN_WIDTH - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.1);

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

type FormState = { kind: 'service'; service: Service | null } | { kind: 'product'; product: Product | null };

// Mismo grid de foto + lista sin foto que ve el cliente en
// negocio-catalogo/[id].tsx, pero acá cada tarjeta es pulsable para editar y
// trae su propio ícono de eliminar -- así el negocio ve su catálogo "tal
// cual" lo ve el cliente, con las acciones de gestión superpuestas.
export default function CatalogoScreen() {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    const myBusiness = work?.business ?? null;
    setBusiness(myBusiness);
    if (!myBusiness) return;

    const [serviceList, productList, planLimits] = await Promise.all([
      getAllServices(myBusiness.id),
      getAllProducts(myBusiness.id),
      getPlanLimits(myBusiness.id),
    ]);
    setServices(serviceList);
    setProducts(productList);
    setLimits(planLimits);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load catalogo error', err))
      .finally(() => setLoading(false));
  }, [load]);

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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Catálogo</Text>
        {business.is_limited && (
          <Text style={styles.limitedNotice}>
            Tu negocio está limitado: no puedes crear, editar ni eliminar servicios o productos.
          </Text>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Servicios ({activeServicesCount}
            {limits?.maxServices !== null ? `/${limits?.maxServices}` : ''})
          </Text>
          {!business.is_limited && (
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
            readOnly={business.is_limited}
            onEdit={(service) => setForm({ kind: 'service', service })}
            onDelete={confirmDeleteService}
          />
        )}

        <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
          <Text style={styles.sectionTitle}>
            Productos ({activeProductsCount}
            {limits?.maxProducts !== null ? `/${limits?.maxProducts}` : ''})
          </Text>
          {!business.is_limited && (
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
            readOnly={business.is_limited}
            onEdit={(product) => setForm({ kind: 'product', product })}
            onDelete={confirmDeleteProduct}
          />
        )}
      </ScrollView>

      <Modal visible={!!form} animationType="slide" onRequestClose={() => setForm(null)}>
        {form?.kind === 'service' && (
          <ServiceForm
            businessId={business.id}
            service={form.service}
            onCancel={() => setForm(null)}
            onSaved={applyService}
            onDelete={form.service ? () => confirmDeleteService(form.service!) : undefined}
          />
        )}
        {form?.kind === 'product' && (
          <ProductForm
            businessId={business.id}
            product={form.product}
            onCancel={() => setForm(null)}
            onSaved={applyProduct}
            onDelete={form.product ? () => confirmDeleteProduct(form.product!) : undefined}
          />
        )}
      </Modal>
    </View>
  );
}

function CatalogGrid<T extends CatalogDisplayItem>({
  items,
  onEdit,
  onDelete,
  readOnly,
}: {
  items: T[];
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  readOnly?: boolean;
}) {
  const withPhoto = items.filter((item) => item.photos.length > 0);
  const withoutPhoto = items.filter((item) => item.photos.length === 0);
  return (
    <>
      {withPhoto.length > 0 && (
        <View style={styles.grid}>
          {withPhoto.map((item) => (
            <Pressable key={item.id} style={styles.gridCard} onPress={() => !readOnly && onEdit(item)}>
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
          ))}
        </View>
      )}
      {withoutPhoto.length > 0 && (
        <View style={[withPhoto.length > 0 && styles.listWrapWithGrid]}>
          {withoutPhoto.map((item) => (
            <Pressable key={item.id} style={styles.itemRow} onPress={() => !readOnly && onEdit(item)}>
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
  onCancel,
  onSaved,
  onDelete,
}: {
  businessId: string;
  service: Service | null;
  onCancel: () => void;
  onSaved: (service: Service) => void;
  onDelete?: () => void;
}) {
  const isEdit = !!service;
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service?.reference_price !== null && service?.reference_price !== undefined ? String(service.reference_price) : '');
  const [photoUrl, setPhotoUrl] = useState(service?.photos[0] ?? '');
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePickPhoto() {
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadBusinessImage(businessId);
      if (url) setPhotoUrl(url);
    } catch (err) {
      console.error('upload service photo error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del servicio.');
      return;
    }
    const parsedPrice = price.trim() ? Number(price) : null;
    if (parsedPrice !== null && Number.isNaN(parsedPrice)) {
      Alert.alert('Precio inválido', 'Ingresa un número válido.');
      return;
    }
    setSaving(true);
    try {
      const result = isEdit
        ? await updateService(service!.id, {
            name: name.trim(),
            description: description.trim() || null,
            reference_price: parsedPrice,
            photos: photoUrl ? [photoUrl] : [],
            is_active: isActive,
          })
        : await createService({
            businessId,
            name: name.trim(),
            description: description.trim() || undefined,
            referencePrice: parsedPrice ?? undefined,
            photos: photoUrl ? [photoUrl] : undefined,
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
    <ScrollView contentContainerStyle={styles.modalContainer}>
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
      <TextField
        label="Precio referencial (opcional)"
        placeholder="15.00"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
      />
      <Text style={styles.fieldLabel}>Foto (opcional)</Text>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" /> : null}
      <Button
        title={photoUrl ? 'Cambiar foto' : 'Agregar foto'}
        variant="secondary"
        onPress={handlePickPhoto}
        loading={uploadingPhoto}
        style={styles.photoButton}
      />

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
  onCancel,
  onSaved,
  onDelete,
}: {
  businessId: string;
  product: Product | null;
  onCancel: () => void;
  onSaved: (product: Product) => void;
  onDelete?: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [price, setPrice] = useState(product?.reference_price !== null && product?.reference_price !== undefined ? String(product.reference_price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '0');
  const [photoUrl, setPhotoUrl] = useState(product?.photos[0] ?? '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePickPhoto() {
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadBusinessImage(businessId);
      if (url) setPhotoUrl(url);
    } catch (err) {
      console.error('upload product photo error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del producto.');
      return;
    }
    const parsedPrice = price.trim() ? Number(price) : null;
    const parsedStock = Number(stock);
    if (parsedPrice !== null && Number.isNaN(parsedPrice)) {
      Alert.alert('Precio inválido', 'Ingresa un número válido.');
      return;
    }
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      Alert.alert('Stock inválido', 'Ingresa un número válido.');
      return;
    }
    setSaving(true);
    try {
      const result = isEdit
        ? await updateProduct(product!.id, {
            name: name.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            reference_price: parsedPrice,
            stock: parsedStock,
            photos: photoUrl ? [photoUrl] : [],
            is_active: isActive,
          })
        : await createProduct({
            businessId,
            name: name.trim(),
            description: description.trim() || undefined,
            category: category.trim() || undefined,
            referencePrice: parsedPrice ?? undefined,
            stock: parsedStock,
            photos: photoUrl ? [photoUrl] : undefined,
          });
      onSaved(result);
    } catch (err) {
      console.error('save product error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.modalContainer}>
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
      <TextField label="Categoría (opcional)" placeholder="Accesorios" value={category} onChangeText={setCategory} />
      <TextField
        label="Precio referencial (opcional)"
        placeholder="45.00"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
      />
      <TextField label="Stock" placeholder="0" keyboardType="numeric" value={stock} onChangeText={setStock} />
      <Text style={styles.fieldLabel}>Foto (opcional)</Text>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" /> : null}
      <Button
        title={photoUrl ? 'Cambiar foto' : 'Agregar foto'}
        variant="secondary"
        onPress={handlePickPhoto}
        loading={uploadingPhoto}
        style={styles.photoButton}
      />

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
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
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
  gridCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
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
  photoPreview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  photoButton: {
    marginBottom: 16,
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
});
