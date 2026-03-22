import StaticPageShell from '../components/StaticPageShell.jsx';

export default function PrivacyPage() {
  return (
    <StaticPageShell title="Privacy">
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">How Sync Work handles your data</p>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">What we collect</h2>
        <p>
          Your account includes an email address, name, and optional profile image. We store messages, files you upload,
          workspace membership, and usage needed to run the service (for example notifications and audit logs where
          enabled).
        </p>
      </section>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Who can see your data</h2>
        <p>
          Messages in a channel are visible to members of that workspace. Direct and group messages are visible to
          participants. Workspace owners and admins may manage membership and certain workspace settings.
        </p>
      </section>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Hosting &amp; security</h2>
        <p>
          Data is stored on infrastructure you choose when deploying the app (for example your hosting provider’s
          database). Use HTTPS in production and keep your server and environment secrets secure.
        </p>
      </section>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your choices</h2>
        <p>
          You can change your password and sign out from your device. You can leave a workspace from Settings when you are
          not the owner (owners must transfer ownership first). Contact your workspace administrator for account or data
          requests.
        </p>
      </section>

      <p className="mt-10 text-xs text-slate-500 dark:text-slate-500">
        This summary is for transparency. It is not legal advice. Adapt this page for your organization and jurisdiction.
      </p>
    </StaticPageShell>
  );
}
