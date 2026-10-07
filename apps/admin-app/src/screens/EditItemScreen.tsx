import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import type { CategoryDTO, ProductDTO } from '@store/shared';
import { PhotoManager } from '../components/PhotoManager';
import { Button, Chip, Field, Section } from '../components/ui';
import { api, ApiError, refreshStorefront } from '../lib/api';
import { confirm, notify } from '../lib/dialog';
import { formatPrice } from '../lib/format';
import type { RootScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { colors, ui, useLayout } from '../theme';

interface Draft {
  title: string;
  description: string;
  category: string;
  price: string;
  compareAtPrice: string;
  images: string[];
  isActive: boolean;
  stockQuantity: string; // new items only
}

const toDraft = (p?: ProductDTO): Draft => ({
  title: p?.title ?? '',
  description: p?.description ?? '',
  category: p?.category ?? '',
  price: p ? String(p.price) : '',
  compareAtPrice: p?.compareAtPrice != null ? String(p.compareAtPrice) : '',
  images: p?.images ?? [],
  isActive: p?.isActive ?? true,
  stockQuantity: '50',
});

const money = (v: string) => (v.trim() === '' ? null : Math.round(Number(v.replace(',', '.')) * 100) / 100);

export function EditItemScreen({ route, navigation }: RootScreenProps<'EditItem'>) {
  const id = route.params.id;
  const isNew = !id;
  const token = useAuth((s) => s.token);
  const { pad, wide } = useLayout();

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [initial, setInitial] = useState<Draft>(toDraft());
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [stockInput, setStockInput] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<CategoryDTO[]>('/categories?includeInactive=true', { token }).then(setCategories).catch(() => undefined);
    if (!id) return;
    api<ProductDTO>(`/products/${id}`, { token })
      .then((p) => {
        setProduct(p);
        setDraft(toDraft(p));
        setInitial(toDraft(p));
        setStockInput(String(p.stockQuantity));
      })
      .catch((e) => notify('Could not load item', e instanceof ApiError ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id, token]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || (newCategory ?? '') !== '';

  // Ask before leaving with unsaved changes.
  const allowLeave = useRef(false);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || allowLeave.current) return;
        e.preventDefault();
        void confirm('Discard changes?', 'You have unsaved changes to this item.', 'Discard', true).then(
          (ok) => ok && navigation.dispatch(e.data.action),
        );
      }),
    [navigation, dirty],
  );

  const price = money(draft.price);
  const compareAt = money(draft.compareAtPrice);
  const offerError = compareAt != null && price != null && compareAt <= price ? 'Must be higher than the price' : undefined;
  const category = (newCategory ?? draft.category).trim().toLowerCase();
  const off = price && compareAt && !offerError ? Math.round((1 - price / compareAt) * 100) : 0;

  async function save() {
    if (!draft.title.trim()) return notify('Add a name for this item');
    if (!category) return notify('Choose a category');
    if (price == null || Number.isNaN(price)) return notify('Enter a price');
    if (offerError) return notify('Original price', offerError);
    setSaving(true);
    try {
      const saved = await api<ProductDTO>(isNew ? '/products' : `/products/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        token,
        body: {
          title: draft.title.trim(),
          description: draft.description.trim(),
          category,
          price,
          compareAtPrice: compareAt,
          images: draft.images,
          isActive: draft.isActive,
          ...(isNew && { stockQuantity: Math.max(0, Math.floor(Number(draft.stockQuantity) || 0)) }),
        },
      });
      refreshStorefront(token);
      allowLeave.current = true;
      if (isNew) {
        navigation.replace('EditItem', { id: saved.id });
      } else {
        setProduct(saved);
        setDraft(toDraft(saved));
        setInitial(toDraft(saved));
        setNewCategory(null);
        allowLeave.current = false;
        notify('Saved', `${saved.title} is updated.`);
      }
    } catch (e) {
      notify('Could not save', e instanceof ApiError ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function applyStock() {
    const value = Math.floor(Number(stockInput));
    if (!product || Number.isNaN(value) || value < 0) return;
    try {
      const updated = await api<ProductDTO>(`/products/${product.id}/stock`, { method: 'PATCH', body: { set: value }, token });
      setProduct(updated);
      setStockInput(String(updated.stockQuantity));
      refreshStorefront(token);
    } catch (e) {
      notify('Could not update stock', e instanceof ApiError ? e.message : undefined);
    }
  }

  useEffect(() => {
    navigation.setOptions({
      title: isNew ? 'New menu item' : draft.title || 'Menu item',
      headerRight: () => (
        <Button title={isNew ? 'Create' : 'Save'} size="sm" style={{ marginRight: pad }} loading={saving} disabled={!dirty && !isNew} onPress={save} />
      ),
    });
  });

  const categoryNames = useMemo(() => {
    const names = categories.map((c) => c.name);
    return draft.category && !names.includes(draft.category) ? [...names, draft.category] : names;
  }, [categories, draft.category]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;

  const left = (
    <>
      <Section title="Photos" subtitle="Shown on the menu and product page.">
        <PhotoManager value={draft.images} onChange={(v) => set('images', v)} size={wide ? 160 : 130} />
      </Section>
      <Section title="Details">
        <Field label="Name">
          <TextInput style={ui.input} value={draft.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Classic Cheeseburger" maxLength={200} />
        </Field>
        <Field label="Description" hint="Ingredients, allergens, what makes it special.">
          <TextInput
            style={[ui.input, { minHeight: 96, textAlignVertical: 'top' }]}
            value={draft.description}
            onChangeText={(v) => set('description', v)}
            multiline
            maxLength={5000}
          />
        </Field>
        <Field label="Category">
          <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
            {categoryNames.map((c) => (
              <Chip
                key={c}
                label={c.charAt(0).toUpperCase() + c.slice(1)}
                active={newCategory === null && draft.category === c}
                onPress={() => {
                  setNewCategory(null);
                  set('category', c);
                }}
              />
            ))}
            <Chip label="+ New" active={newCategory !== null} onPress={() => setNewCategory('')} />
          </View>
          {newCategory !== null && (
            <TextInput
              style={[ui.input, { marginTop: 10 }]}
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder="New category name, e.g. Wraps"
              autoFocus
            />
          )}
        </Field>
      </Section>
    </>
  );

  const right = (
    <>
      <Section title="Pricing">
        <Field label="Price ($)">
          <TextInput style={ui.input} value={draft.price} onChangeText={(v) => set('price', v)} keyboardType="decimal-pad" placeholder="0.00" />
        </Field>
        <Field label="Original price ($) — optional" hint="Fill in to show this item as a special offer." error={offerError}>
          <TextInput
            style={ui.input}
            value={draft.compareAtPrice}
            onChangeText={(v) => set('compareAtPrice', v)}
            keyboardType="decimal-pad"
            placeholder="Not on offer"
          />
        </Field>
        {price != null && !Number.isNaN(price) && (
          <View style={{ backgroundColor: colors.brandSoft, borderRadius: 12, padding: 12, gap: 4 }}>
            <Text style={[ui.muted, { fontWeight: '700', letterSpacing: 0.5 }]}>CUSTOMERS SEE</Text>
            <View style={[ui.row, { gap: 8 }]}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: off ? colors.brandDark : colors.text }}>{formatPrice(price)}</Text>
              {off > 0 && compareAt && <Text style={[ui.muted, { textDecorationLine: 'line-through', fontSize: 15 }]}>{formatPrice(compareAt)}</Text>}
              {off > 0 && (
                <View style={{ backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>−{off}%</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </Section>

      <Section title="Stock">
        {isNew ? (
          <Field label="Starting stock">
            <TextInput style={ui.input} value={draft.stockQuantity} onChangeText={(v) => set('stockQuantity', v)} keyboardType="number-pad" />
          </Field>
        ) : (
          <>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.muted}>In stock now</Text>
              <Text style={{ fontSize: 26, fontWeight: '800' }}>{product?.stockQuantity}</Text>
            </View>
            <View style={[ui.row, { gap: 8 }]}>
              <TextInput style={[ui.input, { flex: 1 }]} value={stockInput} onChangeText={setStockInput} keyboardType="number-pad" />
              <Button title="Set stock" variant="secondary" disabled={stockInput === String(product?.stockQuantity)} onPress={applyStock} />
            </View>
            <Text style={ui.muted}>Updates immediately. {product?.soldCount ?? 0} sold so far.</Text>
          </>
        )}
      </Section>

      <Section
        title="Visible on the menu"
        subtitle={draft.isActive ? 'Customers can see and order this item.' : 'Hidden from customers.'}
        right={<Switch value={draft.isActive} onValueChange={(v) => set('isActive', v)} trackColor={{ true: colors.success, false: '#d6d3d1' }} />}
      />
    </>
  );

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: pad, gap: 14 }} keyboardShouldPersistTaps="handled">
        {wide ? (
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
            <View style={{ flex: 1.4, gap: 14 }}>{left}</View>
            <View style={{ flex: 1, gap: 14 }}>{right}</View>
          </View>
        ) : (
          <>
            {left}
            {right}
          </>
        )}
        <Button title={isNew ? 'Create item' : 'Save changes'} size="lg" loading={saving} disabled={!dirty && !isNew} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
