require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const supabaseClient = require('./supabaseClient');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const url = require('url');

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

ipcMain.handle('send-message', async (event, model, input, outputFormat, chatId, useWebSearch) => {
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
        chat = await supabaseClient.createChat('New Chat');
        chatId = chat ? chat.id : null;
      }

      // Create a new message in the database
      if (chatId) {
        await supabaseClient.createChatMessage(chatId, 'user', input, outputFormat);
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
      conversationHistory.push({ role: 'user', content: input });

      let webSearchResults = '';
      if (useWebSearch) {
        const searchResults = await performWebSearch(input, 2, 8);
        if (searchResults.length > 0) {
          webSearchResults = JSON.stringify(searchResults);

          // Add web search results to conversation history
          conversationHistory.push({
            role: 'system',
            content: `Web search results for "${input}":\n${webSearchResults}\n\nPlease analyze these results, compare the information from different sources, and use them to provide a comprehensive and accurate answer to the user's query. Highlight any conflicting information and provide a balanced view if there are disagreements between sources. Note that ${searchResults.length} source${searchResults.length > 1 ? 's were' : ' was'} found.`
          });
        } else {
          conversationHistory.push({
            role: 'system',
            content: `No web search results were found for "${input}". Please provide the best answer you can based on your existing knowledge.`
          });
        }
      }

      const requestBody = {
        model: model,
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant with access to current information through web search when provided. Use this information to provide up-to-date and accurate responses.' },
          ...conversationHistory
        ],
      };

      if (outputFormat === 'json') {
        requestBody.response_format = { type: 'json_object' };
      }

      const data = JSON.stringify(requestBody);

      console.log('Sending request with body:', data);

      // Validate JSON
      try {
        JSON.parse(data);
        console.log('JSON is valid');
      } catch (jsonError) {
        console.error('Invalid JSON:', jsonError);
        reject(new Error('Invalid JSON payload'));
        return;
      }

      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(data)
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
              chatId: chatId,
              webSearchResults: webSearchResults
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

async function performWebSearch(query, minResults = 2, maxResults = 8) {
  let driver;
  try {
    const options = new chrome.Options();
    options.addArguments('--headless');
    
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    await driver.get(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    await driver.wait(until.elementLocated(By.css('div.g')), 10000);

    let searchResults = [];
    let attempts = 0;
    const maxAttempts = 5; // Increased from 3 to 5

    while (searchResults.length < maxResults && attempts < maxAttempts) {
      try {
        let results = await driver.findElements(By.css('div.g'));
        for (let i = searchResults.length; i < Math.min(results.length, maxResults); i++) {
          try {
            let result = results[i];
            let title = await driver.wait(until.elementIsVisible(await result.findElement(By.css('h3'))), 5000).getText();
            let link = await driver.wait(until.elementIsVisible(await result.findElement(By.css('a'))), 5000).getAttribute('href');
            let summary = await driver.wait(until.elementIsVisible(await result.findElement(By.css('div.VwiC3b'))), 5000).getText();

            let datePublished = await extractDatePublished(result);
            let domainName = extractDomainName(link);
            let pageContent = await extractPageContent(driver, link);

            searchResults.push({
              title,
              link,
              summary,
              datePublished,
              domainName,
              pageContent
            });
          } catch (elementError) {
            console.warn(`Skipping result ${i} due to error:`, elementError);
          }
        }
      } catch (error) {
        console.warn(`Attempt ${attempts + 1} failed:`, error);
      }
      attempts++;
      if (searchResults.length < maxResults) {
        await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
        await driver.sleep(1000);
      }
    }

    // If we don't have the minimum required results, but we have at least one, return what we have
    if (searchResults.length < minResults && searchResults.length > 0) {
      console.warn(`Found fewer results than the minimum required. Minimum: ${minResults}, Found: ${searchResults.length}`);
      return searchResults;
    }

    // If we have no results at all, throw an error
    if (searchResults.length === 0) {
      throw new Error(`No search results found for query: ${query}`);
    }

    return searchResults;
  } catch (error) {
    console.error('Error performing web search:', error);
    throw error;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

async function extractDatePublished(resultElement) {
  try {
    let dateElement = await resultElement.findElement(By.css('span.MUxGbd.wuQ4Ob.WZ8Tjf'));
    return await dateElement.getText();
  } catch (error) {
    return 'Date not found';
  }
}

function extractDomainName(link) {
  try {
    const parsedUrl = new URL(link);
    return parsedUrl.hostname;
  } catch (error) {
    return 'Domain not found';
  }
}

async function extractPageContent(driver, link) {
  try {
    await driver.get(link);
    await driver.wait(until.elementLocated(By.css('body')), 10000);

    const mainText = await driver.executeScript(`
      return document.body.innerText
        .replace(/\\s+/g, ' ')
        .trim()
        .substring(0, 1000);
    `);

    const headings = await driver.executeScript(`
      return Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => h.innerText.trim())
        .filter(h => h.length > 0)
        .slice(0, 5);
    `);

    const links = await driver.executeScript(`
      return document.links.length;
    `);

    const images = await driver.executeScript(`
      return document.images.length;
    `);

    return {
      mainText,
      headings,
      links,
      images
    };
  } catch (error) {
    console.error('Error extracting page content:', error);
    return {
      mainText: 'Content extraction failed',
      headings: [],
      links: 0,
      images: 0
    };
  }
}

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