# Career Groove for iOS

Native SwiftUI client for iOS and iPadOS 17 or newer. The app uses the same
PostgreSQL-backed API as the Career Groove web application.

## Local Setup

Requirements:

- macOS 15 or newer
- Xcode 16.4 or newer
- XcodeGen 2.45.4 or newer

Generate and open the project:

```bash
cd ios
./bootstrap.sh
open CareerGroove.xcodeproj
```

`Config/Products.storekit` supplies local monthly and yearly StoreKit products.
The Debug and Release API base URL is `https://careergroove.website`. Override
`API_BASE_URL` in a local Xcode configuration when testing another backend.

## Apple Configuration

The project is intentionally unsigned until an Apple Developer team exists.
After enrollment:

1. Create the App ID `com.careergroove.careergroove`.
2. Enable Associated Domains, Sign in with Apple, Push Notifications, and
   In-App Purchase.
3. Set `DEVELOPMENT_TEAM` in `project.yml`.
4. Set `APPLE_TEAM_ID` and `AUTH_APPLE_IOS_CLIENT_ID` on the backend.
5. Regenerate the project with `./bootstrap.sh`.
6. Confirm that
   `https://careergroove.website/.well-known/apple-app-site-association`
   contains `<TEAM_ID>.com.careergroove.careergroove`.

Do not commit `.p8` keys, App Store Connect keys, or provisioning profiles.

## Authentication

- Email/password uses short-lived access tokens and rotating refresh tokens.
- Access and refresh tokens are stored with ThisDeviceOnly Keychain protection.
- Google and GitHub use `ASWebAuthenticationSession` and a PKCE-protected,
  one-time authorization code.
- Sign in with Apple uses `ASAuthorizationAppleIDProvider`; the backend verifies
  Apple’s signed identity token, audience, issuer, nonce, and replay identifier.
- Passkey sign-in uses `ASAuthorizationController` against the
  `careergroove.website` relying party and the existing Auth.js authenticator
  records.

Passkeys and external providers are hidden when the backend capability endpoint
reports that they are not configured.

## Billing

StoreKit product identifiers:

- `com.careergroove.careergroove.pro.monthly`
- `com.careergroove.careergroove.pro.yearly`

The app supplies the Career Groove user UUID as StoreKit’s `appAccountToken`.
The backend verifies Apple’s signed transaction before the app finishes it.
App Store Server Notifications V2 must target:

```text
https://careergroove.website/api/webhooks/app-store
```

Existing Stripe subscriptions remain visible to the backend, but the iOS app
does not sell digital access through Stripe.

## Push Notifications

The app registers only after user consent. The Docker
`mobile-notification-worker` checks every five minutes for:

- Upcoming interviews
- Application follow-ups
- Completed or failed document generation
- Pending command-session actions
- Subscription problems

APNs credentials and `MOBILE_NOTIFICATION_WORKER_SECRET` are required in the
backend environment. Invalid device tokens are removed after APNs returns 410.

## Validation

The GitHub Actions workflow generates the Xcode project, builds the app, and
runs unit tests on a macOS 15/Xcode 16.4 runner:

```bash
xcodebuild test \
  -project CareerGroove.xcodeproj \
  -scheme CareerGroove \
  -destination 'platform=iOS Simulator,id=<simulator-udid>' \
  CODE_SIGNING_ALLOWED=NO
```

Signing, physical-device passkey checks, APNs delivery, StoreKit sandbox
purchases, TestFlight upload, and App Review require an active Apple Developer
account and cannot be completed on the Linux development host.
