import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { api, getApiBaseUrl, getPublicAssetUrl, getToken } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀'];

function formatTime(d) {
  if (!d) return '';
  const x = new Date(d);
  return x.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Workspace() {
  const { user, logout, setTheme } = useAuth();
  const { socket, connected } = useSocket();

  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [channels, setChannels] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [members, setMembers] = useState([]);

  const [channelId, setChannelId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [dmPeer, setDmPeer] = useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingName, setTypingName] = useState(null);
  const typingTimer = useRef(null);

  const [threadParent, setThreadParent] = useState(null);
  const [threadReplies, setThreadReplies] = useState([]);

  const [toast, setToast] = useState(null);

  const [showCreateWs, setShowCreateWs] = useState(false);
  const [showJoinWs, setShowJoinWs] = useState(false);
  const [showCreateCh, setShowCreateCh] = useState(false);
  const [showDm, setShowDm] = useState(false);

  const [newWsName, setNewWsName] = useState('');
  const [joinSlug, setJoinSlug] = useState('');
  const [newChName, setNewChName] = useState('');
  const [newChType, setNewChType] = useState('public');

  const messagesEnd = useRef(null);
  const fileRef = useRef(null);

  const refetchWorkspaces = useCallback(async () => {
    const { workspaces: list } = await api('/workspaces');
    setWorkspaces(list);
    setWorkspaceId((prev) => prev || list[0]?.id || null);
  }, []);

  useEffect(() => {
    refetchWorkspaces().catch(console.error);
  }, [refetchWorkspaces]);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      const [ch, conv, mem] = await Promise.all([
        api(`/channels/workspace/${workspaceId}/channels`),
        api(`/conversations/workspace/${workspaceId}/conversations`),
        api(`/messages/workspace/${workspaceId}/members`),
      ]);
      setChannels(ch.channels);
      setConversations(conv.conversations);
      setMembers(mem.members);
      setChannelId(null);
      setConversationId(null);
      setDmPeer(null);
      setMessages([]);
    })().catch(console.error);
  }, [workspaceId]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId),
    [workspaces, workspaceId]
  );

  useEffect(() => {
    if (!socket || !connected) return undefined;
    const onRecv = (msg) => {
      if (msg.threadParentId) {
        setThreadReplies((prev) => {
          if (threadParent && threadParent.id === msg.threadParentId) return [...prev, msg];
          return prev;
        });
        return;
      }
      if (msg.channelId && msg.channelId === channelId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      if (msg.conversationId && msg.conversationId === conversationId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
    };
    const onUpd = (msg) => {
      const patch = (list) => list.map((m) => (m.id === msg.id ? msg : m));
      setMessages(patch);
      setThreadReplies(patch);
    };
    const onTyping = (p) => {
      if (p.channelId && p.channelId === channelId && p.userId !== user.id) {
        setTypingName(p.isTyping ? 'Someone' : null);
        if (p.isTyping) {
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingName(null), 3000);
        }
      }
      if (p.conversationId && p.conversationId === conversationId && p.userId !== user.id) {
        setTypingName(p.isTyping ? 'Someone' : null);
        if (p.isTyping) {
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingName(null), 3000);
        }
      }
    };
    const onNotify = (n) => {
      if (n.type === 'dm') {
        setToast({ text: `New message: ${n.preview || ''}` });
        setTimeout(() => setToast(null), 4000);
      }
    };
    socket.on('receive_message', onRecv);
    socket.on('message_updated', onUpd);
    socket.on('typing', onTyping);
    socket.on('notification', onNotify);
    return () => {
      socket.off('receive_message', onRecv);
      socket.off('message_updated', onUpd);
      socket.off('typing', onTyping);
      socket.off('notification', onNotify);
    };
  }, [socket, connected, channelId, conversationId, user.id, threadParent]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, threadReplies]);

  useEffect(() => {
    if (!socket || !connected || !channelId) return undefined;
    socket.emit('join_channel', { channelId }, () => {});
    return () => socket.emit('leave_channel', { channelId });
  }, [socket, connected, channelId]);

  useEffect(() => {
    if (!socket || !connected || !conversationId) return undefined;
    socket.emit('join_conversation', { conversationId }, () => {});
    return () => socket.emit('leave_conversation', { conversationId });
  }, [socket, connected, conversationId]);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { messages: list } = await api(`/messages/channel/${channelId}/messages`);
      setMessages(list);
    })().catch(console.error);
  }, [channelId]);

  useEffect(() => {
    if (!conversationId) {
      if (!channelId) setMessages([]);
      return;
    }
    (async () => {
      const { messages: list } = await api(`/messages/conversation/${conversationId}/messages`);
      setMessages(list);
    })().catch(console.error);
  }, [conversationId, channelId]);

  useEffect(() => {
    if (!threadParent || !channelId) {
      setThreadReplies([]);
      return;
    }
    (async () => {
      const { replies } = await api(`/messages/channel/${channelId}/thread/${threadParent.id}`);
      setThreadReplies(replies);
    })().catch(console.error);
  }, [threadParent, channelId]);

  function emitTyping(isTyping) {
    if (!socket) return;
    if (channelId) socket.emit('typing', { channelId, isTyping });
    else if (conversationId) socket.emit('typing', { conversationId, isTyping });
  }

  function onInputChange(e) {
    setInput(e.target.value);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 800);
  }

  async function sendMessage(attachmentUrl, attachmentMime) {
    const text = input.trim();
    if (!text && !attachmentUrl) return;
    if (!socket) return;
    const payload = {
      content: text,
      attachmentUrl: attachmentUrl || '',
      attachmentMime: attachmentMime || '',
    };
    if (channelId) {
      payload.channelId = channelId;
      if (threadParent) payload.threadParentId = threadParent.id;
    } else if (conversationId) {
      payload.conversationId = conversationId;
    } else return;

    socket.emit('send_message', payload, (res) => {
      if (!res?.ok) console.error(res?.error);
    });
    setInput('');
    emitTyping(false);
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Upload failed');
      return;
    }
    await sendMessage(data.url, data.mime);
  }

  async function onReaction(msg, emoji) {
    try {
      await api(`/messages/${msg.id}/reactions`, { method: 'POST', body: { emoji } });
    } catch (e) {
      console.error(e);
    }
  }

  async function createWorkspace(e) {
    e.preventDefault();
    const { workspace } = await api('/workspaces', { method: 'POST', body: { name: newWsName } });
    setShowCreateWs(false);
    setNewWsName('');
    await refetchWorkspaces();
    setWorkspaceId(workspace.id);
  }

  async function joinWorkspace(e) {
    e.preventDefault();
    const { workspace } = await api('/workspaces/join', { method: 'POST', body: { slug: joinSlug } });
    setShowJoinWs(false);
    setJoinSlug('');
    await refetchWorkspaces();
    setWorkspaceId(workspace.id);
  }

  async function createChannel(e) {
    e.preventDefault();
    if (!workspaceId) return;
    await api(`/channels/workspace/${workspaceId}/channels`, {
      method: 'POST',
      body: { name: newChName, type: newChType },
    });
    setShowCreateCh(false);
    setNewChName('');
    const { channels: next } = await api(`/channels/workspace/${workspaceId}/channels`);
    setChannels(next);
  }

  async function openDm(peerId) {
    if (!workspaceId) return;
    const { conversation } = await api(`/conversations/workspace/${workspaceId}/conversations`, {
      method: 'POST',
      body: { otherUserId: peerId },
    });
    setShowDm(false);
    setChannelId(null);
    setConversationId(conversation.id);
    setDmPeer(conversation.otherUser);
    const { conversations: convs } = await api(`/conversations/workspace/${workspaceId}/conversations`);
    setConversations(convs);
  }

  const headerTitle =
    channelId && channels.find((c) => c.id === channelId)
      ? `# ${channels.find((c) => c.id === channelId).name}`
      : conversationId && dmPeer
        ? dmPeer.name
        : 'Select a channel or person';

  const dark = user?.theme === 'dark';

  if (!workspaces.length) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-slate-50 p-8 dark:bg-slate-900">
        <p className="text-lg text-slate-600 dark:text-slate-300">Create or join a workspace to get started.</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white"
            onClick={() => setShowCreateWs(true)}
          >
            Create workspace
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold dark:border-slate-600"
            onClick={() => setShowJoinWs(true)}
          >
            Join workspace
          </button>
        </div>
        <button type="button" className="text-sm text-slate-500 underline" onClick={logout}>
          Sign out
        </button>
        {showCreateWs ? (
          <Modal title="Create workspace" onClose={() => setShowCreateWs(false)}>
            <form onSubmit={createWorkspace} className="space-y-3">
              <input
                required
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                placeholder="Workspace name"
              />
              <button type="submit" className="w-full rounded bg-violet-700 py-2 text-white">
                Create
              </button>
            </form>
          </Modal>
        ) : null}
        {showJoinWs ? (
          <Modal title="Join workspace by slug" onClose={() => setShowJoinWs(false)}>
            <form onSubmit={joinWorkspace} className="space-y-3">
              <input
                required
                value={joinSlug}
                onChange={(e) => setJoinSlug(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                placeholder="e.g. acme-corp"
              />
              <button type="submit" className="w-full rounded bg-violet-700 py-2 text-white">
                Join
              </button>
            </form>
          </Modal>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Workspace rail */}
      <aside className="flex w-16 flex-col items-center gap-2 border-r border-[#522653] bg-[#3f0e40] py-3 dark:border-slate-700">
        {workspaces.map((w) => (
          <button
            key={w.id}
            type="button"
            title={w.name}
            onClick={() => setWorkspaceId(w.id)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white transition ${
              workspaceId === w.id ? 'bg-white/20 ring-2 ring-white/40' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {w.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          title="Add workspace"
          onClick={() => setShowCreateWs(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-white/40 text-lg text-white/80 hover:bg-white/10"
        >
          +
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className="text-xs text-white/70 hover:text-white"
          title="Toggle theme"
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </aside>

      {/* Channels + DMs */}
      <aside className="flex w-64 flex-col border-r border-[#522653] bg-[#3f0e40] text-[#d1d2d3] dark:border-slate-700 dark:bg-slate-950">
        <div className="border-b border-[#522653] px-3 py-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate font-bold text-white">{activeWorkspace?.name || 'Workspace'}</div>
            <button
              type="button"
              className="text-xs text-[#b39fb3] hover:text-white"
              onClick={() => setShowJoinWs(true)}
            >
              Join
            </button>
          </div>
          <div className="mt-1 truncate text-xs text-[#b39fb3]">{user?.email}</div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="px-2 text-xs font-semibold uppercase tracking-wide text-[#b39fb3]">Channels</div>
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setConversationId(null);
                setDmPeer(null);
                setChannelId(c.id);
                setThreadParent(null);
              }}
              className={`mt-0.5 flex w-full items-center rounded px-2 py-1.5 text-left text-sm ${
                channelId === c.id ? 'bg-[#1164a3] text-white' : 'hover:bg-white/10'
              }`}
            >
              {c.type === 'private' ? '🔒' : '#'} {c.name}
            </button>
          ))}
          <button
            type="button"
            className="mt-2 w-full rounded px-2 py-1 text-left text-sm text-[#b39fb3] hover:bg-white/10"
            onClick={() => setShowCreateCh(true)}
          >
            + Add channel
          </button>

          <div className="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-[#b39fb3]">
            Direct messages
          </div>
          {conversations.map((cv) => (
            <button
              key={cv.id}
              type="button"
              onClick={() => {
                setChannelId(null);
                setConversationId(cv.id);
                setDmPeer(cv.otherUser);
                setThreadParent(null);
              }}
              className={`mt-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                conversationId === cv.id ? 'bg-[#1164a3] text-white' : 'hover:bg-white/10'
              }`}
            >
              <Avatar user={cv.otherUser} size={8} />
              <span className="truncate">{cv.otherUser.name}</span>
            </button>
          ))}
          <button
            type="button"
            className="mt-2 w-full rounded px-2 py-1 text-left text-sm text-[#b39fb3] hover:bg-white/10"
            onClick={() => setShowDm(true)}
          >
            + New DM
          </button>
        </div>

        <div className="border-t border-[#522653] p-2 dark:border-slate-700">
          <div className="flex items-center gap-2 rounded bg-black/20 px-2 py-2">
            <Avatar user={user} size={8} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
              <button type="button" className="text-xs text-[#b39fb3] hover:underline" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-900">
        <header className="flex h-14 shrink-0 items-center border-b border-slate-200 px-4 dark:border-slate-700">
          <h1 className="truncate text-lg font-bold">{headerTitle}</h1>
          {typingName ? <span className="ml-3 text-sm text-slate-500">{typingName} is typing…</span> : null}
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            {connected ? (
              <span className="text-emerald-600">● Live</span>
            ) : (
              <span className="text-amber-600">Reconnecting…</span>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {messages.map((m) => (
                <MessageBlock
                  key={m.id}
                  message={m}
                  selfId={user.id}
                  onReaction={onReaction}
                  onThread={() => {
                    setThreadParent(m);
                    if (m.channelId) setChannelId(m.channelId);
                  }}
                />
              ))}
              <div ref={messagesEnd} />
            </div>

            <div className="border-t border-slate-200 p-4 dark:border-slate-700">
              <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2 py-2 text-sm dark:border-slate-600"
                  onClick={() => fileRef.current?.click()}
                >
                  📎
                </button>
                <input
                  value={input}
                  onChange={onInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    channelId || conversationId ? `Message ${channelId ? 'the channel' : dmPeer?.name || ''}` : 'Select a channel'
                  }
                  disabled={!channelId && !conversationId}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!channelId && !conversationId}
                  className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {threadParent && channelId ? (
            <aside className="w-80 shrink-0 border-l border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                <span className="text-sm font-semibold">Thread</span>
                <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => setThreadParent(null)}>
                  ✕
                </button>
              </div>
              <div className="max-h-[40vh] space-y-2 overflow-y-auto px-3 py-2">
                {threadReplies.map((m) => (
                  <MessageBlock
                    key={m.id}
                    message={m}
                    selfId={user.id}
                    onReaction={onReaction}
                    onThread={() => {}}
                    compact
                  />
                ))}
              </div>
              <div className="border-t border-slate-200 p-2 dark:border-slate-700">
                <input
                  className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                  placeholder="Reply…"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const text = e.currentTarget.value.trim();
                    if (!text || !socket) return;
                    socket.emit(
                      'send_message',
                      { channelId, content: text, threadParentId: threadParent.id },
                      () => {}
                    );
                    e.currentTarget.value = '';
                  }}
                />
              </div>
            </aside>
          ) : null}
        </div>
      </main>

      {toast ? (
        <div className="fixed bottom-6 right-6 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast.text}
        </div>
      ) : null}

      {showCreateWs ? (
        <Modal title="Create workspace" onClose={() => setShowCreateWs(false)}>
          <form onSubmit={createWorkspace} className="space-y-3">
            <input
              required
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              placeholder="Workspace name"
            />
            <button type="submit" className="w-full rounded bg-violet-700 py-2 text-white">
              Create
            </button>
          </form>
        </Modal>
      ) : null}

      {showJoinWs ? (
        <Modal title="Join workspace by slug" onClose={() => setShowJoinWs(false)}>
          <form onSubmit={joinWorkspace} className="space-y-3">
            <input
              required
              value={joinSlug}
              onChange={(e) => setJoinSlug(e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              placeholder="e.g. acme-corp"
            />
            <button type="submit" className="w-full rounded bg-violet-700 py-2 text-white">
              Join
            </button>
          </form>
        </Modal>
      ) : null}

      {showCreateCh ? (
        <Modal title="Create channel" onClose={() => setShowCreateCh(false)}>
          <form onSubmit={createChannel} className="space-y-3">
            <input
              required
              value={newChName}
              onChange={(e) => setNewChName(e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              placeholder="channel-name"
            />
            <select
              value={newChType}
              onChange={(e) => setNewChType(e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <button type="submit" className="w-full rounded bg-violet-700 py-2 text-white">
              Create
            </button>
          </form>
        </Modal>
      ) : null}

      {showDm ? (
        <Modal title="Start a direct message" onClose={() => setShowDm(false)}>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {members
              .filter((m) => m.id !== user.id)
              .map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => openDm(m.id)}
                  >
                    <Avatar user={m} size={8} />
                    <span>{m.name}</span>
                  </button>
                </li>
              ))}
          </ul>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MessageBlock({ message, selfId, onReaction, onThread, compact }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  async function saveEdit() {
    try {
      await api(`/messages/${message.id}`, { method: 'PATCH', body: { content: draft } });
      setEditing(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function remove() {
    if (!confirm('Delete this message?')) return;
    try {
      await api(`/messages/${message.id}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
  }

  const mine = message.senderId === selfId;

  return (
    <div className={`group flex gap-3 rounded-lg px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/80 ${compact ? 'text-sm' : ''}`}>
      <Avatar user={message.sender} size={compact ? 8 : 9} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-bold">{message.sender?.name || 'Unknown'}</span>
          <span className="text-xs text-slate-500">{formatTime(message.createdAt)}</span>
          {message.editedAt ? <span className="text-xs text-slate-400">(edited)</span> : null}
        </div>
        {editing ? (
          <div className="mt-1 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <button type="button" className="text-sm text-violet-600" onClick={saveEdit}>
              Save
            </button>
            <button type="button" className="text-sm text-slate-500" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-0.5 whitespace-pre-wrap break-words text-sm">
            {message.deletedAt ? <span className="italic text-slate-400">{message.content}</span> : message.content}
          </div>
        )}
        {message.attachmentUrl ? (
          <div className="mt-2">
            {message.attachmentMime?.startsWith('image/') ? (
              <img src={getPublicAssetUrl(message.attachmentUrl)} alt="" className="max-h-48 rounded border border-slate-200" />
            ) : (
              <a href={getPublicAssetUrl(message.attachmentUrl)} className="text-violet-600 underline" target="_blank" rel="noreferrer">
                Download attachment
              </a>
            )}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1 opacity-0 transition group-hover:opacity-100">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-700"
              onClick={() => onReaction(message, em)}
            >
              {em}
            </button>
          ))}
          {message.channelId && !message.threadParentId ? (
            <button type="button" className="text-xs text-violet-600 hover:underline" onClick={onThread}>
              Thread
            </button>
          ) : null}
          {mine && !message.deletedAt ? (
            <>
              <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button type="button" className="text-xs text-red-600 hover:underline" onClick={remove}>
                Delete
              </button>
            </>
          ) : null}
        </div>
        {message.reactions?.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReaction(message, r.emoji)}
                className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-700"
              >
                {r.emoji} {r.userIds?.length || 0}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
