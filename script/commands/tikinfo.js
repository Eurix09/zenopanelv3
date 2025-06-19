const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = {
  eurix: {
    name: "tikinfo",
    description: "Get information about a TikTok user",
    usage: "/tikinfo [username]",
  },

  execute: async (bot, msg, args) => {
    try {
      const chatId = msg.chat.id;
      const username = args.join(" ").trim();

      if (!username) {
        return bot.sendMessage(
          chatId,
          "❌ Please enter a TikTok username.\nUsage: `/tikinfo <username>`",
          { parse_mode: "Markdown" }
        );
      }

      // API request
      const { data } = await axios.get(`https://tikwm.com/api/user/info?unique_id=${username}`);

      if (!data || data.code !== 0 || !data.data || !data.data.user) {
        return bot.sendMessage(chatId, "❌ Error: Unable to fetch user details.");
      }

      const userInfo = data.data.user;
      const stats = data.data.stats || {};

      const { id, uniqueId, nickname, avatarLarger, signature, secUid } = userInfo;
      const { followerCount = 0, followingCount = 0, heartCount = 0, videoCount = 0 } = stats;

      // Ensure cache directory exists
      const cacheDir = path.join(__dirname, "cache");
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const avatarPath = path.join(cacheDir, `${id}.png`);
      const getAvatar = await axios.get(avatarLarger, { responseType: 'arraybuffer' });

      fs.writeFileSync(avatarPath, Buffer.from(getAvatar.data, 'binary'));

      bot.sendPhoto(chatId, fs.createReadStream(avatarPath), {
        caption: `📌 *TikTok User Information*\n\n👤 *Username:* ${uniqueId}\n🏷️ *Nickname:* ${nickname}\n🆔 *ID:* ${id}\n🔑 *Sec UID:* ${secUid}\n📝 *Bio:* ${signature || "No bio available"}\n📹 *Videos:* ${videoCount}\n👥 *Followers:* ${followerCount}\n🔄 *Following:* ${followingCount}\n❤️ *Likes:* ${heartCount}`,
        parse_mode: "Markdown",
      });

      // Delete cached avatar after sending the photo
      setTimeout(() => {
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }, 5000);

    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, `❌ An error occurred while fetching TikTok information.\n\nError: ${error.message}`);
    }
  }
};