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
      licenseType: 'unlimited'
    };
  }

  // If user is a Teacher / Staff user, inherit the subscription status from their registered Headteacher / School Admin
  // unless the teacher account already has its own direct active license
  let evalUser = user;
  let isInheritedFromHeadteacher = false;
  let headteacherName = '';

  const userHasDirectActiveLicense = user.licenseType === 'activated' || user.licenseType === 'unlimited';

  if (user.role === 'Teacher' && !userHasDirectActiveLicense) {
    try {
      const allUsers = DbController.getRegisteredUsers();
      const schoolId = user.schoolId;
      
      // Find matching Headteacher / School Admin for this school or generally
      const headteacher = allUsers.find(u => 
        (u.role === 'Headteacher' || u.role === 'Admin') &&
        (schoolId ? u.schoolId === schoolId : true) &&
        u.email?.toLowerCase().trim() !== 'pegyirenyi@gmail.com'
      ) || allUsers.find(u => 
        (u.role === 'Headteacher' || u.role === 'Admin') &&
        u.email?.toLowerCase().trim() !== 'pegyirenyi@gmail.com'
      );

      if (headteacher) {
        evalUser = headteacher;
        isInheritedFromHeadteacher = true;
        headteacherName = headteacher.name || headteacher.email;
      }
    } catch (e) {
      console.warn("Could not retrieve Headteacher subscription profile for teacher:", e);
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

  // Build helpful display status statements linked to this user's subscription
  let message = '';
  if (isLocked) {
    if (isInheritedFromHeadteacher) {
      message = evalUser.isSuspended
        ? `School account access has been suspended by Headteacher/Admin (${headteacherName}). Please contact your Headteacher to reactivate.`
        : isTrial
          ? `Your school's 7-day free trial (Headteacher: ${headteacherName}) has expired. Please notify your Headteacher to activate an annual school license.`
          : `Your school's subscription (Headteacher: ${headteacherName}) requires license activation or renewal. Please notify your Headteacher to activate the school license.`;
    } else {
      message = evalUser.isSuspended
        ? `Account access (User ID: ${evalUser.uid}) has been suspended by Admin. Please contact Admin at pegyirenyi@gmail.com or 0544052717 to request license activation.`
        : isTrial
          ? `Your 7-day free trial period for User ID (${evalUser.uid}) has ended. Please purchase an annual license (1, 2, 3, or 5 years) to unlock full access.`
          : `Your ${evalUser.licensePeriod || 1}-year school database license for User ID (${evalUser.uid}) has expired. Please purchase a single-use renewal passcode to regain full access.`;
    }
  } else {
    if (isInheritedFromHeadteacher) {
      message = isTrial
        ? `7-Day Free Trial Active via Headteacher (${headteacherName}). ${countdownString} remaining in your school's trial.`
        : `Licensed School Account (Headteacher: ${headteacherName}). Real-time school license active with ${countdownString} remaining on your ${evalUser.licensePeriod || 1}-year subscription.`;
    } else {
      message = licenseType === 'unlimited'
        ? `Unlimited Lifetime License active for User ID: ${evalUser.uid}.`
        : isTrial
          ? `7-Day Free Trial Active (${evalUser.uid}). ${countdownString} remaining in your trial countdown.`
          : `Licensed Account (${evalUser.uid}). Your license is active with ${countdownString} remaining on your ${evalUser.licensePeriod || 1}-year license subscription.`;
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
    licenseType
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
