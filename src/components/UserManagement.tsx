import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { signOut, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { db } from '../lib/firebase';
import { getAdminAuth, getUserManagementAuth, cleanupUserManagementAuth } from '../services/auth';
import { Shield, PlusCircle, LogOut, User } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import UserList from './UserList';
import RoleModal from './RoleModal';
import CreateUserModal from './CreateUserModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import LoadingSpinner from './LoadingSpinner';
import type { User as UserType, Role } from '../types/user';

export default function UserManagement() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const adminAuth = getAdminAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersCollection = collection(db, 'users');
      const snapshot = await getDocs(usersCollection);
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        lastUpdated: doc.data().lastUpdated?.toDate() || new Date()
      })) as UserType[];
      setUsers(usersData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
      setLoading(false);
    }
  };

  const handleCreateUser = async (email: string, password: string, role: Role) => {
    let managementAuth = null;
    try {
      managementAuth = getUserManagementAuth();
      const userCredential = await createUserWithEmailAndPassword(managementAuth, email, password);
      const { uid } = userCredential.user;

      const userDoc = {
        uid,
        email,
        role,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };

      await addDoc(collection(db, 'users'), userDoc);
      
      // Sign out the newly created user from the secondary auth instance
      if (managementAuth.currentUser) {
        await managementAuth.signOut();
      }

      toast.success('User created successfully');
      setIsCreateModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters');
      } else {
        toast.error('Failed to create user');
      }

      // Clean up if auth creation succeeded but Firestore failed
      if (managementAuth?.currentUser) {
        try {
          await deleteUser(managementAuth.currentUser);
        } catch (cleanupError) {
          console.error('Error cleaning up auth user:', cleanupError);
        }
      }
    } finally {
      // Always clean up the temporary auth instance
      cleanupUserManagementAuth();
    }
  };

  const handleEditRole = (user: UserType) => {
    setSelectedUser(user);
    setIsRoleModalOpen(true);
  };

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData = {
        role: newRole,
        lastUpdated: serverTimestamp()
      };

      await updateDoc(userRef, updateData);
      toast.success('User role updated successfully');
      fetchUsers();
      setIsRoleModalOpen(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleDeleteClick = (user: UserType) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;

    try {
      await deleteDoc(doc(db, 'users', selectedUser.id));
      toast.success('User deleted successfully');
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(adminAuth);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-indigo-600" />
              <h1 className="ml-3 text-xl font-semibold text-gray-900">User Roles Management</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-700">
                <User className="h-5 w-5 mr-2" />
                <span>{adminAuth.currentUser?.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0">
          <div className="flex justify-end mb-6">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Add User
            </button>
          </div>

          <UserList
            users={users}
            onEditRole={handleEditRole}
            onDeleteUser={handleDeleteClick}
          />

          <RoleModal
            user={selectedUser}
            isOpen={isRoleModalOpen}
            onClose={() => {
              setIsRoleModalOpen(false);
              setSelectedUser(null);
            }}
            onSave={handleUpdateRole}
          />

          <CreateUserModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSave={handleCreateUser}
          />

          <DeleteConfirmModal
            isOpen={isDeleteModalOpen}
            user={selectedUser}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedUser(null);
            }}
            onConfirm={handleDeleteConfirm}
          />
        </div>
      </main>
    </div>
  );
}