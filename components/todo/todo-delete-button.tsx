import React, { useContext, useState } from 'react';
import { Button } from '../ui/button';
import { TODO } from '@/types/todo';
import { TodoContext } from '@/contexts/todo-context';
import { Text } from '../ui/text';
import { Trash2 } from 'lucide-react-native';
import { Icon } from '../ui/icon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const TodoDeleteButton = ({ id }: { id: TODO['id'] }) => {
  const { deleteTodo } = useContext(TodoContext);
  const [open, setOpen] = useState(false);

  const onPress = async () => {
    try {
      await deleteTodo(id);
      setOpen(false);
    } catch (e) {
      console.warn('Failed to delete todo', e);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Text>Delete</Text>
          <Icon as={Trash2} size={16} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Text>Are you sure?</Text>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Text>This action cannot be undone. This will permanently delete the todo item.</Text>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Text>Cancel</Text>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onPress={onPress}>
              <Text>Continue</Text>
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TodoDeleteButton;
