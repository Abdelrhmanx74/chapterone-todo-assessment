import { TodoContext } from '@/contexts/todo-context';
import { THEME } from '@/lib/theme';
import { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, useColorScheme, View, Text } from 'react-native';
import { Bubble, GiftedChat, IMessage, InputToolbar, Send } from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPcLlmServerBaseUrl,
  isPcLlmServerReachable,
  pcTodoCompletion,
} from '@/services/pc-llm-service';

const AI_USER = {
  _id: 2,
  name: 'AI Assistant',
  avatar: 'https://avatar.iran.liara.run/public/12',
};

const USER = {
  _id: 1,
};

export default function Screen() {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(() => getPcLlmServerBaseUrl());
  const { todos, addTodo, updateTodo, deleteTodo } = useContext(TodoContext);
  const scheme = (useColorScheme() as 'light' | 'dark') ?? 'light';
  const theme = THEME[scheme];

  useEffect(() => {
    const init = async () => {
      try {
        setIsModelLoading(true);
        setModelError(null);

        const base = getPcLlmServerBaseUrl();
        setServerUrl(base);

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
        console.error('Failed to init model', e);
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
    };
    init();
  }, []);

  const normalizeText = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

  const looksLikeLastTodoRequest = (userMsg: string) => {
    const msg = normalizeText(userMsg);
    return (
      /(\blast\b).*(\btodo\b|\btask\b)/.test(msg) || /(\btodo\b|\btask\b).*(\blast\b)/.test(msg)
    );
  };

  const getLastTodoId = () => (todos.length > 0 ? todos[todos.length - 1].id : null);

  const handleAIResponse = async (text: string, userMsg: string) => {
    // Try to parse JSON actions
    try {
      // Look for JSON block
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const action = JSON.parse(jsonStr);

        let responseText = 'Done!';

        if (action.action === 'add') {
          await addTodo({
            id: Date.now(), // Simple ID generation
            title: action.title,
            completed: false,
            date: new Date(),
          });
          responseText = `Added todo: "${action.title}"`;
        } else if (action.action === 'delete') {
          let id = action.id !== undefined ? Number(action.id) : NaN;
          if (!Number.isFinite(id) && looksLikeLastTodoRequest(userMsg)) {
            const lastId = getLastTodoId();
            if (lastId !== null) id = lastId;
          }

          if (Number.isFinite(id) && todos.some((t) => t.id === id)) {
            await deleteTodo(id);
            responseText = `Deleted todo with ID: ${id}`;
          } else {
            responseText = 'Which todo should I delete?';
          }
        } else if (action.action === 'update') {
          let id = action.id !== undefined ? Number(action.id) : NaN;
          if (!Number.isFinite(id) && looksLikeLastTodoRequest(userMsg)) {
            const lastId = getLastTodoId();
            if (lastId !== null) id = lastId;
          }

          if (Number.isFinite(id)) {
            const todoToUpdate = todos.find((t) => t.id === id);
            if (todoToUpdate) {
              await updateTodo({
                ...todoToUpdate,
                title: action.title ?? todoToUpdate.title,
                completed: action.completed ?? todoToUpdate.completed,
              });
              responseText = `Updated todo: "${action.title ?? todoToUpdate.title}"`;
            } else {
              responseText = `Todo with ID ${id} not found.`;
            }
          } else {
            responseText = 'Which todo should I update?';
          }
        }

        // Add AI response confirming action
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
      console.log('Not a JSON action or failed to parse', e);
    }

    // If no action or parsing failed, just show the text
    setMessages((prev) =>
      GiftedChat.append(prev, [
        {
          _id: Math.random().toString(),
          text: text,
          createdAt: new Date(),
          user: AI_USER,
        },
      ])
    );
  };

  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      setMessages((prev) => GiftedChat.append(prev, newMessages));
      const userMsg = newMessages[0].text;

      if (!isModelReady) return;

      setIsTyping(true);
      try {
        const fullResponse = await pcTodoCompletion({
          modelId: 'qwen15',
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
    [isModelReady, serverUrl, todos]
  );

  if (!isModelReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.background,
        }}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.foreground, marginTop: 10 }}>
          {isModelLoading ? 'Connecting to PC LLM server...' : 'PC LLM server not reachable.'}
        </Text>
        {!!modelError && (
          <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 5 }}>
            {modelError}
          </Text>
        )}
        <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 5 }}>
          URL: {serverUrl ?? 'not set'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={USER}
        isTyping={isTyping}
        listProps={{ keyboardShouldPersistTaps: 'handled' }}
        textInputProps={{ style: { color: theme.foreground } }}
        timeTextStyle={{
          left: { color: theme.mutedForeground, fontSize: 11 },
          right: { color: theme.primaryForeground, fontSize: 11 },
        }}
      />
    </SafeAreaView>
  );
}
