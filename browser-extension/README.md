# CareerGroove Job Capture Extension

This is a Manifest V3 browser extension for saving job posts directly into CareerGroove Tracker Studio.

## Load Locally in Chrome or Edge

1. Run CareerGroove and sign in at `http://localhost:3000`.
2. Open Chrome or Edge extension settings.
3. Enable developer mode.
4. Choose **Load unpacked** and select this `browser-extension` folder.
5. Open a job post, click the CareerGroove extension, review the parsed fields, and choose **Save role**.

## Load Temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on**.
4. Select `manifest.json` from this `browser-extension` folder.
5. Open a job post, click the CareerGroove extension, review the parsed fields, and choose **Save role**.

The extension stores only the CareerGroove app URL in browser sync storage. Captured posting text is sent to your CareerGroove instance through the existing authenticated `/api/applications/parse` and `/api/applications` routes.

## Production Notes

- The popup defaults to `https://careergroove.website`; change `DEFAULT_APP_URL` in `popup.js` if your deployment differs.
- Keep the user signed in to CareerGroove in the same browser profile.
- The extension uses the active tab content only when the user opens the popup or context-menu capture.
- The manifest includes both Manifest V3 background forms: Chrome uses `service_worker`, while Firefox uses `scripts`.
