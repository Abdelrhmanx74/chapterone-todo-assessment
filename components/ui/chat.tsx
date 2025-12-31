import React, { useCallback, useEffect, useState } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { GiftedChat, IMessage, Bubble, Send, InputToolbar } from 'react-native-gifted-chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@/lib/theme';
import { Button } from './button';
import { Icon } from './icon';
import { ArrowUp } from 'lucide-react-native';

type ChatProps = {
  initialMessages?: IMessage[];
  user?: { _id: string | number };
};

export default function Chat({ initialMessages = [], user = { _id: 1 } }: ChatProps) {
  const [messages, setMessages] = useState<IMessage[]>(initialMessages);
  const scheme = (useColorScheme() as 'light' | 'dark') ?? 'light';
  const theme = THEME[scheme];
  const insets = useSafeAreaInsets();

  const keyboardTopToolbarHeight = Platform.select({ ios: 44, default: 0 });
  const keyboardVerticalOffset = insets.bottom + keyboardTopToolbarHeight;

  useEffect(() => {
    if (initialMessages.length) setMessages(initialMessages);
  }, [initialMessages]);

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages((prev) => GiftedChat.append(prev, newMessages));
  }, []);

  const renderBubble = (props: any) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: {
            backgroundColor: theme.primary,
            paddingBottom: 4,
          },
          left: {
            backgroundColor: theme.secondary,
            paddingBottom: 4,
          },
        }}
        textStyle={{
          right: { color: theme.primaryForeground },
          left: { color: theme.secondaryForeground },
        }}
        bottomContainerStyle={{ right: { paddingBottom: 0 }, left: { paddingBottom: 0 } }}
        containerToNextStyle={{ right: { marginBottom: 2 }, left: { marginBottom: 2 } }}
        containerToPreviousStyle={{ right: { marginBottom: 2 }, left: { marginBottom: 2 } }}
      />
    );
  };

  const renderSend = (sendProps: any) => {
    const canSend = !!sendProps.text?.trim();
    return (
      <Send {...sendProps} containerStyle={{ justifyContent: 'center', marginRight: 8 }}>
        <Button
          variant="default"
          size="icon"
          disabled={!canSend}
          onPress={() => {
            sendProps.onSend({ text: sendProps.text.trim() }, true);
          }}>
          <Icon as={ArrowUp} size={16} className={undefined} />
        </Button>
      </Send>
    );
  };

  const renderInputToolbar = (props: any) => (
    <InputToolbar
      {...props}
      containerStyle={{
        backgroundColor: theme.input,
        borderTopColor: theme.border,
        borderTopWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 8,
      }}
      primaryStyle={{ alignItems: 'center' }}
    />
  );

  return (
    <GiftedChat
      messages={messages}
      onSend={onSend}
      user={user}
      renderBubble={renderBubble}
      renderSend={renderSend}
      renderInputToolbar={renderInputToolbar}
      keyboardAvoidingViewProps={{
        keyboardVerticalOffset,
        behavior: Platform.select({ ios: 'padding', default: undefined }),
      }}
      listProps={{ keyboardShouldPersistTaps: 'handled' }}
      textInputProps={{ style: { color: theme.foreground } }}
      timeTextStyle={{
        left: { color: theme.mutedForeground, fontSize: 11 },
        right: { color: theme.primaryForeground, fontSize: 11 },
      }}
      messageTextProps={{ linkStyle: { left: { color: '#3b82f6' }, right: { color: '#bfdbfe' } } }}
    />
  );
}
