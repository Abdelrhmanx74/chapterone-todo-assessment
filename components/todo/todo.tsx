import { TODO } from '@/types/todo';
import React, { useContext } from 'react';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { EllipsisVertical } from 'lucide-react-native';
import { Text } from '../ui/text';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { View } from 'react-native';
import { Checkbox } from '../ui/checkbox';
import { TodoContext } from '@/contexts/todo-context';
import TodoEditModal from './todo-edit-modal';
import TodoDeleteButton from './todo-delete-button';
import { Badge } from '../ui/badge';

const Todo = (todo: TODO) => {
  const { updateTodo } = useContext(TodoContext);

  return (
    <Card className="w-full flex-row items-center justify-start gap-4 p-4">
      <Checkbox
        className="size-6 rounded-md"
        checked={todo.completed}
        onCheckedChange={async (checked) => {
          try {
            await updateTodo({ ...todo, completed: !!checked });
          } catch (e) {
            console.warn('Failed to toggle todo', e);
          }
        }}
      />
      <View className="flex-1">
        <Text className="text-base font-medium">{todo.title}</Text>
        {todo.description ? (
          <Text className="text-sm text-muted-foreground">{todo.description}</Text>
        ) : null}
      </View>
      {todo.by_ai ? (
        <Badge>
          <Text>By AI</Text>
        </Badge>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Icon as={EllipsisVertical} size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <TodoEditModal todo={todo} />
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <TodoDeleteButton id={todo.id} />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
};

export default Todo;
