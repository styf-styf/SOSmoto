import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { getCategories, suggestCategory } from '../services/catalog';
import type { Category, CategoryKind } from '../types/database';

interface CategoryPickerProps {
  label?: string;
  kind: CategoryKind;
  value: string;
  onChange: (categoryId: string, name: string) => void;
  error?: string;
}

export function CategoryPicker({ label = 'Categoría', kind, value, onChange, error }: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    getCategories(kind)
      .then(setCategories)
      .catch((err) => console.error('load categories error', err));
  }, [kind]);

  // Al cargar en modo edición, muestra el nombre de la categoría ya seleccionada.
  useEffect(() => {
    if (initialized.current || !value || categories.length === 0) return;
    const match = categories.find((c) => c.id === value);
    if (match) {
      setQuery(match.name);
      initialized.current = true;
    }
  }, [value, categories]);

  const filtered = query.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : categories;
  const exactMatch = categories.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  function selectCategory(category: Category) {
    setQuery(category.name);
    onChange(category.id, category.name);
    setOpen(false);
  }

  async function handleSuggest() {
    const name = query.trim();
    if (!name || suggesting) return;
    setSuggesting(true);
    try {
      const created = await suggestCategory(name, kind);
      setCategories((prev) => [...prev, created]);
      selectCategory(created);
    } catch (err) {
      console.error('suggest category error', err);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder="Buscar categoría..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setOpen(true);
          if (!text.trim()) onChange('', '');
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <View style={styles.dropdown}>
          {filtered.map((category) => (
            <Pressable key={category.id} style={styles.option} onPress={() => selectCategory(category)}>
              <Text style={styles.optionText}>{category.name}</Text>
              {category.status === 'pending' && <Text style={styles.pendingTag}>pendiente</Text>}
            </Pressable>
          ))}
          {query.trim().length > 0 && !exactMatch && (
            <Pressable style={styles.suggestOption} onPress={handleSuggest} disabled={suggesting}>
              {suggesting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.suggestText}>Sugerir "{query.trim()}" como nueva categoría</Text>
                </>
              )}
            </Pressable>
          )}
          {filtered.length === 0 && query.trim().length === 0 && (
            <Text style={styles.emptyText}>Escribe para buscar…</Text>
          )}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  dropdown: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxHeight: 220,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
  },
  pendingTag: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
  suggestOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    flexShrink: 1,
  },
  emptyText: {
    padding: 14,
    fontSize: 13,
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
});
