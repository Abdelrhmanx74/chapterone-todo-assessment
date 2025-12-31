import { TODO } from '@/types/todo';
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type TodoContextType = {
  todos: TODO[];
  addTodo: (todo: TODO) => Promise<void>;
  getTodos: () => Promise<TODO[]>;
  updateTodo: (todo: TODO) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
};

const STORAGE_KEY = 'todos';

export const TodoContext = createContext<TodoContextType>({
  todos: [],
  addTodo: async () => {},
  getTodos: async () => [],
  updateTodo: async () => {},
  deleteTodo: async () => {},
});

export function TodoProvider({ children }: { children: React.ReactNode }) {
  const [todos, setTodos] = useState<TODO[]>([]);

  // Add a todo: update in-memory state and persist the new list
  const addTodo = async (todo: TODO): Promise<void> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as TODO[]) : todos;
      const next = [...prev, todo];
      setTodos(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('addTodo failed', e);
    }
  };

  // Read todos from storage without changing in-memory state
  const getTodos = async (): Promise<TODO[]> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const next = raw ? (JSON.parse(raw) as TODO[]) : [];
      setTodos(next);
      return next;
    } catch (e) {
      console.warn('getTodos failed', e);
      return [];
    }
  };

  const updateTodo = async (updatedTodo: TODO): Promise<void> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as TODO[]) : todos;
      const next = prev.map((todo) => (todo.id === updatedTodo.id ? updatedTodo : todo));
      setTodos(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('updateTodo failed', e);
    }
  };

  const deleteTodo = async (id: number): Promise<void> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as TODO[]) : todos;
      const next = prev.filter((todo) => todo.id !== id);
      setTodos(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('deleteTodo failed', e);
    }
  };

  useEffect(() => {
    getTodos();
  }, []);

  return (
    <TodoContext.Provider value={{ todos, addTodo, getTodos, updateTodo, deleteTodo }}>
      {children}
    </TodoContext.Provider>
  );
}
