import { User } from '../types';

interface StoredUser {
  id: string;
  email: string;
  password: string;
  name: string;
  avatar: string;
  bio?: string;
  diversityScore: number;
  connectionsUsed: number;
  connectionsMax: number;
  tier: string;
  createdAt: number;
}

const DB_NAME = 'BrickAuthDB';
const DB_VERSION = 1;
const USERS_STORE = 'users';
const CURRENT_USER_KEY = 'currentUser';

// Open IndexedDB for user storage
const openAuthDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(USERS_STORE)) {
        const store = db.createObjectStore(USERS_STORE, { keyPath: 'id' });
        store.createIndex('email', 'email', { unique: true });
      }
    };
  });
};

// Generate avatar based on name
const generateAvatar = (name: string): string => {
  const hue = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${hue.toString(16).padStart(6, '0')}&color=fff&size=400`;
};

// Hash password (simple implementation - in production use bcrypt or similar)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Register new user
export const registerUser = async (email: string, password: string, name: string): Promise<User> => {
  try {
    const db = await openAuthDB();
    
    // Check if user already exists
    const transaction = db.transaction([USERS_STORE], 'readonly');
    const store = transaction.objectStore(USERS_STORE);
    const index = store.index('email');
    const existingUser = await new Promise<StoredUser | undefined>((resolve) => {
      const request = index.get(email);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });
    
    if (existingUser) {
      throw new Error('User already exists with this email');
    }
    
    // Create new user
    const hashedPassword = await hashPassword(password);
    const userId = `user-${Date.now()}`;
    const storedUser: StoredUser = {
      id: userId,
      email,
      password: hashedPassword,
      name,
      avatar: generateAvatar(name),
      diversityScore: 0,
      connectionsUsed: 0,
      connectionsMax: 20,
      tier: 'Foundation',
      createdAt: Date.now(),
    };
    
    // Save to IndexedDB
    const writeTransaction = db.transaction([USERS_STORE], 'readwrite');
    const writeStore = writeTransaction.objectStore(USERS_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = writeStore.add(storedUser);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Convert to User type
    const user: User = {
      id: storedUser.id,
      name: storedUser.name,
      avatar: storedUser.avatar,
      bio: storedUser.bio,
      diversityScore: storedUser.diversityScore,
      connectionsUsed: storedUser.connectionsUsed,
      connectionsMax: storedUser.connectionsMax,
      tier: storedUser.tier as 'Sketcher' | 'Mason' | 'Architect',
      playlists: [],
      chosenArtists: [],
    };
    
    // Save as current user
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    
    return user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Login user
export const loginUser = async (email: string, password: string): Promise<User> => {
  try {
    const db = await openAuthDB();
    const transaction = db.transaction([USERS_STORE], 'readonly');
    const store = transaction.objectStore(USERS_STORE);
    const index = store.index('email');
    
    const storedUser = await new Promise<StoredUser | undefined>((resolve) => {
      const request = index.get(email);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });
    
    if (!storedUser) {
      throw new Error('User not found');
    }
    
    const hashedPassword = await hashPassword(password);
    if (storedUser.password !== hashedPassword) {
      throw new Error('Invalid password');
    }
    
    // Convert to User type
    const user: User = {
      id: storedUser.id,
      name: storedUser.name,
      avatar: storedUser.avatar,
      bio: storedUser.bio,
      diversityScore: storedUser.diversityScore,
      connectionsUsed: storedUser.connectionsUsed,
      connectionsMax: storedUser.connectionsMax,
      tier: storedUser.tier as 'Sketcher' | 'Mason' | 'Architect',
      playlists: [],
      chosenArtists: [],
    };
    
    // Save as current user
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    
    return user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  try {
    const userJson = localStorage.getItem(CURRENT_USER_KEY);
    if (!userJson) return null;
    return JSON.parse(userJson) as User;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Logout user
export const logoutUser = (): void => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

// Update user data
export const updateUser = async (user: User): Promise<void> => {
  try {
    const db = await openAuthDB();
    const transaction = db.transaction([USERS_STORE], 'readonly');
    const store = transaction.objectStore(USERS_STORE);
    
    const storedUser = await new Promise<StoredUser | undefined>((resolve) => {
      const request = store.get(user.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });
    
    if (!storedUser) {
      throw new Error('User not found in database');
    }
    
    // Update stored user
    const updatedStoredUser: StoredUser = {
      ...storedUser,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      diversityScore: user.diversityScore,
      connectionsUsed: user.connectionsUsed,
      connectionsMax: user.connectionsMax,
      tier: user.tier,
    };
    
    const writeTransaction = db.transaction([USERS_STORE], 'readwrite');
    const writeStore = writeTransaction.objectStore(USERS_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = writeStore.put(updatedStoredUser);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Update localStorage
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};
