const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script started');

contextBridge.exposeInMainWorld('api', {
  sendMessage: async (model, input, outputFormat) => {
    try {
      return await ipcRenderer.invoke('send-message', model, input, outputFormat);
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
});

console.log('Preload script completed');