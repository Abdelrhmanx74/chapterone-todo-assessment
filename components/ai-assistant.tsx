import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { PortalHost } from '@rn-primitives/portal';
import { TodoContext } from '@/contexts/todo-context';
import { THEME } from '@/lib/theme';
import {
  getPcLlmServerBaseUrl,
  isPcLlmServerReachable,
  PC_MODELS,
  pcTodoCompletion,
  type PcModelId,
} from '@/services/pc-llm-service';
import { Bot, ChevronDown, X, Send as SendIcon } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  Animated,
  Dimensions,
} from 'react-native';
import { GiftedChat, IMessage, Send, Bubble, InputToolbar } from 'react-native-gifted-chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AI_USER = {
  _id: 2,
  name: 'AI Assistant',
  avatar: 'https://avatar.iran.liara.run/public/12',
};

const USER = {
  _id: 1,
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(() => getPcLlmServerBaseUrl());
  const [selectedModelId, setSelectedModelId] = useState<PcModelId>('qwen15');

  const { todos, addTodo, updateTodo, deleteTodo } = useContext(TodoContext);
  const scheme = (useColorScheme() as 'light' | 'dark') ?? 'light';
  const theme = THEME[scheme];
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const initModel = useCallback(async () => {
    setIsModelLoading(true);
    setIsModelReady(false);
    setModelError(null);

    const base = getPcLlmServerBaseUrl();
    setServerUrl(base);

    try {
      const ok = await isPcLlmServerReachable(base ?? undefined);
      if (!ok) {
        throw new Error(
          base
            ? `Can't reach PC LLM server at ${base}`
            : 'PC LLM server URL not set (EXPO_PUBLIC_LLM_SERVER_URL)'
        );
      }

      setIsModelReady(true);
      setMessages([
        {
          _id: 1,
          text: 'Hello! I can help you manage your todos. Just tell me what to do.',
          createdAt: new Date(),
          user: AI_USER,
        },
      ]);
    } catch (e) {
      console.error('PC LLM server init failed', e);
      setIsModelReady(false);
      setModelError(e instanceof Error ? e.message : 'Failed to connect to PC LLM server');
      setMessages([
        {
          _id: 1,
          text: 'Failed to connect to PC LLM server.',
          createdAt: new Date(),
          user: AI_USER,
        },
      ]);
    } finally {
      setIsModelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen]);

  useEffect(() => {
    // Initialize in background even if closed
    initModel();

    return () => {
      // Don't cleanup here if we want it to persist across opens/closes
      // But maybe cleanup on unmount of the whole app
    };
  }, [initModel]);

  const handleAIResponse = async (text: string, userMsg: string) => {
    console.log('AI Raw Response:', text);
    try {
      // Strip markdown code blocks if present
      const cleaned = text
        .replace(/```json?\s*/gi, '')
        .replace(/```/g, '')
        .trim();

      const lower = cleaned.toLowerCase();

      // Try to parse either a JSON array or a JSON object from the model output.
      const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
      const objectMatch = cleaned.match(/\{[\s\S]*?\}/);

      const parsedRoot = arrayMatch
        ? JSON.parse(arrayMatch[0])
        : objectMatch
          ? JSON.parse(objectMatch[0])
          : null;

      type Op =
        | { action: 'add'; title: string }
        | { action: 'delete'; id: number }
        | { action: 'update'; id: number; title?: string; completed?: boolean };

      const ops: Op[] = [];

      const inferAction = (maybe: any, rawLower: string): 'add' | 'delete' | 'update' | null => {
        if (typeof maybe?.action === 'string') {
          const a = maybe.action.toLowerCase();
          if (a === 'add' || a === 'delete' || a === 'update') return a;
        }
        if (rawLower.includes('delete') || rawLower.includes('remove')) return 'delete';
        if (rawLower.includes('add') || rawLower.includes('create')) return 'add';
        if (
          rawLower.includes('update') ||
          rawLower.includes('edit') ||
          rawLower.includes('complete')
        )
          return 'update';
        return null;
      };

      const splitNumberedPair = (title: string): string[] => {
        const m = title.match(/^(.*?)(\d+)\s+and\s+(\d+)\s*$/i);
        if (!m) return [title];

        const trimTrailingPunct = (s: string) => {
          let out = s.trim();
          while (out.endsWith('-') || out.endsWith(':') || out.endsWith(',')) {
            out = out.slice(0, -1).trimEnd();
          }
          return out;
        };

        const base = trimTrailingPunct(m[1]);
        const a = m[2];
        const b = m[3];
        if (!base) return [title];
        return [`${base} ${a}`.trim(), `${base} ${b}`.trim()];
      };

      const normalizeToOps = (node: any) => {
        if (!node) return;

        // If model returns { actions: [...] }
        if (Array.isArray(node.actions)) {
          for (const a of node.actions) normalizeToOps(a);
          return;
        }

        // If model returns a list directly
        if (Array.isArray(node)) {
          for (const item of node) normalizeToOps(item);
          return;
        }

        const action = inferAction(node, lower);
        if (!action) return;

        // Multi-delete: { action:"delete", ids:[...] }
        if (action === 'delete' && Array.isArray(node.ids)) {
          for (const id of node.ids) {
            const n = Number(id);
            if (Number.isFinite(n)) ops.push({ action: 'delete', id: n });
          }
          return;
        }

        // Multi-update: { action:"update", updates:[{id,...}, ...] }
        if (action === 'update' && Array.isArray(node.updates)) {
          for (const u of node.updates) {
            const n = Number(u?.id);
            if (!Number.isFinite(n)) continue;
            ops.push({
              action: 'update',
              id: n,
              title: typeof u?.title === 'string' ? u.title : undefined,
              completed: typeof u?.completed === 'boolean' ? u.completed : undefined,
            });
          }
          return;
        }

        // Multi-add: { action:"add", titles:[...] }
        if (action === 'add' && Array.isArray(node.titles)) {
          for (const t of node.titles) {
            if (typeof t !== 'string') continue;
            for (const split of splitNumberedPair(t)) {
              ops.push({ action: 'add', title: split });
            }
          }
          return;
        }

        // Single operations
        if (action === 'add' && typeof node.title === 'string') {
          for (const split of splitNumberedPair(node.title)) {
            ops.push({ action: 'add', title: split });
          }
          return;
        }

        if (action === 'delete' && node.id !== undefined) {
          const n = Number(node.id);
          if (Number.isFinite(n)) ops.push({ action: 'delete', id: n });
          return;
        }

        if (action === 'update' && node.id !== undefined) {
          const n = Number(node.id);
          if (!Number.isFinite(n)) return;
          ops.push({
            action: 'update',
            id: n,
            title: typeof node.title === 'string' ? node.title : undefined,
            completed: typeof node.completed === 'boolean' ? node.completed : undefined,
          });
          return;
        }
      };

      normalizeToOps(parsedRoot);

      if (ops.length > 0) {
        let added = 0;
        let deleted = 0;
        let updated = 0;

        for (const op of ops) {
          if (op.action === 'add') {
            await addTodo({
              id: Date.now() + Math.floor(Math.random() * 1000),
              title: op.title,
              completed: false,
              by_ai: true,
            });
            added += 1;
          } else if (op.action === 'delete') {
            await deleteTodo(op.id);
            deleted += 1;
          } else if (op.action === 'update') {
            const todoToUpdate = todos.find((t) => t.id === Number(op.id));
            if (todoToUpdate) {
              await updateTodo({
                ...todoToUpdate,
                title: op.title ?? todoToUpdate.title,
                completed: op.completed ?? todoToUpdate.completed,
              });
              updated += 1;
            }
          }
        }

        const responseText =
          added > 0 && deleted === 0 && updated === 0
            ? `✅ Added ${added} task(s).`
            : deleted > 0 && added === 0 && updated === 0
              ? `🗑️ Deleted ${deleted} task(s).`
              : updated > 0 && added === 0 && deleted === 0
                ? `📝 Updated ${updated} task(s).`
                : `✅ Done. Added ${added}, deleted ${deleted}, updated ${updated}.`;

        setMessages((prev) =>
          GiftedChat.append(prev, [
            {
              _id: Math.random().toString(),
              text: responseText,
              createdAt: new Date(),
              user: AI_USER,
            },
          ])
        );
        return;
      }
    } catch (e) {
      console.error('AI Action Error:', e);
    }

    // Local fallback (no JSON from model): try to execute from the user's message.
    // This keeps the model "free", but ensures the app still works.
    const msg = userMsg.trim();
    const msgLower = msg.toLowerCase();

    const appendAssistant = (assistantText: string) => {
      setMessages((prev) =>
        GiftedChat.append(prev, [
          {
            _id: Math.random().toString(),
            text: assistantText,
            createdAt: new Date(),
            user: AI_USER,
          },
        ])
      );
    };

    // Delete "last" todo
    if ((msgLower.includes('delete') || msgLower.includes('remove')) && msgLower.includes('last')) {
      const last = todos[todos.length - 1];
      if (last) {
        await deleteTodo(Number(last.id));
        appendAssistant(`🗑️ Deleted last task #${last.id}`);
        return;
      }
    }

    // Add tasks: "add two new tasks X and Y" / "add X and Y" / "add: X, Y"
    if (msgLower.startsWith('add') || msgLower.startsWith('create')) {
      const afterVerb = msg.replace(/^\s*(add|create)\s*/i, '').trim();
      const afterLabel = afterVerb.replace(/^\s*(\d+\s+)?(new\s+)?(tasks?|todos?)\s*/i, '').trim();
      const payload = afterLabel.replace(/^[:\-]\s*/, '').trim();

      const titles: string[] = [];

      // Special case: "watch movie 1 and 2" => two titles
      const numberedPair = payload.match(/^(.*?)(\d+)\s+and\s+(\d+)\s*$/i);
      if (numberedPair) {
        const trimTrailingPunct = (s: string) => {
          let out = s.trim();
          while (out.endsWith('-') || out.endsWith(':') || out.endsWith(',')) {
            out = out.slice(0, -1).trimEnd();
          }
          return out;
        };

        const base = trimTrailingPunct(numberedPair[1]);
        const a = numberedPair[2];
        const b = numberedPair[3];
        if (base) {
          titles.push(`${base} ${a}`.trim());
          titles.push(`${base} ${b}`.trim());
        }
      } else {
        // Generic split on commas and "and"
        const parts = payload
          .split(/\s*,\s*|\s+and\s+/i)
          .map((p) => p.trim())
          .filter(Boolean);

        titles.push(...parts);
      }

      if (titles.length > 0) {
        for (const title of titles) {
          await addTodo({
            id: Date.now() + Math.floor(Math.random() * 1000),
            title,
            completed: false,
            by_ai: true,
          });
        }
        appendAssistant(`✅ Added ${titles.length} task(s).`);
        return;
      }
    }

    // Fallback for plain text or failed parse
    let displayText = text;
    if (text.trim() === '{}' || text.trim() === '{ }') {
      displayText = "I'm sorry, I didn't understand that. Please try again.";
    }

    setMessages((prev) =>
      GiftedChat.append(prev, [
        {
          _id: Math.random().toString(),
          text: displayText,
          createdAt: new Date(),
          user: AI_USER,
        },
      ])
    );
  };

  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      if (isTyping) return;
      setMessages((prev) => GiftedChat.append(prev, newMessages));
      const userMsg = newMessages[0].text;

      if (!isModelReady) return;

      setIsTyping(true);
      try {
        const fullResponse = await pcTodoCompletion({
          modelId: selectedModelId,
          userMsg,
          todos: todos.map((t) => ({ id: t.id, title: t.title, completed: t.completed })),
          baseUrl: serverUrl ?? undefined,
        });

        handleAIResponse(fullResponse, userMsg);
      } catch (e) {
        console.error(e);
        setMessages((prev) =>
          GiftedChat.append(prev, [
            {
              _id: Math.random().toString(),
              text:
                e instanceof Error
                  ? `Server error: ${e.message}`
                  : 'Server error while generating response.',
              createdAt: new Date(),
              user: AI_USER,
            },
          ])
        );
      } finally {
        setIsTyping(false);
      }
    },
    [isModelReady, isTyping, selectedModelId, serverUrl, todos]
  );

  const renderBubble = (props: any) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: {
            backgroundColor: theme.primary,
          },
          left: {
            backgroundColor: theme.muted,
          },
        }}
        textStyle={{
          right: {
            color: theme.primaryForeground,
          },
          left: {
            color: theme.foreground,
          },
        }}
      />
    );
  };

  const renderSend = (props: any) => {
    return (
      <Send {...props}>
        <View className="mb-2 mr-4">
          <Icon as={SendIcon} size={24} className="text-primary" />
        </View>
      </Send>
    );
  };

  return (
    <>
      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.primary,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
          zIndex: 50,
        }}>
        <Icon as={Bot} size={28} color={theme.primaryForeground} />
      </TouchableOpacity>

      {/* Bottom Sheet Modal */}
      <Modal
        transparent
        visible={isOpen}
        animationType="none"
        onRequestClose={() => setIsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <Animated.View
            style={{
              height: '80%',
              backgroundColor: theme.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              transform: [{ translateY: slideAnim }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 10,
            }}>
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border p-4">
              <View className="flex-row items-center gap-2">
                <Icon as={Bot} size={24} className="text-primary" />
                <Text className="text-lg font-semibold text-foreground">AI Assistant</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Text className="text-foreground">
                        {PC_MODELS.find((m) => m.id === selectedModelId)?.label ?? selectedModelId}
                      </Text>
                      <Icon as={ChevronDown} size={16} className="ml-2 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" portalHost="ai-assistant-portal">
                    <DropdownMenuRadioGroup
                      value={selectedModelId}
                      onValueChange={(v) => setSelectedModelId(v as PcModelId)}>
                      {PC_MODELS.map((m) => (
                        <DropdownMenuRadioItem key={m.id} value={m.id}>
                          <Text>{m.label}</Text>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="ghost" size="icon" onPress={() => setIsOpen(false)}>
                  <Icon as={X} size={24} className="text-muted-foreground" />
                </Button>
              </View>
            </View>

            {/* Chat Content */}
            <View style={{ flex: 1, backgroundColor: theme.background }}>
              {!isModelReady ? (
                <View className="flex-1 items-center justify-center p-4">
                  {isModelLoading ? (
                    <>
                      <ActivityIndicator size="large" color={theme.primary} />
                      <Text className="mt-4 text-center text-foreground">
                        Connecting to PC LLM server...
                      </Text>
                      <Text className="mt-2 text-center text-xs text-muted-foreground">
                        Server URL: {serverUrl ?? 'not set'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text className="text-center text-foreground">
                        PC LLM server is not reachable.
                      </Text>
                      {!!modelError && (
                        <Text className="mt-2 text-center text-xs text-muted-foreground">
                          {modelError}
                        </Text>
                      )}
                      <Text className="mt-2 text-center text-xs text-muted-foreground">
                        URL: {serverUrl ?? 'not set'}
                      </Text>
                      <View className="mt-4 flex-row gap-2">
                        <Button onPress={() => initModel()}>
                          <Text className="text-primary-foreground">Retry</Text>
                        </Button>
                      </View>
                    </>
                  )}
                </View>
              ) : (
                <GiftedChat
                  messages={messages}
                  onSend={onSend}
                  user={USER}
                  isTyping={isTyping}
                  renderBubble={renderBubble}
                  renderSend={renderSend}
                  // alwaysShowSend
                  // scrollToBottom
                  textInputProps={{
                    style: {
                      color: theme.foreground,
                      flex: 1,
                      paddingTop: 10,
                      paddingBottom: 10,
                      paddingLeft: 10,
                    },
                  }}
                />
              )}
            </View>
            <View style={{ height: insets.bottom }} />
            <PortalHost name="ai-assistant-portal" />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
