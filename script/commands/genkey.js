const fs = require('fs');
const path = require('path');
const moment = require('moment');

module.exports = {
    eurix: {
        name: 'genkey',
        description: 'Generate an API key',
        usage: '/genkey', 
    },
    async execute(bot, msg, args) {
        const config = require('../../config.json');
        if (msg.from.id.toString() !== config.admin[0]) {
            return bot.sendMessage(msg.chat.id, "⚠️ Only the system owner can use this command.");
        }
        try {
            if (args.length === 0) {
                return bot.sendMessage(msg.chat.id, '⚠️ *Example Commands:*\n\n`/genkey 1dev 1days devid` - _1 Key 1 Dev_\n`/genkey alldev 1days` - _1 Key All Dev_', { parse_mode: 'Markdown' });
                    }

            if (args[0].toLowerCase() === 'delete') {
                const username = 'Eugene Aguilar';
                const keyFilePath = path.join(__dirname, '../../USERPANEL', `${username}.json`);

                if (!fs.existsSync(keyFilePath)) {
                    return bot.sendMessage(msg.chat.id, '❌ No API keys found.');
                }

                const keysData = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
                const keys = Object.keys(keysData);

                if (keys.length === 0) {
                    return bot.sendMessage(msg.chat.id, '❌ No API keys found.');
                }

                let keyList = '📝 Here are the available keys for deletion:\n\n';
                keys.forEach((key, index) => {
                    keyList += `${index + 1}. ${key}\n   Expires: ${keysData[key].expirationDate}\n   Type: ${keysData[key].type}\n`;
                    if (keysData[key].zipCode) {
                        keyList += `   Device ID: ${keysData[key].zipCode}\n`;
                    }
                    keyList += '\n';
                });
                keyList += 'Reply with a number to delete the corresponding key.';

                return bot.sendMessage(msg.chat.id, keyList);
            }
            if (args[0].toLowerCase() === 'list') {
                const username = 'ForVipUsers';
                const keyFilePath = path.join(__dirname, '../../USERPANEL', `${username}.json`);

                if (!fs.existsSync(keyFilePath)) {
                    return bot.sendMessage(msg.chat.id, '❌ No API keys found.');
                }

                const keysData = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));

                if (Object.keys(keysData).length === 0) {
                    return bot.sendMessage(msg.chat.id, '❌ No API keys found.');
                }

                let message = '📑 <b>API Keys Information:</b>\n\n';
                for (const [key, data] of Object.entries(keysData)) {
                    message += `🔑 <code>${key}</code>\n`;
                    message += `📅 Expiration: ${data.expirationDate}\n`;
                    message += `📱 Type: ${data.type}\n`;
                    message += `📮 Device ID: ${data.zipCode || 'N/A'}\n`;
                    message += `⚡ Status: ${data.maintenance ? '🔧 Maintenance' : '✅ Active'}\n`;
                    message += `━━━━━━━━━━━━━━━\n\n`;
                }
                return bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
            }
            if (args.length < 2) {
                return bot.sendMessage(msg.chat.id, '⚠️ *Example Commands:*\n\n`/genkey 1dev 1days devid` - _1 Key 1 Dev_\n`/genkey alldev 1days` - _1 Key All Dev_', { parse_mode: 'Markdown' });
                    }

            const keyType = args[0].toLowerCase();
            const duration = args[1].toLowerCase();

            if (!['1dev', 'alldev'].includes(keyType)) {
                return bot.sendMessage(msg.chat.id, '❌ Invalid key type. Use "1dev" or "alldev"');
            }

            // Parse duration (e.g., "1day", "2days", "3days")
            const timeMatch = duration.match(/^(\d+)(day|days)$/);
            if (!timeMatch) {
                return bot.sendMessage(msg.chat.id, '❌ Invalid duration format. Use: 1day, 2days, 3days');
            }

            const amount = parseInt(timeMatch[1]);
            if (amount <= 0) {
                return bot.sendMessage(msg.chat.id, '❌ Duration must be at least 1 day');
            }

            if (keyType === '1dev' && !args[2]) {
                return bot.sendMessage(msg.chat.id, '❌ Device ID is required for 1dev keys');
            }

            const expirationDate = moment().add(amount, 'days').format('YYYY-MM-DD');
            const randomHex = require('crypto').randomBytes(16).toString('hex');
            const apiKey = `@ZenoOnTop-${randomHex}`;

            const config = require('../../config.json');
            const adminUsername = 'ForVipUsers';
            const keyFilePath = path.join(__dirname, '../../USERPANEL', `${adminUsername}.json`);

            let keysData = {};
            if (fs.existsSync(keyFilePath)) {
                keysData = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
            }

            keysData[apiKey] = {
                expirationDate,
                zipCode: keyType === '1dev' ? args[2] : '',
                maintenance: false,
                type: keyType === '1dev' ? '1 Key 1 Dev' : '1 Key All Dev'
            };

            fs.writeFileSync(keyFilePath, JSON.stringify(keysData, null, 2));

            // Message with only days
            const message = `
✅ <b>API Key Generated!</b>

📅 <b>Expiration:</b> ${expirationDate}
📱 <b>Type:</b> ${keyType === '1dev' ? '1 Key 1 Dev' : '1 Key All Dev'}
${keyType === '1dev' ? `📱 <b>Device ID:</b> <code>${args[2]}</code>` : ''}
⏰ <b>Duration:</b> ${amount} ${amount > 1 ? 'days' : 'day'}
👤 <b>Generated by:</b> @${msg.from.username || 'Unknown'}

<b>Key:</b> <code>${apiKey}</code>
`;

            await bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });

        } catch (error) {
            console.error('Error in genkey command:', error);
            await bot.sendMessage(msg.chat.id, '❌ An error occurred while processing the command.');
        }
    }
};