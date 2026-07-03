import { LegalLayout } from "../components/LegalLayout";

const LAST_UPDATED = "February 17, 2026";
const CONTACT_EMAIL = "kitetriviaapp@gmail.com";

/**
 * Public route: /terms
 * Kite Terms of Service — covers subscriptions (monthly/yearly/lifetime),
 * Apple/Google cancellation flows, acceptable use, IP, and liability.
 */
export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The gentle agreement between you and Kite."
      lastUpdated={LAST_UPDATED}
    >
      <p>
        Welcome to Kite. By creating an account or using the Kite app on any
        platform, you agree to these Terms of Service (&ldquo;Terms&rdquo;).
        Please read them — they cover important information about your
        account, subscriptions, and our shared rules for keeping Kite kind
        and playable.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Kite is a family-friendly trivia app operated by the makers of Kite
        (&ldquo;Kite&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). If you have
        questions about these Terms, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Your account</h2>
      <p>
        To play Kite you create an account with an email address and
        password, or sign in with Google. You are responsible for keeping
        your credentials safe and for activity that happens under your
        account. If you notice unauthorised access, please email us
        promptly. You must be at least 13 years old (or the age of digital
        consent in your country) to create an account, or use Kite with
        the consent and supervision of a parent or guardian.
      </p>

      <h2>3. The free experience</h2>
      <p>
        Anyone with a Kite account can play a limited number of rounds each
        day at no cost, and can progress through XP, levels, milestones,
        streaks, and the standard shop items unlocked by levelling up. The
        free experience is complete on its own — nothing in the game is
        strictly required to be purchased to keep playing.
      </p>

      <h2>4. Subscriptions — the full experience</h2>
      <p>
        Kite offers an optional paid subscription (the &ldquo;full
        experience&rdquo;) that removes the daily round limit and unlocks
        every currently available and future kite, companion, sky theme,
        and premium feature. The full experience is available in three
        forms:
      </p>
      <ul>
        <li>
          <strong>Monthly</strong> — an auto-renewing subscription billed
          monthly at the price shown in the App Store or Google Play at the
          time of purchase.
        </li>
        <li>
          <strong>Yearly</strong> — an auto-renewing subscription billed
          yearly at the price shown in the App Store or Google Play at the
          time of purchase.
        </li>
        <li>
          <strong>Lifetime</strong> — a one-time purchase that unlocks the
          full experience for the lifetime of your account on the Kite
          service, with no renewal.
        </li>
      </ul>

      <h3>4.1 Renewals</h3>
      <p>
        Auto-renewing subscriptions (monthly and yearly) will automatically
        renew for the same duration at the then-current price until you
        cancel. Renewal charges are collected by Apple or Google 24 hours
        before the current period ends.
      </p>

      <h3>4.2 Cancelling a subscription</h3>
      <p>
        You can cancel an auto-renewing subscription at any time, and the
        subscription will remain active through the end of the current
        billing period. Cancellation happens through the store that
        collected your payment — Kite does not itself process the
        cancellation:
      </p>
      <ul>
        <li>
          <strong>Apple App Store (iOS):</strong> Settings → your Apple ID →
          Subscriptions → Kite → Cancel Subscription.
        </li>
        <li>
          <strong>Google Play (Android):</strong> Google Play app → Menu →
          Subscriptions → Kite → Cancel.
        </li>
      </ul>
      <p>
        You can also open the in-app Customer Center from the Sparkle icon
        in the Kite header for shortcuts to your store&rsquo;s subscription
        page and to request help.
      </p>

      <h3>4.3 Refunds</h3>
      <p>
        All purchases are processed by Apple or Google. Refund requests are
        handled by those stores under their own policies. Kite is not able
        to issue refunds directly for App Store or Google Play purchases,
        but we will do our best to help — please email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you
        believe you were charged in error.
      </p>

      <h3>4.4 Free trials and introductory offers</h3>
      <p>
        If Kite offers a free trial or introductory price, it will be
        clearly labelled at the moment of purchase. Unless you cancel
        before the end of the trial or introductory period, the
        subscription automatically converts to the regular price.
      </p>

      <h3>4.5 Restore purchases</h3>
      <p>
        If you reinstall Kite or move to a new device, you can restore any
        active subscription or lifetime purchase from within the paywall.
        Restoration is tied to the Apple ID or Google account that made the
        original purchase.
      </p>

      <h3>4.6 Web purchases</h3>
      <p>
        Where Kite offers browser-based purchases, they are processed by
        Stripe, Inc., and are subject to the same non-refund policy in
        section 4.3 unless required by law.
      </p>

      <h2>5. Acceptable use</h2>
      <p>Kite is a calm place. Please don&rsquo;t use it to:</p>
      <ul>
        <li>Harass, threaten, or harm any person, including our team.</li>
        <li>
          Attempt to access another player&rsquo;s account, or interfere with
          the operation of our servers.
        </li>
        <li>
          Reverse-engineer, scrape, or systematically extract questions,
          artwork, or other content from the app for commercial reuse.
        </li>
        <li>
          Cheat, use automated tools, exploit bugs to gain unearned
          progression, or manipulate the leaderboards.
        </li>
        <li>
          Impersonate others, submit misleading account information, or
          create multiple accounts to evade limits, bans, or restrictions.
        </li>
      </ul>
      <p>
        We may suspend or terminate accounts that materially violate these
        rules, with or without notice, and may refuse to allow further
        access.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        Kite&rsquo;s name, logo, artwork, sound design, question wording,
        code, and everything else in the app is owned by Kite or its
        licensors and is protected by copyright and other intellectual
        property laws. You get a personal, non-exclusive, non-transferable
        licence to use the app on devices you own, for non-commercial
        enjoyment. That licence lasts as long as you comply with these
        Terms.
      </p>
      <p>
        Your gameplay data (level, milestones, owned items) is yours — we
        act as custodians of it, and you can request export or deletion at
        any time as described in our Privacy Policy.
      </p>

      <h2>7. Changes to the service</h2>
      <p>
        Kite is a living app. We may add, change, or retire features from
        time to time, and we may adjust pricing for new subscribers. If a
        material change would negatively affect an existing paid
        subscriber&rsquo;s current billing period, we will provide notice
        and, where required, a way to cancel or receive a pro-rated remedy.
      </p>

      <h2>8. Termination</h2>
      <p>
        You can stop using Kite at any time. To delete your account, email
        us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        We may also suspend or terminate your account for material
        violations of these Terms. Termination does not entitle you to a
        refund of periods already paid; it does stop future renewals.
      </p>

      <h2>9. Disclaimer of warranties</h2>
      <p>
        Kite is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;.
        To the maximum extent permitted by law, we disclaim all warranties,
        express or implied, including fitness for a particular purpose,
        merchantability, uninterrupted availability, and non-infringement.
        We do not guarantee that the app will always be error-free or that
        your data will never be lost.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, in no event will Kite, its
        team, or its licensors be liable for any indirect, incidental,
        special, consequential, or punitive damages, or any loss of profits
        or revenues, whether incurred directly or indirectly, or any loss
        of data, use, goodwill, or other intangible losses, arising out of
        or in connection with your use of the app. Our total liability for
        any claim arising from these Terms or the app is limited to the
        greater of (a) the amount you paid us in the twelve months
        preceding the claim, or (b) fifty US dollars.
      </p>
      <p>
        Some jurisdictions do not allow the exclusion of certain warranties
        or the limitation of certain damages. In those jurisdictions, our
        liability is limited to the smallest amount permitted by law.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You agree to indemnify and hold Kite harmless from any claim or
        demand made by any third party due to your violation of these
        Terms or your misuse of the app, including reasonable attorneys&rsquo;
        fees.
      </p>

      <h2>12. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which
        Kite is established, without regard to conflict-of-laws principles.
        Any dispute arising from these Terms or the app that is not
        resolved informally will be handled in the courts of that
        jurisdiction, except where a mandatory consumer-protection law of
        your country gives you the right to bring a claim locally.
      </p>

      <h2>13. Third-party terms</h2>
      <p>
        Purchases made through the Apple App Store are also governed by
        Apple&rsquo;s{" "}
        <a href="https://www.apple.com/legal/internet-services/itunes/" target="_blank" rel="noopener noreferrer">
          Media Services Terms
        </a>
        . Purchases made through Google Play are governed by the{" "}
        <a href="https://play.google.com/about/play-terms/" target="_blank" rel="noopener noreferrer">
          Google Play Terms of Service
        </a>
        . RevenueCat provides the subscription infrastructure under its own
        terms available at{" "}
        <a href="https://www.revenuecat.com/terms" target="_blank" rel="noopener noreferrer">
          revenuecat.com/terms
        </a>
        .
      </p>

      <h2>14. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. If we make material
        changes we will notify you within the app or by email at least 14
        days before the changes take effect. Continued use of Kite after
        that date means you accept the updated Terms.
      </p>

      <h2>15. Contact</h2>
      <p>
        Say hi at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        We&rsquo;re a small team and we love hearing from players.
      </p>
    </LegalLayout>
  );
}

export { TermsPage };
