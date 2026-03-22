import StaticPageShell from '../components/StaticPageShell.jsx';

export default function HelpPage() {
  return (
    <StaticPageShell title="Help">
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sync Work — quick reference</p>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Workspaces</h2>
        <p>
          Create or join a workspace from the rail on the left. Each workspace has its own channels, direct messages, and
          members.
        </p>
      </section>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Channels &amp; DMs</h2>
        <p>
          Open a channel to post in the group. Use <strong>Direct messages</strong> for one-to-one chats or{' '}
          <strong>New group</strong> for small groups. Select a message to open a <strong>thread</strong> for replies.
        </p>
      </section>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Mentions</h2>
        <p>
          Click <strong>@</strong> next to the message box to pick someone, or type <code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm dark:bg-slate-700">@uuid</code> (with a valid user id) so they get a notification.
        </p>
      </section>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Search</h2>
        <p>
          Use the tabs in the header (<strong>messages</strong>, <strong>channels</strong>, <strong>people</strong>) to
          narrow what you search. Pick a result to jump to that channel or conversation.
        </p>
      </section>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Calls</h2>
        <p>
          <strong>Video</strong> and <strong>Voice</strong> open the same Jitsi Meet room for the current channel or DM.
          Voice starts with the camera off. A message with a join link is posted so others can follow from chat. In-meeting
          chat is available inside Jitsi.
        </p>
      </section>

      <section className="surface-card mt-8 space-y-3 p-5 text-slate-700 transition hover:shadow-soft-lg dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account</h2>
        <p>
          Open <strong>Profile</strong> or <strong>Settings</strong> from the sidebar (bottom) or the gear in the header.
          Change your password, theme, or leave workspace membership from Settings.
        </p>
      </section>
    </StaticPageShell>
  );
}
