import { UserAccount } from './types';
import { DbController } from './db';

export interface SubscriptionStatus {
  isLocked: boolean;
  isTrial: boolean;
  registeredOnDate: Date;
  lastActivatedOnDate: Date | null;
  expiryDate: Date;
  remainingDays: number;
  remainingHours: number;
  remainingMinutes: number;
  remainingSeconds: number;
  countdownString: string;
  message: string;
  requestCode: string;
  licenseType: 'trial' | 'unlicensed' | 'activated' | 'unlimited';
  licensePeriod?: number;
  isInheritedFromHeadteacher?: boolean;
  headteacherName?: string;
}

/**
 * Deterministically generates a secure activation/renewal passcode based on
 * the user's email or login user ID, their unique request code, and an offline salt.
 * Ensures the admin (pegyirenyi@gmail.com) can generate keys offline
 * and the user's client can securely verify them without requiring database lookups.
 */
export function generateActivationCode(identifier: string, requestCode: string, uid?: string): string {
  const cleanId = (identifier || uid || '').toLowerCase().trim();
  const cleanRequest = requestCode.toUpperCase().trim();
  
  let hash = 0;
  const combined = `${cleanId}:${cleanRequest}:GEETECH-SALT-2026`;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const absHash = Math.abs(hash);
  const numPart = (absHash % 900000) + 100000; // Force exactly 6 digits
  const charPart = cleanId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase().split('').reverse().join('').padEnd(3, 'X');
  return `SEC-${charPart}-${numPart}`;
}

export function generateActivationCodeForUid(uid: string, requestCode: string): string {
  return generateActivationCode(uid, requestCode);
}

/**
 * Creates or retrieves a standard format random Request Code.
 * Useful so that multiple requests are unique.
 */
export function getOrCreateRequestCode(user: UserAccount): string {
  if (user.requestCode) return user.requestCode;
  // Generate random digits
  const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4 digits
  const emailPrefix = user.email ? user.email.split('@')[0].substring(0, 4).toUpperCase() : 'USER';
  return `REQ-${emailPrefix}-${randomDigits}`;
}

/**
 * Evaluates the subscription status for any user account.
 * Peggy is free and exempt forever as Master Admin.
 * Everyone is allowed access with limited periods for 7 days Trial.
 * Countdown is based on Firestore countdown timestamp.
 */
export function evaluateSubscription(user: UserAccount | null): SubscriptionStatus | null {
  if (!user) return null;
  
  const email = user.email ? user.email.toLowerCase().trim() : '';
  
  // Rule: pegyirenyi@gmail.com is exempt from subscription limits
  if (email === 'pegyirenyi@gmail.com') {
    return {
      isLocked: false,
      isTrial: false,
      registeredOnDate: new Date(user.createdAt || Date.now()),
      lastActivatedOnDate: new Date(user.lastActivatedOn || user.createdAt || Date.now()),
      expiryDate: new Date('2036-12-31T23:59:59Z'), // Long future date
      remainingDays: 3650,
      remainingHours: 87600,
      remainingMinutes: 5256000,
      remainingSeconds: 315360000,
      countdownString: 'Lifetime Access',
      message: 'System Master Admin Access Granted.',
      requestCode: 'SYSTEM-BYPASS',
      licenseType: 'unlimited',
      licensePeriod: 99,
      isInheritedFromHeadteacher: false
    };
  }

  // Resolve authoritative Headteacher / School Admin subscription for Teachers (always inherits Headteacher period to avoid contradiction)
  let evalUser: UserAccount = user;
  let isInheritedFromHeadteacher = false;
  let headteacherName = '';

  const allUsers = (() => {
    try { return DbController.getRegisteredUsers(); } catch { return []; }
  })();
  const allTimers = (() => {
    try { return DbController.getAllSubscriberTimers(); } catch { return []; }
  })();
  const schoolInfo = (() => {
    try { return DbController.getSchoolInfo(); } catch { return null; }
  })();

  if (user.role === 'Teacher') {
    try {
      const schoolId = (user.schoolId || user.schoolCode || schoolInfo?.schoolId || '').trim();
      const ownerId = (user.ownerId || schoolInfo?.ownerId || schoolInfo?.userId || '').trim();
      const headEmailFromSchool = (schoolInfo?.email || '').toLowerCase().trim();

      // 1. Find registered Headteacher/Admin matching this school or ownerId (excluding Master Admin unless explicitly owner)
      const schoolHeadteachers = allUsers.filter(u =>
        (u.role === 'Headteacher' || u.role === 'Admin') &&
        u.email?.toLowerCase().trim() !== 'pegyirenyi@gmail.com' &&
        (
          (ownerId && (u.uid === ownerId || u.ownerId === ownerId)) ||
          (schoolId && schoolId !== 'school_default' && (u.schoolId === schoolId || u.schoolCode === schoolId)) ||
          (headEmailFromSchool && u.email?.toLowerCase().trim() === headEmailFromSchool)
        )
      );

      // Prefer exact ownerId match, or active/activated account, or newest updated record
      let headteacher = schoolHeadteachers.find(u => ownerId && u.uid === ownerId)
        || schoolHeadteachers.find(u => u.licenseType === 'activated' || u.licenseType === 'unlimited')
        || schoolHeadteachers[0];

      // 2. Also inspect subscriberTimers for Headteacher/Admin of the same school/owner to pick up newest Firestore timer updates
      const matchingTimers = allTimers.filter(t =>
        (t.role === 'Headteacher' || t.role === 'Admin') &&
        t.userEmail?.toLowerCase().trim() !== 'pegyirenyi@gmail.com' &&
        (
          (ownerId && (t.userId === ownerId || t.ownerId === ownerId)) ||
          (headteacher && (t.userId === headteacher.uid || t.id === headteacher.uid)) ||
          (schoolId && schoolId !== 'school_default' && (t.schoolId === schoolId || t.schoolCode === schoolId))
        )
      );
      const headTimer = matchingTimers.sort((a, b) => {
        const aScore = (a.licenseType === 'activated' || a.licenseType === 'unlimited') ? 1 : 0;
        const bScore = (b.licenseType === 'activated' || b.licenseType === 'unlimited') ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      })[0];

      // 3. Reconcile headteacher user and headTimer (prefer whichever has newer activation/update or active license)
      if (headteacher && headTimer) {
        const headUpdated = new Date((headteacher as any).updatedAt || headteacher.lastActivatedOn || headteacher.registeredOn || 0).getTime();
        const timerUpdated = new Date(headTimer.updatedAt || headTimer.lastActivatedOn || headTimer.registeredOn || 0).getTime();
        const timerIsNewer = timerUpdated > headUpdated;
        const timerHasActiveUpgrade = (headTimer.licenseType === 'activated' || headTimer.licenseType === 'unlimited') && headteacher.licenseType !== 'activated' && headteacher.licenseType !== 'unlimited';

        if (timerIsNewer || timerHasActiveUpgrade) {
          evalUser = {
            ...headteacher,
            licenseType: headTimer.licenseType || headteacher.licenseType,
            licensePeriod: headTimer.licensePeriod || headteacher.licensePeriod || 1,
            registeredOn: headTimer.registeredOn || headteacher.registeredOn,
            trialStartDate: headTimer.trialStartDate ?? headteacher.trialStartDate,
            trialEndDate: headTimer.trialEndDate ?? headteacher.trialEndDate,
            lastActivatedOn: headTimer.lastActivatedOn ?? headteacher.lastActivatedOn,
            isSuspended: headTimer.isSuspended ?? headteacher.isSuspended
          };
        } else {
          evalUser = headteacher;
        }
        isInheritedFromHeadteacher = true;
        headteacherName = headteacher.name || headTimer.userName || headteacher.email || 'School Headteacher';
      } else if (headteacher) {
        evalUser = headteacher;
        isInheritedFromHeadteacher = true;
        headteacherName = headteacher.name || headteacher.email || 'School Headteacher';
      } else if (headTimer) {
        evalUser = {
          ...user,
          uid: headTimer.userId || user.uid,
          licenseType: headTimer.licenseType || 'trial',
          licensePeriod: headTimer.licensePeriod || 1,
          registeredOn: headTimer.registeredOn,
          trialStartDate: headTimer.trialStartDate,
          trialEndDate: headTimer.trialEndDate,
          lastActivatedOn: headTimer.lastActivatedOn,
          isSuspended: headTimer.isSuspended
        };
        isInheritedFromHeadteacher = true;
        headteacherName = headTimer.userName || headTimer.userEmail || 'School Headteacher';
      } else if (!schoolId || schoolId === 'school_default') {
        // Fallback only when teacher has no specific schoolId
        const fallbackHead = allUsers.find(u =>
          (u.role === 'Headteacher' || u.role === 'Admin') &&
          u.email?.toLowerCase().trim() !== 'pegyirenyi@gmail.com'
        );
        if (fallbackHead) {
          evalUser = fallbackHead;
          isInheritedFromHeadteacher = true;
          headteacherName = fallbackHead.name || fallbackHead.email;
        }
      }
    } catch (e) {
      console.warn("Could not retrieve Headteacher subscription profile for teacher:", e);
    }
  } else {
    // Also reconcile non-teacher (Headteacher/Admin) against their newest timer record in case Firestore timer synced faster
    const ownTimer = allTimers.find(t => t.userId === user.uid || t.id === user.uid);
    if (ownTimer) {
      const userUpdated = new Date((user as any).updatedAt || user.lastActivatedOn || user.registeredOn || 0).getTime();
      const timerUpdated = new Date(ownTimer.updatedAt || ownTimer.lastActivatedOn || ownTimer.registeredOn || 0).getTime();
      const timerHasUpgrade = (ownTimer.licenseType === 'activated' || ownTimer.licenseType === 'unlimited') && user.licenseType !== 'activated' && user.licenseType !== 'unlimited';
      if (timerUpdated > userUpdated || timerHasUpgrade) {
        evalUser = {
          ...user,
          licenseType: ownTimer.licenseType || user.licenseType,
          licensePeriod: ownTimer.licensePeriod || user.licensePeriod || 1,
          registeredOn: ownTimer.registeredOn || user.registeredOn,
          trialStartDate: ownTimer.trialStartDate ?? user.trialStartDate,
          trialEndDate: ownTimer.trialEndDate ?? user.trialEndDate,
          lastActivatedOn: ownTimer.lastActivatedOn ?? user.lastActivatedOn,
          isSuspended: ownTimer.isSuspended ?? user.isSuspended
        };
      }
    }
  }

  const registeredOn = evalUser.registeredOn || evalUser.createdAt || new Date().toISOString();
  const lastActivatedOn = evalUser.lastActivatedOn || null;
  const requestCode = user.requestCode || getOrCreateRequestCode(user);
  
  const regDate = new Date(registeredOn);
  const lastActivatedDate = lastActivatedOn ? new Date(lastActivatedOn) : null;
  let expDate: Date;
  let isTrial = false;
  let licenseType: 'trial' | 'unlicensed' | 'activated' | 'unlimited' = 'trial';

  if (evalUser.licenseType === 'unlimited') {
    licenseType = 'unlimited';
    expDate = evalUser.isSuspended ? new Date('2026-01-01T00:00:00.000Z') : new Date('2036-12-31T23:59:59Z');
  } else if (evalUser.licenseType === 'activated') {
    licenseType = 'activated';
    // Licensed access expires based on the subscription period (number of years) from lastActivatedOn
    const activationDate = (lastActivatedDate && !isNaN(lastActivatedDate.getTime())) ? lastActivatedDate : (isNaN(regDate.getTime()) ? new Date() : regDate);
    const periodYears = evalUser.licensePeriod || 1;
    expDate = new Date(activationDate.getTime());
    expDate.setFullYear(expDate.getFullYear() + periodYears);
  } else {
    // 7 DAYS TRIAL FOR EVERYONE
    // Persisted to Firebase Cloud Firestore for countdown
    isTrial = true;
    licenseType = 'trial';
    if (evalUser.trialEndDate) {
      expDate = new Date(evalUser.trialEndDate);
    } else {
      const trialStartDate = evalUser.trialStartDate ? new Date(evalUser.trialStartDate) : (isNaN(regDate.getTime()) ? new Date() : regDate);
      expDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  if (isNaN(expDate.getTime())) {
    expDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();
  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  const remainingDays = Math.floor(totalSec / (3600 * 24));
  const remainingHours = Math.floor((totalSec % (3600 * 24)) / 3600);
  const remainingMinutes = Math.floor((totalSec % 3600) / 60);
  const remainingSeconds = totalSec % 60;

  const isExpired = licenseType === 'unlimited' ? !!evalUser.isSuspended : now.getTime() >= expDate.getTime();
  const isLocked = isExpired || !!evalUser.isSuspended;

  let countdownString = '';
  if (isLocked) {
    if (evalUser.isSuspended) {
      countdownString = 'Suspended';
    } else if (isTrial) {
      countdownString = 'Trial Expired (0d 0h 0m 0s)';
    } else {
      countdownString = 'Expired / Locked';
    }
  } else if (licenseType === 'unlimited') {
    countdownString = 'Lifetime Access';
  } else if (isTrial) {
    countdownString = `${remainingDays}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
  } else {
    countdownString = `${remainingDays}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  const effectiveLicensePeriod = evalUser.licensePeriod || 1;

  // Build helpful display status statements linked to this user's subscription
  let message = '';
  if (isLocked) {
    if (isInheritedFromHeadteacher) {
      message = evalUser.isSuspended
        ? `School account access has been suspended by Headteacher/Admin (${headteacherName}). Please contact your Headteacher to reactivate.`
        : isTrial
          ? `Your school's 7-day free trial (Headteacher: ${headteacherName}) has expired. Please notify your Headteacher to activate an annual school license.`
          : `Your school's ${effectiveLicensePeriod}-year subscription (Headteacher: ${headteacherName}) requires license activation or renewal. Please notify your Headteacher to activate the school license.`;
    } else {
      message = evalUser.isSuspended
        ? `Account access (User ID: ${evalUser.uid}) has been suspended by Admin. Please contact Admin at pegyirenyi@gmail.com or 0544052717 to request license activation.`
        : isTrial
          ? `Your 7-day free trial period for User ID (${evalUser.uid}) has ended. Please purchase an annual license (1, 2, 3, or 5 years) to unlock full access.`
          : `Your ${effectiveLicensePeriod}-year school database license for User ID (${evalUser.uid}) has expired. Please purchase a single-use renewal passcode to regain full access.`;
    }
  } else {
    if (isInheritedFromHeadteacher) {
      message = isTrial
        ? `7-Day Free Trial Active via Headteacher (${headteacherName}). ${countdownString} remaining in your school's trial.`
        : `Licensed School Account (Headteacher: ${headteacherName}). Real-time school license active with ${countdownString} remaining on your ${effectiveLicensePeriod}-year subscription.`;
    } else {
      message = licenseType === 'unlimited'
        ? `Unlimited Lifetime License active for User ID: ${evalUser.uid}.`
        : isTrial
          ? `7-Day Free Trial Active (${evalUser.uid}). ${countdownString} remaining in your trial countdown.`
          : `Licensed Account (${evalUser.uid}). Your license is active with ${countdownString} remaining on your ${effectiveLicensePeriod}-year license subscription.`;
    }
  }

  return {
    isLocked,
    isTrial,
    registeredOnDate: regDate,
    lastActivatedOnDate: lastActivatedDate,
    expiryDate: expDate,
    remainingDays,
    remainingHours,
    remainingMinutes,
    remainingSeconds,
    countdownString,
    message,
    requestCode,
    licenseType,
    licensePeriod: effectiveLicensePeriod,
    isInheritedFromHeadteacher,
    headteacherName: headteacherName || undefined
  };
}

/**
 * Prepares direct contact links for admin
 */
export function getContactAdminLinks(email: string, requestCode: string) {
  const adminEmail = 'pegyirenyi@gmail.com';
  const phone = '0544052717'; // Admin Phone in GH (Country code +233 or local 0544052717)

  const subject = encodeURIComponent('GEETECH School DB License Activation Request');
  const body = encodeURIComponent(
    `Hello Administrator,\n\nI need to renew/activate my GEETECH School Database access.\n` +
    `My Registered User Email: ${email}\n` +
    `My System Request Code: ${requestCode}\n` +
    `Please generate the activation code for me so we can complete our license payment.\n\n` +
    `Thank you!`
  );

  const mailtoUrl = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
  
  // Format international number for WhatsApp
  const cleanPhone = '233544052717'; // format for WhatsApp click-to-chat
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${body}`;

  return {
    mailtoUrl,
    whatsappUrl,
    phone,
    adminEmail
  };
}
