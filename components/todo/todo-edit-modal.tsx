import React, { useContext, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { TodoContext } from '@/contexts/todo-context';
import { TODO } from '@/types/todo';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { Icon } from '../ui/icon';
import { Textarea } from '../ui/textarea';

const TodoEditModal = ({ todo }: { todo: TODO }) => {
  const { updateTodo } = useContext(TodoContext);
  const [open, setOpen] = useState(false);
  const { control, handleSubmit } = useForm({
    defaultValues: {
      title: todo.title,
      description: todo.description ?? '',
    },
  });

  const onSubmit: SubmitHandler<{ title: string; description?: string }> = async (data) => {
    console.log('todo-edit onSubmit data', data);
    const updated = { ...todo, ...data };
    console.log('todo-edit updatedTodo', updated);
    await updateTodo(updated);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <Text>Edit</Text>
          <Icon as={Pencil} size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Text>Edit {todo.title}</Text>
          </DialogTitle>
          <DialogDescription>
            <Text>Make changes to your todo item here. Click save when you're done.</Text>
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <Controller
            name="title"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Input
                placeholder="Title"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Textarea
                placeholder="Description (optional)"
                className="placeholder:text-muted-foreground"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <DialogFooter className="flex-row justify-end">
            <DialogClose asChild>
              <Button variant="ghost">
                <Text>Close</Text>
              </Button>
            </DialogClose>
            <Button onPress={handleSubmit(onSubmit)}>
              <Text>Save</Text>
            </Button>
          </DialogFooter>
        </View>
      </DialogContent>
    </Dialog>
  );
};

export default TodoEditModal;
