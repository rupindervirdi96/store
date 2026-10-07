import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { uploadImage } from '../lib/api';
import { choose, notify } from '../lib/dialog';
import { useAuth } from '../store/auth';
import { colors, ui } from '../theme';

interface Pending {
  key: string;
  uri: string;
}

/**
 * Photos for a menu item (or a single category photo). New photos come from
 * the camera or gallery and upload immediately; the parent saves the URLs.
 */
export function PhotoManager({
  value,
  onChange,
  max = 8,
  size = 140,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  size?: number;
}) {
  const token = useAuth((s) => s.token);
  const [pending, setPending] = useState<Pending[]>([]);
  const latest = useRef(value);
  latest.current = value;
  const single = max === 1;
  const room = single ? 1 : max - value.length - pending.length;

  async function pick() {
    const source =
      Platform.OS === 'web'
        ? 'library'
        : await choose('Add photo', [
            { label: 'Take photo', value: 'camera' },
            { label: 'Choose from library', value: 'library' },
          ]);
    if (!source) return;

    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return notify('Camera access needed', 'Allow camera access in Settings to take photos.');
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsMultipleSelection: !single,
        selectionLimit: Math.max(1, room),
      });
    }
    if (result.canceled) return;

    const assets = result.assets.slice(0, Math.max(1, room));
    const items = assets.map((a) => ({ asset: a, key: `${a.uri}-${Math.random()}` }));
    setPending((p) => [...p, ...items.map(({ key, asset }) => ({ key, uri: asset.uri }))]);

    await Promise.all(
      items.map(async ({ asset, key }) => {
        try {
          const { url } = await uploadImage(asset, token);
          latest.current = single ? [url] : [...latest.current, url];
          onChange(latest.current);
        } catch (err) {
          notify('Upload failed', err instanceof Error ? err.message : undefined);
        } finally {
          setPending((p) => p.filter((x) => x.key !== key));
        }
      }),
    );
  }

  const move = (from: number, to: number) => {
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const tile = { width: size, height: Math.round(size * 0.75) };

  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {value.map((url, i) => (
          <View key={url} style={{ gap: 6 }}>
            <View style={[styles.tile, tile]}>
              <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              {i === 0 && !single && (
                <View style={styles.cover}>
                  <Text style={styles.coverText}>Cover</Text>
                </View>
              )}
            </View>
            <View style={[ui.row, { gap: 4, flexWrap: 'wrap', width: tile.width }]}>
              {!single && i > 0 && <SmallAction label="Cover" onPress={() => move(i, 0)} />}
              {!single && i > 0 && <SmallAction label="←" onPress={() => move(i, i - 1)} />}
              {!single && i < value.length - 1 && <SmallAction label="→" onPress={() => move(i, i + 1)} />}
              <SmallAction label="Remove" danger onPress={() => onChange(value.filter((_, j) => j !== i))} />
            </View>
          </View>
        ))}
        {pending.map((p) => (
          <View key={p.key} style={[styles.tile, tile]}>
            <Image source={{ uri: p.uri }} style={[StyleSheet.absoluteFill, { opacity: 0.4 }]} />
            <ActivityIndicator color={colors.brand} />
            <Text style={[ui.muted, { marginTop: 4 }]}>Uploading…</Text>
          </View>
        ))}
        {(single ? value.length === 0 && pending.length === 0 : room > 0) && (
          <Pressable onPress={pick} style={[styles.tile, styles.add, tile]} accessibilityLabel="Add photo">
            <Text style={{ fontSize: 28, color: colors.muted }}>＋</Text>
            <Text style={[ui.muted, { fontWeight: '600' }]}>{Platform.OS === 'web' ? 'Add photo' : 'Camera or gallery'}</Text>
          </Pressable>
        )}
      </ScrollView>
      {single && value.length > 0 && (
        <Pressable onPress={pick}>
          <Text style={{ color: colors.brandDark, fontWeight: '700' }}>Replace photo</Text>
        </Pressable>
      )}
      <Text style={ui.muted}>{single ? 'Photos are resized automatically.' : `${value.length}/${max} · first photo is the cover · resized automatically`}</Text>
    </View>
  );
}

function SmallAction({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.small, danger && { borderColor: '#fecdd3' }]}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: danger ? colors.danger : colors.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e7e5e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#d6d3d1', backgroundColor: '#fff', gap: 4 },
  cover: { position: 'absolute', left: 6, top: 6, backgroundColor: 'rgba(28,25,23,0.8)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  coverText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  small: { borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#fff' },
});
