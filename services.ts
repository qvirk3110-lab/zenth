


import { IDBPDatabase, openDB } from 'idb';
import { User, Task, Settings, CompletedTask, Achievement, Category } from './types.ts';
import dayjs from 'dayjs';

const DB_NAME = 'ZenithDB';
const DB_VERSION = 2; // Incremented version for schema change

// --- Database Service ---
let dbPromise: Promise<IDBPDatabase> | null = null;

const getDb = (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('currentUser')) {
          db.createObjectStore('currentUser', { keyPath: 'id' });
        }
        if (db.objectStoreNames.contains('routines')) { // Migration from old version
            db.deleteObjectStore('routines');
        }
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('history')) {
          db.createObjectStore('history', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains('achievements')) {
            db.createObjectStore('achievements', { keyPath: 'id' });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('categories')) {
           db.createObjectStore('categories', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

// Generic DB operations
export const db = {
  get: async <T,>(storeName: string, key: any): Promise<T | undefined> => {
    return (await getDb()).get(storeName, key);
  },
  getAll: async <T,>(storeName: string): Promise<T[]> => {
    return (await getDb()).getAll(storeName);
  },
  put: async (storeName: string, value: any): Promise<any> => {
    return (await getDb()).put(storeName, value);
  },
  delete: async (storeName: string, key: any): Promise<void> => {
    return (await getDb()).delete(storeName, key);
  },
  clear: async (storeName: string): Promise<void> => {
    return (await getDb()).clear(storeName);
  },
};

// Specific helpers
export const dbService = {
  // User
  addUser: (user: User) => db.put('users', user),
  getUser: (id: number): Promise<User | undefined> => db.get('users', id),
  getUserByEmail: async (email: string) => {
    const users = await db.getAll<User>('users');
    return users.find(u => u.email === email);
  },
  updateUser: (user: User) => db.put('users', user),
  
  // Current User Session
  setCurrentUser: (user: User) => db.put('currentUser', { ...user, id: 1 }),
  getCurrentUser: (): Promise<User | undefined> => db.get('currentUser', 1),
  clearCurrentUser: () => db.delete('currentUser', 1),

  // Categories
  getCategories: () => db.getAll<Category>('categories'),
  saveCategories: async (categories: Category[]) => {
    const dbInstance = await getDb();
    const tx = dbInstance.transaction('categories', 'readwrite');
    await Promise.all([tx.store.clear(), ...categories.map(c => tx.store.put(c))]);
    await tx.done;
  },

  // Tasks
  getTasks: () => db.getAll<Task>('tasks'),
  saveTask: (task: Task) => db.put('tasks', task),
  deleteTask: (taskId: string) => db.delete('tasks', taskId),
  saveTasks: async (tasks: Task[]) => {
    const dbInstance = await getDb();
    const tx = dbInstance.transaction('tasks', 'readwrite');
    await tx.store.clear();
    await Promise.all(tasks.map(t => tx.store.put(t)));
    await tx.done;
  },
  
  // History
  getHistory: () => db.getAll<CompletedTask>('history'),
  addToHistory: (task: CompletedTask) => db.put('history', task),
  
  // Settings
  getSettings: (userId: number) => db.get<Settings>('settings', userId),
  saveSettings: (settings: Settings & { userId: number }) => db.put('settings', settings),

  // Achievements
  getAchievements: () => db.getAll<Achievement>('achievements'),
  saveAchievements: async (achievements: Achievement[]) => {
     const dbInstance = await getDb();
     const tx = dbInstance.transaction('achievements', 'readwrite');
     await Promise.all(achievements.map(a => tx.store.put(a)));
     await tx.done;
  }
};

export const dataService = {
  exportData: async (): Promise<string> => {
    const tasks = await db.getAll('tasks');
    const history = await db.getAll('history');
    const categories = await db.getAll('categories');
    const achievements = await db.getAll('achievements');
    const users = await db.getAll('users');
    const settings = await db.getAll('settings');

    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      data: { tasks, history, categories, achievements, users, settings }
    };
    return JSON.stringify(data, null, 2);
  },

  importData: async (jsonString: string): Promise<void> => {
    const backup = JSON.parse(jsonString);
    if (backup.version !== 2 || !backup.data) {
      throw new Error("Invalid or incompatible backup file.");
    }
    const { tasks = [], history = [], categories = [], achievements = [], users = [], settings = [] } = backup.data;
    
    const stores = ['tasks', 'history', 'categories', 'achievements', 'users', 'settings'];
    const dataMap: {[key: string]: any[]} = { tasks, history, categories, achievements, users, settings };
    
    const dbInstance = await getDb();
    const tx = dbInstance.transaction(stores, 'readwrite');
    
    await Promise.all(stores.map(async (storeName) => {
        // Fix: 'tx.store' is possibly 'undefined'. Get the specific store from the transaction.
        const store = tx.objectStore(storeName as any);
        await store.clear();
        for (const item of dataMap[storeName]) {
            // Fix: 'tx.store' is possibly 'undefined'. Use the retrieved store object.
            await store.put(item);
        }
    }));

    await tx.done;
  }
};


export const createDefaultTasks = (categories: Category[]): Task[] => {
    const now = dayjs();
    const findCatId = (name: string) => categories.find(c => c.name.toLowerCase() === name)?.id || categories[0]?.id || 'work';

    const tasks: Omit<Task, 'id' | 'order' | 'createdAt'>[] = [
        {
            title: 'Sleeping',
            startTime: now.startOf('day').hour(0).valueOf(),
            endTime: now.startOf('day').hour(7).valueOf(),
            status: 'pending', priority: 'low', categoryId: findCatId('rest'),
        },
        {
            title: 'Morning Routine & Breakfast',
            startTime: now.startOf('day').hour(7).valueOf(),
            endTime: now.startOf('day').hour(8).valueOf(),
            status: 'pending', priority: 'medium', categoryId: findCatId('rest'),
        },
        {
            title: 'Work / College',
            startTime: now.startOf('day').hour(9).valueOf(),
            endTime: now.startOf('day').hour(13).valueOf(),
            status: 'pending', priority: 'high', categoryId: findCatId('work'),
        },
        {
            title: 'Lunch Break',
            startTime: now.startOf('day').hour(13).valueOf(),
            endTime: now.startOf('day').hour(14).valueOf(),
            status: 'pending', priority: 'medium', categoryId: findCatId('rest'),
        },
        {
            title: 'Work / College (Part 2)',
            startTime: now.startOf('day').hour(14).valueOf(),
            endTime: now.startOf('day').hour(17).valueOf(),
            status: 'pending', priority: 'high', categoryId: findCatId('work'),
        },
        {
            title: 'Exercise',
            startTime: now.startOf('day').hour(18).valueOf(),
            endTime: now.startOf('day').hour(19).valueOf(),
            status: 'pending', priority: 'medium', categoryId: findCatId('exercise'),
        },
        {
            title: 'Dinner & Relaxation',
            startTime: now.startOf('day').hour(20).valueOf(),
            endTime: now.startOf('day').hour(22).valueOf(),
            status: 'pending', priority: 'low', categoryId: findCatId('rest'),
        }
    ];

    return tasks.map((task, index) => ({
        ...task,
        id: crypto.randomUUID(),
        order: index,
        createdAt: Date.now(),
    }));
};

const scheduledNotifications = new Map<string, number[]>();

// --- Notification Service ---
export const notificationService = {
  async requestPermission() {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notification');
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  },

  showNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          reg.showNotification(title, options);
        } else {
            new Notification(title, options);
        }
      });
    }
  },

  cancelTaskNotifications(taskId: string) {
    if (scheduledNotifications.has(taskId)) {
        scheduledNotifications.get(taskId)?.forEach(timeoutId => clearTimeout(timeoutId));
        scheduledNotifications.delete(taskId);
    }
  },

  scheduleTaskNotifications(task: Task) {
    this.cancelTaskNotifications(task.id);
    if (task.status === 'completed') return;

    const now = Date.now();
    const timeoutIds: number[] = [];

    // Start Notification
    if (task.startTime > now) {
      const startDelay = task.startTime - now;
      const startTimeoutId = setTimeout(() => {
        this.showNotification(`Task Started: ${task.title}`, {
          body: `It's time to begin "${task.title}". You can do it!`,
          icon: '/icons/icon-192x192.png',
          tag: `task-start-${task.id}`
        });
      }, startDelay);
      timeoutIds.push(startTimeoutId as any);
    }
    
    // End/Overdue Notification
    if (task.endTime > now) {
        const endDelay = task.endTime - now;
        const endTimeoutId = setTimeout(async () => {
          // Re-fetch task to check its latest status
          const currentTask = await db.get<Task>('tasks', task.id);
          if (currentTask?.status !== 'completed') {
             this.showNotification(`Task Overdue: ${task.title}`, {
                body: `Your task "${task.title}" was due. Don't forget to complete it!`,
                icon: '/icons/icon-192x192.png',
                tag: `task-end-${task.id}`
            });
          } else {
            this.showNotification(`Task Ended: ${task.title}`, {
                body: `Time's up for "${task.title}". Hope you finished it!`,
                icon: '/icons/icon-192x192.png',
                tag: `task-end-${task.id}`
            });
          }
        }, endDelay);
        timeoutIds.push(endTimeoutId as any);
    }
    
    if (timeoutIds.length > 0) {
        scheduledNotifications.set(task.id, timeoutIds);
    }
  },

  scheduleDailySummary(completed: number, total: number) {
      const now = new Date();
      const summaryTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0); // 9 PM
      const delay = summaryTime.getTime() - now.getTime();
      if(delay > 0) {
          setTimeout(() => {
              this.showNotification('Daily Summary', {
                  body: `You completed ${completed} out of ${total} tasks today. Great job!`,
                  icon: '/icons/icon-192x192.png'
              });
          }, delay);
      }
  }
};