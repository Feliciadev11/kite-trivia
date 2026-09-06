import { LegalLayout } from "../components/LegalLayout";

const LAST_UPDATED = "February 17, 2026";
const CONTACT_EMAIL = "kitetriviaapp@gmail.com";

/**
 * Public route: /privacy
 * Kite Privacy Policy — aligned with Apple App Store Review Guideline 5.1
 * and Google Play Data Safety declarations. Covers RevenueCat subscriptions.
 */
export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How Kite treats the data that powers your sky."
      lastUpdated={LAST_UPDATED}
    >
      <p>
        Kite (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) makes a calming trivia
        app for iOS, Android, and the web. This policy explains what we collect,
        why, how it is stored, and the choices you have. We believe privacy is a
        feature — so we collect the minimum information necessary to make Kite
        work, and we never sell your personal data.
      </p>

      <h2>1. Information we collect</h2>

      <h3>Account information</h3>
      <p>
        You can play Kite, earn progress, and purchase Premium without
        creating an account. If you choose to register, we store the email
        address and display name you provide, together with a securely
        hashed password (we never store or see your raw password).
      </p>

      <h3>Gameplay data</h3>
      <p>
        To provide the core experience, Kite stores gameplay progress on our
        servers: your current level, XP, weekly score, daily login streak,
        recently seen questions (so we can avoid repeating them), rounds
        played today, unlocked milestones, owned kites/companions/sky themes,
        and your currently equipped items. This information is tied to your
        account and used only to run the game and show your progress.
      </p>

      <h3>Purchases and subscriptions</h3>
      <p>
        Purchases and subscriptions on iOS and Android are processed by
        Apple&rsquo;s App Store and Google Play respectively. Kite never sees
        your payment card details. We integrate with RevenueCat, Inc. as our
        subscription infrastructure provider — RevenueCat verifies your
        purchase with Apple/Google, tells our servers whether your
        subscription is active, and sends purchase-lifecycle events (started,
        renewed, cancelled, expired). We record the resulting entitlement
        state (active/inactive), the product identifier you purchased
        (lifetime, yearly, or monthly), and the expiration date if applicable.
        Web purchases (if used) are processed by Stripe, Inc., which
        similarly handles card data on our behalf. For more information see
        the{" "}
        <a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener noreferrer">
          RevenueCat privacy policy
        </a>{" "}
        and the{" "}
        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
          Stripe privacy policy
        </a>
        .
      </p>

      <h3>Device and diagnostic data</h3>
      <p>
        When Kite runs on a device we may receive basic technical information
        automatically — device model, operating system version, app version,
        preferred language, and crash diagnostics. This information is used
        to keep the app stable and to prioritise fixes.
      </p>

      <h3>Analytics</h3>
      <p>
        We use aggregated, non-identifying analytics to understand which
        parts of the app people enjoy (for example, how many rounds are
        played, which sky themes are most popular). Where our analytics
        provider assigns any identifier that could be linked to you, we
        treat it as personal data covered by this policy. We do not use
        analytics for advertising and we do not share individualised data
        with advertising networks.
      </p>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To create and secure your account.</li>
        <li>To save your gameplay progress across devices.</li>
        <li>To provide subscription features and confirm entitlement.</li>
        <li>To respond to your support requests.</li>
        <li>To improve the app (bug fixes, performance, content quality).</li>
        <li>To detect and prevent fraud, abuse, and violations of our Terms.</li>
      </ul>
      <p>
        We do not use your personal information to build advertising profiles
        or to sell to third parties. We do not use your gameplay data to
        train third-party AI models.
      </p>

      <h2>3. Who we share information with</h2>
      <p>
        Kite shares personal information only with service providers who help
        us operate the app, and only to the extent necessary to provide those
        services:
      </p>
      <ul>
        <li>
          <strong>Apple App Store and Google Play</strong> — process purchases
          on iOS and Android and issue receipts that we validate through
          RevenueCat.
        </li>
        <li>
          <strong>RevenueCat, Inc.</strong> — verifies purchase receipts,
          manages subscription state, and provides the paywall and Customer
          Center screens. We pass your Kite user identifier to RevenueCat so
          your entitlement can be linked to your account.
        </li>
        <li>
          <strong>Stripe, Inc.</strong> — processes web purchases if you use
          the browser version of the app.
        </li>
        <li>
          <strong>Cloud infrastructure providers</strong> that host our
          servers and databases under contractual data-protection terms.
        </li>
      </ul>
      <p>
        We may also disclose information if we are required to by law, or if
        we believe in good faith that disclosure is necessary to protect our
        rights, your safety, or the safety of others.
      </p>

      <h2>4. Data retention</h2>
      <p>
        We keep your account information and gameplay data for as long as
        your account is active. If you delete your account (see
        &ldquo;Your rights&rdquo; below) we delete your personal data within
        30 days, except where we are legally required to keep it (for
        example, tax records related to purchases). Aggregated, non-personal
        analytics may be retained indefinitely.
      </p>

      <h2>5. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access,
        correct, export, or delete your personal information, and to object
        to or restrict certain uses. To exercise any of these rights, email
        us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will
        verify the request against the email on your account and respond
        within 30 days.
      </p>
      <p>
        You can also manage or cancel your subscription at any time from
        Settings → Apple ID → Subscriptions on iOS, or from Google Play →
        Subscriptions on Android. Cancelling stops future renewals; already
        paid periods run to completion.
      </p>

      <h2>6. Children&rsquo;s privacy</h2>
      <p>
        Kite is designed to be family-friendly. We do not knowingly collect
        personal information from children under 13 (or the equivalent age
        of digital consent in your region) without verifiable parental
        consent. Parents who believe their child has provided us with
        personal information may contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will
        promptly delete it.
      </p>

      <h2>7. Security</h2>
      <p>
        Passwords are hashed with bcrypt before being stored. Session
        cookies are HTTP-only, marked Secure, and use SameSite=Lax to
        prevent common cross-site attacks. Traffic between the app and our
        servers is encrypted with TLS. No system is perfectly secure — if
        we ever become aware of an incident affecting your data we will
        notify you as required by law.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Our servers and service providers may be located in the United States
        or other countries. By using Kite you understand that your
        information will be processed in those locations, which may not have
        the same data-protection laws as your country of residence. We rely
        on standard contractual clauses and equivalent safeguards for
        international transfers.
      </p>

      <h2>9. App Store and Google Play disclosures</h2>
      <p>
        For Apple&rsquo;s App Privacy label, Kite collects the following
        categories: <strong>Identifiers</strong> (account user ID),
        <strong> Contact Info</strong> (email address), <strong>User
        Content</strong> (gameplay progress you create), <strong>Purchases
        </strong> (subscription status and product identifier), and
        <strong> Diagnostics</strong> (crash and performance data). All are
        linked to your identity and used only for app functionality,
        analytics, and product improvement — not for tracking or
        advertising.
      </p>
      <p>
        For Google Play&rsquo;s Data Safety form, Kite declares the same
        categories, encrypts data in transit, provides a way to request
        deletion, and does not share data with third parties beyond the
        service providers listed in section 3.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. If we make material
        changes we will notify you within the app or by email before the
        changes take effect. The date at the top of this page reflects the
        most recent revision.
      </p>

      <h2>11. Contact us</h2>
      <p>
        Questions or concerns? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We read
        every message and reply personally.
      </p>
    </LegalLayout>
  );
}

export { PrivacyPage };
