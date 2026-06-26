import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
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
} from '../../services/catalog';
import { getMyWorkBusiness } from '../../services/businesses';
import { pickAndUploadBusinessImage } from '../../services/storage';
import type { Business, Product, Service } from '../../types/database';

type Tab = 'services' | 'products';

export default function CatalogoScreen() {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  function handleAddPress() {
    const atLimit = tab === 'services' ? atServiceLimit : atProductLimit;
    if (atLimit) {
      const max = tab === 'services' ? limits?.maxServices : limits?.maxProducts;
      Alert.alert(
        'Límite de plan alcanzado',
        `Tu plan ${limits?.planName} permite hasta ${max} ${tab === 'services' ? 'servicios' : 'productos'} activos. Sube de plan para agregar más.`
      );
      return;
    }
    setShowForm(true);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Catálogo</Text>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'services' && styles.tabSelected]}
          onPress={() => {
            setTab('services');
            setShowForm(false);
          }}
        >
          <Text style={[styles.tabText, tab === 'services' && styles.tabTextSelected]}>
            Servicios ({activeServicesCount}{limits?.maxServices !== null ? `/${limits?.maxServices}` : ''})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'products' && styles.tabSelected]}
          onPress={() => {
            setTab('products');
            setShowForm(false);
          }}
        >
          <Text style={[styles.tabText, tab === 'products' && styles.tabTextSelected]}>
            Productos ({activeProductsCount}{limits?.maxProducts !== null ? `/${limits?.maxProducts}` : ''})
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {tab === 'services' ? (
          <>
            {services.length === 0 && !showForm && (
              <Text style={styles.placeholder}>Aún no agregas servicios.</Text>
            )}
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                businessId={business.id}
                service={service}
                onUpdated={(updated) => setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
                onDeleted={() => setServices((prev) => prev.filter((s) => s.id !== service.id))}
              />
            ))}
            {showForm ? (
              <AddServiceForm
                businessId={business.id}
                onCancel={() => setShowForm(false)}
                onCreated={(service) => {
                  setServices((prev) => [service, ...prev]);
                  setShowForm(false);
                }}
              />
            ) : (
              <Button title="+ Agregar servicio" variant="secondary" onPress={handleAddPress} />
            )}
          </>
        ) : (
          <>
            {products.length === 0 && !showForm && (
              <Text style={styles.placeholder}>Aún no agregas productos.</Text>
            )}
            {products.map((product) => (
              <ProductCard
                key={product.id}
                businessId={business.id}
                product={product}
                onUpdated={(updated) => setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
                onDeleted={() => setProducts((prev) => prev.filter((p) => p.id !== product.id))}
              />
            ))}
            {showForm ? (
              <AddProductForm
                businessId={business.id}
                onCancel={() => setShowForm(false)}
                onCreated={(product) => {
                  setProducts((prev) => [product, ...prev]);
                  setShowForm(false);
                }}
              />
            ) : (
              <Button title="+ Agregar producto" variant="secondary" onPress={handleAddPress} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ServiceCard({
  businessId,
  service,
  onUpdated,
  onDeleted,
}: {
  businessId: string;
  service: Service;
  onUpdated: (service: Service) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? '');
  const [price, setPrice] = useState(service.reference_price !== null ? String(service.reference_price) : '');
  const [photoUrl, setPhotoUrl] = useState(service.photos[0] ?? '');
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

  async function handleToggleActive(value: boolean) {
    setBusy(true);
    try {
      const updated = await updateService(service.id, { is_active: value });
      onUpdated(updated);
    } catch (err) {
      console.error('toggle service error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar el servicio.');
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert('Eliminar servicio', `¿Eliminar "${service.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteService(service.id);
            onDeleted();
          } catch (err) {
            console.error('delete service error', err);
          }
        },
      },
    ]);
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
      const updated = await updateService(service.id, {
        name: name.trim(),
        description: description.trim() || null,
        reference_price: parsedPrice,
        photos: photoUrl ? [photoUrl] : [],
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      console.error('update service error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <View style={styles.card}>
        <TextField label="Nombre" value={name} onChangeText={setName} />
        <TextField label="Descripción (opcional)" value={description} onChangeText={setDescription} />
        <TextField
          label="Precio referencial (opcional)"
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
        <View style={styles.editActions}>
          <Button title="Guardar" onPress={handleSave} loading={saving} style={styles.flexButton} />
          <Button
            title="Cancelar"
            variant="secondary"
            onPress={() => {
              setName(service.name);
              setDescription(service.description ?? '');
              setPrice(service.reference_price !== null ? String(service.reference_price) : '');
              setPhotoUrl(service.photos[0] ?? '');
              setEditing(false);
            }}
            style={styles.flexButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {service.photos[0] && <Image source={{ uri: service.photos[0] }} style={styles.cardPhoto} resizeMode="cover" />}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{service.name}</Text>
        <View style={styles.cardActions}>
          <Pressable onPress={() => setEditing(true)}>
            <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </View>
      {service.description && <Text style={styles.cardMeta}>{service.description}</Text>}
      {service.reference_price !== null && (
        <Text style={styles.cardPrice}>${service.reference_price.toFixed(2)}</Text>
      )}
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>{service.is_active ? 'Activo' : 'Oculto'}</Text>
        <Switch value={service.is_active} onValueChange={handleToggleActive} disabled={busy} />
      </View>
    </View>
  );
}

function ProductCard({
  businessId,
  product,
  onUpdated,
  onDeleted,
}: {
  businessId: string;
  product: Product;
  onUpdated: (product: Product) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? '');
  const [category, setCategory] = useState(product.category ?? '');
  const [price, setPrice] = useState(product.reference_price !== null ? String(product.reference_price) : '');
  const [stock, setStock] = useState(String(product.stock));
  const [photoUrl, setPhotoUrl] = useState(product.photos[0] ?? '');
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

  async function handleToggleActive(value: boolean) {
    setBusy(true);
    try {
      const updated = await updateProduct(product.id, { is_active: value });
      onUpdated(updated);
    } catch (err) {
      console.error('toggle product error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar el producto.');
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert('Eliminar producto', `¿Eliminar "${product.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(product.id);
            onDeleted();
          } catch (err) {
            console.error('delete product error', err);
          }
        },
      },
    ]);
  }

  function resetFields() {
    setName(product.name);
    setDescription(product.description ?? '');
    setCategory(product.category ?? '');
    setPrice(product.reference_price !== null ? String(product.reference_price) : '');
    setStock(String(product.stock));
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
      const updated = await updateProduct(product.id, {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        reference_price: parsedPrice,
        stock: parsedStock,
        photos: photoUrl ? [photoUrl] : [],
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      console.error('update product error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <View style={styles.card}>
        <TextField label="Nombre" value={name} onChangeText={setName} />
        <TextField label="Descripción (opcional)" value={description} onChangeText={setDescription} />
        <TextField label="Categoría (opcional)" value={category} onChangeText={setCategory} />
        <TextField
          label="Precio referencial (opcional)"
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
        />
        <TextField label="Stock" keyboardType="numeric" value={stock} onChangeText={setStock} />
        <Text style={styles.fieldLabel}>Foto (opcional)</Text>
        {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" /> : null}
        <Button
          title={photoUrl ? 'Cambiar foto' : 'Agregar foto'}
          variant="secondary"
          onPress={handlePickPhoto}
          loading={uploadingPhoto}
          style={styles.photoButton}
        />
        <View style={styles.editActions}>
          <Button title="Guardar" onPress={handleSave} loading={saving} style={styles.flexButton} />
          <Button
            title="Cancelar"
            variant="secondary"
            onPress={() => {
              resetFields();
              setPhotoUrl(product.photos[0] ?? '');
              setEditing(false);
            }}
            style={styles.flexButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {product.photos[0] && <Image source={{ uri: product.photos[0] }} style={styles.cardPhoto} resizeMode="cover" />}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{product.name}</Text>
        <View style={styles.cardActions}>
          <Pressable onPress={() => setEditing(true)}>
            <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </View>
      {product.category && <Text style={styles.cardMeta}>Categoría: {product.category}</Text>}
      {product.description && <Text style={styles.cardMeta}>{product.description}</Text>}
      <Text style={styles.cardMeta}>Stock: {product.stock}</Text>
      {product.reference_price !== null && (
        <Text style={styles.cardPrice}>${product.reference_price.toFixed(2)}</Text>
      )}
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>{product.is_active ? 'Activo' : 'Oculto'}</Text>
        <Switch value={product.is_active} onValueChange={handleToggleActive} disabled={busy} />
      </View>
    </View>
  );
}

function AddServiceForm({
  businessId,
  onCancel,
  onCreated,
}: {
  businessId: string;
  onCancel: () => void;
  onCreated: (service: Service) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
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

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del servicio.');
      return;
    }
    const parsedPrice = price.trim() ? Number(price) : undefined;
    if (parsedPrice !== undefined && Number.isNaN(parsedPrice)) {
      Alert.alert('Precio inválido', 'Ingresa un número válido.');
      return;
    }
    setSaving(true);
    try {
      const service = await createService({
        businessId,
        name: name.trim(),
        description: description.trim() || undefined,
        referencePrice: parsedPrice,
        photos: photoUrl ? [photoUrl] : undefined,
      });
      onCreated(service);
    } catch (err) {
      console.error('create service error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear el servicio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
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
      <View style={styles.editActions}>
        <Button title="Guardar" onPress={handleCreate} loading={saving} style={styles.flexButton} />
        <Button title="Cancelar" variant="secondary" onPress={onCancel} style={styles.flexButton} />
      </View>
    </View>
  );
}

function AddProductForm({
  businessId,
  onCancel,
  onCreated,
}: {
  businessId: string;
  onCancel: () => void;
  onCreated: (product: Product) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [photoUrl, setPhotoUrl] = useState('');
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

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del producto.');
      return;
    }
    const parsedPrice = price.trim() ? Number(price) : undefined;
    const parsedStock = Number(stock);
    if (parsedPrice !== undefined && Number.isNaN(parsedPrice)) {
      Alert.alert('Precio inválido', 'Ingresa un número válido.');
      return;
    }
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      Alert.alert('Stock inválido', 'Ingresa un número válido.');
      return;
    }
    setSaving(true);
    try {
      const product = await createProduct({
        businessId,
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        referencePrice: parsedPrice,
        stock: parsedStock,
        photos: photoUrl ? [photoUrl] : undefined,
      });
      onCreated(product);
    } catch (err) {
      console.error('create product error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear el producto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
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
      <View style={styles.editActions}>
        <Button title="Guardar" onPress={handleCreate} loading={saving} style={styles.flexButton} />
        <Button title="Cancelar" variant="secondary" onPress={onCancel} style={styles.flexButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  container: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
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
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextSelected: {
    color: colors.primary,
  },
  list: {
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    backgroundColor: colors.background,
  },
  photoButton: {
    marginBottom: 16,
  },
  cardPhoto: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  flexButton: {
    flex: 1,
  },
});
