const axios = require('axios');

module.exports = {
  eurix: {
    name: "tiksearch",
    description: "Search TikTok videos",
    permission: "all",
    usage: "/tiksearch [query]"
  },

  execute: async function(bot, msg, args) {
    if (!args.length) {
      return bot.sendMessage(msg.chat.id, "Please provide a search keyword.\nExample: /tiksearch codm");
    }

    const keyword = args.join(" ");
    try {
      const response = await axios.get(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(keyword)}`);

      if (!response.data || !response.data.data || !Array.isArray(response.data.data.videos)) {
        return bot.sendMessage(msg.chat.id, "No videos found for this keyword.");
      }

      let messageText = "🎵 Choose a video from this list:\n\n";
      const videos = response.data.data.videos.slice(0, 10); // Limit to 10 videos

      videos.forEach((video, index) => {
        messageText += `${index + 1}. ${video.title || 'No title'}\n`;
        messageText += `👤 Author: @${video.author?.unique_id || 'unknown'}\n`;
        messageText += `📝 Nickname: ${video.author?.nickname || 'unknown'}\n`;
        messageText += `❤️ ${video.digg_count || 0} 💬 ${video.comment_count || 0}\n`;
        messageText += `🕒 Duration: ${video.duration || 0}s\n\n`;
      });

      messageText += "\nReply with the number (1-10) to get the video.";

      // Store video data and message IDs in temporary storage
      global.tikTokSearchResults = global.tikTokSearchResults || {};
      global.tikTokSearchResults[msg.chat.id] = videos;

      global.tikTokSearchMessageIds = global.tikTokSearchMessageIds || {};
      const sentMessage = await bot.sendMessage(msg.chat.id, messageText);
      global.tikTokSearchMessageIds[msg.chat.id] = sentMessage.message_id;

    } catch (error) {
      console.error("TikTok search error:", error);
      await bot.sendMessage(msg.chat.id, "Error searching TikTok videos. Please try again later.");
    }
  }
};