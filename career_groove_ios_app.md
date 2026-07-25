CareerGroove iOS Native App — Production Plan
1. Architecture
Layer	Technology
UI	SwiftUI (iOS 17+) — matches the existing web app's SwiftUI patterns
State	Swift @Observable / @Environment — same pattern already used in the codebase
Networking	URLSession + async/await with a thin client layer
Auth	Keychain-stored session cookie from Auth.js JWT
OAuth	ASWebAuthenticationSession (iOS native)
Passkeys	ASAuthorizationController + AuthenticationServices — ties into the same Auth.js WebAuthn endpoints
Payments	StoreKit for in-app subscriptions, OR ASWebAuthenticationSession to Stripe Checkout
Audio	AVAudioPlayer / AVPlayer for the 4-station ambient player
Haptics	UIImpactFeedbackGenerator, UINotificationFeedbackGenerator
Push	UserNotifications + UNUserNotificationCenter
Charts	Swift Charts (iOS 16+) — built-in, no dependency
DB client	URLSession → REST API (no local DB; shared PostgreSQL is the source of truth)
2. Backend Changes
Near-zero — same as before:
1. 
CORS headers in next.config.ts (one-file change)
2. 
Optional: POST /api/mobile/token-exchange to exchange credentials for a session token directly (avoids cookie parsing on iOS). The existing cookie approach works too, but a token endpoint is cleaner for mobile.
Recommended approach — add one tiny endpoint (2 hours):
// app/api/mobile/signin/route.ts
import { signIn } from "@/auth";
export async function POST(request: Request) {
  const { email, password } = await request.json();
  try {
    const r = await signIn("credentials", { email, password, redirect: false });
    if (!r.ok || !r?.error) {
      // Get the JWT from the session
      return Response.json({ token: r?.sessionToken || "..." });
    }
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  } catch {
    return Response.json({ error: "Sign in failed" }, { status: 500 });
  }
}
The mobile app stores this token in the Keychain and sends it as Authorization: Bearer <token>. A lightweight Next.js middleware (or existing auth() call) can accept either the cookie or the Authorization header.
3. Xcode Project Structure
CareerGroove/
├── App/
│   ├── CareerGrooveApp.swift          — @main App struct
│   ├── ContentView.swift              — Root router
│   └── AppDelegate.swift              — Push notification setup
├── Core/
│   ├── Networking/
│   │   ├── APIClient.swift            — URLSession wrapper, token injection
│   │   ├── APIJobs.swift              — Job endpoints
│   │   ├── APIApplications.swift      — Application endpoints
│   │   ├── APIContacts.swift
│   │   ├── APIResidences.swift
│   │   ├── APICredentials.swift
│   │   ├── APISkills.swift
│   │   ├── APIDocuments.swift
│   │   ├── APIProviderConnections.swift
│   │   ├── APICommandSessions.swift
│   │   ├── APIAnalytics.swift
│   │   ├── APIApplicationPreferences.swift
│   │   ├── APIAI.swift               — AI streaming/text endpoint
│   │   ├── APIAuth.swift             — Sign in, register
│   │   ├── APIStripe.swift
│   │   └── APIGitHub.swift
│   ├── Auth/
│   │   ├── AuthManager.swift          — Keychain, session lifecycle
│   │   ├── OAuthProvider.swift        — Google/Apple/GitHub via ASWebAuthenticationSession
│   │   └── PasskeyManager.swift       — ASAuthorizationController for WebAuthn
│   ├── Models/                        — Codable structs matching API JSON
│   │   ├── User.swift
│   │   ├── Job.swift
│   │   ├── Application.swift
│   │   ├── ApplicationEvent.swift
│   │   ├── ApplicationScore.swift
│   │   ├── Contact.swift
│   │   ├── Residence.swift
│   │   ├── Credential.swift
│   │   ├── Skill.swift
│   │   ├── Document.swift
│   │   ├── ProviderConnection.swift
│   │   ├── CommandSession.swift
│   │   ├── ApplicationPreferences.swift
│   │   ├── Analytics.swift
│   │   └── APIError.swift
│   └── Extensions/
│       ├── Date+Formatting.swift
│       ├── String+Validation.swift
│       └── View+Conditional.swift
├── Features/
│   ├── Dashboard/
│   │   ├── DashboardView.swift
│   │   ├── DashboardViewModel.swift
│   │   ├── CommandSessionCard.swift
│   │   ├── HotOpportunitiesCard.swift
│   │   └── QuickToolsGrid.swift
│   ├── Auth/
│   │   ├── SignInView.swift
│   │   ├── RegisterView.swift
│   │   └── AuthViewModel.swift
│   ├── Journey/
│   │   ├── JourneyListView.swift       — Job timeline
│   │   ├── JobDetailView.swift
│   │   ├── JobFormView.swift           — Add/edit job
│   │   ├── AIInterviewerView.swift     — Chat-based career story
│   │   └── JourneyViewModel.swift
│   ├── Applications/
│   │   ├── PipelineView.swift          — Kanban board
│   │   ├── ApplicationListView.swift
│   │   ├── ApplicationDetailView.swift — Full detail with tabs
│   │   ├── ApplicationFormView.swift
│   │   ├── ApplicationEventsView.swift
│   │   ├── ApplicationInterviewsView.swift
│   │   ├── ApplicationOutcomesView.swift
│   │   ├── CommandSessionView.swift
│   │   └── ApplicationsViewModel.swift
│   ├── Network/
│   │   ├── ContactListView.swift
│   │   ├── ContactDetailView.swift
│   │   ├── ContactFormView.swift
│   │   └── NetworkViewModel.swift
│   ├── Documents/
│   │   ├── DocumentListView.swift
│   │   ├── DocumentViewer.swift
│   │   ├── AIStudioView.swift          — Generate resume/cover letter
│   │   └── DocumentsViewModel.swift
│   ├── MockInterview/
│   │   ├── MockInterviewView.swift
│   │   └── MockInterviewViewModel.swift
│   ├── Settings/
│   │   ├── SettingsListView.swift
│   │   ├── ProfileEditView.swift
│   │   ├── AIProvidersView.swift       — Connect/discover/select models
│   │   ├── ApplicationPreferencesView.swift
│   │   ├── ResidencesView.swift
│   │   ├── CredentialsView.swift
│   │   ├── SkillsView.swift
│   │   ├── MusicPlayerView.swift
│   │   ├── BillingView.swift
│   │   └── SettingsViewModel.swift
│   └── Static/
│       ├── PrivacyView.swift
│       └── TermsView.swift
├── Components/                        — Reusable SwiftUI widgets
│   ├── ButtonStyles.swift              — Bouncy press animations
│   ├── CardStyles.swift
│   ├── EmptyStateView.swift
│   ├── LoadingState.swift
│   ├── ErrorState.swift
│   ├── MotionButton.swift             — Matches the web's motion-button component
│   ├── MusicPlayerOverlay.swift
│   ├── AccountMenuView.swift
│   ├── PageHeadingView.swift
│   ├── BottomTabBar.swift
│   ├── SidebarView.swift              — iPad/macOS sidebar
│   └── ChatBubbleView.swift
└── Resources/
    ├── Assets.xcassets/
    ├── Colors.xcassets                — Matches DESIGN.md palette
    └── Audio/                         — Lo-Fi, Ambient, Classical, Brain Waves
4. Navigation Structure (SwiftUI NavigationStack)
TabView (bottom tab bar — iOS)
├── Dashboard       → NavigationStack
├── Journey         → NavigationStack → JobDetail → AIInterviewer
├── Applications    → NavigationStack → ApplicationDetail → Interviews/Events/Outcomes
├── Network         → NavigationStack → ContactDetail
└── Documents       → NavigationStack → DocumentViewer
Sheet presentations:
├── Settings (from tab bar gear icon) → NavigationStack
│   ├── Profile
│   ├── AI Providers
│   ├── Application Preferences
│   ├── Residences
│   ├── Credentials
│   ├── Skills
│   ├── Music Player
│   └── Billing
├── Sign In / Register (from auth guard)
└── Command Session (from Dashboard)
On iPad / macOS (Catalyst), the TabView switches to a Sidebar split-view.
5. Data Flow
[iOS App]
    │
    ├── APIClient (URLSession + async/await)
    │   ├── Keychain → Bearer token injection
    │   └── Base URL from App Config
    │
    ├── [GET/POST/PATCH/DELETE] → [Your Containerized Next.js API]
    │                                      │
    │                                      └── [PostgreSQL — Shared with Web]
    │
    └── [Response] → [@Observable ViewModel] → [SwiftUI View]
AI requests: POST /api/ai returns text/plain. URLSession reads it as a string. If streaming is added later, use URLSession.bytes stream.
6. Auth Flow
┌─────────────────────────────────────────────────────────┐
│  iOS App                                                │
│                                                         │
│  1. Email/Password:                                     │
│     POST /api/mobile/signin                             │
│       → { email, password }                             │
│       ← { token: "jwt..." }                             │
│     Store token in Keychain                             │
│                                                         │
│  2. OAuth (Google/GitHub/Apple):                        │
│     ASWebAuthenticationSession                          │
│       → opens /api/auth/signin/google in system browser │
│       → callback captures session cookie/token          │
│     Store token in Keychain                             │
│                                                         │
│  3. Passkey (WebAuthn):                                 │
│     ASAuthorizationController(.platformPublicKey)       │
│       → uses iCloud Keychain passkey                    │
│       → POST /api/auth/callback/credentials with the    │
│         WebAuthn assertion                              │
│     Store session token                                 │
└─────────────────────────────────────────────────────────┘
Sign-in with Apple is special: use ASAuthorizationController with ASAuthorizationAppleIDProvider. This is the only OAuth that works natively without ASWebAuthenticationSession. The resulting identity token is posted to your custom token exchange endpoint.
7. Key Implementation Details
APIClient
final class APIClient {
    static let shared = APIClient()
    private let baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"]
        ?? "https://career.example.com"
    private let keychain = KeychainManager()
    private var token: String? {
        get async { await keychain.read(key: "auth-token") }
    }
    func request<T: Decodable>(
        _ method: String,
        _ path: String,
        body: Encodable? = nil
    ) async throws -> T {
        var urlRequest = URLRequest(url: URL(string: "\(baseURL)\(path)")!)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = await token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            urlRequest.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
Models (Codable structs matching API JSON)
struct Job: Codable, Identifiable {
    let id: String
    let company: String
    let title: String
    let location: String?
    let startedOn: String?
    let endedOn: String?
    let current: Bool
    let rawNotes: String?
    let achievements: [String]
    let metadata: [String: AnyCodable]?
    let createdAt: String
}
struct Application: Codable, Identifiable {
    let id: String
    let status: ApplicationStatus
    let title: String
    let company: String
    // ... all fields matching the API JSON
    let latestScore: ApplicationScore?
}
AI Interviewer ViewModel
@Observable final class AIInterviewerViewModel {
    var messages: [ChatMessage] = []
    var isLoading = false
    func sendMessage(_ text: String) async {
        messages.append(ChatMessage(role: "user", content: text))
        isLoading = true
        defer { isLoading = false }
        do {
            let response: String = try await APIClient.shared.requestText(
                "POST", "/api/ai",
                body: AIRequest(
                    purpose: "job-interviewer",
                    messages: messages.map { $0.toAPI() }
                )
            )
            messages.append(ChatMessage(role: "assistant", content: response))
        } catch {
            // handle error
        }
    }
}
Animations (matching web's Framer Motion style)
// MotionButton — mirrors components/motion-button.tsx
struct MotionButton: View {
    let action: () -> Void
    let label: String
    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.black(16))
                .padding()
                .background(Color.coral)
                .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(BouncyPressStyle()) // custom Spring animation
    }
}
struct BouncyPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6),
                       value: configuration.isPressed)
    }
}
8. Design System (Matches DESIGN.md)
Token	Hex	Usage
ink	#26312C	Backgrounds, text
cream	#F5F0E8	Page backgrounds, cards
coral	#FF6B6B	Primary CTAs
sun	#FFC857	Accent, highlights
mint	#4ECDC4	Success states
plum	#6C5B7B	Secondary text, tags
Define as Color extensions in Colors.xcassets.
9. Target Deployment
Target	Version
iOS	17.0 (minimum)
iPadOS	17.0 (same app, split-view sidebar)
visionOS	Optional (same SwiftUI app)
Mac Catalyst	Optional (same SwiftUI app)
10. Container Usage
Your existing Docker setup stays fully intact. The iOS app is compiled on macOS (Xcode) — not in a container. But for CI:
# Dockerfile.ios-builder — for CI/CD only
FROM ghcr.io/cirruslabs/macos-ventura-xcode:15.4
WORKDIR /app
COPY . .
RUN xcodebuild -scheme CareerGroove -destination 'generic/platform=iOS' build
This is optional — most teams just build on GitHub Actions macOS runners. Your actual app distribution is through TestFlight (beta) → App Store (production), hitting the same containerized backend.
11. Development Phases
Phase	Duration	Deliverables
P1: Foundation	Week 1	Xcode project, APIClient, Auth (email + Keychain), SignIn/Register views, CORS on backend
P2: Core Screens	Weeks 2-3	Dashboard, Journey (timeline + AI interviewer), Applications (pipeline + detail)
P3: Full Features	Week 4	Network, Documents, Mock Interview, Command Session
P4: Settings + Polish	Week 5	All settings screens, AI Providers, Music Player, Billing, haptics, animations
P5: App Store	Week 6	TestFlight beta, App Store Connect setup, screenshots, privacy labels, submission