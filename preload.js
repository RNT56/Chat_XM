const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script started');

contextBridge.exposeInMainWorld('api', {
  sendMessage: async (model, input, outputFormat, chatId, useWebSearch) => {
    try {
      return await ipcRenderer.invoke('send-message', model, input, outputFormat, chatId, useWebSearch);
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  },
  updateApiKey: async (apiKey) => {
    try {
      return await ipcRenderer.invoke('update-api-key', apiKey);
    } catch (error) {
      console.error('Error in updateApiKey:', error);
      throw error;
    }
  },
  createChat: async (name) => {
    try {
      return await ipcRenderer.invoke('create-chat', name);
    } catch (error) {
      console.error('Error in createChat:', error);
      throw error;
    }
  },
  getChat: async (id) => {
    try {
      return await ipcRenderer.invoke('get-chat', id);
    } catch (error) {
      console.error('Error in getChat:', error);
      throw error;
    }
  },
  updateChat: async (id, name) => {
    try {
      return await ipcRenderer.invoke('update-chat', id, name);
    } catch (error) {
      console.error('Error in updateChat:', error);
      throw error;
    }
  },
  deleteChat: async (id) => {
    try {
      return await ipcRenderer.invoke('delete-chat', id);
    } catch (error) {
      console.error('Error in deleteChat:', error);
      throw error;
    }
  },
  getAllChats: async () => {
    try {
      return await ipcRenderer.invoke('get-all-chats');
    } catch (error) {
      console.error('Error in getAllChats:', error);
      throw error;
    }
  },
  createChatMessage: async (chatId, role, content, format) => {
    try {
      return await ipcRenderer.invoke('create-chat-message', chatId, role, content, format);
    } catch (error) {
      console.error('Error in createChatMessage:', error);
      throw error;
    }
  },
  getChatMessages: async (chatId) => {
    try {
      return await ipcRenderer.invoke('get-chat-messages', chatId);
    } catch (error) {
      console.error('Error in getChatMessages:', error);
      throw error;
    }
  }
});

console.log('Preload script completed');