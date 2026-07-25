# Deployment Checklist

## Apple Developer

- [ ] Enroll Jeremy Guill in the Apple Developer Program.
- [ ] Register `com.careergroove.careergroove`.
- [ ] Enable Sign in with Apple, Associated Domains, Push Notifications, and
      In-App Purchase.
- [ ] Create development and distribution signing assets.
- [ ] Create an APNs `.p8` key and record its key ID and team ID.
- [ ] Set the Xcode project’s development team.

## App Store Connect

- [ ] Create **Career Groove** with the registered bundle ID.
- [ ] Replace `APP_STORE_APP_APPLE_ID` with the numeric app ID.
- [ ] Create the **Career Groove Pro** subscription group.
- [ ] Create and approve the monthly and yearly product identifiers from the
      StoreKit configuration.
- [ ] Complete pricing, tax, and banking agreements.
- [ ] Configure App Store Server Notifications V2 for sandbox, test it, then
      configure production.
- [ ] Download Apple root certificates and set
      `APP_STORE_ROOT_CA_BASE64` as a JSON array of base64 DER values.

## Backend

- [ ] Deploy migration `012_mobile_auth_and_push.sql`.
- [ ] Generate a high-entropy `MOBILE_NOTIFICATION_WORKER_SECRET`.
- [ ] Set `APPLE_TEAM_ID`, `AUTH_APPLE_IOS_CLIENT_ID`, APNs values, and App
      Store verification values from `.env.example`.
- [ ] Enable `AUTH_EXPERIMENTAL_ENABLE_PASSKEYS` after the associated-domain
      file is verified from a public device network.
- [ ] Configure Google and GitHub callback URLs for the production Auth.js URL.
- [ ] Verify `docker compose up -d --build mobile-notification-worker`.
- [ ] Confirm the App Store webhook and internal notification endpoint do not
      pass through a caching proxy.

## TestFlight Gate

- [ ] Run unit tests and a Release archive in Xcode.
- [ ] Test email sign-in, refresh rotation, sign-out, each OAuth provider,
      native Apple sign-in, and a passkey on a physical device.
- [ ] Test interrupted network requests and expired access/refresh tokens.
- [ ] Test monthly/yearly purchase, cancellation, pending approval, renewal,
      expiration, refund/revocation, and restore in StoreKit sandbox.
- [ ] Test all five push categories in sandbox and production.
- [ ] Verify Dynamic Type at accessibility sizes, VoiceOver order, reduced
      motion, landscape, iPad split view, offline errors, and empty states.
- [ ] Run through every create, update, and delete workflow against staging.
- [ ] Capture required iPhone and iPad App Store screenshots.
- [ ] Validate the privacy manifest and complete App Privacy answers.
- [ ] Add App Review notes and a review account with representative test data.
- [ ] Upload the archive to TestFlight and resolve all processing warnings.

## Production Gate

- [ ] Obtain beta feedback and crash-free usage from TestFlight.
- [ ] Confirm privacy and terms pages are publicly reachable.
- [ ] Confirm support contact and account-deletion instructions.
- [ ] Submit the reviewed build and metadata to App Review.
- [ ] Use phased release and monitor sign-in, purchase verification, APNs
      failures, API error rates, and document worker health.
