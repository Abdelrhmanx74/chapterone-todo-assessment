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
import { Plus } from 'lucide-react-native';
import { Icon } from '../ui/icon';
import { Textarea } from '../ui/textarea';

type FormValues = { title: string; description?: string };

const TodoAddModal = () => {
  const { addTodo } = useContext(TodoContext);
  const [open, setOpen] = useState(false);
  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { title: '', description: '' },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    const newTodo: TODO = {
      id: Date.now(),
      title: data.title,
      description: data.description,
      completed: false,
      by_ai: false,
    };

    try {
      await addTodo(newTodo);
      reset();
      setOpen(false);
    } catch (e) {
      console.warn('addTodo failed', e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-dashed">
          <Text>Add</Text>
          <Icon as={Plus} size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[25rem]">
        <DialogHeader>
          <DialogTitle>
            <Text>New Todo</Text>
          </DialogTitle>
          <DialogDescription>
            <Text>Create a new todo item.</Text>
          </DialogDescription>
        </DialogHeader>
        <View className="gap-3">
          <Controller
            name="title"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Input
                autoFocus
                placeholder="Title"
                className="placeholder:text-muted-foreground"
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
              <Text>Create</Text>
            </Button>
          </DialogFooter>
        </View>
      </DialogContent>
    </Dialog>
  );
};

export default TodoAddModal;
