require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const supabaseClient = require('./supabaseClient');

let OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('API Key length:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 'Not set');

// Rate limiting variables
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const MAX_REQUESTS_PER_WINDOW = 20;
let requestTimestamps = [];

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline';"]
      }
    })
  });
}

app.whenReady().then(() => {
  supabaseClient.initializeSupabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('send-message', async (event, model, input, outputFormat, chatId) => {
  return new Promise(async (resolve, reject) => {
    // Rate limiting check
    const now = Date.now();
    requestTimestamps = requestTimestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

    if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      reject(new Error('Rate limit exceeded. Please try again later.'));
      return;
    }

    requestTimestamps.push(now);

    try {
      let chat;
      if (!chatId) {
        // Create a new chat if chatId is not provided
        chat = await supabaseClient.createChat('New Chat');
        chatId = chat ? chat.id : null;
      }

      // Create a new message in the database
      if (chatId) {
        await supabaseClient.createChatMessage(chatId, 'user', input, 'text');
      }

      // Modify the input if JSON output is requested
      let modifiedInput = input;
      if (outputFormat === 'json' && !input.toLowerCase().includes('json')) {
        modifiedInput = `${input} Please provide the response in JSON format.`;
      }

      // Fetch previous messages for context
      let conversationHistory = [];
      if (chatId) {
        const previousMessages = await supabaseClient.getChatMessages(chatId);
        conversationHistory = previousMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      }
      conversationHistory.push({ role: 'user', content: modifiedInput });

      const data = JSON.stringify({
        model: model,
        messages: conversationHistory,
        response_format: { type: outputFormat === 'json' ? 'json_object' : 'text' },
      });

      console.log('Sending request with model:', model);
      console.log('Input:', modifiedInput);
      console.log('Output format:', outputFormat);

      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Length': data.length
        }
      };

      console.log('Request options:', JSON.stringify(options, null, 2));

      const req = https.request(options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', async () => {
          console.log('Response status code:', res.statusCode);
          console.log('Response body:', responseBody);

          if (res.statusCode === 200) {
            const responseData = JSON.parse(responseBody);
            const content = responseData.choices[0].message.content;

            // Store the bot's response in the database
            if (chatId) {
              await supabaseClient.createChatMessage(chatId, 'assistant', content, outputFormat);
            }

            resolve({
              content,
              format: outputFormat,
              chatId: chatId
            });
          } else {
            reject(new Error(`Request failed with status code ${res.statusCode}: ${responseBody}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Request error:', error);
        reject(error);
      });

      req.write(data);
      req.end();
    } catch (error) {
      console.error('Error in send-message:', error);
      reject(error);
    }
  });
});

ipcMain.handle('update-api-key', async (event, apiKey) => {
  OPENAI_API_KEY = apiKey;

  // Update the .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/^OPENAI_API_KEY=.*/m, `OPENAI_API_KEY=${apiKey}`);
  } else {
    envContent = `OPENAI_API_KEY=${apiKey}\n`;
  }

  fs.writeFileSync(envPath, envContent);

  // Reload the environment variables
  require('dotenv').config();

  return { success: true };
});

ipcMain.handle('create-chat', async (event, name) => {
  try {
    return await supabaseClient.createChat(name);
  } catch (error) {
    console.error('Error in create-chat handler:', error);
    throw error;
  }
});

ipcMain.handle('get-chat', async (event, id) => {
  try {
    return await supabaseClient.getChat(id);
  } catch (error) {
    console.error('Error in get-chat handler:', error);
    throw error;
  }
});

ipcMain.handle('update-chat', async (event, id, name) => {
  try {
    return await supabaseClient.updateChat(id, name);
  } catch (error) {
    console.error('Error in update-chat handler:', error);
    throw error;
  }
});

ipcMain.handle('delete-chat', async (event, id) => {
  try {
    return await supabaseClient.deleteChat(id);
  } catch (error) {
    console.error('Error in delete-chat handler:', error);
    throw error;
  }
});

ipcMain.handle('get-all-chats', async (event) => {
  try {
    return await supabaseClient.getAllChats();
  } catch (error) {
    console.error('Error in get-all-chats handler:', error);
    throw error;
  }
});

ipcMain.handle('create-chat-message', async (event, chatId, role, content, format) => {
  try {
    return await supabaseClient.createChatMessage(chatId, role, content, format);
  } catch (error) {
    console.error('Error in create-chat-message handler:', error);
    throw error;
  }
});

ipcMain.handle('get-chat-messages', async (event, chatId) => {
  try {
    return await supabaseClient.getChatMessages(chatId);
  } catch (error) {
    console.error('Error in get-chat-messages handler:', error);
    throw error;
  }
});

function toggleTheme() {
    const body = document.body;
    const isDarkMode = body.classList.toggle('dark-mode');
    body.classList.toggle('light-mode', !isDarkMode);

    // Toggle highlight.js stylesheets
    document.getElementById('highlight-dark').disabled = !isDarkMode;
    document.getElementById('highlight-light').disabled = isDarkMode;

    // Save the theme preference (you can add this if you want to persist the theme)
    localStorage.setItem('darkMode', isDarkMode);
}

// Call this function when initializing your app
function initializeTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);

    document.getElementById('highlight-dark').disabled = !isDarkMode;
    document.getElementById('highlight-light').disabled = isDarkMode;
}

// Make sure to call initializeTheme() when your app starts