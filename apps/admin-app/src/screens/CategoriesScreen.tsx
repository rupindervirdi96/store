import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import type { CategoryDTO } from '@store/shared';
import { PhotoManager } from '../components/PhotoManager';
import { Badge, Button, EmptyState, Section } from '../components/ui';
import { api, ApiError, refreshStorefront } from '../lib/api';
import { confirm, notify } from '../lib/dialog';
import { useAuth } from '../store/auth';
import { colors, ui, useLayout } from '../theme';

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function CategoriesScreen() {
  const token = useAuth((s) => s.token);
  const { pad, wide } = useLayout();
  const [categories, setCategories] = useState<CategoryDTO[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setCategories(await api<CategoryDTO[]>('/categories?includeInactive=true', { token }));
  }, [token]);
  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await fn();
      await load();
      refreshStorefront(token);
      return true;
    } catch (e) {
      notify('Something went wrong', e instanceof ApiError ? e.message : undefined);
      return false;
    }
  }

  const patch = (c: CategoryDTO, body: Partial<Pick<CategoryDTO, 'name' | 'image' | 'isActive'>>) =>
    run(() => api(`/categories/${c.id}`, { method: 'PATCH', body, token }));

  const move = (i: number, dir: -1 | 1) => {
    if (!categories) return;
    const ids = categories.map((c) => c.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    void run(() => api('/categories/order', { method: 'PUT', body: { ids }, token }));
  };

  const remove = async (c: CategoryDTO) => {
    if (await confirm(`Delete "${title(c.name)}"?`, 'This category will be removed from the menu.', 'Delete', true)) {
      void run(() => api(`/categories/${c.id}`, { method: 'DELETE', token }));
    }
  };

  if (!categories) return <EmptyState title="Loading categories…" />;

  const list = (
    <View style={[ui.card, { padding: 0, overflow: 'hidden' }]}>
      {categories.length === 0 && <EmptyState title="No categories yet" body="Add your first one." />}
      {categories.map((c, i) =>
        editing === c.id ? (
          <EditRow
            key={c.id}
            category={c}
            onCancel={() => setEditing(null)}
            onSave={async (body) => {
              if (await patch(c, body)) setEditing(null);
            }}
          />
        ) : (
          <View key={c.id} style={{ padding: 14, gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <View style={[ui.row, { gap: 12 }]}>
              <View style={{ gap: 2 }}>
                <ArrowButton label="▲" disabled={i === 0} onPress={() => move(i, -1)} />
                <ArrowButton label="▼" disabled={i === categories.length - 1} onPress={() => move(i, 1)} />
              </View>
              <View style={{ width: 72, height: 54, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e7e5e4' }}>
                {c.image && <Image source={{ uri: c.image }} style={{ width: '100%', height: '100%', opacity: c.isActive ? 1 : 0.4 }} />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={ui.h3}>{title(c.name)}</Text>
                <View style={[ui.row, { gap: 6, flexWrap: 'wrap' }]}>
                  <Text style={ui.muted}>
                    {c.productCount} item{c.productCount === 1 ? '' : 's'}
                  </Text>
                  {!c.isActive && <Badge label="Hidden" />}
                  {!c.image && <Badge label="No photo" tone="amber" />}
                </View>
              </View>
              <Switch value={c.isActive} onValueChange={(v) => void patch(c, { isActive: v })} trackColor={{ true: colors.success, false: '#d6d3d1' }} />
            </View>
            <View style={[ui.row, { gap: 8, justifyContent: 'flex-end' }]}>
              <Button title="Edit" size="sm" variant="secondary" onPress={() => setEditing(c.id)} />
              <Button title="Delete" size="sm" variant="danger" disabled={c.productCount > 0} onPress={() => remove(c)} />
            </View>
          </View>
        ),
      )}
    </View>
  );

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ padding: pad, gap: 14 }}>
      <Text style={ui.muted}>The order here is the order on the website; photos are used for the home page tiles. Categories with items can't be deleted.</Text>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.6 }}>{list}</View>
          <View style={{ flex: 1 }}>
            <NewCategory onCreate={(body) => run(() => api('/categories', { method: 'POST', body, token }))} />
          </View>
        </View>
      ) : (
        <>
          {list}
          <NewCategory onCreate={(body) => run(() => api('/categories', { method: 'POST', body, token }))} />
        </>
      )}
    </ScrollView>
  );
}

function ArrowButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={{ paddingHorizontal: 6, opacity: disabled ? 0.2 : 1 }} accessibilityLabel={label === '▲' ? 'Move up' : 'Move down'}>
      <Text style={{ color: colors.muted, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function EditRow({ category, onCancel, onSave }: { category: CategoryDTO; onCancel: () => void; onSave: (body: { name: string; image: string | null }) => void }) {
  const [name, setName] = useState(category.name);
  const [images, setImages] = useState(category.image ? [category.image] : []);
  return (
    <View style={{ padding: 14, gap: 12, backgroundColor: colors.brandSoft }}>
      <PhotoManager value={images} onChange={setImages} max={1} size={150} />
      <TextInput style={ui.input} value={name} onChangeText={setName} placeholder="Category name" />
      <Text style={ui.muted}>Renaming moves all of its items along automatically.</Text>
      <View style={[ui.row, { gap: 8 }]}>
        <Button title="Save" onPress={() => onSave({ name, image: images[0] ?? null })} disabled={!name.trim()} />
        <Button title="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

function NewCategory({ onCreate }: { onCreate: (body: { name: string; image: string | null }) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Add a category" subtitle="It appears on the website once it has a visible item.">
      <TextInput style={ui.input} value={name} onChangeText={setName} placeholder="e.g. Wraps" />
      <PhotoManager value={images} onChange={setImages} max={1} size={150} />
      <Button
        title="Add category"
        loading={busy}
        disabled={!name.trim()}
        onPress={async () => {
          setBusy(true);
          if (await onCreate({ name, image: images[0] ?? null })) {
            setName('');
            setImages([]);
          }
          setBusy(false);
        }}
      />
    </Section>
  );
}
