import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { LocationMapPreview, type MapMarker } from '@/components/moments/LocationMapPreview';
import { FullScreenLocationMapModal } from '@/components/profile/FullScreenLocationMapModal';
import { Avatar } from '@/components/ui/primitives';
import { usePartnerLocationRealtime, useSharedLocationMap } from '@/hooks/useSharedLocationMap';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { useAuthStore, useRelationshipStore } from '@/stores';

const ME_COLOR = '#e85d75';
const PARTNER_COLOR = '#5b8def';

const PREVIEW_COORDS = {
  me: { latitude: 40.758, longitude: -73.9855, label: 'Midtown' },
  partner: { latitude: 40.7484, longitude: -73.9857, label: 'Chelsea' },
};

function LocationLegendRow({
  displayName,
  profileName,
  place,
  tint,
  imageUrl,
}: {
  displayName: string;
  profileName?: string | null;
  place?: string;
  tint: string;
  imageUrl?: string | null;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.locationRow}>
      <View style={[styles.avatarRing, { borderColor: tint }]}>
        <Avatar
          name={profileName ?? displayName}
          imageUrl={imageUrl}
          size={34}
          colorsOverride={['#ffffff', '#ffffff']}
          initialColor={tint}
        />
      </View>
      <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
        {displayName}
        {place ? <Text style={{ color: colors.textSecondary }}>{` · ${place}`}</Text> : null}
      </Text>
    </View>
  );
}

/** Home location block shown below mood when location sharing is active. */
export function HomeLocationSnapshot() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);
  const { markers, myPlace, partnerOnMap } = useSharedLocationMap();
  const [showMap, setShowMap] = useState(false);

  usePartnerLocationRealtime();

  // Reciprocal: home map only when you are sharing (partner pin requires both).
  const locationActive = Boolean(user?.location_sharing_enabled);

  const partnerName = getFirstName(partner?.name) ?? 'Partner';

  const previewMarkers = useMemo((): MapMarker[] => {
    return [
      {
        latitude: PREVIEW_COORDS.me.latitude,
        longitude: PREVIEW_COORDS.me.longitude,
        label: 'Me',
        name: user?.name,
        color: ME_COLOR,
        avatarUrl: user?.avatar_url,
      },
      {
        latitude: PREVIEW_COORDS.partner.latitude,
        longitude: PREVIEW_COORDS.partner.longitude,
        label: partnerName,
        name: partner?.name,
        color: PARTNER_COLOR,
        avatarUrl: partner?.avatar_url,
      },
    ];
  }, [partner?.avatar_url, partner?.name, partnerName, user?.avatar_url, user?.name]);

  const isPreview = markers.length === 0;
  const displayMarkers = isPreview ? previewMarkers : markers;

  if (!locationActive && !__DEV__) return null;

  return (
    <>
      <View style={styles.wrap}>
        {locationActive && isPreview ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowMap(true)} accessibilityRole="button" accessibilityLabel="Open location map">
              <LocationMapPreview markers={displayMarkers} height={160} interactive />
            </Pressable>
            <View style={styles.legend}>
              {isPreview ? (
                <>
                  <LocationLegendRow
                    displayName="Me"
                    profileName={user?.name}
                    place={PREVIEW_COORDS.me.label}
                    tint={ME_COLOR}
                    imageUrl={user?.avatar_url}
                  />
                  <LocationLegendRow
                    displayName={partnerName}
                    profileName={partner?.name}
                    place={PREVIEW_COORDS.partner.label}
                    tint={PARTNER_COLOR}
                    imageUrl={partner?.avatar_url}
                  />
                </>
              ) : (
                <>
                  {myPlace && (
                    <LocationLegendRow
                      displayName="Me"
                      profileName={user?.name}
                      place={myPlace.label || undefined}
                      tint={ME_COLOR}
                      imageUrl={user?.avatar_url}
                    />
                  )}
                  {partnerOnMap && (
                    <LocationLegendRow
                      displayName={partner?.name?.trim() || 'Partner'}
                      profileName={partner?.name}
                      place={partner?.location_label || undefined}
                      tint={PARTNER_COLOR}
                      imageUrl={partner?.avatar_url}
                    />
                  )}
                </>
              )}
            </View>
          </>
        )}
      </View>

      <FullScreenLocationMapModal
        visible={showMap}
        markers={displayMarkers}
        title={relationship?.relationship_name ?? 'Locations'}
        onClose={() => setShowMap(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  legend: { gap: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRing: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 2,
  },
  locationText: { flex: 1, fontSize: 14, fontWeight: '600' },
  loadingBox: {
    height: 160,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
