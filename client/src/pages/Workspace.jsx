import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { api, getApiBaseUrl, getPublicAssetUrl, getToken } from '../lib/api.js';
import { readMessagePreviewInNotif } from '../lib/settingsPrefs.js';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [channels, setChannels] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [members, setMembers] = useState([]);

  const [channelId, setChannelId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [dmPeer, setDmPeer] = useState(null);
  const [groupConv, setGroupConv] = useState(null);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [presenceIds, setPresenceIds] = useState([]);
  const [showGroupDm, setShowGroupDm] = useState(false);
  const [groupSelected, setGroupSelected] = useState(() => new Set());
  const [groupTitle, setGroupTitle] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [searchTab, setSearchTab] = useState('messages');
  const [channelSearchResults, setChannelSearchResults] = useState([]);
  const [peopleSearchResults, setPeopleSearchResults] = useState([]);
  const [showCall, setShowCall] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [transferUserId, setTransferUserId] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addGroupPick, setAddGroupPick] = useState(() => new Set());
  const [showMention, setShowMention] = useState(false);

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

  const loadNotifications = useCallback(async () => {
    const { notifications: n } = await api('/notifications');
    setNotifications(n || []);
  }, []);

  useEffect(() => {
    refetchWorkspaces().catch(console.error);
  }, [refetchWorkspaces]);

  useEffect(() => {
    loadNotifications().catch(console.error);
  }, [loadNotifications]);

  useEffect(() => {
    const inv = searchParams.get('invite');
    if (!inv) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await api('/workspaces/join-invite', { method: 'POST', body: { token: inv } });
        if (!cancelled) await refetchWorkspaces();
      } catch (e) {
        console.error(e);
      }
      if (!cancelled) {
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev);
            n.delete('invite');
            return n;
          },
          { replace: true }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, refetchWorkspaces, setSearchParams]);

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
      setGroupConv(null);
      setMessages([]);
    })().catch(console.error);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !searchQ.trim()) {
      setSearchResults([]);
      setChannelSearchResults([]);
      setPeopleSearchResults([]);
      return;
    }
    const q = searchQ.trim();
    const t = setTimeout(() => {
      const enc = encodeURIComponent(q);
      if (searchTab === 'messages') {
        if (q.length < 2) {
          setSearchResults([]);
          return;
        }
        api(`/workspaces/${workspaceId}/search?q=${enc}&type=messages`)
          .then((d) => setSearchResults(d.results || []))
          .catch(console.error);
        return;
      }
      if (searchTab === 'channels') {
        api(`/workspaces/${workspaceId}/search?q=${enc}&type=channels`)
          .then((d) => setChannelSearchResults(d.results || []))
          .catch(console.error);
        return;
      }
      api(`/workspaces/${workspaceId}/search?q=${enc}&type=people`)
        .then((d) => setPeopleSearchResults(d.results || []))
        .catch(console.error);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ, workspaceId, searchTab]);

  useEffect(() => {
    if (!socket || !connected || !workspaceId) return undefined;
    socket.emit('join_presence', { workspaceId }, () => {});
    const onPresence = (p) => {
      if (p.workspaceId === workspaceId) setPresenceIds(p.userIds || []);
    };
    socket.on('presence', onPresence);
    return () => {
      socket.emit('leave_presence', { workspaceId });
      socket.off('presence', onPresence);
    };
  }, [socket, connected, workspaceId]);

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
      loadNotifications().catch(() => {});
      if (n.type === 'dm' || n.type === 'mention') {
        const showPreview = readMessagePreviewInNotif();
        const text =
          n.type === 'mention'
            ? showPreview
              ? `Mention: ${n.preview || ''}`
              : 'You were mentioned'
            : showPreview
              ? `New message: ${n.preview || ''}`
              : 'New message';
        setToast({ text });
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
  }, [socket, connected, channelId, conversationId, user.id, threadParent, loadNotifications]);

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
    if (!threadParent) {
      setThreadReplies([]);
      return;
    }
    if (channelId) {
      (async () => {
        const { replies } = await api(`/messages/channel/${channelId}/thread/${threadParent.id}`);
        setThreadReplies(replies);
      })().catch(console.error);
      return;
    }
    if (conversationId) {
      (async () => {
        const { replies } = await api(`/messages/conversation/${conversationId}/thread/${threadParent.id}`);
        setThreadReplies(replies);
      })().catch(console.error);
      return;
    }
    setThreadReplies([]);
  }, [threadParent, channelId, conversationId]);

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

  async function sendMessage(extraAttachments) {
    const text = input.trim();
    const attList = Array.isArray(extraAttachments) ? extraAttachments : [];
    const hasFile = attList.length > 0;
    if (!text && !hasFile) return;
    if (!socket) return;
    const payload = {
      content: text || (hasFile ? 'Attachment' : ''),
      attachments: attList,
    };
    if (channelId) {
      payload.channelId = channelId;
      if (threadParent) payload.threadParentId = threadParent.id;
    } else if (conversationId) {
      payload.conversationId = conversationId;
      if (threadParent) payload.threadParentId = threadParent.id;
    } else return;

    socket.emit('send_message', payload, (res) => {
      if (!res?.ok) console.error(res?.error);
    });
    setInput('');
    setShowMention(false);
    emitTyping(false);
  }

  async function onPickFile(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const token = getToken();
    const base = getApiBaseUrl();
    const attList = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
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
      attList.push({ url: data.url, mime: data.mime });
    }
    await sendMessage(attList);
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
    setGroupConv(null);
    const { conversations: convs } = await api(`/conversations/workspace/${workspaceId}/conversations`);
    setConversations(convs);
  }

  async function createGroupDm(e) {
    e.preventDefault();
    if (!workspaceId || groupSelected.size < 1) return;
    const memberIds = [...groupSelected];
    const { conversation } = await api(`/conversations/workspace/${workspaceId}/conversations/group`, {
      method: 'POST',
      body: { memberIds, title: groupTitle },
    });
    setShowGroupDm(false);
    setGroupSelected(new Set());
    setGroupTitle('');
    setChannelId(null);
    setConversationId(conversation.id);
    setGroupConv({ title: conversation.title, participants: conversation.participants });
    setDmPeer(null);
    const { conversations: convs } = await api(`/conversations/workspace/${workspaceId}/conversations`);
    setConversations(convs);
  }

  const myRole = useMemo(() => members.find((m) => m.id === user?.id)?.role, [members, user?.id]);
  const canManage = myRole === 'owner' || myRole === 'admin';

  const headerTitle =
    channelId && channels.find((c) => c.id === channelId)
      ? `# ${channels.find((c) => c.id === channelId).name}`
      : conversationId && groupConv
        ? groupConv.title || groupConv.participants?.map((p) => p.name).join(', ')
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
        <Link
          to="/settings"
          title="Settings"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-white/80 transition hover:bg-white/10"
        >
          ⚙️
        </Link>
        <button
          type="button"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-white/70 transition hover:bg-white/10 hover:text-white"
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

        <div className="relative border-b border-[#522653] px-2 py-2 dark:border-slate-700">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {['messages', 'channels', 'people'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                  searchTab === tab
                    ? 'bg-[#1164a3] text-white'
                    : 'bg-white/10 text-[#d1d2d3] hover:bg-white/15'
                }`}
                onClick={() => setSearchTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={
              searchTab === 'messages' ? 'Search messages…' : searchTab === 'channels' ? 'Channels…' : 'People…'
            }
            className="w-full rounded border border-[#522653] bg-black/20 px-2 py-1.5 text-xs text-[#d1d2d3] placeholder:text-[#b39fb3] focus:border-[#1164a3] focus:outline-none focus:ring-1 focus:ring-[#1164a3]"
          />
          {searchTab === 'messages' && searchResults.length > 0 && searchQ.trim().length >= 2 ? (
            <div className="absolute left-2 right-2 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded border border-[#522653] bg-[#350d36] p-2 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left text-[#d1d2d3] hover:bg-white/10"
                  onClick={() => {
                    (async () => {
                      if (r.channelId) {
                        setGroupConv(null);
                        setDmPeer(null);
                        setConversationId(null);
                        setChannelId(r.channelId);
                      } else if (r.conversationId && workspaceId) {
                        setChannelId(null);
                        const { conversations: convs } = await api(
                          `/conversations/workspace/${workspaceId}/conversations`
                        );
                        setConversations(convs);
                        const cv = convs.find((c) => c.id === r.conversationId);
                        if (cv) {
                          if (cv.kind === 'group') {
                            setGroupConv({ title: cv.title, participants: cv.participants });
                            setDmPeer(null);
                          } else {
                            setGroupConv(null);
                            setDmPeer(cv.otherUser);
                          }
                        }
                        setConversationId(r.conversationId);
                      }
                      setSearchQ('');
                      setSearchResults([]);
                    })().catch(console.error);
                  }}
                >
                  {r.channelName ? `#${r.channelName}` : r.conversationLabel || 'DM'} — {r.content?.slice(0, 80)}
                </button>
              ))}
            </div>
          ) : null}
          {searchTab === 'channels' && channelSearchResults.length > 0 && searchQ.trim().length >= 1 ? (
            <div className="absolute left-2 right-2 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded border border-[#522653] bg-[#350d36] p-2 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800">
              {channelSearchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left text-[#d1d2d3] hover:bg-white/10"
                  onClick={() => {
                    setGroupConv(null);
                    setDmPeer(null);
                    setConversationId(null);
                    setChannelId(r.id);
                    setSearchQ('');
                    setChannelSearchResults([]);
                  }}
                >
                  {r.type === 'private' ? '🔒 ' : '#'}
                  {r.name}
                </button>
              ))}
            </div>
          ) : null}
          {searchTab === 'people' && peopleSearchResults.length > 0 && searchQ.trim().length >= 1 ? (
            <div className="absolute left-2 right-2 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded border border-[#522653] bg-[#350d36] p-2 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800">
              {peopleSearchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left text-[#d1d2d3] hover:bg-white/10"
                  onClick={() => {
                    if (r.id === user.id) return;
                    openDm(r.id);
                    setSearchQ('');
                    setPeopleSearchResults([]);
                  }}
                >
                  {r.name} <span className="text-[#b39fb3]">{r.email}</span>
                </button>
              ))}
            </div>
          ) : null}
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
                setGroupConv(null);
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
                setThreadParent(null);
                if (cv.kind === 'group') {
                  setGroupConv({ title: cv.title, participants: cv.participants });
                  setDmPeer(null);
                } else {
                  setGroupConv(null);
                  setDmPeer(cv.otherUser);
                }
              }}
              className={`mt-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                conversationId === cv.id ? 'bg-[#1164a3] text-white' : 'hover:bg-white/10'
              }`}
            >
              {cv.kind === 'group' ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/20 text-xs font-bold">
                  G
                </span>
              ) : (
                <Avatar user={cv.otherUser} size={8} />
              )}
              <span className="truncate">
                {cv.kind === 'group' ? cv.title || cv.participants?.map((p) => p.name).join(', ') : cv.otherUser.name}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="mt-2 w-full rounded px-2 py-1 text-left text-sm text-[#b39fb3] hover:bg-white/10"
            onClick={() => setShowDm(true)}
          >
            + New DM
          </button>
          <button
            type="button"
            className="mt-1 w-full rounded px-2 py-1 text-left text-sm text-[#b39fb3] hover:bg-white/10"
            onClick={() => setShowGroupDm(true)}
          >
            + New group
          </button>
        </div>

        <div className="border-t border-[#522653] p-2 dark:border-slate-700">
          <div className="flex items-center gap-2 rounded bg-black/20 px-2 py-2">
            <Avatar user={user} size={8} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                <Link to="/profile" className="text-[#b39fb3] hover:underline">
                  Profile
                </Link>
                <Link to="/help" className="text-[#b39fb3] hover:underline">
                  Help
                </Link>
                <button type="button" className="text-[#b39fb3] hover:underline" onClick={logout}>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-900">
        <header className="relative flex h-14 shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-700">
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{headerTitle}</h1>
          {groupConv && conversationId ? (
            <button
              type="button"
              className="shrink-0 rounded px-2 py-1 text-xs text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-[#522653]/40"
              onClick={() => {
                setShowAddGroup(true);
                setAddGroupPick(new Set());
              }}
            >
              Add people
            </button>
          ) : null}
          {typingName ? <span className="text-sm text-slate-500">{typingName} is typing…</span> : null}
          {(channelId || conversationId) && workspaceId ? (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300"
              title="Video call (opens Jitsi)"
              onClick={() => setShowCall(true)}
            >
              Call
            </button>
          ) : null}
          <div className="relative">
            <button
              type="button"
              className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => {
                setShowNotif(!showNotif);
                if (!showNotif) loadNotifications().catch(() => {});
              }}
            >
              🔔 {notifications.filter((n) => !n.readAt).length || ''}
            </button>
            {showNotif ? (
              <div className="absolute right-0 top-10 z-50 max-h-72 w-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800">
                <button
                  type="button"
                  className="mb-2 text-violet-600 hover:underline"
                  onClick={() => api('/notifications/read-all', { method: 'PATCH' }).then(() => loadNotifications())}
                >
                  Mark all read
                </button>
                {notifications.length === 0 ? <p className="text-slate-500">No notifications</p> : null}
                {notifications.map((n) => (
                  <div key={n.id} className="border-b border-slate-100 py-2 dark:border-slate-700">
                    <div className="font-semibold">{n.title || n.type}</div>
                    <div className="text-slate-600 dark:text-slate-300">{n.body}</div>
                    {!n.readAt ? (
                      <button
                        type="button"
                        className="mt-1 text-violet-600 hover:underline"
                        onClick={() =>
                          api(`/notifications/${n.id}/read`, { method: 'PATCH' }).then(() => loadNotifications())
                        }
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {canManage ? (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => {
                setShowAdmin(true);
                setInviteUrl('');
                (async () => {
                  try {
                    const { audit } = await api(`/workspaces/${workspaceId}/audit`);
                    setAuditRows(audit || []);
                  } catch (e) {
                    console.error(e);
                    setAuditRows([]);
                  }
                })();
              }}
            >
              Admin
            </button>
          ) : null}
          {presenceIds.filter((id) => id !== user.id).length > 0 ? (
            <span className="hidden text-xs text-slate-500 sm:inline" title="Online in this workspace">
              {presenceIds.filter((id) => id !== user.id).length} online
            </span>
          ) : null}
          <div className="flex items-center gap-2 text-xs text-slate-500">
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
                    if (m.conversationId) setConversationId(m.conversationId);
                  }}
                />
              ))}
              <div ref={messagesEnd} />
            </div>

            <div className="border-t border-slate-200 p-4 dark:border-slate-700">
              <input ref={fileRef} type="file" multiple className="hidden" onChange={onPickFile} />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2 py-2 text-sm dark:border-slate-600"
                  onClick={() => fileRef.current?.click()}
                >
                  📎
                </button>
                <div className="relative flex min-w-0 flex-1 gap-1">
                  <button
                    type="button"
                    className="shrink-0 rounded border border-slate-200 px-2 py-2 text-sm dark:border-slate-600"
                    title="Mention someone"
                    disabled={!channelId && !conversationId}
                    onClick={() => setShowMention((v) => !v)}
                  >
                    @
                  </button>
                  {showMention && (channelId || conversationId) ? (
                    <div className="absolute bottom-full left-0 z-30 mb-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800">
                      {members
                        .filter((m) => m.id !== user.id)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="block w-full truncate px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                            onClick={() => {
                              const uid = String(m.id).toLowerCase();
                              setInput((prev) => `${prev}@${uid} `);
                              setShowMention(false);
                            }}
                          >
                            {m.name}
                          </button>
                        ))}
                    </div>
                  ) : null}
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
                      channelId || conversationId
                        ? `Message ${channelId ? 'the channel' : groupConv?.title || dmPeer?.name || 'group'} — @ inserts mention`
                        : 'Select a channel'
                    }
                    disabled={!channelId && !conversationId}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </div>
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

          {threadParent && (channelId || conversationId) ? (
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
                    const payload = { content: text, threadParentId: threadParent.id };
                    if (channelId) payload.channelId = channelId;
                    else if (conversationId) payload.conversationId = conversationId;
                    socket.emit('send_message', payload, () => {});
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

      {showGroupDm ? (
        <Modal title="New group conversation" onClose={() => setShowGroupDm(false)}>
          <form onSubmit={createGroupDm} className="space-y-3">
            <input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              placeholder="Group name (optional)"
            />
            <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {members
                .filter((m) => m.id !== user.id)
                .map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={groupSelected.has(m.id)}
                      onChange={() => {
                        setGroupSelected((prev) => {
                          const n = new Set(prev);
                          if (n.has(m.id)) n.delete(m.id);
                          else n.add(m.id);
                          return n;
                        });
                      }}
                    />
                    <Avatar user={m} size={8} />
                    {m.name}
                  </label>
                ))}
            </div>
            <button type="submit" className="w-full rounded bg-violet-700 py-2 text-white">
              Create group
            </button>
          </form>
        </Modal>
      ) : null}

      {showAdmin && workspaceId ? (
        <Modal title="Workspace admin" onClose={() => setShowAdmin(false)}>
          <div className="space-y-4 text-sm">
            <div>
              <button
                type="button"
                className="rounded bg-violet-700 px-3 py-1.5 text-white"
                onClick={async () => {
                  try {
                    const data = await api(`/workspaces/${workspaceId}/invites`, {
                      method: 'POST',
                      body: { role: 'member' },
                    });
                    setInviteUrl(data.inviteUrl || '');
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Create invite link
              </button>
              {inviteUrl ? (
                <p className="mt-2 break-all text-xs text-slate-600 dark:text-slate-300">{inviteUrl}</p>
              ) : null}
            </div>
            <div className="max-h-48 overflow-y-auto border-t border-slate-200 pt-2 dark:border-slate-600">
              <div className="font-semibold">Members</div>
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 py-1">
                  <span>
                    {m.name} <span className="text-slate-500">({m.role})</span>
                  </span>
                  {canManage && m.id !== user.id && m.role !== 'owner' ? (
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={async () => {
                        if (!confirm('Remove this member?')) return;
                        try {
                          await api(`/workspaces/${workspaceId}/members/${m.id}`, { method: 'DELETE' });
                          const { members: next } = await api(`/messages/workspace/${workspaceId}/members`);
                          setMembers(next);
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="max-h-40 overflow-y-auto border-t border-slate-200 pt-2 dark:border-slate-600">
              <div className="font-semibold">Audit log</div>
              {auditRows.length === 0 ? (
                <p className="text-slate-500">No entries</p>
              ) : (
                auditRows.map((row) => (
                  <div key={row.id} className="border-b border-slate-100 py-1 text-xs dark:border-slate-700">
                    <span className="text-slate-500">{formatTime(row.createdAt)}</span> {row.action}
                    {row.meta && Object.keys(row.meta).length ? ` ${JSON.stringify(row.meta)}` : ''}
                  </div>
                ))
              )}
            </div>
            {myRole === 'owner' ? (
              <div className="border-t border-slate-200 pt-2 dark:border-slate-600">
                <div className="font-semibold">Transfer ownership</div>
                <select
                  value={transferUserId}
                  onChange={(e) => setTransferUserId(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="">Select member…</option>
                  {members
                    .filter((m) => m.id !== user.id && m.role !== 'owner')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="mt-2 rounded bg-amber-700 px-3 py-1.5 text-white"
                  onClick={async () => {
                    if (!transferUserId || !confirm('Transfer ownership to this member?')) return;
                    try {
                      await api(`/workspaces/${workspaceId}/transfer`, {
                        method: 'POST',
                        body: { newOwnerUserId: transferUserId },
                      });
                      setTransferUserId('');
                      const { members: next } = await api(`/messages/workspace/${workspaceId}/members`);
                      setMembers(next);
                      const { audit: auditNext } = await api(`/workspaces/${workspaceId}/audit`);
                      setAuditRows(auditNext || []);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  Transfer
                </button>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {showCall && workspaceId ? (
        <Modal title="Video call" wide onClose={() => setShowCall(false)}>
          <p className="mb-2 text-xs text-slate-500">
            Opens a Jitsi room shared with this channel or conversation. Others can join with the same room name.
          </p>
          <iframe
            title="Jitsi call"
            src={`https://meet.jit.si/syncwork-${workspaceId}-${channelId || conversationId || 'lobby'}#config.prejoinPageEnabled=false`}
            className="h-[min(70vh,420px)] w-full rounded-lg border border-slate-200 bg-black dark:border-slate-600"
            allow="camera; microphone; display-capture; autoplay"
          />
        </Modal>
      ) : null}

      {showAddGroup && conversationId && groupConv ? (
        <Modal
          title="Add people to group"
          onClose={() => {
            setShowAddGroup(false);
            setAddGroupPick(new Set());
          }}
        >
          <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {members
              .filter((m) => !groupConv.participants?.some((p) => p.id === m.id))
              .map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={addGroupPick.has(m.id)}
                    onChange={() => {
                      setAddGroupPick((prev) => {
                        const n = new Set(prev);
                        if (n.has(m.id)) n.delete(m.id);
                        else n.add(m.id);
                        return n;
                      });
                    }}
                  />
                  <Avatar user={m} size={8} />
                  {m.name}
                </label>
              ))}
          </div>
          {members.filter((m) => !groupConv.participants?.some((p) => p.id === m.id)).length === 0 ? (
            <p className="text-sm text-slate-500">Everyone in the workspace is already in this group.</p>
          ) : null}
          <button
            type="button"
            className="mt-3 w-full rounded bg-violet-700 py-2 text-white"
            onClick={async () => {
              const userIds = [...addGroupPick];
              if (!userIds.length || !workspaceId) return;
              try {
                await api(`/conversations/conversation/${conversationId}/members`, {
                  method: 'POST',
                  body: { userIds },
                });
                const { conversations: convs } = await api(`/conversations/workspace/${workspaceId}/conversations`);
                setConversations(convs);
                const cv = convs.find((c) => c.id === conversationId);
                if (cv) setGroupConv({ title: cv.title, participants: cv.participants });
                setShowAddGroup(false);
                setAddGroupPick(new Set());
              } catch (e) {
                console.error(e);
              }
            }}
          >
            Add to group
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`w-full ${wide ? 'max-w-4xl' : 'max-w-md'} rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800`}
      >
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
          <div className="mt-0.5 max-w-none break-words text-sm [&_a]:text-violet-600 [&_code]:rounded [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800">
            {message.deletedAt ? (
              <span className="italic text-slate-400">{message.content}</span>
            ) : (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            )}
          </div>
        )}
        {(message.attachments?.length
          ? message.attachments
          : message.attachmentUrl
            ? [{ url: message.attachmentUrl, mime: message.attachmentMime }]
            : []
        ).map((a, i) => (
          <div key={a.id || i} className="mt-2">
            {a.mime?.startsWith('image/') ? (
              <img src={getPublicAssetUrl(a.url)} alt="" className="max-h-48 rounded border border-slate-200" />
            ) : (
              <a href={getPublicAssetUrl(a.url)} className="text-violet-600 underline" target="_blank" rel="noreferrer">
                Download attachment
              </a>
            )}
          </div>
        ))}
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
          {(message.channelId || message.conversationId) && !message.threadParentId ? (
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
