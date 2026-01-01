import ThemeToggle from '@/components/theme-toggle';
import Todo from '@/components/todo/todo';

import { TodoContext } from '@/contexts/todo-context';
import { Stack } from 'expo-router';
import { useContext } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import TodoAddModal from '@/components/todo/todo-add-modal';

export default function Screen() {
  const { todos } = useContext(TodoContext);

  return (
    <>
      <Stack.Screen options={{ title: 'Todos', headerRight: () => <ThemeToggle /> }} />

      <View className="flex-1 items-center justify-center gap-4 p-4">
          {todos?.length === 0 ? (
            <Text>No todos available. Add some!</Text>
          ) : (
            todos.map((todo) => <Todo key={todo.id} {...todo} />)
          )}
          <TodoAddModal />
      </View>
    </>
  );
}
