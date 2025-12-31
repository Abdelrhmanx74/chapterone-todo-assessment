import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { THEME } from '@/lib/theme';
import { ArrowRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Bubble, GiftedChat, IMessage, InputToolbar, Send } from 'react-native-gifted-chat';

const initialMessages = [
  {
    _id: 1,
    text: 'Hello developer',
    createdAt: new Date(),
    user: {
      _id: 2,
      name: 'React',
      avatar: 'https://avatar.iran.liara.run/public/12',
    },
  },
];

export default function Screen() {
  const [messages, setMessages] = useState<IMessage[]>(initialMessages);
  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages((prev) => GiftedChat.append(prev, newMessages));
  }, []);
  const scheme = (useColorScheme() as 'light' | 'dark') ?? 'light';
  const theme = THEME[scheme];

  // const renderBubble = (props: any) => {
  //   return (
  //     <Bubble
  //       {...props}
  //       wrapperStyle={{
  //         right: {
  //           backgroundColor: theme.primary,
  //           paddingBottom: 4,
  //         },
  //         left: {
  //           backgroundColor: theme.secondary,
  //           paddingBottom: 4,
  //         },
  //       }}
  //       textStyle={{
  //         right: { color: theme.primaryForeground },
  //         left: { color: theme.secondaryForeground },
  //       }}
  //       bottomContainerStyle={{ right: { paddingBottom: 0 }, left: { paddingBottom: 0 } }}
  //       containerToNextStyle={{ right: { marginBottom: 2 }, left: { marginBottom: 2 } }}
  //       containerToPreviousStyle={{ right: { marginBottom: 2 }, left: { marginBottom: 2 } }}
  //     />
  //   );
  // };

  // const renderSend = (sendProps: any) => {
  //   const canSend = !!sendProps.text?.trim();
  //   return (
  //     <Send {...sendProps} containerStyle={{ justifyContent: 'center', marginRight: 8 }}>
  //       <Icon as={ArrowRight} size={16} />
  //     </Send>
  //   );
  // };

  // const renderInputToolbar = (props: any) => (
  //   <InputToolbar
  //     {...props}
  //     containerStyle={{
  //       backgroundColor: theme.input,
  //       borderTopColor: theme.border,
  //       borderTopWidth: 1,
  //       paddingVertical: 6,
  //       paddingHorizontal: 8,
  //     }}
  //     primaryStyle={{ alignItems: 'center' }}
  //   />
  // );

  return (
    <GiftedChat
      messages={messages}
      onSend={onSend}
      user={{ _id: 1 }}
      // renderBubble={renderBubble}
      // renderSend={renderSend}
      // renderInputToolbar={renderInputToolbar}
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
