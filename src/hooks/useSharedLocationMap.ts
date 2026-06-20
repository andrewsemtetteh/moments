import { useEffect, useMemo } from 'react';

import type { MapMarker } from '@/components/moments/LocationMapPreview';
import { hasValidCoords } from '@/lib/location';
import { fetchPartnerProfileRow, subscribePartnerLocation } from '@/lib/partner-location';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { UserProfile } from '@/types/database';

const YOU_COLOR = '#e85d75';
const PARTNER_COLOR = '#5b8def';

export function buildSharedLocationMarkers(
  user?: UserProfile | null,
  partner?: UserProfile | null,
): MapMarker[] {
  const pins: MapMarker[] = [];

  if (
    user?.location_sharing_enabled &&
    hasValidCoords(user.location_latitude, user.location_longitude)
  ) {
    pins.push({
      latitude: user.location_latitude!,
      longitude: user.location_longitude!,
      label: user.name?.trim() || 'You',
      color: YOU_COLOR,
      avatarUrl: user.avatar_url,
    });
  }

  if (
    partner?.location_sharing_enabled &&
    hasValidCoords(partner.location_latitude, partner.location_longitude)
  ) {
    pins.push({
      latitude: partner.location_latitude!,
      longitude: partner.location_longitude!,
      label: partner.name?.trim() || 'Partner',
      color: PARTNER_COLOR,
      avatarUrl: partner.avatar_url,
    });
  }

  return pins;
}

export function useSharedLocationMap() {
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);

  const markers = useMemo(
    () => buildSharedLocationMarkers(user, partner),
    [user, partner],
  );

  const myPlace =
    user?.location_sharing_enabled &&
    hasValidCoords(user.location_latitude, user.location_longitude)
      ? {
          latitude: user.location_latitude!,
          longitude: user.location_longitude!,
          label: user.location_label ?? '',
        }
      : null;

  const partnerSharing = partner?.location_sharing_enabled ?? false;
  const partnerOnMap = Boolean(
    partner &&
      partner.location_sharing_enabled &&
      hasValidCoords(partner.location_latitude, partner.location_longitude),
  );

  return { markers, myPlace, partnerSharing, partnerOnMap, partner };
}

export function usePartnerLocationRealtime() {
  const partnerId = useRelationshipStore((s) => s.partner?.id);
  const setPartner = useRelationshipStore((s) => s.setPartner);

  useEffect(() => {
    if (!partnerId) return;

    let cancelled = false;

    const applyPartner = async () => {
      const profile = await fetchPartnerProfileRow(partnerId);
      if (!cancelled && profile) setPartner(profile);
    };

    void applyPartner();

    const unsubscribe = subscribePartnerLocation(partnerId, () => {
      void applyPartner();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [partnerId, setPartner]);
}
