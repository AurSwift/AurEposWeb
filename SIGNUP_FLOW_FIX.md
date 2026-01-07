# Signup Flow Fix - Email Verification & Authentication

## Problem

After email verification, users were getting an "Unauthorized. Please sign in or provide verified email" error when trying to proceed with plan selection and billing.

**Root Cause:** Users were not signed in after email verification, but the checkout flow requires an authenticated session.

## Solution

Implemented a **redirect-to-login** flow after email verification with callback URL support.

### Flow Diagram

```
1. User signs up
   ↓
2. User receives verification email
   ↓
3. User clicks verification link
   ↓
4. Email is verified in database
   ↓
5. User is redirected to LOGIN page (with callback URL)
   ↓
6. User logs in with their credentials
   ↓
7. User is redirected to PLAN SELECTION page
   ↓
8. User selects plan and billing cycle
   ↓
9. User proceeds to Stripe checkout (authenticated)
```

## Changes Made

### 1. Email Verification Page (`web/app/verify-email/page.tsx`)

**Before:**
```typescript
// After verification, redirect directly to plan selection
router.push("/signup?step=plan&verified=true");
```

**After:**
```typescript
// After verification, redirect to login with callback URL
router.push(
  `/login?callbackUrl=${encodeURIComponent("/signup?step=plan&verified=true")}&verified=true&email=${encodeURIComponent(data.email)}`
);
```

**Changes:**
- Redirects to `/login` instead of `/signup?step=plan`
- Passes `callbackUrl` parameter to redirect after login
- Passes `verified=true` flag to show success message
- Passes `email` parameter to pre-fill login form
- Updated success message to inform user they need to log in

### 2. Login Page (`web/app/login/page.tsx`)

**Added:**
- `useSearchParams` to read URL parameters
- `useEffect` to detect email verification redirect
- State for showing verification success message
- Pre-fill email field if provided in URL
- Callback URL support in login handler

**Changes:**

1. **Import additions:**
```typescript
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
```

2. **State additions:**
```typescript
const searchParams = useSearchParams();
const [showVerifiedMessage, setShowVerifiedMessage] = useState(false);
```

3. **Email verification detection:**
```typescript
useEffect(() => {
  const verified = searchParams?.get("verified");
  const emailParam = searchParams?.get("email");
  
  if (verified === "true") {
    setShowVerifiedMessage(true);
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
    setTimeout(() => setShowVerifiedMessage(false), 10000);
  }
}, [searchParams]);
```

4. **Callback URL support in login handler:**
```typescript
// Check if there's a callback URL (e.g., from email verification)
const callbackUrl = searchParams?.get("callbackUrl");

if (callbackUrl) {
  // Redirect to the callback URL (e.g., plan selection)
  window.location.href = decodeURIComponent(callbackUrl);
  return;
}
```

5. **Success message UI:**
```typescript
{showVerifiedMessage && (
  <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 animate-in fade-in-50">
    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
    <AlertDescription className="text-sm text-green-800 dark:text-green-200">
      <strong>Email verified successfully!</strong>
      <br />
      Please log in to continue with your plan selection.
    </AlertDescription>
  </Alert>
)}
```

## User Experience

### Before Fix
1. User signs up → Email verification → ❌ Error on plan selection (not authenticated)

### After Fix
1. User signs up
2. User receives verification email
3. User clicks verification link
4. ✅ Success message: "Email verified! Redirecting to login..."
5. User is redirected to login page
6. ✅ Success message: "Email verified successfully! Please log in to continue..."
7. Email field is pre-filled
8. User enters password and logs in
9. ✅ User is automatically redirected to plan selection page
10. User can now proceed with checkout (authenticated)

## Security Considerations

### Why Not Auto-Login?

We chose **not** to implement auto-login after email verification for the following reasons:

1. **Security Best Practice:** Requiring users to enter their password after email verification adds an extra layer of security.

2. **No Password Storage:** We don't store passwords in plain text, so we can't auto-login without the user providing their password.

3. **Session Management:** This approach ensures proper session creation through the standard authentication flow.

4. **Audit Trail:** Each login is properly logged and tracked.

### Alternative Approaches (Not Implemented)

1. **One-Time Login Token:** Could create a temporary token for auto-login after verification, but adds complexity and potential security risks.

2. **Store Password Temporarily:** Never acceptable for security reasons.

3. **Passwordless Magic Link:** Would require significant architecture changes.

## Testing

### Test Scenario 1: New User Signup
1. Go to `/signup`
2. Enter email, password, company name
3. Click "Create Account"
4. Check email for verification link
5. Click verification link
6. Should see success message and redirect to login
7. Should see "Email verified successfully!" message
8. Email field should be pre-filled
9. Enter password and log in
10. Should redirect to plan selection page
11. Select plan and billing cycle
12. Should successfully proceed to Stripe checkout

### Test Scenario 2: Already Verified Email
1. Click verification link again
2. Should see "Email already verified" message
3. Should redirect to login page
4. Should be able to log in normally

### Test Scenario 3: Invalid/Expired Token
1. Use invalid or expired verification link
2. Should see error message
3. Should offer to request new verification email

## Files Modified

1. `web/app/verify-email/page.tsx` - Email verification page
2. `web/app/login/page.tsx` - Login page with callback support

## Environment

- Next.js 14+ (App Router)
- NextAuth.js (Credentials Provider)
- React 18+
- TypeScript

## Deployment Notes

- No database migrations required
- No environment variable changes
- No breaking changes to existing flows
- Backward compatible with existing login flow

## Future Improvements

1. **Remember Me:** Add "Remember Me" checkbox to keep users logged in longer
2. **Social Auth:** Add Google/GitHub OAuth for easier signup
3. **Magic Link:** Implement passwordless authentication
4. **2FA:** Add two-factor authentication for enhanced security
5. **Session Timeout:** Implement session timeout warnings

## Related Files

- `web/auth/index.ts` - NextAuth configuration
- `web/lib/auth-utils.ts` - Authentication utilities
- `web/app/api/auth/verify-email/route.ts` - Email verification API
- `web/app/signup/page.tsx` - Signup page
- `web/proxy.ts` - Global route protection middleware

## Support

If users report issues with the signup flow:

1. Check if email verification was successful (check `users` table, `email_verified` field)
2. Verify user can log in with their credentials
3. Check browser console for any JavaScript errors
4. Verify callback URL is properly encoded/decoded
5. Check NextAuth session is being created properly

## Conclusion

This fix ensures users have a smooth, secure signup experience while maintaining proper authentication throughout the checkout flow. The redirect-to-login approach is a standard pattern used by many SaaS applications and provides a good balance between security and user experience.

