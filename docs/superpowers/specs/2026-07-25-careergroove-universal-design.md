# CareerGroove Universal Product Design

## Product character

CareerGroove should feel like a capable career coach with a record collection: warm, rhythmic, optimistic, and decisive. The interface uses the existing cream, ink, coral, plum, mint, and sunshine palette; Outfit supplies expressive display typography while system fonts keep dense product data readable.

## Responsive architecture

Phones use a five-destination bottom navigation: Home, Journey, Applications, Network, and More. Documents, analytics, interview tools, profile, billing, providers, and settings live in the More stack so the tab bar remains usable. Tablets and web expand into a left navigation rail and keep the active workspace visible. All feature routes retain stable URLs across platforms.

## Landing experience

The public web experience follows AIDA:

- Navigation is compact and high contrast.
- The hero uses artistic asymmetry, an ultra-wide two-line headline, and two clear actions.
- Interest is a gapless 12-column dense feature grid: spans 7+5, then 4+4+4.
- Desire uses stacked proof cards and a pinned story on wide web screens.
- Action ends with one high-contrast conversion panel and a restrained footer.

Inline artwork is abstract and musical rather than generic stock photography. Motion never carries essential meaning.

## Product surfaces

Authenticated screens share `Screen`, `Section`, `GrooveCard`, `GrooveButton`, `Field`, `EmptyState`, `ErrorState`, and `LoadingState` primitives. Tracker status uses color plus text and iconography. Data-heavy screens provide compact mobile cards and aligned web/tablet rows from the same source data.

The music controller is persistent but subordinate: compact by default, never covers primary actions, follows platform audio-session rules, and respects saved settings. Motion uses Reanimated on native. Browser-only enhancements may use a web adapter, but navigation and actions remain fully usable with motion disabled.

## Data and session behavior

TanStack Query owns server state. A single API client validates shared Zod response contracts, serializes token refresh so concurrent 401 responses trigger one refresh, retries the original request once, and signs out on refresh failure. Native tokens use SecureStore. Web tokens use memory plus encrypted or HttpOnly-cookie-compatible storage; refresh credentials are never placed in URLs.

Every data screen defines loading, empty, offline, permission, validation, and retry behavior. Optimistic updates are limited to reversible low-risk actions; destructive and billing operations wait for server confirmation.

## Accessibility

Text and controls meet WCAG AA contrast. Touch targets are at least 44 by 44 points. Dynamic type, screen-reader labels, logical focus order, keyboard operation, safe areas, and reduced-motion preferences are required. Status is never communicated by color alone.

## Release criteria

The universal app must export for web, bundle for iOS and Android, pass component and session tests, and reproduce every existing feature-parity item before legacy clients are removed. Production web assets use immutable hashed caching; HTML is never cached immutably. Deep links and OAuth callbacks are tested on all three platforms.
