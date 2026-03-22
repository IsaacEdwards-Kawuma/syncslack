-- Neon / PostgreSQL — run on startup (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  theme VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  owner_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members (user_id);

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'private')),
  description TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  participant_low UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  participant_high UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, participant_low, participant_high),
  CHECK (participant_low < participant_high)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels (id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations (id) ON DELETE CASCADE,
  thread_parent_id UUID REFERENCES messages (id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  reactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  attachment_url TEXT NOT NULL DEFAULT '',
  attachment_mime TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (channel_id IS NOT NULL AND conversation_id IS NULL)
    OR (channel_id IS NULL AND conversation_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_root ON messages (channel_id, created_at DESC)
  WHERE deleted_at IS NULL AND thread_parent_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (thread_parent_id, created_at);

-- ── Migrations / extended schema (idempotent) ─────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose VARCHAR(32) NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  workspace_id UUID REFERENCES workspaces (id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages (id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID NOT NULL REFERENCES users (id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces (id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users (id),
  action VARCHAR(80) NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_ws ON audit_log(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_mentions (
  message_id UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, mentioned_user_id)
);

CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_msg ON message_attachments(message_id);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'direct';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_workspace_id_participant_low_participant_high_key;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_participant_low_participant_high_check;

ALTER TABLE conversations ALTER COLUMN participant_low DROP NOT NULL;
ALTER TABLE conversations ALTER COLUMN participant_high DROP NOT NULL;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_check;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_kind_participants_check;

ALTER TABLE conversations ADD CONSTRAINT conversations_kind_participants_check CHECK (
  (kind = 'direct' AND participant_low IS NOT NULL AND participant_high IS NOT NULL AND participant_low < participant_high)
  OR (kind = 'group' AND participant_low IS NULL AND participant_high IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_direct_pair
  ON conversations (workspace_id, participant_low, participant_high)
  WHERE kind = 'direct' OR kind IS NULL;

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);

ALTER TABLE workspace_invites DROP CONSTRAINT IF EXISTS workspace_invites_role_check;
ALTER TABLE workspace_invites ADD CONSTRAINT workspace_invites_role_check CHECK (role IN ('admin', 'member'));

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- Extended features (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_text VARCHAR(140) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_emoji VARCHAR(32) NOT NULL DEFAULT '';

ALTER TABLE messages ADD COLUMN IF NOT EXISTS also_to_channel BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS pinned_messages (
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_pins_channel ON pinned_messages (channel_id);

CREATE TABLE IF NOT EXISTS saved_messages (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_messages (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS channel_notification_prefs (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (level IN ('all', 'mentions', 'mute')),
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS incoming_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  secret_token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incoming_webhooks_channel ON incoming_webhooks (channel_id);
