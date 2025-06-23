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
    try {
      const username = args.join(" ");
      if (!username) {
        return bot.sendMessage(chatId, "Please enter a Tiktok username.");
      }

      const response = await axios.get(`https://eurix-api.replit.app/tikstalk?username=${username}`);
      const id = response.data.id;
      const nickname = response.data.nickname;
      const user = response.data.username;
      const avatar = response.data.avatarLarger;
      const follower = response.data.followerCount;
      const following = response.data.followingCount;
      const heart = response.data.heartCount;

      const title = path.join(__dirname, `/cache/${id}.png`);

      const getAvatar = await axios.get(avatar, { responseType: 'arraybuffer' });

      fs.writeFileSync(title, Buffer.from(getAvatar.data, 'binary'));

      bot.sendPhoto(chatId, fs.createReadStream(title), { caption: `Tiktok Information\n\nUsername: ${user}\nNickname: ${nickname}\nId: ${id}\nFollower: ${follower}\nFollowing: ${following}\nHeart: ${heart}`});
    } catch (error) {
      bot.sendMessage(chatId, `An error occurred while fetching the Tiktok information.\n${error}`);
      console.log(error);
    }
  }
};
