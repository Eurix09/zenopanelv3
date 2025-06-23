const path = require('path');
const fs = require('fs');
const axios = require('axios');

module.exports = {
  eurix: {
    name: "tikinfo",
    description: "Get information about a TikTok user",
    usage: "/tikinfo [username]",
  },

  execute: async (bot, msg, args) => {
    const chatId = msg.chat.id; // ✅ Fixed missing variable

    try {
      const username = args.join(" ");
      if (!username) {
        return bot.sendMessage(chatId, "Please enter a TikTok username.");
      }

      const apiUrl = `https://tiktokstalk.onrender.com/tikstalk?username=${encodeURIComponent(username)}`;
      const response = await axios.get(apiUrl);

      if (!response.data || !response.data.username) {
        return bot.sendMessage(chatId, "Could not fetch data for the specified user.");
      }

      const { id, nickname, username: user, avatarLarger: avatar, followerCount, followingCount, heartCount } = response.data;

      const filePath = path.join(__dirname, `/cache/${id}.png`);
      const avatarResponse = await axios.get(avatar, { responseType: 'arraybuffer' });
      fs.writeFileSync(filePath, Buffer.from(avatarResponse.data, 'binary'));

      const caption = `📱 TikTok Information

👤 Username: ${user}
📛 Nickname: ${nickname}
🆔 ID: ${id}
👥 Followers: ${followerCount}
🔄 Following: ${followingCount}
❤️ Hearts: ${heartCount}`;

      await bot.sendPhoto(chatId, fs.createReadStream(filePath), { caption });

    } catch (error) {
      console.error("Error fetching TikTok data:", error);
      bot.sendMessage(chatId, "❌ An error occurred while fetching the TikTok information.");
    }
  }
};
