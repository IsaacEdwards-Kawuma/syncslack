import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { api, getApiBaseUrl, getPublicAssetUrl, getToken } from '../lib/api.js';
import { readMessagePreviewInNotif } from '../lib/settingsPrefs.js';
import Avatar from '../components/Avatar.jsx';
import { getMentionContext, mentionsToMarkdownLinks } from '../utils/mentions.js';
import { applySlashExpansion } from '../utils/slashCommands.js';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀'];

function formatTime(d) {
  if (!d) return '';
  const x = new Date(d);
  return x.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function dayKey(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}

function formatDayLabel(d) {
  if (!d) return '';
  const t = new Date(d);
  const start = (x) => {
    const n = new Date(x);
    n.setHours(0, 0, 0, 0);
    return n;
  };
  const today = start(Date.now());
  const td = start(t);
  const diffDays = Math.round((today - td) / 864e5);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return t.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: t.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function withinMinutes(a, b, mins) {
  if (!a || !b) return false;
  return Math.abs(new Date(a) - new Date(b)) / 60000 <= mins;
}

function DayDivider({ label }) {
  return (
    <div className="relative my-6 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center px-4">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-600" />
      </div>
      <span className="relative rounded-full border border-slate-200/80 bg-white/95 px-3 py-1 text-xs sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 shadow-sm backdrop-blur-sm dark:border-slate-600/80 dark:bg-slate-900/95 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
}

export default function Workspace() {
  const { user, logout, setTheme } = useAuth();
  const { socket, connected } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

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
  /** null | 'video' | 'audio' — Jitsi call modal */
  const [callMode, setCallMode] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [transferUserId, setTransferUserId] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addGroupPick, setAddGroupPick] = useState(() => new Set());
  const [showMention, setShowMention] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [channelNotifLevel, setChannelNotifLevel] = useState('all');
  const [searchFromUserId, setSearchFromUserId] = useState('');
  const [threadAlsoToChannel, setThreadAlsoToChannel] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedList, setSavedList] = useState([]);
  const [unreadChannels, setUnreadChannels] = useState(() => new Set());
  const [unreadConversations, setUnreadConversations] = useState(() => new Set());
  const [showThreadsModal, setShowThreadsModal] = useState(false);
  const [threadsInbox, setThreadsInbox] = useState([]);
  const [threadsUnreadCount, setThreadsUnreadCount] = useState(0);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [priorityTasks, setPriorityTasks] = useState([]);
  const [searchScope, setSearchScope] = useState('');
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');
  const [searchInFiles, setSearchInFiles] = useState(true);
  const [pendingMessageScroll, setPendingMessageScroll] = useState(null);
  const [composerDrag, setComposerDrag] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingName, setTypingName] = useState(null);
  const typingTimer = useRef(null);

  const [threadParent, setThreadParent] = useState(null);
  const [threadReplies, setThreadReplies] = useState([]);
  const threadParentRef = useRef(null);

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
  const messagesScrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const fileRef = useRef(null);
  const skipNextMessageFetchRef = useRef(false);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const notifDebounceRef = useRef(null);
  const lastVisibilityRefetchAt = useRef(0);

  const refetchWorkspaces = useCallback(async () => {
    const { workspaces: list } = await api('/workspaces');
    setWorkspaces(list);
    setWorkspaceId((prev) => prev || list[0]?.id || null);
  }, []);

  const loadNotifications = useCallback(async () => {
    const { notifications: n } = await api('/notifications');
    setNotifications(n || []);
  }, []);

  const loadUnread = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const s = await api(`/workspaces/${workspaceId}/unread-summary`);
      setUnreadChannels(new Set(s.unreadChannels || []));
      setUnreadConversations(new Set(s.unreadConversations || []));
    } catch (e) {
      console.error(e);
    }
  }, [workspaceId]);

  const loadThreadsInbox = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const out = await api(`/workspaces/${workspaceId}/threads/inbox?limit=50`);
      setThreadsInbox(out.items || []);
      setThreadsUnreadCount(out.counts?.unread || 0);
    } catch (e) {
      console.error(e);
      setThreadsInbox([]);
      setThreadsUnreadCount(0);
    }
  }, [workspaceId]);

  const loadPriorityTasks = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const out = await api(`/tasks/workspaces/${workspaceId}/priority`);
      setPriorityTasks(out.tasks || []);
    } catch (e) {
      console.error(e);
      setPriorityTasks([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    threadParentRef.current = threadParent;
  }, [threadParent]);

  const refetchCurrentMessages = useCallback(async () => {
    try {
      if (channelId) {
        const { messages: list } = await api(`/messages/channel/${channelId}/messages`);
        setMessages(list);
      } else if (conversationId) {
        const { messages: list } = await api(`/messages/conversation/${conversationId}/messages`);
        setMessages(list);
      }
    } catch (e) {
      console.error(e);
    }
  }, [channelId, conversationId]);

  const mergeIncomingMessage = useCallback((msg) => {
    if (!msg?.id) return;
    if (msg.threadParentId) {
      const openId = threadParentRef.current?.id;
      if (openId && msg.threadParentId === openId) {
        setThreadReplies((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      return;
    }
    if (msg.channelId && msg.channelId === channelId) {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      return;
    }
    if (msg.conversationId && msg.conversationId === conversationId) {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    }
  }, [channelId, conversationId]);

  useEffect(() => {
    refetchWorkspaces().catch(console.error);
  }, [refetchWorkspaces]);

  useEffect(() => {
    loadNotifications().catch(console.error);
  }, [loadNotifications]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [channelId, conversationId, workspaceId]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    function onMq() {
      if (mq.matches) setMobileSidebarOpen(false);
    }
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileSidebarOpen]);

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
    const st = location.state;
    if (!st?.openDmWith) return;
    const uid = st.openDmWith;
    const targetWs = st.workspaceId;
    if (targetWs && targetWs !== workspaceId) {
      setWorkspaceId(targetWs);
      return;
    }
    if (!workspaceId || !uid) return;
    let cancelled = false;
    (async () => {
      try {
        const { conversation } = await api(`/conversations/workspace/${workspaceId}/conversations`, {
          method: 'POST',
          body: { otherUserId: uid },
        });
        if (cancelled) return;
        setShowDm(false);
        setChannelId(null);
        setConversationId(conversation.id);
        setDmPeer(conversation.otherUser);
        setGroupConv(null);
        const { conversations: convs } = await api(`/conversations/workspace/${workspaceId}/conversations`);
        setConversations(convs);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) navigate('.', { replace: true, state: {} });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.state, workspaceId, navigate]);

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
        const fromQ = searchFromUserId ? `&from=${encodeURIComponent(searchFromUserId)}` : '';
        let scope = '';
        if (searchScope.startsWith('ch:')) {
          scope += `&channelId=${encodeURIComponent(searchScope.slice(3))}`;
        } else if (searchScope.startsWith('cv:')) {
          scope += `&conversationId=${encodeURIComponent(searchScope.slice(3))}`;
        }
        const df = searchDateFrom ? `&dateFrom=${encodeURIComponent(searchDateFrom)}` : '';
        const dt = searchDateTo ? `&dateTo=${encodeURIComponent(searchDateTo)}` : '';
        const fileQ = searchInFiles ? '' : '&files=0';
        api(`/workspaces/${workspaceId}/search?q=${enc}&type=messages${fromQ}${scope}${df}${dt}${fileQ}`)
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
    }, 200);
    return () => clearTimeout(t);
  }, [
    searchQ,
    workspaceId,
    searchTab,
    searchFromUserId,
    searchScope,
    searchDateFrom,
    searchDateTo,
    searchInFiles,
  ]);

  useEffect(() => {
    if (!workspaceId) return;
    loadUnread();
  }, [workspaceId, loadUnread]);

  useEffect(() => {
    if (!workspaceId) return;
    const id = setInterval(() => loadUnread(), 45000);
    return () => clearInterval(id);
  }, [workspaceId, loadUnread]);

  useEffect(() => {
    if (!showThreadsModal) return;
    loadThreadsInbox();
    const id = setInterval(() => loadThreadsInbox().catch(() => {}), 45000);
    return () => clearInterval(id);
  }, [showThreadsModal, loadThreadsInbox]);

  useEffect(() => {
    if (!showPriorityModal) return;
    loadPriorityTasks();
    const id = setInterval(() => loadPriorityTasks().catch(() => {}), 45000);
    return () => clearInterval(id);
  }, [showPriorityModal, loadPriorityTasks]);

  useEffect(() => {
    if (!channelId && !conversationId) return;
    const body = channelId ? { channelId } : { conversationId };
    api('/messages/mark-read', { method: 'POST', body })
      .then(() => loadUnread())
      .catch(() => {});
  }, [channelId, conversationId, loadUnread]);

  useEffect(() => {
    if (!channelId && !conversationId) return;
    if (!stickToBottomRef.current) return;
    const t = setTimeout(() => {
      const body = channelId ? { channelId } : { conversationId };
      api('/messages/mark-read', { method: 'POST', body }).then(() => loadUnread()).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [messages, channelId, conversationId, loadUnread]);

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

  const draftKey = useMemo(() => {
    if (channelId) return `ch:${channelId}`;
    if (conversationId) return `conv:${conversationId}`;
    return null;
  }, [channelId, conversationId]);

  useEffect(() => {
    if (!channelId) {
      setChannelNotifLevel('all');
      return;
    }
    api(`/channels/${channelId}/notification-prefs`)
      .then((d) => setChannelNotifLevel(d.level || 'all'))
      .catch(() => {});
  }, [channelId]);

  useEffect(() => {
    if (!draftKey) {
      setInput('');
      return;
    }
    try {
      const d = localStorage.getItem(`syncwork_draft_${draftKey}`);
      setInput(d || '');
    } catch {
      setInput('');
    }
  }, [draftKey]);

  useEffect(() => {
    setThreadAlsoToChannel(false);
  }, [threadParent?.id]);

  useEffect(() => {
    if (!socket || !connected) return undefined;
    const onRecv = (msg) => {
      mergeIncomingMessage(msg);
    };
    const onUpd = (msg) => {
      const patch = (list) => list.map((m) => (m.id === msg.id ? msg : m));
      setMessages(patch);
      setThreadReplies(patch);
    };
    const onTyping = (p) => {
      const label = p.userName || 'Someone';
      if (p.channelId && p.channelId === channelId && p.userId !== user.id) {
        setTypingName(p.isTyping ? label : null);
        if (p.isTyping) {
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingName(null), 3000);
        }
      }
      if (p.conversationId && p.conversationId === conversationId && p.userId !== user.id) {
        setTypingName(p.isTyping ? label : null);
        if (p.isTyping) {
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingName(null), 3000);
        }
      }
    };
    const onNotify = (n) => {
      clearTimeout(notifDebounceRef.current);
      notifDebounceRef.current = setTimeout(() => loadNotifications().catch(() => {}), 200);
      if (n.type === 'dm' || n.type === 'mention' || n.type === 'reminder') {
        const dndActive = user?.dndUntil && new Date(user.dndUntil) > new Date();
        if (dndActive) return;
        const showPreview = readMessagePreviewInNotif();
        const text =
          n.type === 'mention'
            ? showPreview
              ? `Mention: ${n.preview || ''}`
              : 'You were mentioned'
            : n.type === 'reminder'
              ? showPreview
                ? `Reminder: ${n.preview || ''}`
                : 'You have a reminder'
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
  }, [socket, connected, channelId, conversationId, user.id, mergeIncomingMessage, loadNotifications]);

  useEffect(() => {
    if (!socket) return undefined;
    const onReconnect = () => {
      refetchCurrentMessages();
    };
    socket.on('reconnect', onReconnect);
    return () => socket.off('reconnect', onReconnect);
  }, [socket, refetchCurrentMessages]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisibilityRefetchAt.current < 1200) return;
      lastVisibilityRefetchAt.current = now;
      refetchCurrentMessages();
      loadUnread();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refetchCurrentMessages, loadUnread]);

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [channelId, conversationId]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) {
      messagesEnd.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (stickToBottomRef.current || dist < 100) {
      messagesEnd.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, threadReplies]);

  useEffect(() => {
    if (!pendingMessageScroll) return undefined;
    const found = messages.some((m) => m.id === pendingMessageScroll);
    if (!found) {
      const t = setTimeout(() => setPendingMessageScroll(null), 4000);
      return () => clearTimeout(t);
    }
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-message-id="${pendingMessageScroll}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('ring-2', 'ring-violet-400', 'rounded-xl');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-violet-400', 'rounded-xl');
        }, 2200);
      }
      setPendingMessageScroll(null);
    });
    return () => cancelAnimationFrame(id);
  }, [messages, pendingMessageScroll]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = dist < 80;
      setShowJumpLatest(dist > 140);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [channelId, conversationId, messages.length]);

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
    if (skipNextMessageFetchRef.current) {
      skipNextMessageFetchRef.current = false;
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
    if (skipNextMessageFetchRef.current) {
      skipNextMessageFetchRef.current = false;
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

  const mentionCtx = useMemo(() => getMentionContext(input), [input]);
  const mentionFilter = mentionCtx.open ? mentionCtx.filter : '';
  const mentionMembers = useMemo(() => {
    const f = mentionFilter;
    return members
      .filter((m) => m.id !== user.id)
      .filter((m) => {
        if (!f) return true;
        return m.name.toLowerCase().includes(f) || String(m.id).toLowerCase().includes(f);
      });
  }, [members, user.id, mentionFilter]);

  const showMentionPicker = (channelId || conversationId) && (showMention || mentionCtx.open);

  function onInputChange(e) {
    const value = e.target.value;
    setInput(value);
    if (draftKey) {
      try {
        localStorage.setItem(`syncwork_draft_${draftKey}`, value);
      } catch {
        /* ignore */
      }
    }
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 800);
  }

  function insertMention(userId) {
    const uid = String(userId).toLowerCase();
    setShowMention(false);
    setInput((prev) => {
      const ctx = getMentionContext(prev);
      if (ctx.replaceStart >= 0) {
        return `${prev.slice(0, ctx.replaceStart)}@${uid} ${prev.slice(ctx.replaceEnd)}`;
      }
      return `${prev}@${uid} `;
    });
  }

  async function sendMessage(extraAttachments) {
    const raw = input.trim();
    const expanded = applySlashExpansion(raw);
    const text = expanded.trim();
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
      if (threadParent) {
        payload.threadParentId = threadParent.id;
        payload.alsoToChannel = Boolean(threadAlsoToChannel);
      }
    } else if (conversationId) {
      payload.conversationId = conversationId;
      if (threadParent) payload.threadParentId = threadParent.id;
    } else return;

    socket.emit('send_message', payload, (res) => {
      if (res?.ok && res.message) mergeIncomingMessage(res.message);
      else if (!res?.ok) console.error(res?.error);
    });
    setInput('');
    if (draftKey) {
      try {
        localStorage.removeItem(`syncwork_draft_${draftKey}`);
      } catch {
        /* ignore */
      }
    }
    setShowMention(false);
    emitTyping(false);
  }

  function buildJitsiMeetUrl(mode) {
    if (!workspaceId) return '';
    const tail = channelId || conversationId || 'lobby';
    const room = `syncwork-${workspaceId}-${tail}`;
    const params = [
      'config.prejoinPageEnabled=false',
      mode === 'audio' ? 'config.startWithVideoMuted=true' : 'config.startWithVideoMuted=false',
      'config.disableChat=false',
    ];
    return `https://meet.jit.si/${room}#${params.join('&')}`;
  }

  function announceCallInChat(mode) {
    if (!socket) return;
    const url = buildJitsiMeetUrl(mode);
    if (!url) return;
    const label = mode === 'audio' ? 'Voice call' : 'Video call';
    const emoji = mode === 'audio' ? '🎤' : '📹';
    const content = `${emoji} **${label}** — [Join](${url})`;
    const payload = { content };
    if (channelId) {
      payload.channelId = channelId;
      if (threadParent) {
        payload.threadParentId = threadParent.id;
        payload.alsoToChannel = Boolean(threadAlsoToChannel);
      }
    } else if (conversationId) {
      payload.conversationId = conversationId;
      if (threadParent) payload.threadParentId = threadParent.id;
    } else return;
    socket.emit('send_message', payload, (res) => {
      if (res?.ok && res.message) mergeIncomingMessage(res.message);
      else if (!res?.ok) console.error(res?.error);
    });
  }

  function openCall(mode) {
    setCallMode(mode);
    announceCallInChat(mode);
  }

  async function uploadFilesFromList(files) {
    const list = [...files];
    if (!list.length) return;
    const token = getToken();
    const base = getApiBaseUrl();
    const attList = [];
    for (const file of list) {
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
      attList.push({ url: data.url, mime: data.mime, originalName: data.originalName || '' });
    }
    await sendMessage(attList);
  }

  async function onPickFile(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    await uploadFilesFromList(files);
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

  const activeChannel = useMemo(
    () => (channelId ? channels.find((c) => c.id === channelId) : null),
    [channels, channelId]
  );

  const headerTitle =
    channelId && activeChannel
      ? `# ${activeChannel.name}`
      : conversationId && groupConv
        ? groupConv.title || groupConv.participants?.map((p) => p.name).join(', ')
        : conversationId && dmPeer
          ? dmPeer.name
          : 'Select a channel or person';

  const dark = user?.theme === 'dark';

  if (!workspaces.length) {
    return (
        <div className="relative flex min-h-full flex-col items-center justify-center gap-6 overflow-hidden bg-gradient-to-b from-slate-50 via-violet-50/30 to-slate-100 p-6 dark:from-slate-950 dark:via-violet-950/20 dark:to-slate-900 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(139, 92, 246, 0.2), transparent), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(99, 102, 241, 0.12), transparent)',
          }}
        />
        <div className="relative text-center motion-safe:animate-fade-in-up">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-indigo-600/10 text-3xl shadow-glow">
            ✨
          </div>
          <p className="text-lg font-medium text-slate-700 dark:text-slate-200">Create or join a workspace to get started.</p>
        </div>
        <div className="relative flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg active:scale-[0.99]"
            onClick={() => setShowCreateWs(true)}
          >
            Create workspace
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300/80 bg-white/80 px-5 py-2.5 font-semibold shadow-sm backdrop-blur-sm transition hover:border-violet-300 hover:bg-white dark:border-slate-600 dark:bg-slate-800/80 dark:hover:border-violet-700"
            onClick={() => setShowJoinWs(true)}
          >
            Join workspace
          </button>
        </div>
        <button type="button" className="relative text-sm font-medium text-slate-500 transition hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400" onClick={logout}>
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
    <div className="flex h-full min-h-0 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      {mobileSidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity md:hidden"
          aria-hidden
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex h-full shrink-0 md:static md:z-auto md:translate-x-0 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 ease-out md:translate-x-0`}
      >
      {/* Workspace rail */}
      <aside className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-[#522653] bg-[#3f0e40] py-3 shadow-[4px_0_24px_-8px_rgba(0,0,0,0.25)] dark:border-slate-700">
        {workspaces.map((w) => (
          <button
            key={w.id}
            type="button"
            title={w.name}
            onClick={() => setWorkspaceId(w.id)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white transition duration-200 active:scale-95 ${
              workspaceId === w.id ? 'bg-white/20 shadow-md ring-2 ring-white/40' : 'bg-white/10 hover:bg-white/20'
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
      <aside className="flex w-[min(16rem,calc(100vw-4rem))] shrink-0 flex-col border-r border-[#522653] bg-[#3f0e40] text-[#d1d2d3] shadow-[4px_0_24px_-8px_rgba(0,0,0,0.2)] dark:border-slate-700 dark:bg-slate-950 md:w-64">
        <div className="border-b border-[#522653] px-3 py-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate font-bold text-white">{activeWorkspace?.name || 'Workspace'}</div>
            <button
              type="button"
              className="text-sm sm:text-xs text-[#b39fb3] hover:text-white"
              onClick={() => setShowJoinWs(true)}
            >
              Join
            </button>
          </div>
          <div className="mt-1 truncate text-sm sm:text-xs text-[#b39fb3]">{user?.email}</div>
        </div>

        <div className="relative border-b border-[#522653] px-2 py-2 dark:border-slate-700">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {['messages', 'channels', 'people'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`flex items-center justify-center rounded px-2 py-1 text-sm sm:text-[10px] ${
                  searchTab === tab
                    ? 'bg-[#1164a3] text-white'
                    : 'bg-white/10 text-[#d1d2d3] hover:bg-white/15'
                }`}
                onClick={() => setSearchTab(tab)}
                title={tab}
              >
                {tab === 'messages' ? '💬' : tab === 'channels' ? '#' : '👥'}
              </button>
            ))}
          </div>
          {searchTab === 'messages' && members.length > 0 ? (
            <select
              value={searchFromUserId}
              onChange={(e) => setSearchFromUserId(e.target.value)}
              className="mb-1.5 w-full rounded border border-[#522653] bg-black/20 px-2 py-1 text-sm sm:text-[10px] text-[#d1d2d3]"
            >
              <option value="">From: anyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  From: {m.name}
                </option>
              ))}
            </select>
          ) : null}
          {searchTab === 'messages' ? (
            <>
              <select
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value)}
                className="mb-1.5 w-full rounded border border-[#522653] bg-black/20 px-2 py-1 text-sm sm:text-[10px] text-[#d1d2d3]"
              >
                <option value="">Scope: all channels &amp; DMs</option>
                <optgroup label="Channels">
                  {channels.map((c) => (
                    <option key={c.id} value={`ch:${c.id}`}>
                      #{c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Direct">
                  {conversations.map((cv) => (
                    <option key={cv.id} value={`cv:${cv.id}`}>
                      {cv.kind === 'group'
                        ? cv.title || cv.participants?.map((p) => p.name).join(', ')
                        : cv.otherUser?.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="mb-1.5 flex flex-wrap gap-1">
                <input
                  type="date"
                  value={searchDateFrom}
                  onChange={(e) => setSearchDateFrom(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-[#522653] bg-black/20 px-2 py-1.5 text-sm sm:text-[10px] text-[#d1d2d3]"
                  title="From date"
                />
                <input
                  type="date"
                  value={searchDateTo}
                  onChange={(e) => setSearchDateTo(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-[#522653] bg-black/20 px-2 py-1.5 text-sm sm:text-[10px] text-[#d1d2d3]"
                  title="To date"
                />
              </div>
              <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-sm sm:text-[10px] text-[#b39fb3]">
                <input
                  type="checkbox"
                  checked={searchInFiles}
                  onChange={(e) => setSearchInFiles(e.target.checked)}
                />
                Search in file names
              </label>
            </>
          ) : null}
          <input
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={
              searchTab === 'messages' ? 'Search messages…' : searchTab === 'channels' ? 'Channels…' : 'People…'
            }
            className="w-full rounded border border-[#522653] bg-black/20 px-2 py-1.5 text-sm sm:text-xs text-[#d1d2d3] placeholder:text-[#b39fb3] focus:border-[#1164a3] focus:outline-none focus:ring-1 focus:ring-[#1164a3]"
          />
          {searchTab === 'messages' && searchResults.length > 0 && searchQ.trim().length >= 2 ? (
            <div className="absolute left-2 right-2 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded border border-[#522653] bg-[#350d36] p-2 text-sm sm:text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="block w-full truncate rounded px-2 py-1 text-left text-[#d1d2d3] hover:bg-white/10"
                  onClick={() => {
                    (async () => {
                      setPendingMessageScroll(r.id);
                      if (r.channelId) {
                        setGroupConv(null);
                        setDmPeer(null);
                        setConversationId(null);
                        setChannelId(r.channelId);
                      } else if (r.conversationId && workspaceId) {
                        setChannelId(null);
                        setConversationId(r.conversationId);
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
                  className="flex w-full items-center gap-2 truncate rounded px-2 py-1.5 text-left text-[#d1d2d3] hover:bg-white/10"
                  onClick={() => {
                    if (!workspaceId) return;
                    navigate(`/profile/${r.id}?ws=${workspaceId}`);
                    setSearchQ('');
                    setPeopleSearchResults([]);
                  }}
                >
                  <Avatar user={r} size={7} />
                  <span className="min-w-0 truncate">
                    {r.name} <span className="text-[#b39fb3]">{r.email}</span>
                  </span>
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
              className={`mt-0.5 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                channelId === c.id ? 'bg-[#1164a3] text-white' : 'hover:bg-white/10'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                {c.type === 'private' ? '🔒' : '#'} {c.name}
              </span>
              {unreadChannels.has(c.id) ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" title="Unread" aria-hidden />
              ) : null}
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
                <GroupAvatarStack
                  participants={cv.participants}
                  size={7}
                  ringClass={
                    conversationId === cv.id
                      ? 'ring-2 ring-[#1164a3]'
                      : 'ring-2 ring-[#3f0e40] dark:ring-slate-950'
                  }
                />
              ) : workspaceId ? (
                <Link
                  to={`/profile/${cv.otherUser.id}?ws=${workspaceId}`}
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  title="View profile"
                >
                  <Avatar user={cv.otherUser} size={8} />
                </Link>
              ) : (
                <Avatar user={cv.otherUser} size={8} />
              )}
              <span className="min-w-0 flex-1 truncate">
                {cv.kind === 'group' ? cv.title || cv.participants?.map((p) => p.name).join(', ') : cv.otherUser.name}
              </span>
              {unreadConversations.has(cv.id) ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" title="Unread" aria-hidden />
              ) : null}
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
              {user?.statusText || user?.statusEmoji ? (
                <div className="truncate text-sm sm:text-[10px] text-[#b39fb3]">
                  {user?.statusEmoji ? `${user.statusEmoji} ` : ''}
                  {user?.statusText || ''}
                </div>
              ) : null}
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
      </div>

      {/* Main chat */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white/90 backdrop-blur-[2px] dark:bg-slate-900/90">
        <header className="sticky top-0 z-10 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/85 px-3 py-2 shadow-soft backdrop-blur-md sm:px-4 dark:border-slate-700/80 dark:bg-slate-900/85">
          <button
            type="button"
            className="-ml-0.5 shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open channels menu"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2.5">
              {channelId && activeChannel ? (
                <>
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 to-indigo-500/15 text-sm font-bold text-violet-700 shadow-sm dark:text-violet-300"
                    aria-hidden
                  >
                    #
                  </span>
                  <h1 className="truncate text-base font-bold leading-tight sm:text-lg">{activeChannel.name}</h1>
                </>
              ) : conversationId && groupConv ? (
                <>
                  <GroupAvatarStack
                    participants={groupConv.participants}
                    size={8}
                    ringClass="ring-2 ring-slate-200 dark:ring-slate-700"
                  />
                  <h1 className="min-w-0 truncate text-base font-bold leading-tight sm:text-lg">{headerTitle}</h1>
                </>
              ) : conversationId && dmPeer && workspaceId ? (
                <Link
                  to={`/profile/${dmPeer.id}?ws=${workspaceId}`}
                  className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none ring-violet-500/0 transition hover:bg-slate-100/80 focus-visible:ring-2 dark:hover:bg-slate-800/80"
                >
                  <Avatar user={dmPeer} size={9} />
                  <h1 className="min-w-0 truncate text-base font-bold leading-tight sm:text-lg">{dmPeer.name}</h1>
                </Link>
              ) : (
                <h1 className="truncate text-base font-bold leading-tight sm:text-lg">{headerTitle}</h1>
              )}
            </div>
            {workspaceId && members.length > 0 ? (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title="People in this workspace">
                {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
              </p>
            ) : null}
          </div>
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
          {channelId ? (
            <select
              value={channelNotifLevel}
              onChange={async (e) => {
                const level = e.target.value;
                setChannelNotifLevel(level);
                try {
                  await api(`/channels/${channelId}/notification-prefs`, { method: 'PATCH', body: { level } });
                } catch (err) {
                  console.error(err);
                }
              }}
              className="max-w-[7.5rem] rounded border border-slate-200 bg-white px-1 py-1.5 text-sm sm:text-[10px] dark:border-slate-600 dark:bg-slate-800"
              title="Notifications for this channel"
            >
              <option value="all">All activity</option>
              <option value="mentions">Mentions</option>
              <option value="mute">Mute</option>
            </select>
          ) : null}
          <button
            type="button"
            className="rounded px-2 py-1 text-sm sm:text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            title="Saved messages"
            onClick={async () => {
              setShowSavedModal(true);
              try {
                const { messages: list } = await api('/messages/saved');
                setSavedList(list || []);
              } catch (e) {
                console.error(e);
                setSavedList([]);
              }
            }}
          >
            Saved
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-sm sm:text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            title="Threads inbox"
            onClick={async () => {
              setShowThreadsModal(true);
              await loadThreadsInbox().catch(() => {});
            }}
          >
            🧵 Threads{threadsUnreadCount ? ` (${threadsUnreadCount})` : ''}
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-sm sm:text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            title="Priority inbox"
            onClick={async () => {
              setShowPriorityModal(true);
              await loadPriorityTasks().catch(() => {});
            }}
          >
            ⚡ Priority{priorityTasks.length ? ` (${priorityTasks.length})` : ''}
          </button>
          {(channelId || conversationId) && workspaceId ? (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm sm:text-xs font-medium text-slate-700 transition hover:bg-violet-100 hover:text-violet-900 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-violet-950/80 dark:hover:text-violet-200"
                title="Video call — posts a join link in this chat"
                onClick={() => openCall('video')}
              >
                📹 Video
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm sm:text-xs font-medium text-slate-700 transition hover:bg-violet-100 hover:text-violet-900 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-violet-950/80 dark:hover:text-violet-200"
                title="Voice call (mic only, camera off) — posts a join link in this chat"
                onClick={() => openCall('audio')}
              >
                🎤 Voice
              </button>
            </div>
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
              <div className="absolute right-0 top-10 z-50 max-h-[min(18rem,70vh)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200/90 bg-white/95 p-2 text-sm sm:text-xs shadow-soft-lg backdrop-blur-md motion-safe:animate-modal-in dark:border-slate-600 dark:bg-slate-800/95 sm:w-80">
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                Reconnecting…
              </span>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              ref={messagesScrollRef}
              className="flex-1 space-y-0 overflow-y-auto px-4 py-3 sm:px-6"
            >
              {!channelId && !conversationId ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 px-4 text-center text-slate-500 motion-safe:animate-fade-in-up dark:text-slate-400">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/15 to-indigo-600/10 text-4xl shadow-inner">
                    👋
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Welcome to Sync Work</p>
                    <p className="mt-1 max-w-sm text-sm leading-relaxed">Pick a channel or direct message in the sidebar to start chatting.</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 px-4 text-center text-slate-500 motion-safe:animate-fade-in-up dark:text-slate-400">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/12 to-slate-400/10 text-3xl">
                    💬
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No messages yet</p>
                    <p className="mt-1 max-w-sm text-sm leading-relaxed">Say hello below — Markdown, uploads, and @mentions.</p>
                  </div>
                </div>
              ) : (
                messages.map((m, i) => {
                  const prev = i > 0 ? messages[i - 1] : null;
                  const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                  const groupWithPrev = Boolean(
                    prev &&
                      !m.threadParentId &&
                      !prev.threadParentId &&
                      prev.senderId === m.senderId &&
                      withinMinutes(prev.createdAt, m.createdAt, 6)
                  );
                  return (
                    <div key={m.id}>
                      {showDay ? <DayDivider label={formatDayLabel(m.createdAt)} /> : null}
                      <MessageBlock
                        message={m}
                        members={members}
                        selfId={user.id}
                        workspaceId={workspaceId}
                        groupWithPrev={groupWithPrev}
                        onReaction={onReaction}
                        onThread={() => {
                          setThreadParent(m);
                          if (m.channelId) setChannelId(m.channelId);
                          if (m.conversationId) setConversationId(m.conversationId);
                        }}
                      />
                    </div>
                  );
                })
              )}
              <div ref={messagesEnd} />
            </div>

            {showJumpLatest && (channelId || conversationId) && messages.length > 0 ? (
              <button
                type="button"
                className="absolute bottom-24 right-4 z-10 rounded-full border border-violet-200/80 bg-white/95 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-soft-lg backdrop-blur-sm transition hover:scale-[1.02] hover:border-violet-300 hover:shadow-md dark:border-violet-800/50 dark:bg-slate-800/95 dark:text-violet-300 dark:hover:bg-slate-700"
                onClick={() => {
                  stickToBottomRef.current = true;
                  messagesEnd.current?.scrollIntoView({ behavior: 'auto' });
                  setShowJumpLatest(false);
                }}
              >
                ↓ New messages
              </button>
            ) : null}

            <div
              className={`border-t border-slate-200/90 bg-gradient-to-t from-slate-50/90 to-white/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-shadow dark:border-slate-700/90 dark:from-slate-950/90 dark:to-slate-900/80 sm:p-4 ${
                composerDrag ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''
              }`}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setComposerDrag(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setComposerDrag(true);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget)) return;
                setComposerDrag(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setComposerDrag(false);
                if (!channelId && !conversationId) return;
                const fl = e.dataTransfer?.files;
                if (fl?.length) uploadFilesFromList(fl);
              }}
            >
              <input ref={fileRef} type="file" multiple className="hidden" onChange={onPickFile} />
              <div className="flex items-end gap-1.5 sm:gap-2">
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 text-sm shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-violet-800 dark:hover:bg-violet-950/30"
                  onClick={() => fileRef.current?.click()}
                >
                  📎
                </button>
                <div className="relative flex min-w-0 flex-1 gap-1">
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 text-sm shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-violet-800 dark:hover:bg-violet-950/30"
                    title="Mention someone"
                    disabled={!channelId && !conversationId}
                    onClick={() => setShowMention((v) => !v)}
                  >
                    @
                  </button>
                  {showMentionPicker ? (
                    <div className="absolute bottom-full left-0 z-30 mb-1 max-h-48 w-[min(16rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800">
                      {mentionMembers.length === 0 ? (
                        <div className="px-3 py-2 text-slate-500">No matching people</div>
                      ) : (
                        mentionMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="flex w-full items-center gap-2 truncate px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                            onClick={() => insertMention(m.id)}
                          >
                            <Avatar user={m} size={7} />
                            <span className="truncate">{m.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                  <textarea
                    value={input}
                    onChange={onInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowMention(false);
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={1}
                    placeholder={
                      channelId || conversationId
                        ? `Message ${channelId ? 'the channel' : groupConv?.title || dmPeer?.name || 'group'} — @ for mention`
                        : 'Select a channel'
                    }
                    disabled={!channelId && !conversationId}
                    className="min-h-[44px] max-h-36 min-w-0 flex-1 resize-y rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm shadow-inner outline-none ring-violet-500/0 transition focus:border-violet-300 focus:ring-2 focus:ring-violet-500/25 dark:border-slate-600 dark:bg-slate-800/90 dark:text-white dark:focus:border-violet-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!channelId && !conversationId}
                  className="shrink-0 self-end rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 sm:px-4"
                >
                  Send
                </button>
              </div>
              {channelId || conversationId ? (
                <p className="mt-2 text-center text-sm sm:text-[10px] text-slate-400 dark:text-slate-500">
                  <strong className="font-medium text-slate-500 dark:text-slate-400">Enter</strong> to send ·{' '}
                  <strong className="font-medium text-slate-500 dark:text-slate-400">Shift+Enter</strong> new line · Markdown
                  supported
                </p>
              ) : null}
            </div>
          </div>

          {threadParent && (channelId || conversationId) ? (
            <aside className="fixed inset-0 z-[60] flex min-h-0 flex-col bg-slate-50/98 backdrop-blur-sm dark:bg-slate-950/98 lg:static lg:inset-auto lg:z-auto lg:h-full lg:w-[min(100%,20rem)] lg:max-w-[20rem] lg:shrink-0 lg:border-l lg:border-slate-200/90 lg:bg-gradient-to-b lg:from-slate-50/95 lg:to-white/90 lg:shadow-[inset_6px_0_20px_-12px_rgba(15,23,42,0.08)] dark:lg:border-slate-700 dark:lg:from-slate-950 dark:lg:to-slate-900">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200/90 bg-white/60 px-3 py-2.5 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Thread</div>
                  <div className="truncate text-sm sm:text-xs text-slate-500 dark:text-slate-400">Reply in this side panel</div>
                </div>
                <div className="flex items-center gap-2">
                  {threadParent ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={async () => {
                        try {
                          if (threadParent.resolved) {
                            await api(`/messages/${threadParent.id}/resolve-thread`, { method: 'DELETE' });
                          } else {
                            await api(`/messages/${threadParent.id}/resolve-thread`, { method: 'POST' });
                          }
                          setThreadParent((prev) => (prev ? { ...prev, resolved: !prev.resolved } : prev));
                          await loadThreadsInbox();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      title={threadParent.resolved ? 'Mark unresolved' : 'Resolve this thread'}
                    >
                      {threadParent.resolved ? 'Unresolve' : 'Resolve'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-800"
                    onClick={() => setThreadParent(null)}
                    aria-label="Close thread"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
                <div className="rounded-lg border border-slate-200 bg-white/80 p-2 text-xs dark:border-slate-600 dark:bg-slate-900/80">
                  {workspaceId && threadParent.senderId ? (
                    <Link
                      to={
                        threadParent.senderId === user.id
                          ? '/profile'
                          : `/profile/${threadParent.senderId}?ws=${workspaceId}`
                      }
                      className="flex items-center gap-2 rounded-md outline-none ring-violet-500/0 transition hover:bg-slate-100/80 focus-visible:ring-2 dark:hover:bg-slate-800/50"
                    >
                      <Avatar user={threadParent.sender} size={7} />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {threadParent.sender?.name || 'Unknown'}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatar user={threadParent.sender} size={7} />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {threadParent.sender?.name || 'Unknown'}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 line-clamp-4 text-slate-600 dark:text-slate-300">
                    {threadParent.deletedAt ? <span className="italic">(deleted)</span> : threadParent.content}
                  </div>
                </div>
                {threadReplies.map((m) => (
                  <MessageBlock
                    key={m.id}
                    message={m}
                    members={members}
                    selfId={user.id}
                    workspaceId={workspaceId}
                    onReaction={onReaction}
                    onThread={() => {}}
                    compact
                  />
                ))}
              </div>
              <div className="shrink-0 border-t border-slate-200 p-2 dark:border-slate-700">
                {channelId ? (
                  <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={threadAlsoToChannel}
                      onChange={(e) => setThreadAlsoToChannel(e.target.checked)}
                    />
                    Also send to channel
                  </label>
                ) : null}
                <textarea
                  rows={2}
                  className="w-full resize-y rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                  placeholder="Reply… (Enter to send, Shift+Enter newline). Try /shrug"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.shiftKey) return;
                    e.preventDefault();
                    const raw = e.currentTarget.value.trim();
                    const text = applySlashExpansion(raw).trim();
                    if (!text || !socket) return;
                    const payload = { content: text, threadParentId: threadParent.id };
                    if (channelId) {
                      payload.channelId = channelId;
                      payload.alsoToChannel = Boolean(threadAlsoToChannel);
                    } else if (conversationId) payload.conversationId = conversationId;
                    socket.emit('send_message', payload, (res) => {
                      if (res?.ok && res.message) mergeIncomingMessage(res.message);
                    });
                    e.currentTarget.value = '';
                  }}
                />
              </div>
            </aside>
          ) : null}
        </div>
      </main>

      {toast ? (
        <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-[90] max-w-[calc(100vw-2rem)] rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast.text}
        </div>
      ) : null}

      {showSavedModal ? (
        <Modal title="Saved messages" onClose={() => setShowSavedModal(false)}>
          <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {savedList.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">No saved messages yet. Use “Save” on a message.</p>
            ) : null}
            {savedList.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-200 p-2 text-sm sm:text-xs dark:border-slate-600">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {workspaceId && m.senderId ? (
                      <Link
                        to={m.senderId === user.id ? '/profile' : `/profile/${m.senderId}?ws=${workspaceId}`}
                        className="flex items-center gap-2 rounded-md outline-none ring-violet-500/0 transition hover:bg-slate-50 focus-visible:ring-2 dark:hover:bg-slate-800/50"
                      >
                        <Avatar user={m.sender} size={7} />
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{m.sender?.name || 'Unknown'}</div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Avatar user={m.sender} size={7} />
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{m.sender?.name || 'Unknown'}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="rounded bg-violet-100 px-2 py-1 text-sm sm:text-[10px] font-medium text-violet-800 hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-200 dark:hover:bg-violet-900"
                      onClick={() => {
                        (async () => {
                          try {
                            setThreadParent(null);
                            skipNextMessageFetchRef.current = true;
                            setPendingMessageScroll(m.id);
                            setShowSavedModal(false);
                            if (m.channelId) {
                              setGroupConv(null);
                              setDmPeer(null);
                              setConversationId(null);
                              setChannelId(m.channelId);
                              const { messages: list } = await api(
                                `/messages/channel/${m.channelId}/messages/around/${m.id}?limit=80`
                              );
                              setMessages(list);
                            } else if (m.conversationId && workspaceId) {
                              setChannelId(null);
                              setConversationId(m.conversationId);
                              const { conversations: convs } = await api(
                                `/conversations/workspace/${workspaceId}/conversations`
                              );
                              setConversations(convs);
                              const cv = convs.find((c) => c.id === m.conversationId);
                              if (cv) {
                                if (cv.kind === 'group') {
                                  setGroupConv({ title: cv.title, participants: cv.participants });
                                  setDmPeer(null);
                                } else {
                                  setGroupConv(null);
                                  setDmPeer(cv.otherUser);
                                }
                              }
                              const { messages: list } = await api(
                                `/messages/conversation/${m.conversationId}/messages/around/${m.id}?limit=80`
                              );
                              setMessages(list);
                            }
                          } catch (e) {
                            console.error(e);
                            skipNextMessageFetchRef.current = false;
                          }
                        })();
                      }}
                    >
                      Go to message
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-2 py-1 text-sm sm:text-[10px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={async () => {
                        try {
                          await api(`/messages/${m.id}/save`, { method: 'DELETE' });
                          setSavedList((prev) => prev.filter((x) => x.id !== m.id));
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">{m.content}</div>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}

      {showThreadsModal ? (
        <Modal title="Threads inbox" onClose={() => setShowThreadsModal(false)}>
          <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {threadsInbox.length === 0 ? <p className="text-slate-500">No thread activity yet.</p> : null}
            {threadsInbox.map((t) => (
              <button
                key={t.id}
                type="button"
                className="flex w-full items-start gap-2 rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                onClick={async () => {
                  setShowThreadsModal(false);
                  try {
                    if (t.channelId) {
                      setConversationId(null);
                      setDmPeer(null);
                      setGroupConv(null);
                      setChannelId(t.channelId);
                    } else if (t.conversationId) {
                      setChannelId(null);
                      setConversationId(t.conversationId);
                      if (workspaceId) {
                        const { conversations: convs } = await api(
                          `/conversations/workspace/${workspaceId}/conversations`
                        );
                        setConversations(convs);
                        const cv = convs.find((c) => c.id === t.conversationId);
                        if (cv) {
                          if (cv.kind === 'group') {
                            setGroupConv({ title: cv.title, participants: cv.participants });
                            setDmPeer(null);
                          } else {
                            setGroupConv(null);
                            setDmPeer(cv.otherUser);
                          }
                        }
                      }
                    }
                    setThreadParent({
                      id: t.id,
                      content: t.content,
                      createdAt: t.createdAt,
                      senderId: t.senderId,
                      sender: t.sender,
                      channelId: t.channelId || null,
                      conversationId: t.conversationId || null,
                      threadParentId: null,
                      resolved: t.resolved,
                    });
                    await api('/messages/mark-read', { method: 'POST', body: { threadRootId: t.id } });
                    await loadThreadsInbox();
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                <Avatar user={t.sender} size={7} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate font-semibold text-slate-800 dark:text-slate-100">{t.sender?.name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{formatTime(t.createdAt)}</div>
                    {t.unread ? (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                        Unread
                      </span>
                    ) : null}
                    {t.mentioned ? (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                        Mentioned
                      </span>
                    ) : null}
                    {t.resolved ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Resolved
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-slate-600 dark:text-slate-300">{t.content}</div>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {showPriorityModal ? (
        <Modal title="Priority inbox" onClose={() => setShowPriorityModal(false)}>
          <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {priorityTasks.length === 0 ? <p className="text-slate-500">No priority tasks in the next 24 hours.</p> : null}
            {priorityTasks.map((t) => (
              <div key={t.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-600">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{t.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Due: {t.dueAt ? new Date(t.dueAt).toLocaleString() : '—'} · Priority {t.priority}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className="rounded bg-violet-700 px-2 py-1 text-xs text-white hover:bg-violet-600"
                      onClick={async () => {
                        try {
                          setShowPriorityModal(false);
                          setThreadParent(null);
                          skipNextMessageFetchRef.current = true;
                          setPendingMessageScroll(t.sourceMessageId);
                          if (t.channelId) {
                            setConversationId(null);
                            setDmPeer(null);
                            setGroupConv(null);
                            setChannelId(t.channelId);
                            const { messages: list } = await api(
                              `/messages/channel/${t.channelId}/messages/around/${t.sourceMessageId}?limit=80`
                            );
                            setMessages(list);
                          } else if (t.conversationId && workspaceId) {
                            setChannelId(null);
                            setConversationId(t.conversationId);
                            const { conversations: convs } = await api(
                              `/conversations/workspace/${workspaceId}/conversations`
                            );
                            setConversations(convs);
                            const cv = convs.find((c) => c.id === t.conversationId);
                            if (cv) {
                              if (cv.kind === 'group') {
                                setGroupConv({ title: cv.title, participants: cv.participants });
                                setDmPeer(null);
                              } else {
                                setGroupConv(null);
                                setDmPeer(cv.otherUser);
                              }
                            }
                            const { messages: list } = await api(
                              `/messages/conversation/${t.conversationId}/messages/around/${t.sourceMessageId}?limit=80`
                            );
                            setMessages(list);
                          }
                        } catch (e) {
                          console.error(e);
                          skipNextMessageFetchRef.current = false;
                        }
                      }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
                      onClick={async () => {
                        try {
                          await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: 'done' } });
                          await loadPriorityTasks();
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
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
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar user={m} size={7} />
                    {workspaceId ? (
                      <Link
                        to={`/profile/${m.id}?ws=${workspaceId}`}
                        className="truncate font-medium text-violet-700 hover:underline dark:text-violet-400"
                      >
                        {m.name} <span className="font-normal text-slate-500">({m.role})</span>
                      </Link>
                    ) : (
                      <span className="truncate">
                        {m.name} <span className="text-slate-500">({m.role})</span>
                      </span>
                    )}
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

      {callMode && workspaceId ? (
        <Modal
          title={callMode === 'audio' ? 'Voice call' : 'Video call'}
          wide
          onClose={() => setCallMode(null)}
        >
          <p className="mb-2 text-xs text-slate-500">
            Jitsi room for this channel or conversation. A join link was posted in the chat. Voice starts with the camera
            off; you can turn video on in the meeting.
          </p>
          <iframe
            title={callMode === 'audio' ? 'Jitsi voice call' : 'Jitsi video call'}
            src={buildJitsiMeetUrl(callMode)}
            className="h-[min(50vh,280px)] w-full rounded-lg border border-slate-200 bg-black sm:h-[min(70vh,420px)] dark:border-slate-600"
            allow="camera; microphone; display-capture; autoplay; fullscreen"
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

function GroupAvatarStack({ participants, size = 8, ringClass = 'ring-2 ring-slate-200 dark:ring-slate-700' }) {
  const list = (participants || []).filter(Boolean).slice(0, 3);
  if (!list.length) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-xs font-bold ring-2 ring-white/25">
        G
      </span>
    );
  }
  return (
    <span className="flex shrink-0 -space-x-2">
      {list.map((p) => (
        <span key={p.id} className={`inline-flex rounded-full ${ringClass}`}>
          <Avatar user={p} size={size} />
        </span>
      ))}
    </span>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/55 p-3 backdrop-blur-sm motion-safe:animate-fade-in sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${wide ? 'max-w-4xl' : 'max-w-md'} rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-soft-lg backdrop-blur-md motion-safe:animate-modal-in sm:p-6 dark:border-slate-600/60 dark:bg-slate-800/95`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-lg font-bold text-transparent dark:from-white dark:to-slate-300">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MentionLink({ href, children, members, workspaceId, selfId }) {
  if (href?.startsWith('mention:')) {
    const id = href.slice('mention:'.length);
    const m = (members || []).find((u) => String(u.id).toLowerCase() === id.toLowerCase());
    const chip = (
      <>
        {m ? <Avatar user={m} size={6} /> : null}
        <span className="inline-flex items-center rounded bg-violet-100 px-1 font-medium text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
          @{children}
        </span>
      </>
    );
    if (workspaceId && id) {
      const to =
        selfId && String(selfId).toLowerCase() === id.toLowerCase()
          ? '/profile'
          : `/profile/${id}?ws=${workspaceId}`;
      return (
        <Link
          to={to}
          className="inline-flex max-w-full items-center gap-1 align-middle no-underline hover:opacity-90"
          title={id}
        >
          {chip}
        </Link>
      );
    }
    return (
      <span className="inline-flex max-w-full items-center gap-1 align-middle" title={id}>
        {chip}
      </span>
    );
  }
  return (
    <a href={href} className="text-violet-600 underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function MessageBlock({ message, members = [], selfId, workspaceId, onReaction, onThread, compact, groupWithPrev }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskDueInMinutes, setTaskDueInMinutes] = useState('60');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [remindInMinutes, setRemindInMinutes] = useState('60');

  async function createTask() {
    try {
      const dueInMinutesNum = taskDueInMinutes ? Number(taskDueInMinutes) : null;
      await api(`/tasks/${message.id}/from-message`, {
        method: 'POST',
        body: { dueInMinutes: dueInMinutesNum, assigneeUserId: selfId },
      });
      setShowTaskModal(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function createReminder() {
    try {
      const minutesNum = Number(remindInMinutes);
      if (!Number.isFinite(minutesNum) || minutesNum <= 0) return;
      await api(`/reminders/${message.id}/from-message`, {
        method: 'POST',
        body: { minutes: minutesNum },
      });
      setShowReminderModal(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(message.content || '');
    } catch {
      /* ignore */
    }
  }

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

  async function pinMsg() {
    try {
      await api(`/messages/${message.id}/pin`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  }

  async function saveMsg() {
    try {
      await api(`/messages/${message.id}/save`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  }

  const mine = message.senderId === selfId;
  const showHeader = compact || !groupWithPrev;

  return (
    <>
      <div
      data-message-id={message.id}
      className={`group flex gap-3 rounded-xl px-2 transition-colors duration-150 ${groupWithPrev && !compact ? '-mt-0.5 py-0' : 'py-1'} hover:bg-slate-50/90 dark:hover:bg-slate-800/80 ${compact ? 'text-sm' : ''}`}
    >
      {showHeader ? (
        <Avatar user={message.sender} size={compact ? 8 : 9} />
      ) : (
        <div className="flex w-9 shrink-0 justify-end pt-1">
          <span className="text-sm sm:text-[10px] tabular-nums text-slate-400 opacity-0 transition group-hover:opacity-100">
            {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        {showHeader ? (
          <div className="flex flex-wrap items-baseline gap-2">
            {workspaceId && message.senderId ? (
              <Link
                to={
                  String(message.senderId) === String(selfId)
                    ? '/profile'
                    : `/profile/${message.senderId}?ws=${workspaceId}`
                }
                className="font-bold text-slate-900 hover:underline dark:text-slate-100"
              >
                {message.sender?.name || 'Unknown'}
              </Link>
            ) : (
              <span className="font-bold">{message.sender?.name || 'Unknown'}</span>
            )}
            <span className="text-sm sm:text-xs text-slate-500">{formatTime(message.createdAt)}</span>
            {message.editedAt ? <span className="text-sm sm:text-xs text-slate-400">(edited)</span> : null}
          </div>
        ) : null}
        {editing ? (
          <div className={`${showHeader ? 'mt-1' : 'mt-0'} flex gap-2`}>
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
          <div
            className={`${showHeader ? 'mt-0.5' : 'mt-0'} max-w-none break-words text-sm [&_a]:text-violet-600 [&_code]:rounded [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800`}
          >
            {message.deletedAt ? (
              <span className="italic text-slate-400">{message.content}</span>
            ) : (
              <ReactMarkdown
                components={{
                  a: (props) => (
                    <MentionLink {...props} members={members} workspaceId={workspaceId} selfId={selfId} />
                  ),
                }}
              >
                {mentionsToMarkdownLinks(message.content, members)}
              </ReactMarkdown>
            )}
          </div>
        )}
        {(message.attachments?.length
          ? message.attachments
          : message.attachmentUrl
            ? [{ url: message.attachmentUrl, mime: message.attachmentMime, originalName: '' }]
            : []
        ).map((a, i) => (
          <div key={a.id || i} className="mt-2">
            {a.mime?.startsWith('image/') ? (
              <img src={getPublicAssetUrl(a.url)} alt="" className="max-h-48 rounded border border-slate-200" />
            ) : a.mime?.startsWith('video/') || /\.(mp4|webm|ogg|mkv)$/i.test(a.url || '') ? (
              <div className="max-w-2xl">
                <video
                  controls
                  src={getPublicAssetUrl(a.url)}
                  className="max-h-96 w-full rounded border border-slate-200 bg-black"
                />
                <a
                  href={getPublicAssetUrl(a.url)}
                  className="mt-1 inline-block text-sm sm:text-xs text-violet-600 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open video in new tab
                </a>
              </div>
            ) : a.mime?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(a.url || '') ? (
              <div className="max-w-2xl">
                <audio controls src={getPublicAssetUrl(a.url)} className="w-full" />
                <a
                  href={getPublicAssetUrl(a.url)}
                  className="mt-1 inline-block text-sm sm:text-xs text-violet-600 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open audio in new tab
                </a>
              </div>
            ) : a.mime === 'application/pdf' || /\.pdf$/i.test(a.url || '') ? (
              <div className="max-w-2xl">
                <iframe
                  title="PDF preview"
                  src={getPublicAssetUrl(a.url)}
                  className="h-96 w-full rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800"
                />
                <a
                  href={getPublicAssetUrl(a.url)}
                  className="mt-1 inline-block text-sm sm:text-xs text-violet-600 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open PDF in new tab
                </a>
              </div>
            ) : (
              <a href={getPublicAssetUrl(a.url)} className="text-violet-600 underline" target="_blank" rel="noreferrer">
                Download attachment
                {a.originalName ? ` (${a.originalName})` : ''}
              </a>
            )}
          </div>
        ))}
        <div className="mt-1 flex flex-wrap items-center gap-1 opacity-0 transition group-hover:opacity-100">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className="rounded bg-slate-100 px-1.5 py-0.5 text-sm sm:text-xs dark:bg-slate-700"
              onClick={() => onReaction(message, em)}
            >
              {em}
            </button>
          ))}
          {(message.channelId || message.conversationId) && !message.threadParentId ? (
            <button type="button" className="text-sm sm:text-xs text-violet-600 hover:underline" onClick={onThread}>
              Thread
            </button>
          ) : null}
          {!message.deletedAt && message.content ? (
            <button type="button" className="text-sm sm:text-xs text-slate-500 hover:underline" onClick={copyText}>
              Copy
            </button>
          ) : null}
          {!message.deletedAt && message.channelId && !message.threadParentId ? (
            <button type="button" className="text-sm sm:text-xs text-slate-500 hover:underline" onClick={pinMsg}>
              Pin
            </button>
          ) : null}
          {!message.deletedAt ? (
            <button type="button" className="text-sm sm:text-xs text-slate-500 hover:underline" onClick={saveMsg}>
              Save
            </button>
          ) : null}
          {!message.deletedAt ? (
            <button
              type="button"
              className="text-sm sm:text-xs text-slate-500 hover:underline"
              onClick={() => setShowTaskModal(true)}
            >
              Task
            </button>
          ) : null}
          {!message.deletedAt ? (
            <button
              type="button"
              className="text-sm sm:text-xs text-slate-500 hover:underline"
              onClick={() => setShowReminderModal(true)}
            >
              Remind
            </button>
          ) : null}
          {mine && !message.deletedAt ? (
            <>
              <button
                type="button"
                className="text-sm sm:text-xs text-slate-500 hover:underline"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button type="button" className="text-sm sm:text-xs text-red-600 hover:underline" onClick={remove}>
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
                className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-sm sm:text-xs dark:border-slate-600 dark:bg-slate-700"
              >
                {r.emoji} {r.userIds?.length || 0}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      </div>
      {showTaskModal ? (
        <Modal title="Create task" onClose={() => setShowTaskModal(false)}>
          <div className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Task from: <span className="font-semibold">{message.content ? message.content.slice(0, 80) : 'Attachment'}</span>
            </div>
            <label className="block text-sm">
              Due
              <select
                value={taskDueInMinutes}
                onChange={(e) => setTaskDueInMinutes(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="0">No due date</option>
                <option value="30">In 30 minutes</option>
                <option value="60">In 1 hour</option>
                <option value="120">In 2 hours</option>
                <option value="480">In 8 hours</option>
                <option value="1440">Tomorrow</option>
                <option value="10080">Next week</option>
              </select>
            </label>
            <button
              type="button"
              className="w-full rounded bg-violet-700 py-2 text-white"
              onClick={() => createTask()}
            >
              Create task
            </button>
          </div>
        </Modal>
      ) : null}
      {showReminderModal ? (
        <Modal title="Set reminder" onClose={() => setShowReminderModal(false)}>
          <div className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Reminder for: <span className="font-semibold">{message.content ? message.content.slice(0, 80) : 'Attachment'}</span>
            </div>
            <label className="block text-sm">
              Remind me
              <select
                value={remindInMinutes}
                onChange={(e) => setRemindInMinutes(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="15">In 15 minutes</option>
                <option value="30">In 30 minutes</option>
                <option value="60">In 1 hour</option>
                <option value="240">In 4 hours</option>
                <option value="1440">Tomorrow</option>
              </select>
            </label>
            <button
              type="button"
              className="w-full rounded bg-violet-700 py-2 text-white"
              onClick={() => createReminder()}
            >
              Create reminder
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
