
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const config = require('../../config.json');

const bot = new TelegramBot(config.token, { polling: false });

async function sendShoti() {
  try {
    const response = await axios.get("https://shoti.fbbot.org/api/get-shoti");
    if (!response.data || !response.data.result || !response.data.result.content) {
      console.error("Invalid response from Shoti API");
      return;
    }

    const { result: videoData } = response.data;
    const { user } = videoData;

    const caption = 
      "*🎀 Auto Shoti Video Every 30 minutes*\n\n" +
      `*📌 Username:* [${user.username}](https://tiktok.com/@${user.username})\n` +
      `*🏷 Nickname:* ${user.nickname}\n` +
      `*📷 Instagram:* ${user.instagram ? `[${user.instagram}](https://instagram.com/${user.instagram})` : 'N/A'}\n` +
      `*🌍 Region:* ${videoData.region}\n` +
      `*⏳ Duration:* ${videoData.duration} ms\n` +
      `*🏆 Shoti Score:* ${videoData.shoti_score}\n` +
      `*🆔 Shoti ID:* \`${videoData.shoti_id}\`\n\n` +
      `*💠 Owner:* [@ZenoOnTop](https://t.me/ZenoOnTop)`;

    // Get all admin chat IDs from config
    const adminChatIds = config.admin;

    for (const chatId of adminChatIds) {
      await bot.sendVideo(chatId, videoData.content, {
        caption,
        parse_mode: 'Markdown'
      });
    }

    console.log("Shoti sent successfully");
  } catch (error) {
    console.error("Error sending shoti:", error.message);
  }
}

module.exports = sendShoti;
