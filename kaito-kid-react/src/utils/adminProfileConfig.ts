import type { User } from '../types';

export type AdminGender = 'male' | 'female' | 'other';

export interface AdminBasicProfile {
  fullName: string;
  displayName: string;
  email: string;
  phone: string;
  birthday: string;
  gender: AdminGender;
  avatar?: string;
}

export interface AdminWorkProfile {
  position: string;
  department: string;
  jobDescription: string;
  joinedAt: string;
}

export interface AdminProfileRecord {
  basic: AdminBasicProfile;
  work: AdminWorkProfile;
  updatedAt?: string;
}

const PROFILE_STORAGE_KEY = 'adminProfile';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function parseStorageValue<T>(storageKey: string, fallback: T): T {
  try {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function getDefaultBasicProfile(currentUser?: Partial<User>, adminCredentials?: { email?: string }): AdminBasicProfile {
  const fallbackName = asString(currentUser?.name, 'Administrator');
  return {
    fullName: fallbackName,
    displayName: fallbackName,
    email: asString(currentUser?.email, asString(adminCredentials?.email, 'admin@kaitokid.com')),
    phone: asString(currentUser?.phone),
    birthday: '1990-01-01',
    gender: 'male',
    avatar: currentUser?.avatar,
  };
}

function getDefaultWorkProfile(currentUser?: Partial<User>): AdminWorkProfile {
  return {
    position: 'Administrator',
    department: 'Quan tri',
    jobDescription: 'Quan ly toan bo hoat động cua website ban hang KAITO KID.',
    joinedAt: asString(currentUser?.createdAt, '2024-01-01T00:00:00.000Z'),
  };
}

function normalizeBasicProfile(
  rawBasic: Partial<AdminBasicProfile> | null | undefined,
  currentUser?: Partial<User>,
  adminCredentials?: { email?: string },
): AdminBasicProfile {
  const defaults = getDefaultBasicProfile(currentUser, adminCredentials);

  return {
    fullName: asString(rawBasic?.fullName, defaults.fullName),
    displayName: asString(rawBasic?.displayName, asString(rawBasic?.fullName, defaults.displayName)),
    email: asString(rawBasic?.email, defaults.email),
    phone: asString(rawBasic?.phone, defaults.phone),
    birthday: asString(rawBasic?.birthday, defaults.birthday),
    gender:
      rawBasic?.gender === 'female' || rawBasic?.gender === 'other' || rawBasic?.gender === 'male'
        ? rawBasic.gender
        : defaults.gender,
    avatar: asString(rawBasic?.avatar, defaults.avatar || '') || undefined,
  };
}

function normalizeWorkProfile(
  rawWork: Partial<AdminWorkProfile> | null | undefined,
  currentUser?: Partial<User>,
): AdminWorkProfile {
  const defaults = getDefaultWorkProfile(currentUser);

  return {
    position: asString(rawWork?.position, defaults.position),
    department: asString(rawWork?.department, defaults.department),
    jobDescription: asString(rawWork?.jobDescription, defaults.jobDescription),
    joinedAt: asString(rawWork?.joinedAt, defaults.joinedAt),
  };
}

export function readAdminProfile(): AdminProfileRecord {
  const storedProfile = parseStorageValue<Partial<AdminProfileRecord>>(PROFILE_STORAGE_KEY, {});
  const legacyBasic = parseStorageValue<Partial<AdminBasicProfile>>('adminBasicInfo', {});
  const legacyWork = parseStorageValue<Partial<AdminWorkProfile>>('adminWorkInfo', {});
  const currentUser = parseStorageValue<Partial<User>>('currentUser', {});
  const adminCredentials = parseStorageValue<{ email?: string }>('adminCredentials', {});

  const basicSource = {
    ...legacyBasic,
    ...(storedProfile.basic || {}),
  };

  const workSource = {
    ...legacyWork,
    ...(storedProfile.work || {}),
  };

  return {
    basic: normalizeBasicProfile(basicSource, currentUser, adminCredentials),
    work: normalizeWorkProfile(workSource, currentUser),
    updatedAt: asString(storedProfile.updatedAt) || undefined,
  };
}

export function saveAdminProfile(profile: AdminProfileRecord): AdminProfileRecord {
  const normalized = {
    basic: normalizeBasicProfile(profile.basic),
    work: normalizeWorkProfile(profile.work),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem('adminBasicInfo', JSON.stringify(normalized.basic));
  localStorage.setItem('adminWorkInfo', JSON.stringify(normalized.work));
  return normalized;
}

export function syncAdminProfileToSession(profile: AdminProfileRecord): void {
  const adminCredentials = parseStorageValue<{ username?: string; email?: string; password?: string }>(
    'adminCredentials',
    {},
  );

  localStorage.setItem(
    'adminCredentials',
    JSON.stringify({
      ...adminCredentials,
      email: profile.basic.email || adminCredentials.email,
    }),
  );

  const currentUser = parseStorageValue<User | null>('currentUser', null);

  if (currentUser?.role === 'admin') {
    const nextUser: User = {
      ...currentUser,
      name: profile.basic.displayName || profile.basic.fullName,
      email: profile.basic.email,
      phone: profile.basic.phone,
      avatar: profile.basic.avatar,
    };

    localStorage.setItem('currentUser', JSON.stringify(nextUser));
    localStorage.setItem('username', nextUser.name || nextUser.email);
    localStorage.setItem('userEmail', nextUser.email);

    if (nextUser.phone) {
      localStorage.setItem('userPhone', nextUser.phone);
    }
  }
}

export function getAdminDisplayName(profile?: AdminProfileRecord): string {
  const resolvedProfile = profile || readAdminProfile();
  return resolvedProfile.basic.displayName || resolvedProfile.basic.fullName || 'Administrator';
}
